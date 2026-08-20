import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Literal, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Ensure src/ and training/ are in Python path for package resolutions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'training'))

from app import run_single_forecast, fetch_data_from_bronze_storage
from config import Config
from ingest import write_to_training_data_bronze, get_db_operations_log
from training import deploy_models_to_azure, train_models
from ui import get_predictions_json, get_metrics_json, get_metrics_by_step_json, get_weather_json, get_oot_history_json, get_scenario_predictions_json
from weather import refresh_weather_cache, get_weather_timeseries, _weather_cache_exists
from monitoring import (
    get_events,
    get_monitoring_payload,
    inference_run,
)

logging.basicConfig(level=logging.INFO)

pipeline_progress = {
    "running": False,
    "percent": 0,
    "step": "Idle"
}

WEATHER_PREFLIGHT_MAX_RETRIES = 3
WEATHER_PREFLIGHT_RETRY_BACKOFF_SECONDS = 5.0


def _ensure_weather_cache_ready(entity_ids, config: Config) -> None:
    """
    Makes sure every given station has a usable weather cache before a
    forecast run needs it, retrying with backoff for any station that isn't
    cached yet (e.g. a station whose weather has never been fetched, or
    whose only fetch attempt so far hit a transient failure like Open-Meteo
    rate-limiting). Only touches stations missing a cache entry -- does not
    force-refresh stations that already have one, unlike refresh_weather_cache().

    Parameters
    ----------
    entity_ids : Iterable[str]
        Distinct station identifiers actually present in this run's Bronze
        input data.
    config : Config
        Used to check/populate the weather cache.

    Raises
    ------
    Exception
        Re-raises the last fetch error for a station if every retry attempt
        fails, since the forecast run cannot proceed without that station's
        weather data.
    """
    lookback_days = 90
    forecast_days = 16
    start_date = (date.today() - timedelta(days=lookback_days)).isoformat()
    end_date = (date.today() + timedelta(days=forecast_days - 1)).isoformat()

    for entity_id in entity_ids:
        if _weather_cache_exists(config, entity_id=entity_id):
            continue

        logging.info(f"No weather cache yet for '{entity_id}'; fetching before forecast run.")
        for attempt in range(1, WEATHER_PREFLIGHT_MAX_RETRIES + 1):
            try:
                get_weather_timeseries(start_date=start_date, end_date=end_date, entity_id=entity_id)
                break
            except Exception as e:
                if attempt == WEATHER_PREFLIGHT_MAX_RETRIES:
                    raise
                logging.warning(
                    f"Weather pre-flight attempt {attempt} failed for '{entity_id}': {e}. Retrying..."
                )
                time.sleep(WEATHER_PREFLIGHT_RETRY_BACKOFF_SECONDS * attempt)


def _run_forecast_for_horizon(horizon: str, config: Config) -> None:
    """
    Shared forecast-run logic for a single horizon: loads that horizon's
    Bronze data, warms any missing weather cache entries, then runs the
    forecast. Used by both the run-forecast HTTP route and the scheduled
    post-ingestion forecast run, so the two triggers can't drift apart.
    """
    bronze_df = fetch_data_from_bronze_storage(config, horizon_type=horizon)
    _ensure_weather_cache_ready(bronze_df["entity_id"].unique(), config)
    run_single_forecast(horizon, config)

def _run_monitored_forecast(
    horizon: str,
    config: Config,
    trigger: str = "manual",
) -> None:
    """
    Monitoring wrapper around the existing forecast implementation.

    IMPORTANT:
    _run_forecast_for_horizon() itself remains unchanged.

    This wrapper adds operational observability around it.
    """

    with inference_run(
        horizon=horizon,
        trigger=trigger,
    ):
        _run_forecast_for_horizon(
            horizon,
            config,
    )


