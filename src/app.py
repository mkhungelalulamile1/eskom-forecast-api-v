import os
import io
import json
import pandas as pd
import numpy as np
import xgboost as xgb
from config import Config

# weather.py now lives in training/, a sibling of src/; add it to sys.path so
# this resolves whether app.py is imported (e.g. by function_app.py, which
# already adds both dirs) or run directly as a script.
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'training'))
import weather
from additional_features import build_origin_features

# Lag steps generated for every numeric_cols column: the full previous 30 daily
# time steps (1-30), plus a +/-7 day window around the year-ago mark (358-372)
# rather than a single lag_365, so the model sees the year-ago period instead
# of one exact day (robust to slight calendar drift/leap years). Shared between
# training.py and app.py so the trained model's feature set and inference's
# stacked feature set always match exactly.
LAG_STEPS = list(range(1, 31)) + list(range(358, 373))

# Rolling-mean windows generated alongside the lag steps.
ROLLING_WINDOWS = [7, 30]


def load_weather_edges(horizon_key: str, config: Config) -> dict:
    """
    Loads the fixed per-entity quintile bin edges saved by training.py for a
    given horizon ('tactical' or 'strategic'), so inference buckets each
    station's temp_max_c/temp_min_c/humidity_pct exactly the way the trained
    model expects. Returns a dict mapping entity_id -> edges.

    Tries Azure Blob Storage (Models container) first -- required for a
    deployed Function App instance, which has no local models/ directory of
    its own (gitignored, not part of the deploy package) -- falling back to
    local disk for local development.
    """
    blob_name = f"{horizon_key}_weather_edges.json"

    if config.has_storage_access():
        try:
            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container="models", blob=blob_name)
            stream = io.BytesIO()
            blob_client.download_blob().readinto(stream)
            stream.seek(0)
            return json.load(stream)
        except Exception as e:
            print(f"Could not load {blob_name} from Azure Storage: {e}. Trying local fallback.")

    edges_path = os.path.join(config.local_models_dir, blob_name)
    with open(edges_path, "r") as f:
        return json.load(f)


def load_entity_encoding(horizon_key: str, target: str, config: Config) -> dict:
    """
    Loads the smoothed per-entity target-mean encoding saved by
    training.py's compute_entity_target_encoding() for a given horizon
    ('tactical'/'strategic') and target ('Input'/'Replenishment'), so
    inference attaches each station's encoded value exactly as computed at
    training time -- this is a lookup only, never recomputed here. Returns a
    dict mapping entity_id -> encoded value, plus a "__global_mean__"
    fallback key (see compute_entity_target_encoding()).

    Tries Azure Blob Storage (Models container) first, falling back to
    local disk, same pattern as load_weather_edges().
    """
    blob_name = f"{horizon_key}_{target.lower()}_entity_encoding.json"

    if config.has_storage_access():
        try:
            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container="models", blob=blob_name)
            stream = io.BytesIO()
            blob_client.download_blob().readinto(stream)
            stream.seek(0)
            return json.load(stream)
        except Exception as e:
            print(f"Could not load {blob_name} from Azure Storage: {e}. Trying local fallback.")

    edges_path = os.path.join(config.local_models_dir, blob_name)
    with open(edges_path, "r") as f:
        return json.load(f)


def apply_entity_target_encoding(entity_ids, encoding: dict) -> np.ndarray:
    """
    Looks up each entity_id's precomputed target-mean encoding (see
    compute_entity_target_encoding() in training.py) -- a plain join, no
    calculation. Entities missing from `encoding` (e.g. a station with no
    history at training time) fall back to the map's own "__global_mean__".

    Parameters
    ----------
    entity_ids : array-like
        Entity id for each row to encode.
    encoding : dict
        entity_id -> encoded value, plus a "__global_mean__" fallback key,
        as returned by compute_entity_target_encoding()/load_entity_encoding().

    Returns
    -------
    np.ndarray
        Encoded value aligned to `entity_ids`.
    """
    fallback = encoding.get("__global_mean__", 0.0)
    return np.array([encoding.get(e, fallback) for e in entity_ids], dtype=float)


