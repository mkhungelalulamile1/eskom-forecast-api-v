import os
import sys
import io
import json
import numpy as np
import pandas as pd
import xgboost as xgb

# config.py and app.py live in src/, a sibling of this training/ folder; add
# it to sys.path so this resolves whether training.py is imported (e.g. by
# function_app.py, which already adds both dirs) or run directly as a script.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))
from config import Config
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import weather
from additional_features import build_origin_features

def compute_smape(y_true: np.ndarray, y_pred: np.ndarray, weights: np.ndarray = None) -> float:
    """
    Computes weighted Symmetric Mean Absolute Percentage Error (SMAPE).

    Parameters
    ----------
    y_true : np.ndarray
        Ground-truth target values.
    y_pred : np.ndarray
        Predicted target values, aligned with `y_true`.
    weights : np.ndarray, optional
        Per-sample weights for the average. If not provided, an unweighted
        mean is returned.

    Returns
    -------
    float
        The (optionally weighted) SMAPE, as a percentage.
    """
    denominator = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    denominator = np.where(denominator == 0, 1e-8, denominator)
    smape_elements = 100.0 * np.abs(y_true - y_pred) / denominator
    if weights is not None:
        return float(np.average(smape_elements, weights=weights))
    return float(np.mean(smape_elements))

