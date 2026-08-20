import io
import json
import logging
import os
import sys
from datetime import date, timedelta

import pandas as pd

from config import Config

# weather.py/scenario_definitions.py live in training/, a sibling of src/.
# Add it to sys.path so imports work regardless of the entry point.
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "training",
    ),
)

import weather
from scenario_definitions import SCENARIO_DEFINITIONS


def read_parquet(
    config: Config,
    container: str,
    blob_name: str,
    local_path: str,
) -> pd.DataFrame:
    """
    Read a parquet file from Azure Blob Storage when available,
    otherwise read it from the local filesystem.
    """

    # Production (Azure)
    if config.use_azure():

        logging.info(f"Reading Azure blob: {container}/{blob_name}")

        blob_service_client = config.get_blob_service_client()

        blob_client = blob_service_client.get_blob_client(
            container=container,
            blob=blob_name,
        )

        stream = io.BytesIO()

        blob_client.download_blob().readinto(stream)

        stream.seek(0)

        return pd.read_parquet(stream)

    # Development (Local)

    logging.info(f"Reading local parquet: {local_path}")

    if not os.path.exists(local_path):

        raise FileNotFoundError(f"Missing local parquet file:\n{local_path}")

    return pd.read_parquet(local_path)


def get_predictions_json(config: Config) -> dict:
    """
    Reads daily (tactical) and monthly (strategic) forecast predictions
    from Azure Blob Storage or the local filesystem.
    """

    data = {"daily": [], "monthly": []}

    for key in ["daily", "monthly"]:

        blob_name = f"{key}/predictions.parquet"

        local_path = os.path.join(config.local_gold_dir, blob_name)

        try:

            df = read_parquet(
                config=config,
                container=config.gold_container,
                blob_name=blob_name,
                local_path=local_path,
            )

            logging.info(f"Loaded prediction data for {key}")

        except FileNotFoundError:

            logging.warning(f"Prediction file not found for {key}")

            continue

        except Exception as e:

            logging.exception(f"Unable to load prediction file: {blob_name}")

            raise RuntimeError(f"Failed loading {blob_name}: {e}") from e

        if df is None or df.empty:
            continue

        try:

            df = df.copy()

            # Ensure numeric columns are floats
            for column in ["Input", "Replenishment"]:

                if column in df.columns:

                    df[column] = pd.to_numeric(df[column], errors="coerce").astype(
                        float
                    )

            # Calculate Stockpile if not already present
            if "Stockpile" not in df.columns and {
                "Input",
                "Replenishment",
                "entity_id",
                "event_date",
            }.issubset(df.columns):

                df = df.sort_values(["entity_id", "event_date"])

                df["Stockpile"] = (
                    (df["Replenishment"] - df["Input"])
                    .groupby(df["entity_id"])
                    .cumsum()
                )

            if "event_date" in df.columns:

                df["event_date"] = pd.to_datetime(df["event_date"]).dt.strftime(
                    "%Y-%m-%d"
                )

            # Replace NaN with None
            df = df.astype(object).where(pd.notna(df), None)

            data[key] = df.to_dict(orient="records")

        except Exception as e:

            logging.exception(f"Failed formatting prediction data ({key})")

            raise RuntimeError(f"Prediction formatting failed ({key}): {e}") from e

    return data


def get_scenario_predictions_json(config: Config) -> dict:
    """
    Reads daily (tactical) and monthly (strategic) scenario forecast
    predictions from Azure Blob Storage or the local filesystem.
    """

    labels_by_scenario_id = {s["scenario_id"]: s["label"] for s in SCENARIO_DEFINITIONS}

    data = {"daily": [], "monthly": []}

    for key in ["daily", "monthly"]:

        blob_name = f"{key}/scenario_predictions.parquet"

        local_path = os.path.join(config.local_gold_dir, blob_name)

        try:

            df = read_parquet(
                config=config,
                container=config.gold_container,
                blob_name=blob_name,
                local_path=local_path,
            )

            logging.info(f"Loaded scenario predictions for {key}")

        except FileNotFoundError:

            logging.warning(f"Scenario predictions not found for {key}")

            continue

        except Exception as e:

            logging.exception(f"Unable to load {blob_name}")

            raise RuntimeError(f"Failed to load {blob_name}: {e}") from e

        if df is None or df.empty:
            continue

        try:

            df = df.copy()

            numeric_columns = ["Input", "Replenishment", "Stockpile"]

            for column in numeric_columns:

                if column in df.columns:

                    df[column] = pd.to_numeric(df[column], errors="coerce").astype(
                        float
                    )

            if "event_date" in df.columns:

                df["event_date"] = pd.to_datetime(df["event_date"]).dt.strftime(
                    "%Y-%m-%d"
                )

            df["label"] = (
                df["scenario_id"].map(labels_by_scenario_id).fillna(df["scenario_id"])
            )

            # Replace NaN with None
            df = df.astype(object).where(pd.notna(df), None)

            data[key] = df.to_dict(orient="records")

        except Exception as e:

            logging.exception(f"Failed formatting scenario predictions for {key}")

            raise RuntimeError(f"Scenario formatting failed ({key}): {e}") from e

    return data