def fetch_data_from_bronze_storage(config: Config, horizon_type: str) -> pd.DataFrame:
    """
    Fetches raw time-series data from Azure Storage (Bronze) or local mock directory.

    Parameters:
    -----------
    config : Config
        The configuration object with storage connection details.
    horizon_type : str
        The type of horizon ('daily' or 'monthly').

    Returns:
    --------
    pd.DataFrame
        The loaded dataframe in Parquet format.
    """
    blob_name = f"{horizon_type}/input_data.parquet"
    
    if config.has_storage_access():
        try:
            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.bronze_container, blob=blob_name)
            
            # Download blob content as bytes and read as parquet
            stream = io.BytesIO()
            blob_client.download_blob().readinto(stream)
            stream.seek(0)
            print(f"Successfully loaded {blob_name} from Azure Bronze Container.")
            return pd.read_parquet(stream)
        except Exception as e:
            print(f"Error fetching from Azure Storage for {horizon_type}: {e}. Falling back to local directory.")
            
    # Fallback to local mock data file for development/testing
    local_path = os.path.join(config.local_bronze_dir, blob_name)
    if not os.path.exists(local_path):
        print(f"Bronze file {local_path} not found. Generating mock data for demo...")
        import generate_mock_data
        generate_mock_data.generate_mock_data(num_entities=config.num_entities, num_years=config.num_years)
        
    if os.path.exists(local_path):
        print(f"Loading local fallback parquet file: {local_path}")
        return pd.read_parquet(local_path)
    else:
        raise FileNotFoundError(f"No source data found for {horizon_type} in Azure Storage or locally at {local_path}")


def data_format_validation(df: pd.DataFrame, expected_entities: int = 15, expected_years: int = 20) -> bool:
    """
    Validates that the input dataframe has the required columns, non-empty records,
    and correct data types to prevent silent failures.

    Parameters:
    -----------
    df : pd.DataFrame
        The dataframe to validate.
    expected_entities : int
        The expected number of entities in the dataset.
    expected_years : int
        The expected number of years of historical data.

    Returns:
    --------
    bool
        True if the format is valid, otherwise raises ValueError.
    """
    if df is None or df.empty:
        raise ValueError("Dataframe is empty or None.")

    required_columns = ["entity_id", "event_date"]
    
    # Check that required columns are present
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' is missing from the input data.")
            
    # Validate event_date format
    try:
        df["event_date"] = pd.to_datetime(df["event_date"])
    except Exception as e:
        raise ValueError(f"Failed to parse 'event_date' as datetime: {e}")
        
    # Check assumptions (15 entities, 20 years of history)
    unique_entities = df["entity_id"].nunique()
    if unique_entities < expected_entities:
        print(f"Warning: Expected at least {expected_entities} entities, but found {unique_entities}.")
        
    min_date = df["event_date"].min()
    max_date = df["event_date"].max()
    span_years = (max_date - min_date).days / 365.25
    if span_years < expected_years:
        print(f"Warning: Expected at least {expected_years} years of history, but found {span_years:.2f} years.")

    print("Feature set validation passed successfully.")
    return True