def ensure_target_column(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    """
    Synthesizes `target_col` ('Input' or 'Replenishment') from a bare
    'value' column when the raw data doesn't already have it -- e.g.
    generate_mock_data.py's local/demo bronze data, which only has
    entity_id/event_date/value, unlike real bronze data from ingest.py
    (always has both Input and Replenishment as independent SQL
    aggregates). 'Input' becomes 'value' directly; anything else
    ('Replenishment') becomes 'value' * 0.9, an arbitrary placeholder ratio
    -- fine for exercising the pipeline against mock data, but never fires
    against real bronze data since that already has both columns.

    Shared between prepare_training_dataset() (which needs this for its own
    stacked features) and any caller that works from the raw bronze frame
    directly (e.g. compute_entity_target_encoding() in train_models()) --
    both must synthesize the SAME way, or a caller reading raw `df` without
    this applied will KeyError on a column that only ever existed inside
    prepare_training_dataset()'s own internal copy.

    Parameters
    ----------
    df : pd.DataFrame
        Raw (unstacked) bronze-shaped data.
    target_col : str
        The target column to ensure is present ('Input' or 'Replenishment').

    Returns
    -------
    pd.DataFrame
        `df` with `target_col` guaranteed present if 'value' was available
        (a copy if a column was added; the original object otherwise -- do
        not rely on in-place mutation).
    """
    if target_col not in df.columns and "value" in df.columns:
        df = df.copy()
        if target_col.lower() == "input":
            df[target_col] = df["value"]
        else:
            df[target_col] = df["value"] * 0.9
    return df


def compute_recency_weights(origin_dates: pd.Series, max_date: pd.Timestamp, lambda_val: float = 0.003) -> np.ndarray:
    """
    Computes temporal recency weights: w_t = e^(-lambda * (T - t)).

    Parameters
    ----------
    origin_dates : pd.Series
        The origin date for each training row.
    max_date : pd.Timestamp
        The most recent date in the dataset (T), used as the reference point.
    lambda_val : float, optional
        Decay rate. Higher values weight recent rows more heavily relative
        to older ones (default 0.003, a ~231-day half-life).

    Returns
    -------
    np.ndarray
        Recency weight for each row, in (0, 1].
    """
    delta_days = (max_date - origin_dates).dt.days
    return np.exp(-lambda_val * delta_days)


ENTITY_ENCODING_SMOOTHING_K = 10.0


def compute_entity_target_encoding(df: pd.DataFrame, target_col: str, smoothing_k: float = ENTITY_ENCODING_SMOOTHING_K) -> dict:
    """
    Computes a smoothed per-entity target-mean encoding for `target_col`
    ('Input' or 'Replenishment'): a single number per station summarizing its
    typical level, blended toward the global mean for stations with little
    history so a noisy few-row mean doesn't dominate.

        encoded_entity = (n_entity * mean_entity + k * mean_global) / (n_entity + k)

    As k -> 0 this approaches the raw per-entity mean; as k -> inf it
    approaches the global mean regardless of the entity's own data.

    This is computed ONCE, separately from prepare_training_dataset(), and
    the resulting entity_id -> value mapping is simply joined onto the
    stacked training rows (train_models()) and, later, onto the stacked
    inference rows (app.py's convert_df_to_stack()) via the persisted JSON
    artifact -- inference never recomputes this, only looks it up (see
    save_model_artifact()/load_entity_encoding() in app.py).

    Callers should pass only the training-eligible rows (e.g. bronze data
    already filtered to event_date <= TRAIN_CUTOFF_DATE) so the encoding
    reflects only information available at training time and not the
    held-out out-of-time (OOT) sample. Rows used for the offline train/val
    split inside train_models() are NOT excluded here, so the validation
    fold's own target values contribute (mildly) to its entity encoding --
    a small, accepted amount of leakage into the reported validation
    metrics, traded for keeping this a single standalone step rather than
    threading a train/val boundary through prepare_training_dataset().

    Parameters
    ----------
    df : pd.DataFrame
        Raw (unstacked) bronze-shaped data with 'entity_id' and
        `target_col` columns -- e.g. the same df passed into
        prepare_training_dataset(), optionally pre-filtered by date.
    target_col : str
        The target column to encode against ('Input' or 'Replenishment').
    smoothing_k : float, optional
        Smoothing strength (default `ENTITY_ENCODING_SMOOTHING_K`). Larger
        values shrink low-count entities harder toward the global mean.

    Returns
    -------
    dict
        Maps entity_id -> smoothed encoded value, plus a reserved
        "__global_mean__" key giving the unweighted global mean of
        `target_col` across all rows -- used as the fallback encoding for
        any entity_id not present in this map (e.g. a station with no
        history at training time, encountered later at inference).
    """
    global_mean = float(df[target_col].mean())

    stats = df.groupby("entity_id")[target_col].agg(["mean", "count"])
    encoding = {
        entity: float((row["count"] * row["mean"] + smoothing_k * global_mean) / (row["count"] + smoothing_k))
        for entity, row in stats.iterrows()
    }
    encoding["__global_mean__"] = global_mean
    return encoding


VALID_WEIGHTING_MODES = ("weighted", "unweighted")


def prepare_training_dataset(df: pd.DataFrame, horizon: int, target_col: str, max_overlap: int = 10,
                              weather_edges_by_entity: dict = None, weighting: str = "weighted") -> tuple:
    """
    Prepares stacked features, targets, and weights for XGBoost training.

    Parameters
    ----------
    df : pd.DataFrame
        The raw input dataframe with historical records. Must contain
        'entity_id', 'event_date', and numeric feature columns.
    horizon : int
        The forecasting horizon steps to generate targets for.
    target_col : str
        The target column to predict ('Input' or 'Replenishment').
    max_overlap : int, optional
        The maximum overlap (in steps) allowed between consecutive training
        origins per entity; controls the stride used when sampling origins
        (default is 10).
    weather_edges_by_entity : dict, optional
        Maps entity_id -> fixed quintile bin edges (from
        weather.compute_quantile_edges()) for that station's
        temp_max_c/temp_min_c/humidity_pct. If not provided, edges are computed
        fresh per entity from this call's own date span -- callers training
        multiple targets on the same horizon should compute edges once per
        entity and pass them in, so all targets (and later inference) bucket
        each station's weather consistently.
    weighting : str, optional
        'weighted' (default) applies the recency weights described below.
        'unweighted' assigns every row an equal weight of 1.0 instead --
        skips compute_recency_weights() entirely, so training and evaluation
        metrics treat all history equally regardless of how old it is. Same
        shape/dtype either way, so every downstream consumer (model.fit's
        sample_weight, the metrics functions) works unchanged.

    Returns
    -------
    X : pd.DataFrame
        Stacked training features.
    y : np.ndarray
        Historical future target values.
    w : np.ndarray
        Recency weights (or, if weighting='unweighted', an array of 1.0s).
    entity_ids : np.ndarray
        Entity id aligned to each row of X/y/w.
    target_dates : pd.Series
        The predicted event_date for each row of X/y/w (i.e. the date of the
        target value), used for out-of-time splitting.

    Raises
    ------
    ValueError
        If no entity has enough history to generate at least one training
        row for the requested horizon, or if `weighting` is not one of
        VALID_WEIGHTING_MODES.

    Examples
    --------
    >>> import pandas as pd
    >>> df = pd.DataFrame({
    ...     "entity_id": ["entity_1"] * 400,
    ...     "event_date": pd.date_range("2025-01-01", periods=400),
    ...     "value": range(400)
    ... })
    >>> X, y, w, entity_ids, target_dates = prepare_training_dataset(df, horizon=90, target_col="Input")
    >>> print(X.shape, y.shape, w.shape, entity_ids.shape, target_dates.shape)
    """
    if weighting not in VALID_WEIGHTING_MODES:
        raise ValueError(f"weighting must be one of {VALID_WEIGHTING_MODES}, got {weighting!r}")

    from app import fill_time_series_gaps, LAG_STEPS, ROLLING_WINDOWS
    df = fill_time_series_gaps(df)
    df = ensure_target_column(df, target_col)

    # Find overall maximum date for weight calculation
    max_date = df["event_date"].max()

    entities = df["entity_id"].unique()

    # Origin-anchored bridge onto additionalfeatures/feature_store and
    # additionalfeatures/feature_experiments: one feature row per
    # (entity_id, event_date), built once up front since every historical
    # date is a candidate origin below (unlike inference, which only stacks
    # from the single latest date). Looked up per origin by (entity_id,
    # origin_date) -- never joined on the target's own event_date, which
    # would leak it; see additional_features.py's module docstring. Grain
    # is decided once for the whole df on the same logic used per-entity
    # below, since
    # prepare_training_dataset is always called with a single bronze fetch
    # (daily xor monthly, never mixed). Requires Input/Replenishment by name
    # (feature_store's contract); ensure_target_column() above only
    # synthesizes whichever single target_col was requested, so mock/demo
    # data (entity_id/event_date/value only) never has both at once and
    # origin features are skipped for it -- real bronze data always has both.
    origin_feature_cols = []
    origin_features_by_entity_date = {}
    if {"Input", "Replenishment"}.issubset(df.columns):
        grain = "daily"
        date_deltas = df.sort_values("event_date")["event_date"].diff().dropna().dt.days
        if not date_deltas.empty and date_deltas.median() >= 27:
            grain = "monthly"
        origin_features_table = build_origin_features(df, grain=grain)
        origin_feature_cols = [
            c for c in origin_features_table.columns
            if c not in ("entity_id", "event_date")
        ]
        origin_features_by_entity_date = {
            (row.entity_id, row.event_date): row._asdict()
            for row in origin_features_table.itertuples(index=False)
        }
    empty_origin_features = {col: np.nan for col in origin_feature_cols}

    # Weather/season features are known/forecastable per target date, so fetch
    # each station's own weather once for the whole span (including horizon
    # headroom for the last origins' target dates) and look it up directly
    # rather than lagging it like numeric_cols below. Continuous weather
    # columns are bucketed into per-station quintiles using fixed edges
    # (computed once per horizon and reused across targets/inference).
    weather_by_entity_date = {
        entity: weather.weather_features_by_date(
            df["event_date"].min(), max_date + pd.Timedelta(days=horizon * 31),
            entity_id=entity,
            edges=(weather_edges_by_entity or {}).get(entity),
        )
        for entity in entities
    }
    numeric_cols = [c for c in df.columns if c not in ["entity_id", "event_date", "Input", "Replenishment"]]
    
    X_list = []
    y_list = []
    w_list = []
    entity_id_list = []
    target_date_list = []

    for entity in entities:
        entity_history = df[df["entity_id"] == entity].sort_values("event_date").reset_index(drop=True)
        n_records = len(entity_history)
        weather_by_date = weather_by_entity_date[entity]
        
        # Determine frequency (daily vs monthly)
        is_monthly = False
        if n_records > 1:
            median_delta = (entity_history["event_date"].diff()).median().days
            if median_delta >= 27:
                is_monthly = True
                
        min_history_len = 15 if is_monthly else 365
        if n_records <= min_history_len + horizon:
            continue
            
        # Select candidate origin indexes working backwards from the latest index
        # to guarantee the inclusion of the most recent training data.
        stride = max(1, horizon - max_overlap)
        latest_origin = n_records - horizon - 1
        candidate_origins = []
        curr = latest_origin
        while curr >= min_history_len:
            candidate_origins.append(curr)
            curr -= stride
        candidate_origins.reverse()
            
        for origin_idx in candidate_origins:
            origin_date = entity_history.loc[origin_idx, "event_date"]

            # Origin-anchored feature_store/feature_experiments features for
            # this origin, looked up once per origin (not per horizon step --
            # every horizon row for this origin shares the same values,
            # mirroring lag_features below).
            origin_row = origin_features_by_entity_date.get(
                (entity, origin_date), empty_origin_features
            )
            origin_features = {
                col: origin_row[col] for col in origin_feature_cols
            }

            # Lag features relative to the origin index
            lag_features = {}
            for col in numeric_cols:
                for lag in LAG_STEPS:
                    val = np.nan
                    target_idx = origin_idx - (lag - 1)
                    if 0 <= target_idx < n_records:
                        val = entity_history.loc[target_idx, col]
                    lag_features[f"{col}_lag_{lag}"] = val

                # Rolling averages
                for window in ROLLING_WINDOWS:
                    start_idx = max(0, origin_idx - window + 1)
                    lag_features[f"{col}_roll_mean_{window}"] = entity_history.loc[start_idx:origin_idx, col].mean()
            
            # For each step in the horizon
            for h in range(1, horizon + 1):
                target_idx = origin_idx + h
                target_val = entity_history.loc[target_idx, target_col]
                target_date = entity_history.loc[target_idx, "event_date"]

                target_timestamp = pd.Timestamp(target_date)
                record = {
                    "horizon_step": h,
                    "is_weekend": int(target_timestamp.dayofweek >= 5),
                    "month_of_year": target_timestamp.month,
                    "week_of_year": target_timestamp.isocalendar().week,
                }
                record.update(lag_features)
                record.update(origin_features)
                record.update(weather_by_date.get(
                    target_timestamp.normalize(),
                    {col: np.nan for col in weather.WEATHER_FEATURE_COLS},
                ))

                X_list.append(record)
                y_list.append(target_val)
                w_list.append(origin_date)
                entity_id_list.append(entity)
                target_date_list.append(target_date)

    if not X_list:
        raise ValueError(f"Insufficient history to generate training dataset for {target_col}")

    X_df = pd.DataFrame(X_list)
    y_arr = np.array(y_list)
    entity_id_arr = np.array(entity_id_list)
    target_dates = pd.Series(target_date_list)

    # Calculate recency weights, unless 'unweighted' training was requested --
    # in which case every row gets an equal weight of 1.0 instead, so training
    # (sample_weight) and evaluation metrics treat all history the same
    # regardless of age.
    if weighting == "unweighted":
        w_arr = np.ones(len(y_list))
    else:
        w_series = pd.Series(w_list)
        w_arr = compute_recency_weights(w_series, max_date)

    return X_df, y_arr, w_arr, entity_id_arr, target_dates

# Training/OOT (out-of-time) split boundary: rows predicting dates on or before
# this cutoff are used for training; rows predicting dates after it are held out
# as an out-of-time test sample.
TRAIN_CUTOFF_DATE = pd.Timestamp("2024-12-31")


def cumulative_stockpile(daily_actual: np.ndarray, daily_pred: np.ndarray,
                          entity_ids: np.ndarray, target_dates: pd.Series) -> tuple:
    """
    Converts a per-row daily Stockpile delta (Replenishment - Input) into the
    cumulative running Stockpile total per entity, matching the definition
    used everywhere else in the app (ui.py's get_predictions_json,
    generate_oot_history()'s oot_history.parquet, and the Stockpile History
    chart) -- a running balance, not a raw daily net-flow figure.

    Rows are not necessarily in date order (e.g. a shuffled train_test_split
    validation fold), so this sorts by (entity_id, date) per entity before
    cumsum-ing, then restores the original row order so the result stays
    aligned with `entity_ids`/weights arrays used elsewhere in the caller.

    Parameters
    ----------
    daily_actual : np.ndarray
        Per-row actual daily Stockpile delta (Replenishment_actual - Input_actual).
    daily_pred : np.ndarray
        Per-row predicted daily Stockpile delta, aligned with `daily_actual`.
    entity_ids : np.ndarray
        Entity id aligned to each row.
    target_dates : pd.Series
        The target event_date for each row, aligned with `daily_actual`.

    Returns
    -------
    tuple
        (cumulative_actual, cumulative_pred), each an np.ndarray in the same
        row order as the inputs.
    """
    df = pd.DataFrame({
        "entity_id": entity_ids,
        "event_date": pd.Series(target_dates).reset_index(drop=True),
        "actual": daily_actual,
        "pred": daily_pred,
    })
    df["_orig_order"] = np.arange(len(df))
    df = df.sort_values(["entity_id", "event_date", "_orig_order"])
    df["cum_actual"] = df.groupby("entity_id")["actual"].cumsum()
    df["cum_pred"] = df.groupby("entity_id")["pred"].cumsum()
    df = df.sort_values("_orig_order")
    return df["cum_actual"].to_numpy(), df["cum_pred"].to_numpy()


def compute_nrmse(rmse: float, y_true: np.ndarray, weights: np.ndarray = None) -> float:
    """
    Computes Normalized RMSE: RMSE divided by the (optionally weighted) mean
    of |y_true|, expressing error relative to the typical magnitude of the
    actual values. Unlike SMAPE, this doesn't degenerate when actual/predicted
    straddle zero (e.g. a cumulative, signed quantity like Stockpile) -- the
    normalizer is a single scalar (mean magnitude), not a per-row denominator
    that can itself approach zero.

    Parameters
    ----------
    rmse : float
        Already-computed RMSE for the same rows as `y_true`.
    y_true : np.ndarray
        Ground-truth target values.
    weights : np.ndarray, optional
        Per-sample weights for the mean. If not provided, an unweighted mean is used.

    Returns
    -------
    float
        RMSE / mean(|y_true|). NaN if the mean magnitude is zero.
    """
    mean_abs_actual = np.average(np.abs(y_true), weights=weights) if weights is not None else np.mean(np.abs(y_true))
    if mean_abs_actual == 0:
        return float("nan")
    return float(rmse / mean_abs_actual)


def compute_per_entity_metrics(horizon_label: str, target: str, entity_ids_val: np.ndarray,
                                y_val: np.ndarray, val_preds: np.ndarray, w_val: np.ndarray) -> pd.DataFrame:
    """
    Computes RMSE, MAE, SMAPE, R-squared, and NRMSE per entity_id for a
    single (horizon, target) validation split.

    SMAPE is only meaningful for non-negative quantities -- Input and
    Replenishment are physical masses and always >=0, but Stockpile (a
    cumulative sum of Replenishment - Input) is signed and legitimately
    crosses zero. Every row where actual and predicted land on opposite
    sides of zero drives SMAPE to exactly its 200% ceiling regardless of how
    close the prediction actually is, which inflates Stockpile's average
    SMAPE independent of real accuracy. For target == 'Stockpile', 'smape'
    is NaN and R2 is reported in its place as the meaningful accuracy signal.

    Parameters
    ----------
    horizon_label : str
        Label identifying the horizon/split (e.g. 'tactical', 'tactical_oot').
    target : str
        The target column these predictions are for ('Input', 'Replenishment',
        or 'Stockpile').
    entity_ids_val : np.ndarray
        Entity id aligned to each row of `y_val`/`val_preds`/`w_val`.
    y_val : np.ndarray
        Ground-truth target values for the validation split.
    val_preds : np.ndarray
        Predicted target values, aligned with `y_val`.
    w_val : np.ndarray
        Per-row recency weights, aligned with `y_val`.

    Returns
    -------
    pd.DataFrame
        One row per entity_id, with columns 'horizon', 'target', 'entity_id',
        'rmse', 'mae', 'smape', 'r2', and 'nrmse'. 'r2' is NaN where undefined
        (fewer than 2 samples, or a zero-variance target). 'smape' is always
        NaN for target == 'Stockpile' (see above).
    """
    rows = []
    for entity in np.unique(entity_ids_val):
        mask = entity_ids_val == entity
        y_e = y_val[mask]
        pred_e = val_preds[mask]
        w_e = w_val[mask]

        # R2 is undefined for fewer than 2 samples or zero-variance targets; fall back to NaN.
        try:
            r2 = float(r2_score(y_e, pred_e, sample_weight=w_e)) if len(y_e) >= 2 else np.nan
        except ValueError:
            r2 = np.nan

        rmse = float(np.sqrt(mean_squared_error(y_e, pred_e, sample_weight=w_e)))

        rows.append({
            "horizon": horizon_label,
            "target": target,
            "entity_id": entity,
            "rmse": rmse,
            "mae": float(mean_absolute_error(y_e, pred_e, sample_weight=w_e)),
            "smape": float(compute_smape(y_e, pred_e, weights=w_e)) if target != "Stockpile" else float("nan"),
            "r2": r2,
            "nrmse": compute_nrmse(rmse, y_e, weights=w_e),
        })
    return pd.DataFrame(rows)


# Per-horizon-step metrics (compute_per_horizon_step_metrics below) are
# restricted to the first N horizon steps -- near-term steps are what users
# actually drill into, and every additional step multiplies row count by
# (entities x horizons x targets), so this keeps that table's data small
# without truncating the entity-level Model Accuracy table above.
HORIZON_STEP_METRICS_LIMIT = 15


def compute_per_horizon_step_metrics(horizon_label: str, target: str, entity_ids_val: np.ndarray,
                                      horizon_steps_val: np.ndarray, y_val: np.ndarray,
                                      val_preds: np.ndarray, w_val: np.ndarray) -> pd.DataFrame:
    """
    Computes RMSE, MAE, SMAPE, R-squared, and NRMSE per (entity_id,
    horizon_step) for a single (horizon, target) validation split --
    structurally the same metrics as compute_per_entity_metrics(), just
    grouped one level finer (by horizon_step within each entity) so a
    consumer can see how accuracy degrades further out in the forecast
    horizon for one station at a time. Restricted to horizon_step <=
    HORIZON_STEP_METRICS_LIMIT to keep row count bounded (see that
    constant's docstring).

    See compute_per_entity_metrics() for the SMAPE-vs-Stockpile caveat
    (identical here: 'smape' is NaN for target == 'Stockpile', R2 shown in
    its place).

    Parameters
    ----------
    horizon_label : str
        Label identifying the horizon/split (e.g. 'tactical', 'tactical_oot').
    target : str
        The target column these predictions are for ('Input', 'Replenishment',
        or 'Stockpile').
    entity_ids_val : np.ndarray
        Entity id aligned to each row of `y_val`/`val_preds`/`w_val`.
    horizon_steps_val : np.ndarray
        Horizon step (1-indexed) aligned to each row of `y_val`/`val_preds`/`w_val`.
    y_val : np.ndarray
        Ground-truth target values for the validation split.
    val_preds : np.ndarray
        Predicted target values, aligned with `y_val`.
    w_val : np.ndarray
        Per-row recency weights, aligned with `y_val`.

    Returns
    -------
    pd.DataFrame
        One row per (entity_id, horizon_step) with horizon_step <=
        HORIZON_STEP_METRICS_LIMIT, with columns 'horizon', 'target',
        'entity_id', 'horizon_step', 'rmse', 'mae', 'smape', 'r2', and
        'nrmse'. 'r2' is NaN where undefined (fewer than 2 samples, or a
        zero-variance target). 'smape' is always NaN for target ==
        'Stockpile'.
    """
    horizon_steps_val = np.asarray(horizon_steps_val)
    in_range = horizon_steps_val <= HORIZON_STEP_METRICS_LIMIT

    rows = []
    entity_ids_in_range = entity_ids_val[in_range]
    steps_in_range = horizon_steps_val[in_range]
    y_in_range = y_val[in_range]
    pred_in_range = val_preds[in_range]
    w_in_range = w_val[in_range]

    pairs = {(e, s) for e, s in zip(entity_ids_in_range, steps_in_range)}
    for entity, step in sorted(pairs, key=lambda es: (str(es[0]), es[1])):
        mask = (entity_ids_in_range == entity) & (steps_in_range == step)
        y_e = y_in_range[mask]
        pred_e = pred_in_range[mask]
        w_e = w_in_range[mask]

        try:
            r2 = float(r2_score(y_e, pred_e, sample_weight=w_e)) if len(y_e) >= 2 else np.nan
        except ValueError:
            r2 = np.nan

        rmse = float(np.sqrt(mean_squared_error(y_e, pred_e, sample_weight=w_e)))

        rows.append({
            "horizon": horizon_label,
            "target": target,
            "entity_id": entity,
            "horizon_step": int(step),
            "rmse": rmse,
            "mae": float(mean_absolute_error(y_e, pred_e, sample_weight=w_e)),
            "smape": float(compute_smape(y_e, pred_e, weights=w_e)) if target != "Stockpile" else float("nan"),
            "r2": r2,
            "nrmse": compute_nrmse(rmse, y_e, weights=w_e),
        })
    return pd.DataFrame(rows)


def compute_residual_metrics(horizon_label: str, input_metrics: pd.DataFrame,
                              input_errors: dict, replenishment_errors: dict) -> pd.DataFrame:
    """
    Derives per-entity Residual RMSE from the Input and Replenishment validation errors
    (error = actual - predicted), since Residual has no dedicated trained model.

    Input and Replenishment are trained/validated independently (separate train_test_split
    calls), so their per-entity error arrays are not row-aligned. To combine them, each is
    reduced to a per-entity mean error before differencing, rather than differencing
    individual rows.

    Parameters
    ----------
    horizon_label : str
        Label identifying the horizon/split (e.g. 'tactical').
    input_metrics : pd.DataFrame
        Per-entity metrics for the 'Input' target (as returned by
        compute_per_entity_metrics()), used only for its set of entity_ids.
    input_errors : dict
        Maps entity_id -> array of signed validation errors (actual -
        predicted) for the 'Input' target.
    replenishment_errors : dict
        Maps entity_id -> array of signed validation errors (actual -
        predicted) for the 'Replenishment' target.

    Returns
    -------
    pd.DataFrame
        One row per entity_id present in both `input_errors` and
        `replenishment_errors`, with columns 'horizon', 'target' (always
        'Residual'), 'entity_id', 'rmse', 'mae', 'smape' (NaN), 'r2' (NaN),
        and 'nrmse' (NaN).
    """
    rows = []
    for entity in input_metrics["entity_id"].unique():
        if entity not in input_errors or entity not in replenishment_errors:
            continue
        input_mean_error = np.mean(input_errors[entity])
        replenishment_mean_error = np.mean(replenishment_errors[entity])
        diff = input_mean_error - replenishment_mean_error
        rows.append({
            "horizon": horizon_label,
            "target": "Residual",
            "entity_id": entity,
            "rmse": float(np.sqrt(diff ** 2)),
            "mae": float(np.abs(diff)),
            "smape": np.nan,
            "r2": np.nan,
            "nrmse": np.nan,
        })
    return pd.DataFrame(rows)


def _read_existing_metrics_blob(blob_name: str, config: Config) -> pd.DataFrame:
    """
    Best-effort read of a previously-saved metrics/OOT-history parquet
    (Azure first, then local fallback), returning an empty DataFrame if
    neither exists yet or reading fails for any reason (e.g. first-ever
    training run). Used only by _merge_replacing_weighting() below to avoid
    clobbering the other weighting mode's rows on save.
    """
    if config.has_storage_access():
        try:
            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.metrics_container, blob=blob_name)
            stream = io.BytesIO()
            blob_client.download_blob().readinto(stream)
            stream.seek(0)
            return pd.read_parquet(stream)
        except Exception:
            pass

    local_path = os.path.join(config.local_metrics_dir, blob_name)
    if os.path.exists(local_path):
        try:
            return pd.read_parquet(local_path)
        except Exception:
            pass

    return pd.DataFrame()