def get_metrics_json(config: Config) -> list:
    """
    Reads model metrics from Azure Blob Storage or the local filesystem.

    Returns
    -------
    list
        Model metrics as a list of JSON records.
    """

    blob_name = "model_metrics.parquet"

    local_path = os.path.join(config.local_metrics_dir, blob_name)

    try:

        df = read_parquet(
            config=config,
            container=config.metrics_container,
            blob_name=blob_name,
            local_path=local_path,
        )

        logging.info("Loaded model metrics")

    except FileNotFoundError:

        logging.warning("Model metrics file not found.")

        return []

    except Exception as e:

        logging.exception("Unable to load model metrics.")

        raise RuntimeError(f"Unable to load model metrics: {e}") from e

    if df is None or df.empty:
        return []

    # Replace NaN with None so JSON serialization is valid
    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")


def get_metrics_by_step_json(config: Config) -> list:
    """
    Reads per-(entity, horizon_step) model metrics from Azure Blob Storage
    or the local filesystem -- the same RMSE/MAE/SMAPE/R2/NRMSE metrics as
    get_metrics_json(), but broken out by horizon_step (restricted to the
    first HORIZON_STEP_METRICS_LIMIT steps; see training.py's
    compute_per_horizon_step_metrics()) instead of aggregated across the
    whole validation/OOT sample. Kept in a separate file/endpoint from
    get_metrics_json() since this table has far more rows.

    Returns
    -------
    list
        Per-horizon-step model metrics as a list of JSON records.
    """

    blob_name = "model_metrics_by_step.parquet"

    local_path = os.path.join(config.local_metrics_dir, blob_name)

    try:

        df = read_parquet(
            config=config,
            container=config.metrics_container,
            blob_name=blob_name,
            local_path=local_path,
        )

        logging.info("Loaded per-horizon-step model metrics")

    except FileNotFoundError:

        logging.warning("Per-horizon-step model metrics file not found.")

        return []

    except Exception as e:

        logging.exception("Unable to load per-horizon-step model metrics.")

        raise RuntimeError(f"Unable to load per-horizon-step model metrics: {e}") from e

    if df is None or df.empty:
        return []

    # Replace NaN with None so JSON serialization is valid
    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")


def get_oot_history_json(config: Config) -> list:
    """
    Reads the Out-of-Time (OOT) history from Azure Blob Storage
    or the local filesystem.

    Returns
    -------
    list
        OOT history records for the dashboard.
    """

    blob_name = "oot_history.parquet"

    local_path = os.path.join(config.local_metrics_dir, blob_name)

    try:

        df = read_parquet(
            config=config,
            container=config.metrics_container,
            blob_name=blob_name,
            local_path=local_path,
        )

        logging.info("Loaded OOT history.")

    except FileNotFoundError:

        logging.warning("OOT history file not found.")

        return []

    except Exception as e:

        logging.exception("Unable to load OOT history.")

        return []

    if df is None or df.empty:
        return []

    if "event_date" in df.columns:

        df["event_date"] = pd.to_datetime(df["event_date"]).dt.strftime("%Y-%m-%d")

    df = df.astype(object).where(pd.notna(df), None)

    return df.to_dict(orient="records")