def _scheduled_ingest_and_forecast() -> None:
    """
    Daily scheduled job (replaces the Azure Functions timer trigger): pulls
    coal burn/supply records from the source SQL database into Bronze, then
    runs both the daily and monthly forecasts against the freshly-ingested
    data. Each horizon's forecast is attempted independently: a failure in
    one (e.g. daily) is logged but does not prevent the other (monthly) from
    running.
    """
    logging.info("Starting scheduled Bronze ingestion.")
    try:
        write_to_training_data_bronze()
        logging.info("Bronze ingestion completed successfully.")
    except Exception as e:
        logging.error(f"Bronze ingestion failed: {str(e)}", exc_info=True)
        return

    config = Config()
    for horizon in ["daily", "monthly"]:
        try:
            logging.info(f"Starting scheduled forecast execution for horizon: {horizon}")
            _run_monitored_forecast(horizon, config, trigger="scheduled")
            logging.info(f"Scheduled forecast for horizon '{horizon}' completed successfully.")
        except Exception as e:
            logging.error(f"Scheduled forecast for horizon '{horizon}' failed: {str(e)}", exc_info=True)



def initialize_pipeline(weighting: str = "weighted"):

    config = Config()
    steps = []
    errors = []

    pipeline_progress.update({
    "running": True,
    "percent": 0,
    "step": "Starting..."
})

    # ------------------------------------------------------------
    # Bronze ingestion
    # ------------------------------------------------------------
    try:
        pipeline_progress.update({
            "percent": 10,
            "step": "Bronze ingestion"
        })
        if config.has_sql_access():
            logging.info("Starting Bronze ingestion...")
            write_to_training_data_bronze()
            steps.append("✓ Bronze ingestion completed.")
        else:
            steps.append("• Skipping Bronze ingestion (SQL not configured).")
    except Exception as e:
        logging.exception("Bronze ingestion failed.")
        errors.append(f"Bronze ingestion: {e}")

    # ------------------------------------------------------------
    # Weather refresh
    # ------------------------------------------------------------
    try:
        logging.info("Refreshing weather cache...")
        pipeline_progress.update({
        "percent": 30,
        "step": "Refreshing weather cache"
    })
        refresh_weather_cache()
        steps.append("✓ Weather cache refreshed.")
    except Exception as e:
        logging.exception("Weather refresh failed.")
        errors.append(f"Weather refresh: {e}")

    # ------------------------------------------------------------
    # Model training
    # ------------------------------------------------------------
    try:
        pipeline_progress.update({
        "percent": 50,
        "step": "Training forecasting models"
    })
        logging.info(f"Training models ({weighting})...")
        train_models(weighting=weighting)
        steps.append(f"✓ Models trained ({weighting}).")
    except Exception as e:
        logging.exception("Model training failed.")
        errors.append(f"Model training: {e}")

    # ------------------------------------------------------------
    # Verify per-horizon-step metrics (model_metrics_by_step.parquet) were
    # actually produced by the training step above -- train_models() saves
    # this itself; this step just reads it back the same way the dashboard's
    # /api/forecast-metrics-by-step route does, so a silent save failure (or
    # an empty result) shows up in the pipeline's own step/error log instead
    # of only being discoverable later as a blank card on the dashboard.
    # ------------------------------------------------------------
    try:
        pipeline_progress.update({
        "percent": 55,
        "step": "Verifying per-horizon-step metrics"
    })
        metrics_by_step = get_metrics_by_step_json(config)
        if metrics_by_step:
            steps.append(f"✓ Per-horizon-step metrics available ({len(metrics_by_step)} rows).")
        else:
            steps.append("• No per-horizon-step metrics were produced by training.")
    except Exception as e:
        logging.exception("Per-horizon-step metrics verification failed.")
        errors.append(f"Per-horizon-step metrics verification: {e}")

    # ------------------------------------------------------------
    # Deploy models to Azure (must happen before inference below, so the
    # daily/monthly forecast steps run against the models just trained
    # above rather than whatever was previously live -- Prediction_runner.
    # load_models() prefers the Azure-deployed model over the local one
    # whenever Azure Storage is configured).
    # ------------------------------------------------------------
    try:
        pipeline_progress.update({
        "percent": 60,
        "step": "Deploying models to Azure"
    })
        if config.has_storage_access():
            logging.info(f"Deploying trained models to Azure ({weighting})...")
            deploy_models_to_azure(weighting=weighting)
            steps.append(f"✓ Models deployed to Azure ({weighting}).")
        else:
            steps.append("• Skipping model deployment (Azure Storage not configured).")
    except Exception as e:
        logging.exception("Model deployment failed.")
        errors.append(f"Model deployment: {e}")

    # ------------------------------------------------------------
    # Daily forecast
    # ------------------------------------------------------------
    try:
        logging.info("Running daily forecast...")
        pipeline_progress.update({
            "percent": 75,
            "step": "Running daily forecast"
        })
        _run_monitored_forecast("daily", config, trigger="initialize")
        steps.append("✓ Daily forecast completed.")
    except Exception as e:
        logging.exception("Daily forecast failed.")
        errors.append(f"Daily forecast: {e}")

    # ------------------------------------------------------------
    # Monthly forecast
    # ------------------------------------------------------------
    try:
        logging.info("Running monthly forecast...")
        pipeline_progress.update({
        "percent": 90,
        "step": "Running monthly forecast"
    })
        _run_monitored_forecast("monthly", config, trigger="initialize")
        steps.append("✓ Monthly forecast completed.")
    except Exception as e:
        logging.exception("Monthly forecast failed.")
        errors.append(f"Monthly forecast: {e}")

    pipeline_progress.update({
        "running": False,
        "percent": 100,
        "step": "Completed"
    })
    return {
        "status": "Success" if not errors else "Partial Success",
        "steps": steps,
        "errors": errors
    }



scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_job(_scheduled_ingest_and_forecast, "cron", hour=2, minute=0, second=0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    logging.info("Scheduler started: daily ingest+forecast job registered for 02:00 UTC.")
    yield
    scheduler.shutdown()


app = FastAPI(title="Eskom Coal Forecasting API", lifespan=lifespan)


class RunForecastRequest(BaseModel):
    horizon: Literal["daily", "monthly"]


class InitializeRequest(BaseModel):
    # Which recency-weighting mode to train with (see training.py's
    # prepare_training_dataset()/train_models()). Defaults to "weighted" --
    # the pre-existing behavior -- so existing callers that POST an empty
    # body keep working unchanged.
    weighting: Literal["weighted", "unweighted"] = "weighted"

@app.get("/api/inference-monitoring")
def inference_monitoring():
    return JSONResponse(
        {
            "events": get_events()
        },
        status_code=200,
    )

@app.get("/api/inference-monitoring/summary")
def inference_monitoring_summary():
    """
    Dashboard-ready inference monitoring summary.

    Derives operational health from the existing monitoring event stream.
    The forecasting/inference implementation itself is not modified.
    """
    events = get_events()

    inference_events = [
        event
        for event in events
        if event.get("event_type") in {
            "INFERENCE_STARTED",
            "INFERENCE_COMPLETED",
            "INFERENCE_FAILED",
        }
    ]

    resource_events = [
        event
        for event in events
        if event.get("event_type") == "RESOURCE_ACTIVITY"
    ]

    completed_events = [
        event
        for event in inference_events
        if event.get("event_type") == "INFERENCE_COMPLETED"
    ]

    failed_inference_events = [
        event
        for event in inference_events
        if event.get("event_type") == "INFERENCE_FAILED"
        or (
            event.get("event_type") == "INFERENCE_COMPLETED"
            and event.get("status") == "failed"
        )
    ]

    successful_inference_events = [
        event
        for event in completed_events
        if event.get("status") == "success"
    ]

    failed_resource_events = [
        event
        for event in resource_events
        if event.get("status") == "failed"
    ]

    warning_resource_events = [
        event
        for event in resource_events
        if event.get("status") == "warning"
    ]

    # Most recent completed inference.
    latest_completed = (
        max(
            completed_events,
            key=lambda event: event.get("timestamp", ""),
        )
        if completed_events
        else None
    )

    # Overall operational health.
    if failed_inference_events:
        health = "failed"
    elif failed_resource_events or warning_resource_events:
        health = "degraded"
    elif successful_inference_events:
        health = "healthy"
    else:
        health = "unknown"

    # ---------------------------------------------------------------
    # Resource breakdown
    # ---------------------------------------------------------------

    resources = {}

    for event in resource_events:
        resource = event.get("resource") or "unknown"

        if resource not in resources:
            resources[resource] = {
                "resource": resource,
                "events": 0,
                "failures": 0,
                "warnings": 0,
                "successes": 0,
                "last_status": None,
                "last_message": None,
                "last_timestamp": None,
            }

        item = resources[resource]

        item["events"] += 1

        status = event.get("status")

        if status == "failed":
            item["failures"] += 1
        elif status == "warning":
            item["warnings"] += 1
        elif status == "success":
            item["successes"] += 1

        timestamp = event.get("timestamp", "")

        if (
            not item["last_timestamp"]
            or timestamp > item["last_timestamp"]
        ):
            item["last_timestamp"] = timestamp
            item["last_status"] = status
            item["last_message"] = event.get("message")

    # ---------------------------------------------------------------
    # Run aggregation
    # ---------------------------------------------------------------

    runs = {}

    for event in inference_events:
        run_id = event.get("run_id")

        if not run_id:
            continue

        if run_id not in runs:
            runs[run_id] = {
                "run_id": run_id,
                "horizon": event.get("horizon"),
                "trigger": event.get("trigger"),
                "started_at": None,
                "completed_at": None,
                "duration_ms": None,
                "status": "running",
                "resource_failures": 0,
                "resource_warnings": 0,
            }

        run = runs[run_id]
        event_type = event.get("event_type")

        if event_type == "INFERENCE_STARTED":
            run["started_at"] = event.get("timestamp")
            run["horizon"] = (
                event.get("horizon") or run["horizon"]
            )
            run["trigger"] = (
                event.get("trigger") or run["trigger"]
            )
            run["status"] = "running"

        elif event_type == "INFERENCE_COMPLETED":
            run["completed_at"] = event.get("timestamp")
            run["duration_ms"] = event.get("duration_ms")

            # Preserve the actual inference result.
            if event.get("status") == "success":
                run["status"] = "success"
            else:
                run["status"] = "failed"

        elif event_type == "INFERENCE_FAILED":
            run["completed_at"] = event.get("timestamp")
            run["duration_ms"] = event.get("duration_ms")
            run["status"] = "failed"

    # ---------------------------------------------------------------
    # Attach resource issues to their corresponding run.
    # ---------------------------------------------------------------

    for event in resource_events:
        run_id = event.get("run_id")

        if run_id not in runs:
            continue

        if event.get("status") == "failed":
            runs[run_id]["resource_failures"] += 1

        elif event.get("status") == "warning":
            runs[run_id]["resource_warnings"] += 1

    # A successfully completed inference with resource problems is
    # operationally DEGRADED rather than fully healthy.
    for run in runs.values():
        if (
            run["status"] == "success"
            and (
                run["resource_failures"] > 0
                or run["resource_warnings"] > 0
            )
        ):
            run["status"] = "degraded"

    sorted_runs = sorted(
        runs.values(),
        key=lambda item: item.get("started_at") or "",
        reverse=True,
    )

    return JSONResponse(
        {
            "health": health,

            "summary": {
                "total_events": len(events),
                "total_runs": len(runs),
                "successful_runs": len(successful_inference_events),
                "failed_runs": len(failed_inference_events),
                "degraded_runs": sum(
                    1
                    for run in runs.values()
                    if run["status"] == "degraded"
                ),
                "resource_failures": len(failed_resource_events),
                "resource_warnings": len(warning_resource_events),
                "latest_run": latest_completed,
            },

            "resources": sorted(
                resources.values(),
                key=lambda item: (
                    item["failures"],
                    item["warnings"],
                ),
                reverse=True,
            ),

            "runs": sorted_runs,

            "recent_events": events[:100],
        },
        status_code=200,
    )

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/api/ingest-bronze-data")
def ingest_bronze_data_route():
    """
    Manually runs Bronze ingestion on demand, for testing/debugging the SQL
    ingestion path (src/ingest.py) independently of the scheduled job and
    without also running a forecast.
    """
    logging.info("Received a manual Bronze ingestion request.")
    try:
        write_to_training_data_bronze()
        return JSONResponse(
            {"status": "Success", "message": "Bronze ingestion completed successfully."},
            status_code=200,
        )
    except Exception as e:
        logging.error(f"Error during manual Bronze ingestion: {str(e)}", exc_info=True)
        return JSONResponse({"status": "Failed", "error": str(e)}, status_code=500)


@app.post("/api/run-forecast")
def run_forecast(req: RunForecastRequest):
    """
    Executes the forecasting pipeline for a given horizon ('daily' or
    'monthly'), synchronously, returning success/failure in the response.
    """
    horizon = req.horizon
    logging.info(f"Received a run-forecast request for horizon: {horizon}")

    try:
        config = Config()
        logging.info(f"Starting forecast execution for horizon: {horizon} (Azure Storage = {config.has_storage_access()})")

        _run_monitored_forecast(horizon, config, trigger="manual")

        return JSONResponse(
            {"status": "Success", "message": f"{horizon} forecasting run completed."},
            status_code=200,
        )
    except Exception as e:
        logging.error(f"Error executing forecasting run: {str(e)}", exc_info=True)
        return JSONResponse({"status": "Failed", "error": str(e)}, status_code=500)


@app.post("/api/refresh-weather-cache")
def refresh_weather_cache_route():
    """
    Proactively refreshes the weather cache for every known power station.
    Intended to be called on a schedule or manually, independent of
    forecast/training runs.
    """
    logging.info("Received a weather cache refresh request.")
    try:
        results = refresh_weather_cache()
        return JSONResponse({"status": "Success", "results": results}, status_code=200)
    except Exception as e:
        logging.error(f"Error refreshing weather cache: {str(e)}", exc_info=True)
        return JSONResponse({"status": "Failed", "error": str(e)}, status_code=500)


@app.get("/api/forecast-data")
def forecast_data():
    """Serves prediction data as JSON."""
    try:
        config = Config()
        data = get_predictions_json(config)
        return JSONResponse(data, status_code=200)
    except Exception as e:
        logging.error(f"Error fetching forecast data: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/scenario-data")
def scenario_data():
    """Serves what-if scenario prediction data as JSON."""
    try:
        config = Config()
        data = get_scenario_predictions_json(config)
        return JSONResponse(data, status_code=200)
    except Exception as e:
        logging.error(f"Error fetching scenario data: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/forecast-metrics")
def forecast_metrics():
    """Serves per-entity, per-dimension model accuracy metrics (RMSE/MAE/MAPE/SMAPE) as JSON."""
    try:
        config = Config()
        data = get_metrics_json(config)
        return JSONResponse(data, status_code=200)
    except Exception as e:
        logging.error(f"Error fetching forecast metrics: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/forecast-metrics-by-step")
def forecast_metrics_by_step():
    """Serves per-entity, per-horizon-step model accuracy metrics (RMSE/MAE/SMAPE/R2/NRMSE) as JSON."""
    try:
        config = Config()
        data = get_metrics_by_step_json(config)
        return JSONResponse(data, status_code=200)
    except Exception as e:
        logging.error(f"Error fetching per-horizon-step forecast metrics: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/oot-history")
def oot_history():
    """
    Serves per-date, per-entity out-of-time (OOT) actual-vs-predicted
    history (Input, Replenishment, and derived Stockpile) as JSON, for the
    dashboard's Stockpile History chart.
    """
    try:
        config = Config()
        data = get_oot_history_json(config)
        return JSONResponse(data, status_code=200)
    except Exception as e:
        logging.error(f"Error fetching OOT history: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/weather-data")
def weather_data(
    entity_id: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
):
    """
    Serves a daily weather time series (temperature highs/lows, rainfall,
    cloud cover, humidity, wind, UV index, sunshine duration), covering
    recent history and the forecast horizon, for display on the dashboard.
    Accepts an optional `entity_id` query parameter to fetch weather for a
    specific power station's real location; defaults to Kendal Power
    Station if not provided.

    By default, preserves the normal dashboard weather window. Optional
    start_date/end_date allow consumers such as the weather-correlation
    analysis to request a specific historical period.
    """
    try:
        data = get_weather_json(
            entity_id=entity_id,
            start_date=start_date,
            end_date=end_date,
        )

        return JSONResponse(
            data,
            status_code=200,
        )

    except Exception as e:
        logging.error(
            f"Error fetching weather data: {str(e)}",
            exc_info=True,
        )

        return JSONResponse(
            {"error": str(e)},
            status_code=500,
        )



@app.post("/api/initialize")
def initialize_route(req: InitializeRequest = InitializeRequest()):
    return initialize_pipeline(weighting=req.weighting)

@app.get("/api/initialize-progress")
def initialize_progress():
    return pipeline_progress


@app.get("/api/db-operations")
def db_operations_route():
    """
    Serves the in-memory database operations log (server, database, query,
    status, timing) as JSON, most recent first. Backs the dashboard's
    collapsible "Database Activity" panel.
    """
    return get_db_operations_log()


# Serves frontend/index.html at "/" and any other static assets under
# frontend/. Mounted last so it never shadows the /api/* and /healthz routes
# registered above.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))