def _merge_replacing_weighting(new_df: pd.DataFrame, blob_name: str, weighting: str, config: Config) -> pd.DataFrame:
    """
    Merges this run's freshly-computed rows (already tagged with a
    'weighting' column) into whatever was previously saved at `blob_name`,
    replacing only that same weighting mode's old rows -- the other mode's
    rows (if any) are kept as-is, since save_metrics()/save_metrics_by_step()/
    save_oot_history() overwrite the destination file wholesale rather than
    appending. Without this, training with weighting='unweighted' after a
    prior weighting='weighted' run (or vice versa) would silently erase the
    other mode's saved results instead of letting both be compared side by
    side, defeating the point of tagging rows by weighting mode at all.

    Existing rows saved before this 'weighting' column existed have no such
    column (NaN after the union below); they're treated as belonging to
    'weighted' (the long-standing default) so they aren't silently dropped
    on the first run after upgrading.
    """
    existing_df = _read_existing_metrics_blob(blob_name, config)
    if existing_df.empty:
        return new_df

    if "weighting" not in existing_df.columns:
        existing_df["weighting"] = "weighted"
    else:
        existing_df["weighting"] = existing_df["weighting"].fillna("weighted")

    kept_existing = existing_df[existing_df["weighting"] != weighting]
    if kept_existing.empty:
        return new_df
    return pd.concat([kept_existing, new_df], ignore_index=True)