def get_weather_json(
    entity_id: str = None,
    lookback_days: int = 90,
    forecast_days: int = 16,
    start_date: str = None,
    end_date: str = None,
) -> list:
    """
    Returns historical and forecast weather data.

    If start_date and end_date are supplied,
    those exact dates are requested.

    Otherwise, the normal dashboard window
    is used.
    """

    if start_date and end_date:

        requested_start = start_date
        requested_end = end_date

    else:

        requested_start = (
            date.today()
            - timedelta(
                days=lookback_days
            )
        ).isoformat()

        requested_end = (
            date.today()
            + timedelta(
                days=forecast_days - 1
            )
        ).isoformat()


    df = weather.get_weather_timeseries(
        start_date=requested_start,
        end_date=requested_end,
        entity_id=entity_id,
    )


    if (
        df is None
        or df.empty
    ):
        return []


    df = df.copy()


    if "date" in df.columns:

        df["date"] = (
            pd.to_datetime(
                df["date"]
            )
            .dt.strftime(
                "%Y-%m-%d"
            )
        )


    if "weather_code" in df.columns:

        df["weather_label"] = (
            df["weather_code"]
            .apply(
                weather.weather_code_label
            )
        )


    numeric_columns = [
        "temp_max_c",
        "temp_min_c",
        "rainfall_mm",
        "cloud_cover_pct",
        "humidity_pct",
        "wind_speed_kmh",
        "uv_index",
        "sunshine_seconds",
    ]


    for column in numeric_columns:

        if column in df.columns:

            df[column] = (
                pd.to_numeric(
                    df[column],
                    errors="coerce",
                )
                .astype(float)
            )


    df = df.astype(
        object
    ).where(
        pd.notna(df),
        None
    )


    return df.to_dict(
        orient="records"
    )
    """
    Returns weather data for the dashboard.

    By default, the function returns the normal dashboard
    weather window:

        90 days historical
        +
        16 days forecast

    When start_date and end_date are supplied, the exact
    requested date range is returned.

    This is used by the Weather & Forecast Correlation
    component so that weather data can be aligned with
    the exact forecast dates.
    """

    if start_date and end_date:
        requested_start = start_date
        requested_end = end_date

    else:
        requested_start = (
            date.today() -
            timedelta(days=lookback_days)
        ).isoformat()

        requested_end = (
            date.today() +
            timedelta(days=forecast_days - 1)
        ).isoformat()

    df = weather.get_weather_timeseries(
        start_date=requested_start,
        end_date=requested_end,
        entity_id=entity_id,
    )

    if df is None or df.empty:
        return []

    df = df.copy()

    if "date" in df.columns:
        df["date"] = (
            pd.to_datetime(df["date"])
            .dt.strftime("%Y-%m-%d")
        )

    if "weather_code" in df.columns:
        df["weather_label"] = (
            df["weather_code"]
            .apply(weather.weather_code_label)
        )

    numeric_columns = [
        "temp_max_c",
        "temp_min_c",
        "rainfall_mm",
        "cloud_cover_pct",
        "humidity_pct",
        "wind_speed_kmh",
        "uv_index",
        "sunshine_seconds",
    ]

    for column in numeric_columns:
        if column in df.columns:
            df[column] = (
                pd.to_numeric(
                    df[column],
                    errors="coerce",
                )
                .astype(float)
            )

    df = df.astype(object).where(
        pd.notna(df),
        None,
    )

    return df.to_dict(
        orient="records"
    )
    """
    Returns historical and forecast weather data for the dashboard.

    By default, the function preserves the existing dashboard behaviour:
    90 historical days + 16 forecast days.

    When start_date and/or end_date are supplied, the requested date range
    is used instead. This allows components such as weather correlation to
    request weather for the same historical period as the forecast data.
    """

    if start_date is None:
        start_date = (
            date.today() -
            timedelta(days=lookback_days)
        ).isoformat()

    if end_date is None:
        end_date = (
            date.today() +
            timedelta(days=forecast_days - 1)
        ).isoformat()

    df = weather.get_weather_timeseries(
        start_date=start_date,
        end_date=end_date,
        entity_id=entity_id,
    )

    if df is None or df.empty:
        return []

    df = df.copy()

    if "date" in df.columns:
        df["date"] = pd.to_datetime(
            df["date"]
        ).dt.strftime("%Y-%m-%d")

    if "weather_code" in df.columns:
        df["weather_label"] = (
            df["weather_code"]
            .apply(weather.weather_code_label)
        )

    numeric_columns = [
        "temp_max_c",
        "temp_min_c",
        "rainfall_mm",
        "cloud_cover_pct",
        "humidity_pct",
        "wind_speed_kmh",
        "uv_index",
        "sunshine_seconds",
    ]

    for column in numeric_columns:
        if column in df.columns:
            df[column] = pd.to_numeric(
                df[column],
                errors="coerce",
            ).astype(float)

    df = df.astype(object).where(
        pd.notna(df),
        None,
    )

    return df.to_dict(
        orient="records"
    )