def fill_time_series_gaps(df: pd.DataFrame) -> pd.DataFrame:
    """
    Checks for gaps in the time-series date sequence for each entity.

    Daily data:
        Uses daily frequency.

    Monthly data:
        Preserves the existing month-end convention used by the Bronze
        monthly dataset (e.g. 2025-01-31, 2025-02-28, 2025-03-31).

    Missing records inside an entity's historical range are forward-filled
    and backward-filled.

    Important:
        The function does NOT create records before an entity's first
        observation or after its last observation.
    """
    df = df.copy()

    if df.empty:
        return df

    # ---------------------------------------------------------
    # Basic validation
    # ---------------------------------------------------------
    required_columns = {"entity_id", "event_date"}

    missing_columns = required_columns - set(df.columns)

    if missing_columns:
        raise ValueError(
            f"fill_time_series_gaps() missing required columns: "
            f"{sorted(missing_columns)}"
        )

    df["event_date"] = pd.to_datetime(
        df["event_date"],
        errors="coerce",
    )

    if df["event_date"].isna().any():
        bad_rows = df[df["event_date"].isna()]

        raise ValueError(
            f"Invalid event_date values found in "
            f"{len(bad_rows)} rows."
        )

    cleaned_dfs = []

    # ---------------------------------------------------------
    # Process each entity independently
    # ---------------------------------------------------------
    for entity, group in df.groupby("entity_id", sort=False):

        group = (
            group
            .sort_values("event_date")
            .drop_duplicates(
                subset=["event_date"],
                keep="last",
            )
            .set_index("event_date")
        )

        if group.empty:
            continue

        # -----------------------------------------------------
        # Determine frequency
        # -----------------------------------------------------
        is_monthly = False

        if len(group) > 1:

            deltas = (
                pd.Series(group.index)
                .sort_values()
                .diff()
                .dropna()
                .dt.days
            )

            if not deltas.empty:
                median_delta = float(deltas.median())

                # Monthly data has a typical interval around 28-31 days.
                if median_delta >= 27:
                    is_monthly = True

        # -----------------------------------------------------
        # DAILY
        # -----------------------------------------------------
        if not is_monthly:

            full_range = pd.date_range(
                start=group.index.min(),
                end=group.index.max(),
                freq="D",
            )

        # -----------------------------------------------------
        # MONTHLY
        #
        # Your Bronze monthly dataset is month-end based:
        #
        # 2014-01-31
        # 2014-02-28
        # 2014-03-31
        # 2014-04-30
        #
        # Therefore use MonthEnd rather than MonthStart.
        # -----------------------------------------------------
        else:

            full_range = pd.date_range(
                start=group.index.min(),
                end=group.index.max(),
                freq="ME",
            )

        # -----------------------------------------------------
        # Detect actual gaps
        # -----------------------------------------------------
        missing_dates = full_range.difference(group.index)

        if not missing_dates.empty:

            # Don't print thousands of dates to the terminal.
            # Show the count and a small sample instead.
            sample = list(
                missing_dates
                .strftime("%Y-%m-%d")
            )[:10]

            print(
                f"INFO: Gaps detected for entity '{entity}'. "
                f"{len(missing_dates)} missing "
                f"{'monthly' if is_monthly else 'daily'} "
                f"records will be filled. "
                f"Sample: {sample}"
            )

        # -----------------------------------------------------
        # Reindex onto the correct frequency
        # -----------------------------------------------------
        reindexed = group.reindex(full_range)

        reindexed.index.name = "event_date"

        # -----------------------------------------------------
        # Restore entity_id
        # -----------------------------------------------------
        reindexed["entity_id"] = entity

        # -----------------------------------------------------
        # Fill missing values
        #
        # Forward fill first so an internal missing month/day
        # takes the most recent known value.
        #
        # Backward fill handles missing values at the beginning
        # of an entity's actual range.
        # -----------------------------------------------------
        value_columns = [
            column
            for column in reindexed.columns
            if column != "entity_id"
        ]

        if value_columns:
            reindexed[value_columns] = (
                reindexed[value_columns]
                .ffill()
                .bfill()
            )

        # -----------------------------------------------------
        # Restore normal dataframe structure
        # -----------------------------------------------------
        reindexed = reindexed.reset_index()

        cleaned_dfs.append(reindexed)

    # ---------------------------------------------------------
    # Nothing to concatenate
    # ---------------------------------------------------------
    if not cleaned_dfs:
        return df.copy()

    result = pd.concat(
        cleaned_dfs,
        ignore_index=True,
    )

    # ---------------------------------------------------------
    # Final cleanup
    # ---------------------------------------------------------
    result["event_date"] = pd.to_datetime(
        result["event_date"]
    )

    result = (
        result
        .sort_values(
            ["entity_id", "event_date"]
        )
        .reset_index(drop=True)
    )

    return result

    """
    Checks for gaps in the time-series date sequence for each entity.
    If gaps are found, reindexes the time-series to be continuous and forward-fills (ffill) missing values.
    """
    df = df.copy()
    df["event_date"] = pd.to_datetime(df["event_date"])
    
    cleaned_dfs = []
    
    for entity, group in df.groupby("entity_id"):
        group = group.sort_values("event_date").set_index("event_date")
        
        # Determine frequency (daily vs monthly)
        is_monthly = False
        if len(group) > 1:
            median_delta = pd.Series(group.index).diff().median().days
            if median_delta >= 27:
                is_monthly = True
                
        freq = "MS" if is_monthly else "D"
        
        # Generate complete date range
        full_range = pd.date_range(start=group.index.min(), end=group.index.max(), freq=freq)
        
        # Log detected gaps
        missing_dates = full_range.difference(group.index)
        if not missing_dates.empty:
            print(f"INFO: Gaps detected for entity '{entity}'. Missing dates filled: {list(missing_dates.strftime('%Y-%m-%d'))}")
            
        # Reindex to fill gaps
        reindexed = group.reindex(full_range)
        reindexed.index.name = "event_date"
        reindexed = reindexed.reset_index()
        
        # Fill entity_id which becomes NaN for reindexed rows
        reindexed["entity_id"] = entity
        
        # Forward fill and then backward fill missing values
        reindexed = reindexed.ffill().bfill()
        
        cleaned_dfs.append(reindexed)
        
    return pd.concat(cleaned_dfs, ignore_index=True)