def save_metrics(metrics_df: pd.DataFrame, config: Config) -> None:
    """
    Saves the per-dimension, per-entity metrics DataFrame to the Metrics container in Parquet format.

    Parameters
    ----------
    metrics_df : pd.DataFrame
        Combined per-entity metrics across all horizons/targets (as produced
        by compute_per_entity_metrics()/compute_residual_metrics()).
    config : Config
        The configuration object with storage connection details.

    Returns
    -------
    None
        Writes to Azure Blob Storage if storage access is configured
        (falling back to local disk on failure), otherwise writes locally.
    """
    output_blob_name = "model_metrics.parquet"

    if config.has_storage_access():
        try:
            out_stream = io.BytesIO()
            metrics_df.to_parquet(out_stream, index=False)
            out_stream.seek(0)

            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.metrics_container, blob=output_blob_name)
            blob_client.upload_blob(out_stream.getvalue(), overwrite=True)
            print(f"Metrics successfully written to Metrics Storage: {config.metrics_container}/{output_blob_name}")
            return
        except Exception as e:
            print(f"Error uploading metrics to Metrics Storage: {e}. Saving locally.")

    # Save locally as fallback
    os.makedirs(config.local_metrics_dir, exist_ok=True)
    local_out_path = os.path.join(config.local_metrics_dir, output_blob_name)
    metrics_df.to_parquet(local_out_path, index=False)
    print(f"Metrics successfully written locally to: {local_out_path}")


def save_metrics_by_step(metrics_by_step_df: pd.DataFrame, config: Config) -> None:
    """
    Saves the per-(entity, horizon_step) metrics DataFrame (see
    compute_per_horizon_step_metrics()) to the Metrics container in Parquet
    format, as a file separate from model_metrics.parquet -- this table has
    far more rows (entities x horizon_steps x horizons x targets) than the
    entity-level table, so keeping it in its own file/endpoint means
    consumers of the small per-entity table (e.g. the main Model Accuracy
    UI) never pay for the larger payload.

    Parameters
    ----------
    metrics_by_step_df : pd.DataFrame
        Combined per-(entity, horizon_step) metrics across all
        horizons/targets (as produced by compute_per_horizon_step_metrics()).
    config : Config
        The configuration object with storage connection details.

    Returns
    -------
    None
        Writes to Azure Blob Storage if storage access is configured
        (falling back to local disk on failure), otherwise writes locally.
    """
    output_blob_name = "model_metrics_by_step.parquet"

    if config.has_storage_access():
        try:
            out_stream = io.BytesIO()
            metrics_by_step_df.to_parquet(out_stream, index=False)
            out_stream.seek(0)

            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.metrics_container, blob=output_blob_name)
            blob_client.upload_blob(out_stream.getvalue(), overwrite=True)
            print(f"Per-horizon-step metrics successfully written to Metrics Storage: {config.metrics_container}/{output_blob_name}")
            return
        except Exception as e:
            print(f"Error uploading per-horizon-step metrics to Metrics Storage: {e}. Saving locally.")

    # Save locally as fallback
    os.makedirs(config.local_metrics_dir, exist_ok=True)
    local_out_path = os.path.join(config.local_metrics_dir, output_blob_name)
    metrics_by_step_df.to_parquet(local_out_path, index=False)
    print(f"Per-horizon-step metrics successfully written locally to: {local_out_path}")


