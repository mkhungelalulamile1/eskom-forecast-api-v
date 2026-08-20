"""
Inference monitoring and operational observability.

This module intentionally sits OUTSIDE the forecasting implementation.

It does not modify:
    - run_single_forecast()
    - Prediction_runner
    - _run_forecast_for_horizon()

Instead, it:
    1. Creates an inference run ID.
    2. Records run lifecycle events.
    3. Captures logging emitted by the existing pipeline.
    4. Classifies those logs into operational resources.
    5. Exposes structured events for the dashboard.

The data is intentionally in-memory for now. This keeps the implementation
simple and avoids introducing a new database/storage dependency.

For production persistence, this module can later be backed by Azure Table,
Application Insights, Log Analytics, PostgreSQL, etc.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_EVENTS = 2000

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory event store
# ---------------------------------------------------------------------------

_events: List[Dict[str, Any]] = []
_events_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Thread-local run context
# ---------------------------------------------------------------------------

_run_context = threading.local()


def _utc_now() -> str:
    """Return the current UTC timestamp as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _new_run_id() -> str:
    """Create a short human-readable inference run ID."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    suffix = uuid.uuid4().hex[:6]
    return f"inf-{timestamp}-{suffix}"


def get_current_run_id() -> Optional[str]:
    """Return the inference run ID associated with this thread."""
    return getattr(_run_context, "run_id", None)


def _append_event(event: Dict[str, Any]) -> None:
    """Append an event to the bounded in-memory store."""
    with _events_lock:
        _events.append(event)

        # Keep the newest events only.
        if len(_events) > MAX_EVENTS:
            del _events[:-MAX_EVENTS]


# ---------------------------------------------------------------------------
# Public event API
# ---------------------------------------------------------------------------

def record_event(
    *,
    event_type: str,
    status: str = "info",
    resource: Optional[str] = None,
    operation: Optional[str] = None,
    message: Optional[str] = None,
    run_id: Optional[str] = None,
    horizon: Optional[str] = None,
    trigger: Optional[str] = None,
    entity_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
    retry: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Record one structured monitoring event.

    The schema is intentionally frontend-friendly.
    """

    event = {
        "timestamp": _utc_now(),
        "event_id": uuid.uuid4().hex[:12],
        "run_id": run_id or get_current_run_id(),
        "event_type": event_type,
        "status": status,
        "resource": resource,
        "operation": operation,
        "message": message,
        "horizon": horizon,
        "trigger": trigger,
        "entity_id": entity_id,
        "duration_ms": duration_ms,
        "retry": retry,
        "metadata": metadata or {},
    }

    _append_event(event)

    return event


# ---------------------------------------------------------------------------
# Inference run context
# ---------------------------------------------------------------------------

@contextmanager
def inference_run(
    *,
    horizon: str,
    trigger: str = "manual",
) -> Iterator[str]:
    """
    Context manager around an existing inference operation.

    IMPORTANT:
    The wrapped inference function itself is not modified.
    """

    previous_run_id = getattr(_run_context, "run_id", None)

    run_id = _new_run_id()
    started = time.perf_counter()

    _run_context.run_id = run_id

    record_event(
        event_type="INFERENCE_STARTED",
        status="running",
        resource="inference-engine",
        operation="run_forecast",
        message=f"{horizon.title()} inference started.",
        run_id=run_id,
        horizon=horizon,
        trigger=trigger,
    )

    logger.info(
        "[INFERENCE_MONITOR] run_id=%s horizon=%s trigger=%s started",
        run_id,
        horizon,
        trigger,
    )

    try:
        yield run_id

    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)

        record_event(
            event_type="INFERENCE_FAILED",
            status="failed",
            resource="inference-engine",
            operation="run_forecast",
            message=str(exc),
            run_id=run_id,
            horizon=horizon,
            trigger=trigger,
            duration_ms=duration_ms,
            metadata={
                "exception_type": type(exc).__name__,
            },
        )

        logger.error(
            "[INFERENCE_MONITOR] run_id=%s horizon=%s failed: %s",
            run_id,
            horizon,
            exc,
            exc_info=True,
        )

        raise

    else:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)

        record_event(
            event_type="INFERENCE_COMPLETED",
            status="success",
            resource="inference-engine",
            operation="run_forecast",
            message=f"{horizon.title()} inference completed successfully.",
            run_id=run_id,
            horizon=horizon,
            trigger=trigger,
            duration_ms=duration_ms,
        )

        logger.info(
            "[INFERENCE_MONITOR] run_id=%s horizon=%s completed duration_ms=%s",
            run_id,
            horizon,
            duration_ms,
        )

    finally:
        _run_context.run_id = previous_run_id