def convert_df_to_stack(df: pd.DataFrame, horizon: int, horizon_key: str = None, config: Config = None) -> pd.DataFrame:
    """
    Applies Weighted Stacking Data Manipulation.
    Converts historical time-series dataframe into a long stacked format
    for multi-step inference, aligning lag features and including the horizon step index.

    Parameters:
    -----------
    df : pd.DataFrame
        The validated input dataframe with historical records.
    horizon : int
        The number of steps to project forward (e.g., 90 for daily, 36 for monthly).
    horizon_key : str, optional
        'tactical' or 'strategic' -- used to load the matching fixed per-entity
        weather quintile edges saved by training.py. If not provided, edges
        are computed fresh per entity from this call's own (typically short)
        date span, which will NOT match what the trained model expects; only
        intended for standalone testing.
    config : Config, optional
        Used to locate the saved weather edges artifact. Defaults to a fresh Config().

    Returns:
    --------
    pd.DataFrame
        Stacked dataframe where each row has 'entity_id', 'event_date', 'horizon_step',
        and aligned lag features.
    """
    # Fill gaps before stacking
    df = fill_time_series_gaps(df)

    # Grain is decided once for the whole call: convert_df_to_stack is always
    # invoked with a single bronze fetch (daily xor monthly, never mixed --
    # see run_single_forecast), so one median-delta check across all entities
    # is equivalent to (and cheaper than) repeating the per-entity check below
    # just to pick a grain for build_origin_features().
    grain = "daily"
    date_deltas = df.sort_values("event_date")["event_date"].diff().dropna().dt.days
    if not date_deltas.empty and date_deltas.median() >= 27:
        grain = "monthly"

    # Origin-anchored bridge onto additionalfeatures/feature_store and
    # additionalfeatures/feature_experiments: one feature row per
    # (entity_id, event_date), joined below onto each stacked row's
    # origin_date (never event_date -- event_date is the target date, and
    # joining these features there would leak it; see
    # additional_features.py's module docstring). Requires Input/Replenishment
    # by name (feature_store's contract), so it's skipped -- rather than
    # raising -- for callers that stack arbitrary generic numeric columns
    # instead, matching this function's own generic-column design.
    origin_features = (
        build_origin_features(df, grain=grain)
        if {"Input", "Replenishment"}.issubset(df.columns)
        else None
    )

    # 1. Identify the forecast origin for each entity (the latest available date in input data)
    origins = df.groupby("entity_id")["event_date"].max().reset_index()
    origins.rename(columns={"event_date": "origin_date"}, inplace=True)

    # Weather/season features are known/forecastable per target date, so fetch
    # each station's own weather once for the whole span (covering its horizon)
    # and look it up directly rather than lagging it like numeric_cols below.
    # Bucket the continuous ones with that station's fixed quintile edges from training.
    weather_edges_by_entity = load_weather_edges(horizon_key, config or Config()) if horizon_key else {}
    weather_by_entity_date = {
        entity: weather.weather_features_by_date(
            origins["origin_date"].min(), origins["origin_date"].max() + pd.Timedelta(days=horizon * 31),
            entity_id=entity,
            edges=weather_edges_by_entity.get(entity),
        )
        for entity in origins["entity_id"]
    }

    stacked_records = []

    for _, row in origins.iterrows():
        entity = row["entity_id"]
        origin_date = row["origin_date"]
        weather_by_date = weather_by_entity_date[entity]

        # Get historical records for this entity to build lag features
        entity_history = df[df["entity_id"] == entity].sort_values("event_date")
        
        # Build lag features relative to the origin date
        lag_features = {}
        
        # Select numeric columns to lag (excluding entity_id, event_date, and the
        # prediction targets themselves — must match training.py's exclusion so
        # inference features align with the trained model's feature set)
        numeric_cols = [c for c in df.columns if c not in ["entity_id", "event_date", "Input", "Replenishment"]]
        
        for col in numeric_cols:
            # Get values at origin_date, origin_date-1, ..., origin_date-30, and
            # origin_date-365. We locate these values in the sorted entity history
            for lag in LAG_STEPS:
                val = np.nan
                target_idx = len(entity_history) - lag
                if 0 <= target_idx < len(entity_history):
                    val = entity_history.iloc[target_idx][col]
                lag_features[f"{col}_lag_{lag}"] = val

            # Rolling average over past 7, 30 days
            for window in ROLLING_WINDOWS:
                if len(entity_history) >= window:
                    lag_features[f"{col}_roll_mean_{window}"] = entity_history[col].iloc[-window:].mean()
                else:
                    lag_features[f"{col}_roll_mean_{window}"] = entity_history[col].mean()

        # Generate H rows for the forecast horizon
        for h in range(1, horizon + 1):
            # Calculate target prediction date based on daily or monthly granularity
            is_monthly = False
            if len(entity_history) > 1:
                median_delta = (entity_history["event_date"].diff()).median().days
                if median_delta >= 27:
                    is_monthly = True
            
            if is_monthly:
                pred_date = origin_date + pd.DateOffset(months=h)
            else:
                pred_date = origin_date + pd.Timedelta(days=h)

            pred_timestamp = pd.Timestamp(pred_date)
            record = {
                "entity_id": entity,
                "origin_date": origin_date,
                "event_date": pred_date,
                "horizon_step": h,  # The crucial index feature of the horizon
                "is_weekend": int(pred_timestamp.dayofweek >= 5),
                "month_of_year": pred_timestamp.month,
                "week_of_year": pred_timestamp.isocalendar().week,
            }
            # Add the aligned lag features
            record.update(lag_features)
            record.update(weather_by_date.get(
                pred_timestamp.normalize(),
                {col: np.nan for col in weather.WEATHER_FEATURE_COLS},
            ))
            stacked_records.append(record)
            
    stacked_df = pd.DataFrame(stacked_records)

    # Join origin features onto origin_date, not event_date: every horizon
    # row for a given entity/origin shares the same origin, so all H rows get
    # the same origin-feature values, mirroring how lag_features is broadcast
    # across horizon steps above.
    if origin_features is not None:
        stacked_df = stacked_df.merge(
            origin_features,
            left_on=["entity_id", "origin_date"],
            right_on=["entity_id", "event_date"],
            how="left",
            suffixes=("", "_origin"),
        ).drop(columns=["event_date_origin"])

    print(f"Stacking complete. Restructured into {len(stacked_df)} stacked rows.")
    return stacked_df