def save_model_artifact(local_path: str, blob_name: str, config: Config) -> None:
    """
    Uploads a local model artifact (or weather-edges JSON) to the Models
    container in Azure Blob Storage, so it reaches the deployed Function
    App's inference path (Prediction_runner.load_models() / app.
    load_weather_edges()).

    NOT called automatically by train_models() -- promoting a freshly
    trained model to production is a deliberate decision made only after
    reviewing its evaluation/OOT metrics (see deploy_models_to_azure()
    below), not an automatic side effect of running training locally.

    Parameters
    ----------
    local_path : str
        Path to the local file to upload.
    blob_name : str
        Destination blob name within the Models container.
    config : Config
        The configuration object with storage connection details.

    Returns
    -------
    None
        Uploads to Azure Blob Storage if storage access is configured;
        otherwise logs and returns without error. Upload failures are logged
        but do not raise, since the local file remains available either way.
    """
    if not config.has_storage_access():
        print(f"No Azure Storage access configured; {blob_name} stays local-only ({local_path}).")
        return

    try:
        with open(local_path, "rb") as f:
            data = f.read()

        blob_service_client = config.get_blob_service_client()
        container_client = blob_service_client.get_container_client("models")
        if not container_client.exists():
            container_client.create_container()

        blob_client = blob_service_client.get_blob_client(container="models", blob=blob_name)
        blob_client.upload_blob(data, overwrite=True)
        print(f"Uploaded {blob_name} to Models Storage.")
    except Exception as e:
        print(f"Error uploading {blob_name} to Models Storage: {e}. It remains available locally at {local_path}.")


def deploy_models_to_azure(horizon_keys: list = None, weighting: str = "weighted") -> None:
    """
    Promotes the CURRENTLY SAVED LOCAL model artifacts (and their weather
    quintile edges) to production, by uploading them to the Models
    container in Azure Blob Storage; re-uploads the locally-saved
    model_metrics.parquet alongside them (so the Model Accuracy table
    reflects whatever's currently live even if the training run that
    produced it happened without AZURE_STORAGE_CONNECTION_STRING set); then
    immediately refreshes oot_history.parquet by scoring the newly-promoted
    models (see generate_oot_history()).

    This is a deliberate, human-triggered promotion step -- run it only
    after training.train_models() has produced local models and you've
    reviewed their evaluation/OOT metrics (data/metrics/model_metrics.parquet)
    and decided the new models should replace what's currently live. It is
    never called automatically.

    Model training is human-in-the-loop by design, and OOT history reflects
    "how well do the models currently live in production perform" -- so it
    must only ever change as a direct consequence of THIS promotion step,
    never independently. generate_oot_history() is deliberately not exposed
    as its own standalone action (no HTTP route, no schedule) for this
    reason; it is only ever called from here, immediately after a successful
    upload, so the two can never drift out of sync.

    Parameters
    ----------
    horizon_keys : list, optional
        Which horizons to promote ('tactical', 'strategic', or both).
        Defaults to both.
    weighting : str, optional
        Which locally-trained variant to promote: 'weighted' (default) or
        'unweighted' (see train_models()). Only one variant is ever live in
        production at a time -- both are promoted to the SAME fixed Azure
        blob names inference already reads (e.g. tactical_input_model.json),
        so Prediction_runner/generate_oot_history() need no weighting
        concept of their own; whichever variant was promoted last is simply
        what's live. The '_unweighted' filename suffix only exists locally,
        to let both variants coexist on disk before you choose one to promote.

    Returns
    -------
    None

    Raises
    ------
    RuntimeError
        If `AZURE_STORAGE_CONNECTION_STRING` is not configured, or if
        `weighting` is not one of VALID_WEIGHTING_MODES.

    Examples
    --------
    >>> # After reviewing metrics and deciding to promote both horizons:
    >>> from training import deploy_models_to_azure
    >>> deploy_models_to_azure()
    >>> # Or promote only one horizon:
    >>> deploy_models_to_azure(["tactical"])
    >>> # Or promote the unweighted variant instead:
    >>> deploy_models_to_azure(weighting="unweighted")
    """
    if weighting not in VALID_WEIGHTING_MODES:
        raise ValueError(f"weighting must be one of {VALID_WEIGHTING_MODES}, got {weighting!r}")

    config = Config()
    if not config.has_storage_access():
        raise RuntimeError(
            "No Azure Storage access configured. Set AZURE_STORAGE_ACCOUNT_URL "
            "(managed identity) or AZURE_STORAGE_CONNECTION_STRING to the target "
            "environment's storage before promoting models."
        )

    model_suffix = "" if weighting == "weighted" else "_unweighted"

    for horizon_key in (horizon_keys or ["tactical", "strategic"]):
        # Weather edges and entity target-encoding aren't weighting-dependent
        # (they don't use sample weights), so they have no _unweighted
        # variant -- only the model files themselves do. Source (local)
        # filename varies by weighting; destination (Azure) blob name is
        # always the unsuffixed production name, since only one variant is
        # ever live at a time.
        artifacts = [
            (f"{horizon_key}_weather_edges.json", f"{horizon_key}_weather_edges.json"),
            (f"{horizon_key}_input_entity_encoding.json", f"{horizon_key}_input_entity_encoding.json"),
            (f"{horizon_key}_replenishment_entity_encoding.json", f"{horizon_key}_replenishment_entity_encoding.json"),
            (f"{horizon_key}_input_model{model_suffix}.json", f"{horizon_key}_input_model.json"),
            (f"{horizon_key}_replenishment_model{model_suffix}.json", f"{horizon_key}_replenishment_model.json"),
        ]
        for local_blob_name, remote_blob_name in artifacts:
            local_path = os.path.join(config.local_models_dir, local_blob_name)
            if not os.path.exists(local_path):
                print(f"Skipping {remote_blob_name}: no local file at {local_path}.")
                continue
            save_model_artifact(local_path, remote_blob_name, config)

    # Re-upload model_metrics.parquet alongside the promoted models, so the
    # Model Accuracy table always reflects whatever is currently live, even
    # if the train_models() run that produced these local models ran without
    # AZURE_STORAGE_CONNECTION_STRING set (metrics would then only exist
    # locally, not in Azure, despite the models themselves now being promoted).
    local_metrics_path = os.path.join(config.local_metrics_dir, "model_metrics.parquet")
    if os.path.exists(local_metrics_path):
        save_metrics(pd.read_parquet(local_metrics_path), config)
    else:
        print(f"Skipping metrics upload: no local file at {local_metrics_path}.")

    local_metrics_by_step_path = os.path.join(config.local_metrics_dir, "model_metrics_by_step.parquet")
    if os.path.exists(local_metrics_by_step_path):
        save_metrics_by_step(pd.read_parquet(local_metrics_by_step_path), config)
    else:
        print(f"Skipping per-horizon-step metrics upload: no local file at {local_metrics_by_step_path}.")

    print("Model promotion complete. Refreshing OOT history against the newly-deployed models...")
    generate_oot_history()


def save_oot_history(oot_history_df: pd.DataFrame, config: Config) -> None:
    """
    Saves the per-date, per-entity OOT actual-vs-predicted history (Input,
    Replenishment, and derived Stockpile) to the Metrics container in Parquet
    format. Backs the dashboard's Stockpile History chart.

    Parameters
    ----------
    oot_history_df : pd.DataFrame
        Per-date, per-entity OOT actual/predicted history across all
        horizons (as assembled in train_models()/generate_oot_history()).
    config : Config
        The configuration object with storage connection details.

    Returns
    -------
    None
        Writes to Azure Blob Storage if storage access is configured
        (falling back to local disk on failure), otherwise writes locally.
    """
    output_blob_name = "oot_history.parquet"

    if config.has_storage_access():
        try:
            out_stream = io.BytesIO()
            oot_history_df.to_parquet(out_stream, index=False)
            out_stream.seek(0)

            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.metrics_container, blob=output_blob_name)
            blob_client.upload_blob(out_stream.getvalue(), overwrite=True)
            print(f"OOT history successfully written to Metrics Storage: {config.metrics_container}/{output_blob_name}")
            return
        except Exception as e:
            print(f"Error uploading OOT history to Metrics Storage: {e}. Saving locally.")

    # Save locally as fallback
    os.makedirs(config.local_metrics_dir, exist_ok=True)
    local_out_path = os.path.join(config.local_metrics_dir, output_blob_name)
    oot_history_df.to_parquet(local_out_path, index=False)
    print(f"OOT history successfully written locally to: {local_out_path}")