# ---------------------------------------------------------------------------
# Existing logging -> structured monitoring
# ---------------------------------------------------------------------------

def _classify_log(message: str) -> Dict[str, Optional[str]]:
    """
    Classify existing application log messages into operational resources.

    This lets us observe existing code without modifying the implementation
    that generates the logs.
    """

    text = message.lower()

    if any(
        value in text
        for value in [
            "bronze",
            "fetching data from bronze",
            "bronze storage",
            "input_data.parquet",
            "source sql",
            "sql server",
        ]
    ):
        return {
            "resource": "bronze-storage",
            "operation": "data-access",
        }

    if any(
        value in text
        for value in [
            "weather",
            "open-meteo",
            "weather cache",
            "weather api",
        ]
    ):
        return {
            "resource": "weather-service",
            "operation": "weather-data",
        }

    if any(
        value in text
        for value in [
            "loaded local model",
            "model file",
            "model storage",
            "azure model",
            "deploying model",
            "model deployed",
        ]
    ):
        return {
            "resource": "model-storage",
            "operation": "model-access",
        }

    if any(
        value in text
        for value in [
            "prediction",
            "predict",
            "inference",
            "running predictions",
            "predictions successfully",
        ]
    ):
        return {
            "resource": "inference-engine",
            "operation": "prediction",
        }

    if any(
        value in text
        for value in [
            "gold",
            "predictions.parquet",
            "scenario_predictions.parquet",
            "written locally",
            "written to azure",
        ]
    ):
        return {
            "resource": "gold-storage",
            "operation": "prediction-write",
        }

    if any(
        value in text
        for value in [
            "azure",
            "blob",
            "storage account",
            "container",
        ]
    ):
        return {
            "resource": "azure-storage",
            "operation": "storage-access",
        }

    if "scheduler" in text:
        return {
            "resource": "scheduler",
            "operation": "scheduled-job",
        }

    return {
        "resource": "application",
        "operation": "application-log",
    }


class MonitoringLogHandler(logging.Handler):
    """
    Logging handler which converts existing application log messages
    into structured monitoring events.

    It is intentionally passive:
        - It does not change the original log record.
        - It does not raise exceptions.
        - It does not interrupt inference.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            run_id = get_current_run_id()

            # Ignore logs that aren't associated with an inference run.
            if not run_id:
                return

            message = record.getMessage()

            # Don't turn our own monitoring messages back into events.
            if "[INFERENCE_MONITOR]" in message:
                return

            classification = _classify_log(message)

            status = "info"

            if record.levelno >= logging.ERROR:
                status = "failed"
            elif record.levelno >= logging.WARNING:
                status = "warning"
            elif any(
                word in message.lower()
                for word in [
                    "successfully",
                    "completed",
                    "loaded",
                    "written",
                    "starting",
                    "fetching",
                    "running",
                ]
            ):
                status = "success"

            record_event(
                event_type="RESOURCE_ACTIVITY",
                status=status,
                resource=classification["resource"],
                operation=classification["operation"],
                message=message,
                run_id=run_id,
                metadata={
                    "logger": record.name,
                    "level": record.levelname,
                },
            )

        except Exception:
            # Monitoring must NEVER break the inference pipeline.
            pass


_monitoring_handler = MonitoringLogHandler()
_handler_installed = False
_handler_lock = threading.Lock()


def install_logging_monitor() -> None:
    """
    Install the monitoring logging handler exactly once.

    The handler is attached to the root logger so logs from the existing
    application modules can be observed without modifying them.
    """

    global _handler_installed

    with _handler_lock:
        if _handler_installed:
            return

        root_logger = logging.getLogger()

        if _monitoring_handler not in root_logger.handlers:
            root_logger.addHandler(_monitoring_handler)

        _handler_installed = True


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

def get_events(
    *,
    limit: int = 500,
    run_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Return monitoring events, newest first.
    """

    with _events_lock:
        events = list(_events)

    events.reverse()

    if run_id:
        events = [
            event
            for event in events
            if event.get("run_id") == run_id
        ]

    return events[:max(1, min(limit, MAX_EVENTS))]