class Prediction_runner:
    """
    Class wrapping the prediction process: model loading, prediction generation, and saving.
    """
    def __init__(self, horizon: str, config: Config):
        self.horizon = horizon
        self.config = config
        self.models = {}

    def load_models(self) -> dict:
        """
        Loads XGBoost model artifacts for 'input' and 'replenishment' from Azure Storage or local directory fallback.
        """
        for var in ["input", "replenishment"]:
            model_filename = f"{self.horizon}_{var}_model.json"
            local_model_path = os.path.join(self.config.local_models_dir, model_filename)
            
            model = xgb.XGBRegressor()
            model_loaded = False
            
            if self.config.has_storage_access():
                try:
                    blob_service_client = self.config.get_blob_service_client()
                    blob_client = blob_service_client.get_blob_client(container="models", blob=model_filename)
                    
                    model_bytes = io.BytesIO()
                    blob_client.download_blob().readinto(model_bytes)
                    model_bytes.seek(0)
                    
                    model.load_model(bytearray(model_bytes.read()))
                    self.models[var] = model
                    model_loaded = True
                    print(f"Loaded model {model_filename} from Azure Models Container.")
                except Exception as e:
                    print(f"Could not load {model_filename} from Azure Storage: {e}.")
                    
                    # Bootstrap/Upload logic: if local model exists, upload it to Azure models container
                    if os.path.exists(local_model_path):
                        try:
                            print(f"Bootstrapping: Uploading local model {model_filename} to Azure models container...")
                            with open(local_model_path, "rb") as f:
                                model_data = f.read()
                            
                            container_client = blob_service_client.get_container_client("models")
                            if not container_client.exists():
                                container_client.create_container()
                                
                            blob_client.upload_blob(model_data, overwrite=True)
                            
                            # Load it locally now that it's bootstrapped
                            model.load_model(local_model_path)
                            self.models[var] = model
                            model_loaded = True
                            print(f"Successfully bootstrapped and loaded model {model_filename}.")
                        except Exception as upload_err:
                            print(f"Failed to bootstrap local model to Azure: {upload_err}")
                    
            # Local fallback
            if not model_loaded:
                if os.path.exists(local_model_path):
                    model.load_model(local_model_path)
                    self.models[var] = model
                    print(f"Loaded local model file: {local_model_path}")
                else:
                    print(f"Model file {model_filename} not found. Defaulting to baseline/mock prediction.")
                    self.models[var] = None

        if all(model is None for model in self.models.values()):
            print(f"No models found for horizon '{self.horizon}'. All predictions will use baseline/mock calculation.")

        return self.models

    def generate_predictions(self, stack: pd.DataFrame) -> pd.DataFrame:
        """
        Extracts features (including horizon_step) and generates predictions for Input and Replenishment.
        """
        # 1. Separate features from metadata columns
        # 'horizon_step' MUST be included in the features!
        # 'scenario_id' is metadata added by what-if scenario expansion (see
        # scenarios.py); plain (non-scenario) stacks never have this column,
        # so this exclusion is a no-op on the existing baseline call path.
        metadata_cols = ["entity_id", "origin_date", "event_date", "scenario_id"]
        feature_cols = [c for c in stack.columns if c not in metadata_cols]
        X = stack[feature_cols]

        output_cols = [c for c in ["entity_id", "event_date", "horizon_step", "scenario_id"] if c in stack.columns]
        predictions_df = stack[output_cols].copy()

        for var, model in self.models.items():
            col_name = var.capitalize()  # 'Input' or 'Replenishment'
            if model is not None:
                # Input and Replenishment each have their own per-entity target
                # encoding (see training.py's compute_entity_target_encoding());
                # attach the matching one for this target right before predicting,
                # since a single stack is shared across both targets' models.
                # This is a plain lookup against the frozen artifact saved at
                # training time -- no calculation happens here. If the artifact
                # can't be loaded (e.g. not yet generated for an older/rolling
                # model), fall back to a neutral 0.0 for this feature only --
                # matching apply_entity_target_encoding()'s own per-entity
                # fallback -- rather than abandoning the real model for the
                # random mock baseline.
                try:
                    entity_encoding = load_entity_encoding(self.horizon, col_name, self.config)
                except Exception as e:
                    print(f"Could not load entity encoding for {self.horizon}/{col_name}: {e}. Using neutral fallback (0.0) for entity_target_enc.")
                    entity_encoding = {}

                X_target = X.copy()
                X_target["entity_target_enc"] = apply_entity_target_encoding(stack["entity_id"], entity_encoding)
                predictions_df[col_name] = model.predict(X_target)
            else:
                # Mock calculation: baseline + trend + noise
                predictions_df[col_name] = 100.0 + predictions_df["horizon_step"] * 1.5 + np.random.normal(0, 5, len(predictions_df))

        return predictions_df

    def save_predictions_to_gold(self, predictions_df: pd.DataFrame) -> None:
        """
        Saves prediction dataframe to the Gold storage container in Parquet format.
        """
        output_blob_name = f"{'daily' if self.horizon == 'tactical' else 'monthly'}/predictions.parquet"
        
        if self.config.has_storage_access():
            try:
                out_stream = io.BytesIO()
                predictions_df.to_parquet(out_stream, index=False)
                out_stream.seek(0)

                blob_service_client = self.config.get_blob_service_client()
                blob_client = blob_service_client.get_blob_client(container=self.config.gold_container, blob=output_blob_name)
                blob_client.upload_blob(out_stream.getvalue(), overwrite=True)
                print(f"Predictions successfully written to Gold Storage: {self.config.gold_container}/{output_blob_name}")
                return
            except Exception as e:
                print(f"Error uploading predictions to Gold Storage: {e}. Saving locally.")
                
        # Save locally as fallback
        local_out_path = os.path.join(self.config.local_gold_dir, output_blob_name)
        os.makedirs(os.path.dirname(local_out_path), exist_ok=True)
        predictions_df.to_parquet(local_out_path, index=False)
        print(f"Predictions successfully written locally to: {local_out_path}")

    def run(self, stack: pd.DataFrame) -> None:
        """
        Orchestrates prediction: model loading, prediction generation, and saving to Gold.
        """
        if stack is None or stack.empty:
            raise ValueError(f"Input stack is empty for horizon {self.horizon}")
            
        print(f"Running predictions for {self.horizon} horizon with {len(stack)} stacked observations...")
        self.load_models()
        predictions_df = self.generate_predictions(stack)
        self.save_predictions_to_gold(predictions_df)