def generate_oot_history() -> None:
    """
    Populates oot_history.parquet by scoring the CURRENTLY DEPLOYED models
    against bronze data, without retraining.

    Model training (train_models()) is human-in-the-loop and infrequent (run
    every few months): a human runs it locally, reviews the evaluation/OOT
    metrics, and only THEN decides to promote the result via
    deploy_models_to_azure(). OOT history must track that same cadence --
    it reflects "how well do the models CURRENTLY LIVE in production
    perform", so it must only change when a new model is deployed, never on
    its own schedule. deploy_models_to_azure() calls this function itself
    immediately after a successful promotion, precisely so the two can never
    drift out of sync; this function is intentionally NOT wired into any
    HTTP route, ADF trigger, or other independent schedule.

    Mechanically: rebuilds the OOT feature rows straight from bronze (actual
    values require no model at all) and scores them with the currently
    deployed model artifacts via Prediction_runner.load_models() (loaded,
    never re-fit) -- so this never touches or risks the live model artifacts
    themselves.

    Parameters
    ----------
    None

    Returns
    -------
    None
        Saves the assembled OOT history via save_oot_history() if any rows
        were generated; otherwise logs and returns without error.
    """
    from app import (
        Prediction_runner, fetch_data_from_bronze_storage, load_weather_edges,
        load_entity_encoding, apply_entity_target_encoding,
    )

    config = Config()

    all_oot_history = []
    horizons = [
        ("tactical", "Tactical Daily", "daily", 90),
        ("strategic", "Strategic Monthly", "monthly", 36),
    ]

    for horizon_key, horizon_label, bronze_horizon_type, horizon_steps in horizons:
        print(f"Loading {horizon_key} Bronze data for OOT history backfill...")
        try:
            df = fetch_data_from_bronze_storage(config, bronze_horizon_type)

            try:
                weather_edges_by_entity = load_weather_edges(horizon_key, config)
            except Exception as e:
                print(f"No saved weather edges available for {horizon_key} ({e}); skipping.")
                continue

            runner = Prediction_runner(horizon_key, config)
            runner.load_models()
            if all(model is None for model in runner.models.values()):
                print(f"No deployed models found for {horizon_key}; skipping.")
                continue

            oot_by_target = {}
            for target in ["Input", "Replenishment"]:
                var = target.lower()
                model = runner.models.get(var)
                if model is None:
                    print(f"No deployed {horizon_key} model for {target}; skipping {target}.")
                    continue

                X, y, _, entity_ids, target_dates = prepare_training_dataset(
                    df, horizon=horizon_steps, target_col=target, max_overlap=10,
                    weather_edges_by_entity=weather_edges_by_entity,
                )

                # Join the deployed model's own frozen entity target encoding
                # (a lookup, not a recalculation -- see
                # apply_entity_target_encoding()) so X's feature set matches
                # what the deployed model was actually trained on.
                try:
                    entity_encoding = load_entity_encoding(horizon_key, target, config)
                except Exception as e:
                    print(f"No saved entity encoding available for {horizon_key}/{target} ({e}); skipping.")
                    continue
                X["entity_target_enc"] = apply_entity_target_encoding(entity_ids, entity_encoding)

                is_oot = (target_dates > TRAIN_CUTOFF_DATE).to_numpy()
                if not is_oot.any():
                    print(f"No out-of-time rows found after {TRAIN_CUTOFF_DATE.date()} for {horizon_label} - {target}.")
                    continue

                X_oot, y_oot, entity_ids_oot = X[is_oot], y[is_oot], entity_ids[is_oot]
                target_dates_oot = target_dates[is_oot].reset_index(drop=True)
                oot_preds = model.predict(X_oot)

                oot_by_target[target] = pd.DataFrame({
                    "entity_id": entity_ids_oot,
                    "event_date": target_dates_oot,
                    f"{target}_actual": y_oot,
                    f"{target}_predicted": oot_preds,
                })

            if "Input" in oot_by_target and "Replenishment" in oot_by_target:
                oot_merged = pd.merge(
                    oot_by_target["Input"], oot_by_target["Replenishment"],
                    on=["entity_id", "event_date"], how="inner",
                )
                oot_merged = oot_merged.sort_values(["entity_id", "event_date"])
                oot_merged["Stockpile_actual"] = (
                    oot_merged["Replenishment_actual"] - oot_merged["Input_actual"]
                ).groupby(oot_merged["entity_id"]).cumsum()
                oot_merged["Stockpile_predicted"] = (
                    oot_merged["Replenishment_predicted"] - oot_merged["Input_predicted"]
                ).groupby(oot_merged["entity_id"]).cumsum()
                oot_merged["horizon"] = horizon_key
                oot_merged["event_date"] = pd.to_datetime(oot_merged["event_date"]).dt.strftime("%Y-%m-%d")
                all_oot_history.append(oot_merged)
        except Exception as e:
            print(f"Failed to backfill OOT history for {horizon_key}: {e}")

    if all_oot_history:
        oot_history_df = pd.concat(all_oot_history, ignore_index=True)
        save_oot_history(oot_history_df, config)
    else:
        print("No OOT history was generated; skipping OOT history save.")