def clear_events() -> None:
    """Clear all in-memory monitoring events."""
    with _events_lock:
        _events.clear()


# ---------------------------------------------------------------------------
# Dashboard aggregation
# ---------------------------------------------------------------------------

def get_monitoring_summary() -> Dict[str, Any]:
    """
    Build dashboard KPIs from the event stream.
    """

    events = get_events(limit=MAX_EVENTS)

    inference_events = [
        event
        for event in events
        if event.get("event_type")
        in {
            "INFERENCE_STARTED",
            "INFERENCE_COMPLETED",
            "INFERENCE_FAILED",
        }
    ]

    started = [
        event
        for event in inference_events
        if event.get("event_type") == "INFERENCE_STARTED"
    ]

    completed = [
        event
        for event in inference_events
        if event.get("event_type") == "INFERENCE_COMPLETED"
    ]

    failed = [
        event
        for event in inference_events
        if event.get("event_type") == "INFERENCE_FAILED"
    ]

    durations = [
        float(event["duration_ms"])
        for event in completed + failed
        if event.get("duration_ms") is not None
    ]

    total_runs = len(started)
    successful_runs = len(completed)
    failed_runs = len(failed)

    success_rate = (
        round((successful_runs / total_runs) * 100, 1)
        if total_runs
        else 0.0
    )

    average_duration = (
        round(sum(durations) / len(durations), 1)
        if durations
        else 0.0
    )

    last_run = started[0] if started else None

    active_run_ids = {
        event.get("run_id")
        for event in started
    }

    for event in completed + failed:
        active_run_ids.discard(event.get("run_id"))

    return {
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "failed_runs": failed_runs,
        "success_rate": success_rate,
        "average_duration_ms": average_duration,
        "last_run": last_run,
        "active_runs": len(active_run_ids),
        "event_count": len(events),
    }


def get_resource_summary() -> List[Dict[str, Any]]:
    """
    Aggregate resource-level activity.
    """

    events = get_events(limit=MAX_EVENTS)

    resource_events = [
        event
        for event in events
        if event.get("event_type") == "RESOURCE_ACTIVITY"
    ]

    counters: Dict[str, Counter] = {}
    messages: Dict[str, List[str]] = {}

    for event in resource_events:
        resource = event.get("resource") or "application"

        if resource not in counters:
            counters[resource] = Counter()
            messages[resource] = []

        status = event.get("status") or "info"

        counters[resource][status] += 1

        message = event.get("message")
        if message:
            messages[resource].append(message)

    output = []

    for resource, counter in counters.items():
        total = sum(counter.values())
        errors = counter.get("failed", 0)
        warnings = counter.get("warning", 0)

        if errors:
            health = "failed"
        elif warnings:
            health = "warning"
        else:
            health = "healthy"

        output.append(
            {
                "resource": resource,
                "requests": total,
                "errors": errors,
                "warnings": warnings,
                "health": health,
                "latest_message": messages[resource][0]
                if messages[resource]
                else None,
            }
        )

    output.sort(
        key=lambda item: item["requests"],
        reverse=True,
    )

    return output


def get_monitoring_payload() -> Dict[str, Any]:
    """
    Single payload used by the frontend.

    Keeping summary, resources and events together means the frontend only
    needs one HTTP request.
    """

    events = get_events(limit=500)

    return {
        "summary": get_monitoring_summary(),
        "resources": get_resource_summary(),
        "events": events,
        "server_time": _utc_now(),
    }


# Install the logging handler when this module is imported.
install_logging_monitor()