# Backward-compatible function wrapper
def prediction_runner(stack: pd.DataFrame, horizon: str, config: Config):
    """
    Loads model artifacts, runs inference using XGBoost, and saves results to Gold Storage.
    """
    runner = Prediction_runner(horizon, config)
    runner.run(stack)


def _run_scenario_forecast_safely(stack: pd.DataFrame, horizon: str, config: Config) -> None:
    """
    Runs the what-if scenario pipeline for an already-built baseline stack,
    isolating any failure so a scenario-generation bug can never fail the
    baseline forecast run or its ADF webhook callback -- scenarios are
    strictly secondary to the baseline forecast.
    """
    try:
        from scenarios import run_scenario_forecast_for_stack
        run_scenario_forecast_for_stack(stack, horizon=horizon, config=config)
    except Exception as e:
        print(f"Scenario forecast generation failed (baseline unaffected): {e}")


def run_single_forecast(horizon_type: str, config: Config = None) -> None:
    """
    Executes the forecasting pipeline for a single horizon ('daily' or 'monthly').
    """
    if config is None:
        config = Config()
        
    if horizon_type == "daily":
        print("\n--- Starting Daily forecasting pipeline ---")
        daily_dataframe = fetch_data_from_bronze_storage(config, horizon_type="daily")
        if data_format_validation(daily_dataframe, expected_entities=config.num_entities, expected_years=config.num_years):
            daily_stack = convert_df_to_stack(daily_dataframe, horizon=90, horizon_key="tactical", config=config)
            prediction_runner(daily_stack, horizon="tactical", config=config)
            _run_scenario_forecast_safely(daily_stack, horizon="tactical", config=config)

    elif horizon_type == "monthly":
        print("\n--- Starting Monthly forecasting pipeline ---")
        monthly_dataframe = fetch_data_from_bronze_storage(config, horizon_type="monthly")
        if data_format_validation(monthly_dataframe, expected_entities=config.num_entities, expected_years=config.num_years):
            monthly_stack = convert_df_to_stack(monthly_dataframe, horizon=36, horizon_key="strategic", config=config)
            prediction_runner(monthly_stack, horizon="strategic", config=config)
            _run_scenario_forecast_safely(monthly_stack, horizon="strategic", config=config)
    else:
        raise ValueError(f"Unknown horizon type: {horizon_type}")


def app():
    """
    Main orchestration entry point. Loads configurations, fetches daily & monthly datasets,
    validates data formats, converts schemas via Weighted Stacking, and executes prediction runs.
    """
    print("Initializing Forecasting Pipeline...")
    config = Config()

    try:
        run_single_forecast("daily", config)
    except Exception as e:
        print(f"Daily forecasting pipeline failed: {e}")

    try:
        run_single_forecast("monthly", config)
    except Exception as e:
        print(f"Monthly forecasting pipeline failed: {e}")

    print("\nForecasting Pipeline processing run completed.")


if __name__ == "__main__":
    app()