def train_models(weighting: str = "weighted") -> None:
    """
    Loads raw bronze data, prepares training datasets using Weighted Stacking,
    trains XGBoost models with recency weights, saves model artifacts to models/,
    and saves per-entity accuracy metrics (RMSE/MAE/SMAPE) to the metrics store.

    Saves models and weather quintile edges to local disk only (see
    deploy_models_to_azure() for the separate, deliberate step that promotes
    them to production).

    Parameters
    ----------
    weighting : str, optional
        'weighted' (default) trains with recency-weighted rows (see
        compute_recency_weights()). 'unweighted' trains with every row
        weighted equally instead (see prepare_training_dataset()), so the
        two can be trained and compared side by side. Local model filenames
        are suffixed with '_unweighted' when weighting='unweighted' (e.g.
        tactical_input_model_unweighted.json), so both variants can coexist
        locally without overwriting each other; the 'weighted' filenames are
        unchanged from before this parameter existed. Every row saved to the
        metrics store (model_metrics.parquet, model_metrics_by_step.parquet,
        oot_history.parquet) is tagged with a 'weighting' column so results
        from both modes can be told apart and compared in the same file.

    Returns
    -------
    None
    """
    if weighting not in VALID_WEIGHTING_MODES:
        raise ValueError(f"weighting must be one of {VALID_WEIGHTING_MODES}, got {weighting!r}")

    from app import fetch_data_from_bronze_storage, apply_entity_target_encoding

    config = Config()
    os.makedirs(config.local_models_dir, exist_ok=True)
    model_suffix = "" if weighting == "weighted" else "_unweighted"

    all_metrics = []
    all_metrics_by_step = []
    all_oot_history = []

    horizons = [
        ("tactical", "Tactical Daily", "daily", 90),
        ("strategic", "Strategic Monthly", "monthly", 36),
    ]

    for horizon_key, horizon_label, bronze_horizon_type, horizon_steps in horizons:
        print(f"Loading {horizon_key} Bronze data for training...")
        try:
            df = fetch_data_from_bronze_storage(config, bronze_horizon_type)
            errors_by_target = {}
            metrics_by_target = {}
            oot_by_target = {}

            # Compute quintile bin edges for temp_max_c/temp_min_c/humidity_pct once
            # per (horizon, entity) -- each power station has its own weather
            # distribution, so a "top fifth" bucket must be relative to that
            # station's own history, not a shared/default location's. Computed
            # once here and reused for every target and saved for inference to match.
            weather_edges_by_entity = {}
            for entity in df["entity_id"].unique():
                weather_features = weather.get_weather_features(
                    df["event_date"].min().strftime("%Y-%m-%d"),
                    (df["event_date"].max() + pd.Timedelta(days=horizon_steps * 31)).strftime("%Y-%m-%d"),
                    entity_id=entity,
                )
                weather_edges_by_entity[entity] = weather.compute_quantile_edges(weather_features)
            edges_path = os.path.join(config.local_models_dir, f"{horizon_key}_weather_edges.json")
            with open(edges_path, "w") as f:
                json.dump(weather_edges_by_entity, f)
            print(f"Saved {horizon_key} weather quintile edges: {edges_path}")

            # Row-alignment indices (train/val split, OOT mask) computed once from
            # Input's stacked rows and reused for Replenishment below, so both
            # targets' validation/OOT rows correspond to the exact same
            # (entity, origin_date, horizon_step) combinations. This is what
            # makes a row-aligned Stockpile = Replenishment - Input metric
            # possible -- prepare_training_dataset() produces structurally
            # identical rows regardless of target_col (only y differs), so
            # reusing one split's indices for the other is exact, not approximate.
            split_indices = None
            val_preds_by_target = {}
            oot_preds_by_target = {}
            val_actuals_by_target = {}
            oot_actuals_by_target = {}
            val_weights_by_target = {}
            oot_weights_by_target = {}
            val_entity_ids = None
            oot_entity_ids = None
            val_target_dates = None
            oot_target_dates = None
            val_horizon_steps = None
            oot_horizon_steps = None

            for target in ["Input", "Replenishment"]:
                print(f"Training {horizon_key} model for {target}...")
                X, y, w, entity_ids, target_dates = prepare_training_dataset(
                    df, horizon=horizon_steps, target_col=target, max_overlap=10,
                    weather_edges_by_entity=weather_edges_by_entity, weighting=weighting,
                )

                # Per-entity target-mean encoding, computed separately from the
                # stacked features above (raw bronze rows on/before the OOT
                # cutoff only, so the held-out OOT sample never contributes)
                # and simply joined onto X by entity_id -- see
                # compute_entity_target_encoding()/apply_entity_target_encoding()
                # for why this is a plain lookup here, not a recalculation.
                # Saved alongside the model so inference applies the exact
                # same frozen mapping (see app.py's load_entity_encoding()).
                entity_encoding = compute_entity_target_encoding(
                    ensure_target_column(df[df["event_date"] <= TRAIN_CUTOFF_DATE], target), target_col=target,
                )
                X["entity_target_enc"] = apply_entity_target_encoding(entity_ids, entity_encoding)
                encoding_path = os.path.join(
                    config.local_models_dir, f"{horizon_key}_{target.lower()}_entity_encoding.json"
                )
                with open(encoding_path, "w") as f:
                    json.dump(entity_encoding, f)
                print(f"Saved {horizon_key} {target} entity target encoding: {encoding_path}")

                # Out-of-time (OOT) split: only rows predicting dates on/before the cutoff
                # are eligible for training; everything after is held out as OOT test data.
                is_train_pool = (target_dates <= TRAIN_CUTOFF_DATE).to_numpy()
                X_pool, y_pool, w_pool, entity_ids_pool = X[is_train_pool], y[is_train_pool], w[is_train_pool].to_numpy(), entity_ids[is_train_pool]
                X_oot, y_oot, w_oot, entity_ids_oot = X[~is_train_pool], y[~is_train_pool], w[~is_train_pool].to_numpy(), entity_ids[~is_train_pool]
                target_dates_pool = target_dates[is_train_pool].reset_index(drop=True)
                target_dates_oot = target_dates[~is_train_pool].reset_index(drop=True)

                if split_indices is None:
                    # Split the training pool for offline (in-time) model evaluation.
                    # Stratify by entity_id so every power station contributes to both
                    # folds -- a plain random split can otherwise leave low-row-count
                    # entities (e.g. the monthly horizon, or short bronze history) with
                    # zero validation rows, silently dropping them from the per-entity
                    # metrics table. Stratification requires every class (entity) to
                    # have at least 2 members; fall back to an unstratified split for
                    # the rare pool where that doesn't hold. Computed once (from
                    # Input) and reused for Replenishment so both targets validate on
                    # the exact same rows.
                    entity_counts = pd.Series(entity_ids_pool).value_counts()
                    can_stratify = (entity_counts >= 2).all()
                    pool_idx = np.arange(len(X_pool))
                    train_idx, val_idx = train_test_split(
                        pool_idx, test_size=0.2, random_state=42,
                        stratify=entity_ids_pool if can_stratify else None
                    )
                    split_indices = (train_idx, val_idx)
                    val_entity_ids = entity_ids_pool[val_idx]
                    oot_entity_ids = entity_ids_oot
                    val_target_dates = target_dates_pool.iloc[val_idx].reset_index(drop=True)
                    oot_target_dates = target_dates_oot
                    # horizon_step is a stacked feature column, identical in
                    # meaning (and, given the shared split/OOT mask above,
                    # row-aligned) regardless of target_col -- computed once
                    # from Input and reused for Replenishment/Stockpile below,
                    # same as val_entity_ids/oot_entity_ids.
                    val_horizon_steps = X_pool["horizon_step"].to_numpy()[val_idx]
                    oot_horizon_steps = X_oot["horizon_step"].to_numpy()

                train_idx, val_idx = split_indices
                if len(X_pool) != len(val_entity_ids) + len(train_idx):
                    raise ValueError(
                        f"Row count mismatch between targets for {horizon_key}: expected "
                        f"prepare_training_dataset() to produce the same rows regardless of "
                        f"target_col, but got {len(X_pool)} rows for '{target}' vs. "
                        f"{len(train_idx) + len(val_idx)} rows used for the shared split. "
                        f"Cannot safely align Stockpile metrics."
                    )
                X_train, X_val, y_train, y_val, w_train, w_val = (
                    X_pool.iloc[train_idx], X_pool.iloc[val_idx],
                    y_pool[train_idx], y_pool[val_idx], w_pool[train_idx], w_pool[val_idx],
                )
                entity_ids_val = entity_ids_pool[val_idx]
                if not np.array_equal(entity_ids_val, val_entity_ids):
                    raise ValueError(
                        f"Row alignment mismatch between targets for {horizon_key}/{target}: "
                        f"entity_ids at the shared validation indices don't match Input's. "
                        f"Cannot safely align Stockpile metrics."
                    )

                # Fit temporary model for evaluation
                eval_model = xgb.XGBRegressor(n_estimators=50, max_depth=5, learning_rate=0.1)
                eval_model.fit(X_train, y_train, sample_weight=w_train)

                val_preds = eval_model.predict(X_val)
                val_mae = mean_absolute_error(y_val, val_preds, sample_weight=w_val)
                val_rmse = np.sqrt(mean_squared_error(y_val, val_preds, sample_weight=w_val))
                val_r2 = r2_score(y_val, val_preds, sample_weight=w_val)
                val_smape = compute_smape(y_val, val_preds, weights=w_val)

                print(f"--- Evaluation Metrics ({horizon_label} - {target}) ---")
                print(f"  Validation MAE:   {val_mae:.4f}")
                print(f"  Validation RMSE:  {val_rmse:.4f}")
                print(f"  Validation R2:    {val_r2:.4f}")
                print(f"  Validation SMAPE: {val_smape:.2f}%\n")

                # Per-entity metrics for this (horizon, target)
                target_metrics = compute_per_entity_metrics(horizon_key, target, entity_ids_val, y_val, val_preds, w_val)
                metrics_by_target[target] = target_metrics
                all_metrics.append(target_metrics)

                # Per-(entity, horizon_step) metrics for the same validation split
                target_metrics_by_step = compute_per_horizon_step_metrics(
                    horizon_key, target, entity_ids_val, val_horizon_steps, y_val, val_preds, w_val
                )
                all_metrics_by_step.append(target_metrics_by_step)

                # Keep per-entity signed errors (actual - predicted) to derive Residual metrics later
                errors_by_target[target] = {
                    entity: (y_val[entity_ids_val == entity] - val_preds[entity_ids_val == entity])
                    for entity in np.unique(entity_ids_val)
                }

                # Row-aligned validation actual/predicted, kept for the Stockpile metric below.
                val_actuals_by_target[target] = y_val
                val_preds_by_target[target] = val_preds
                val_weights_by_target[target] = w_val

                # Out-of-time evaluation: score the eval model against the held-out
                # post-cutoff sample to report genuine forward-looking performance.
                if len(y_oot) > 0:
                    if not np.array_equal(entity_ids_oot, oot_entity_ids):
                        raise ValueError(
                            f"OOT row alignment mismatch between targets for {horizon_key}/{target}: "
                            f"entity_ids don't match Input's OOT rows. Cannot safely align Stockpile metrics."
                        )
                    oot_preds = eval_model.predict(X_oot)
                    oot_mae = mean_absolute_error(y_oot, oot_preds, sample_weight=w_oot)
                    oot_rmse = np.sqrt(mean_squared_error(y_oot, oot_preds, sample_weight=w_oot))
                    oot_smape = compute_smape(y_oot, oot_preds, weights=w_oot)

                    print(f"--- Out-of-Time Metrics ({horizon_label} - {target}, post-{TRAIN_CUTOFF_DATE.date()}) ---")
                    print(f"  OOT MAE:   {oot_mae:.4f}")
                    print(f"  OOT RMSE:  {oot_rmse:.4f}")
                    print(f"  OOT SMAPE: {oot_smape:.2f}%\n")

                    oot_metrics = compute_per_entity_metrics(f"{horizon_key}_oot", target, entity_ids_oot, y_oot, oot_preds, w_oot)
                    all_metrics.append(oot_metrics)

                    oot_metrics_by_step = compute_per_horizon_step_metrics(
                        f"{horizon_key}_oot", target, entity_ids_oot, oot_horizon_steps, y_oot, oot_preds, w_oot
                    )
                    all_metrics_by_step.append(oot_metrics_by_step)

                    # Row-aligned OOT actual/predicted, kept for the Stockpile metric below.
                    oot_actuals_by_target[target] = y_oot
                    oot_preds_by_target[target] = oot_preds
                    oot_weights_by_target[target] = w_oot

                    # Per-date actual vs. predicted OOT records, kept for the
                    # Stockpile History chart (see save_oot_history below).
                    oot_by_target[target] = pd.DataFrame({
                        "entity_id": entity_ids_oot,
                        "event_date": target_dates_oot,
                        f"{target}_actual": y_oot,
                        f"{target}_predicted": oot_preds,
                    })
                else:
                    print(f"No out-of-time samples found after {TRAIN_CUTOFF_DATE.date()} for {horizon_label} - {target}.")

                # Train final model on 100% of the training pool (up to the cutoff)
                model = xgb.XGBRegressor(n_estimators=50, max_depth=7, learning_rate=0.1)
                model.fit(X_pool, y_pool, sample_weight=w_pool)

                model_path = os.path.join(config.local_models_dir, f"{horizon_key}_{target.lower()}_model{model_suffix}.json")
                model.save_model(model_path)
                print(f"Saved {horizon_key} model ({weighting}): {model_path}")

            # Stockpile = cumulative(Replenishment - Input), scored on the
            # row-aligned validation (and, separately, OOT) splits computed
            # above. Must match ui.py's / the OOT-history derivation's
            # definition of Stockpile (a running cumulative total, not a raw
            # daily delta) -- otherwise the Model Accuracy table's Stockpile
            # row scores a different, smaller-magnitude quantity than what
            # the Stockpile History chart actually plots, producing
            # inconsistent-looking numbers between the two.
            if "Input" in val_preds_by_target and "Replenishment" in val_preds_by_target:
                stockpile_val_actual, stockpile_val_pred = cumulative_stockpile(
                    val_actuals_by_target["Replenishment"] - val_actuals_by_target["Input"],
                    val_preds_by_target["Replenishment"] - val_preds_by_target["Input"],
                    val_entity_ids, val_target_dates,
                )
                stockpile_val_metrics = compute_per_entity_metrics(
                    horizon_key, "Stockpile", val_entity_ids,
                    stockpile_val_actual, stockpile_val_pred, val_weights_by_target["Input"],
                )
                all_metrics.append(stockpile_val_metrics)

                stockpile_val_metrics_by_step = compute_per_horizon_step_metrics(
                    horizon_key, "Stockpile", val_entity_ids, val_horizon_steps,
                    stockpile_val_actual, stockpile_val_pred, val_weights_by_target["Input"],
                )
                all_metrics_by_step.append(stockpile_val_metrics_by_step)

            if "Input" in oot_preds_by_target and "Replenishment" in oot_preds_by_target:
                stockpile_oot_actual, stockpile_oot_pred = cumulative_stockpile(
                    oot_actuals_by_target["Replenishment"] - oot_actuals_by_target["Input"],
                    oot_preds_by_target["Replenishment"] - oot_preds_by_target["Input"],
                    oot_entity_ids, oot_target_dates,
                )
                stockpile_oot_metrics = compute_per_entity_metrics(
                    f"{horizon_key}_oot", "Stockpile", oot_entity_ids,
                    stockpile_oot_actual, stockpile_oot_pred, oot_weights_by_target["Input"],
                )
                all_metrics.append(stockpile_oot_metrics)

                stockpile_oot_metrics_by_step = compute_per_horizon_step_metrics(
                    f"{horizon_key}_oot", "Stockpile", oot_entity_ids, oot_horizon_steps,
                    stockpile_oot_actual, stockpile_oot_pred, oot_weights_by_target["Input"],
                )
                all_metrics_by_step.append(stockpile_oot_metrics_by_step)

            # Derive Residual metrics from the aligned Input/Replenishment validation errors
            if "Input" in errors_by_target and "Replenishment" in errors_by_target:
                residual_metrics = compute_residual_metrics(
                    horizon_key, metrics_by_target["Input"], errors_by_target["Input"], errors_by_target["Replenishment"]
                )
                all_metrics.append(residual_metrics)

            # Derive OOT Stockpile actual/predicted as a cumulative sum of
            # (Replenishment - Input), mirroring ui.py's forecast-data Stockpile
            # derivation, applied to the held-out OOT sample instead.
            if "Input" in oot_by_target and "Replenishment" in oot_by_target:
                oot_merged = pd.merge(
                    oot_by_target["Input"], oot_by_target["Replenishment"],
                    on=["entity_id", "event_date"], how="inner",
                )
                oot_merged = oot_merged.sort_values(["entity_id", "event_date"])
                oot_merged["Stockpile_actual"] = (
                    oot_merged["Replenishment_actual"] - oot_merged["Input_actual"]
                ).groupby(oot_merged["entity_id"]).cumsum()
                oot_merged["Stockpile_predicted"] = (
                    oot_merged["Replenishment_predicted"] - oot_merged["Input_predicted"]
                ).groupby(oot_merged["entity_id"]).cumsum()
                oot_merged["horizon"] = horizon_key
                oot_merged["event_date"] = pd.to_datetime(oot_merged["event_date"]).dt.strftime("%Y-%m-%d")
                all_oot_history.append(oot_merged)
        except Exception as e:
            print(f"Failed to train {horizon_key} models: {e}")

    if all_metrics:
        metrics_df = pd.concat(all_metrics, ignore_index=True)
        metrics_df["weighting"] = weighting
        save_metrics(_merge_replacing_weighting(metrics_df, "model_metrics.parquet", weighting, config), config)
    else:
        print("No metrics were generated; skipping metrics save.")

    if all_metrics_by_step:
        metrics_by_step_df = pd.concat(all_metrics_by_step, ignore_index=True)
        metrics_by_step_df["weighting"] = weighting
        save_metrics_by_step(
            _merge_replacing_weighting(metrics_by_step_df, "model_metrics_by_step.parquet", weighting, config), config
        )
    else:
        print("No per-horizon-step metrics were generated; skipping per-horizon-step metrics save.")

    if all_oot_history:
        oot_history_df = pd.concat(all_oot_history, ignore_index=True)
        oot_history_df["weighting"] = weighting
        save_oot_history(_merge_replacing_weighting(oot_history_df, "oot_history.parquet", weighting, config), config)
    else:
        print("No OOT history was generated; skipping OOT history save.")

if __name__ == "__main__":
    import sys

    # Pull a trailing "--weighting <mode>" pair out of argv, wherever it
    # appears, so it can be combined with either dispatch below (plain
    # `python training.py --weighting unweighted` to train, or
    # `python training.py deploy_models_to_azure tactical --weighting
    # unweighted` to promote a specific variant). Defaults to 'weighted' --
    # the pre-existing behavior -- if not passed.
    argv = sys.argv[1:]
    weighting_mode = "weighted"
    if "--weighting" in argv:
        flag_idx = argv.index("--weighting")
        try:
            weighting_mode = argv[flag_idx + 1]
        except IndexError:
            raise SystemExit("--weighting requires a value: 'weighted' or 'unweighted'")
        if weighting_mode not in VALID_WEIGHTING_MODES:
            raise SystemExit(f"--weighting must be one of {VALID_WEIGHTING_MODES}, got {weighting_mode!r}")
        del argv[flag_idx:flag_idx + 2]

    # generate_oot_history() is intentionally NOT exposed here as its own
    # standalone command -- OOT history must only change as a direct
    # consequence of deploy_models_to_azure() promoting a model, never on
    # its own, so it's only ever called from inside that function.
    if len(argv) > 0 and argv[0] == "deploy_models_to_azure":
        deploy_models_to_azure(argv[1:] or None, weighting=weighting_mode)
    else:
        train_models(weighting=weighting_mode)
