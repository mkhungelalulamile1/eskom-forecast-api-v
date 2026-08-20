"""
Bronze ingestion: pulls daily coal burn/supply records from the source SQL
database and writes them to Bronze storage as:

    daily/input_data.parquet
    monthly/input_data.parquet

Schema:

    entity_id
    event_date
    Input
    Replenishment

Authenticates via SQL username/password (SQL_USERNAME/SQL_PASSWORD env vars).

The source is a SQL Server instance running in-cluster and is reached over
its ClusterIP Service.
"""

import io
import os
import time
from datetime import datetime, timezone

import pandas as pd
import pyodbc

from config import Config

# ============================================================
# DATABASE OPERATION LOG
# ============================================================

# Keep the most recent 50 database operations in memory.
_DB_OPERATIONS_LOG_MAX = 50

_db_operations_log = []


def _log_db_operation(
    config: Config,
    label: str,
    query: str,
    status: str,
    duration_ms: float = None,
    row_count: int = None,
    error: str = None,
) -> None:
    """
    Store a database operation in the in-memory diagnostic log.

    This is used by the frontend Database Activity panel.
    """

    _db_operations_log.insert(
        0,
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "server": config.sql_server_hostname,
            "database": config.sql_database_name,
            "label": label,
            "query": query.strip(),
            "status": status,
            "duration_ms": (
                round(duration_ms, 1) if duration_ms is not None else None
            ),
            "row_count": row_count,
            "error": error,
        },
    )

    # Prevent unbounded memory growth.
    del _db_operations_log[_DB_OPERATIONS_LOG_MAX:]


def get_db_operations_log() -> list:
    """
    Return the database operation log.

    Most recent operation is first.
    """

    return list(_db_operations_log)


# ============================================================
# DAILY QUERY
# ============================================================

DAILY_QUERY = """
SELECT
    a.SBU_DESC AS entity_id,
    a.EVENT_DATE AS event_date,

    SUM(CAST(a.COAL_BURNT AS float)) / 1000 AS Input,

    SUM(CAST(b.COAL_QTY AS float)) / 1000 AS Replenishment

FROM COLLOPS_DAILY_BURN a

LEFT JOIN COLLOPS_DAILY_DELIVERIES b
    ON (
        a.SBU_DESC = b.SBU_DESC
        AND a.EVENT_DATE = b.EVENT_DATE
    )

WHERE
    a.METHOD = 'Actual Tons'
    AND b.METHOD = 'Actual Tons'
    AND b.SUPPLIER_NAME <> 'Total Imports'
    AND b.SUPPLIERID NOT IN (99, 999, 10000)

GROUP BY
    a.SBU_DESC,
    a.EVENT_DATE

ORDER BY
    a.SBU_DESC,
    a.EVENT_DATE
"""


# ============================================================
# MONTHLY QUERY
# ============================================================
#
# IMPORTANT:
#
# DATETRUNC(month, EVENT_DATE) returns the FIRST day of the month.
#
# Example:
#
# 2025-01-15 -> 2025-01-01
# 2025-02-28 -> 2025-02-01
#
# This matches the monthly Bronze/training convention currently
# used by the forecasting pipeline.
# ============================================================

MONTHLY_QUERY = """
SELECT
    a.SBU_DESC AS entity_id,

    DATETRUNC(month, a.EVENT_DATE) AS event_date,

    SUM(CAST(a.COAL_BURNT AS float)) / 1000 AS Input,

    SUM(CAST(b.COAL_QTY AS float)) / 1000 AS Replenishment

FROM COLLOPS_DAILY_BURN a

LEFT JOIN COLLOPS_DAILY_DELIVERIES b
    ON (
        a.SBU_DESC = b.SBU_DESC
        AND a.EVENT_DATE = b.EVENT_DATE
    )

WHERE
    a.METHOD = 'Actual Tons'
    AND b.METHOD = 'Actual Tons'
    AND b.SUPPLIER_NAME <> 'Total Imports'
    AND b.SUPPLIERID NOT IN (99, 999, 10000)

GROUP BY
    a.SBU_DESC,
    DATETRUNC(month, a.EVENT_DATE)

ORDER BY
    a.SBU_DESC,
    DATETRUNC(month, a.EVENT_DATE)
"""


# ============================================================
# DATABASE CONNECTION
# ============================================================


def _connect(config: Config) -> pyodbc.Connection:
    """
    Open a connection to the source SQL Server.

    Authentication uses:

        SQL_USERNAME
        SQL_PASSWORD

    from environment variables.
    """

    if not config.sql_server_hostname or not config.sql_database_name:
        raise RuntimeError(
            "SQL_SERVER_HOSTNAME and SQL_DATABASE_NAME must both "
            "be configured before ingesting from the source database."
        )

    username = os.environ.get("SQL_USERNAME")
    password = os.environ.get("SQL_PASSWORD")

    if not username or not password:
        raise RuntimeError(
            "SQL_USERNAME and SQL_PASSWORD must both be configured "
            "before ingesting from the source database."
        )

    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={config.sql_server_hostname};"
        f"DATABASE={config.sql_database_name};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
    )

    start = time.monotonic()

    try:
        conn = pyodbc.connect(connection_string)

    except Exception as e:
        _log_db_operation(
            config=config,
            label="Connect",
            query=f"(connect to {config.sql_server_hostname})",
            status="failed",
            duration_ms=(time.monotonic() - start) * 1000,
            error=str(e),
        )

        raise

    _log_db_operation(
        config=config,
        label="Connect",
        query=f"(connect to {config.sql_server_hostname})",
        status="success",
        duration_ms=(time.monotonic() - start) * 1000,
    )

    return conn


# ============================================================
# EXECUTE SQL QUERY
# ============================================================


def _fetch_query(
    query: str,
    conn: pyodbc.Connection,
    config: Config,
    label: str = "",
) -> pd.DataFrame:
    """
    Execute a SQL query and return the result as a DataFrame.
    """

    start = time.monotonic()

    try:
        df = pd.read_sql(
            query,
            conn,
        )

    except Exception as e:

        _log_db_operation(
            config=config,
            label=label,
            query=query,
            status="failed",
            duration_ms=(time.monotonic() - start) * 1000,
            error=str(e),
        )

        raise

    _log_db_operation(
        config=config,
        label=label,
        query=query,
        status="success",
        duration_ms=(time.monotonic() - start) * 1000,
        row_count=len(df),
    )

    return df


# ============================================================
# VALIDATE INGESTED DATA
# ============================================================


def _validate_ingested_dataframe(
    df: pd.DataFrame,
    label: str,
) -> pd.DataFrame:
    """
    Validate and normalize an ingested dataframe before writing it.

    Expected schema:

        entity_id
        event_date
        Input
        Replenishment
    """

    if df is None or df.empty:
        raise ValueError(f"{label} returned no records.")

    required_columns = [
        "entity_id",
        "event_date",
        "Input",
        "Replenishment",
    ]

    missing_columns = [
        column for column in required_columns if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"{label} is missing required columns: " f"{missing_columns}"
        )

    df = df.copy()

    # Normalize date.
    df["event_date"] = pd.to_datetime(
        df["event_date"],
        errors="coerce",
    )

    if df["event_date"].isna().any():
        raise ValueError(f"{label} contains invalid event_date values.")

    # Normalize numeric columns.
    for column in [
        "Input",
        "Replenishment",
    ]:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    # Reject invalid numeric values.
    invalid_numeric = df[["Input", "Replenishment"]].isna().any(axis=1)

    if invalid_numeric.any():
        raise ValueError(
            f"{label} contains invalid numeric values "
            f"in Input/Replenishment."
        )

    # Reject infinities.
    numeric_values = df[["Input", "Replenishment"]].to_numpy()

    if (
        not pd.Series(numeric_values.flatten())
        .map(
            lambda value: pd.notna(value)
            and value
            not in (
                float("inf"),
                float("-inf"),
            )
        )
        .all()
    ):
        raise ValueError(f"{label} contains infinite numeric values.")

    # Remove accidental duplicate entity/date records.
    duplicates = df.duplicated(
        subset=[
            "entity_id",
            "event_date",
        ]
    )

    if duplicates.any():
        print(
            f"WARNING: {label} contains "
            f"{duplicates.sum()} duplicate entity/date records. "
            "Keeping the first occurrence."
        )

        df = df.loc[~duplicates].copy()

    # Keep the exact schema expected by Bronze.
    df = df[
        [
            "entity_id",
            "event_date",
            "Input",
            "Replenishment",
        ]
    ]

    # Sort consistently.
    df = df.sort_values(
        [
            "entity_id",
            "event_date",
        ]
    ).reset_index(drop=True)

    return df


# ============================================================
# WRITE TO BRONZE
# ============================================================


def _write_to_bronze(
    df: pd.DataFrame,
    blob_name: str,
    config: Config,
) -> None:
    """
    Write a Bronze dataframe to Azure Blob Storage.

    If Azure storage is unavailable, save locally instead.
    """

    if config.has_storage_access():

        try:
            out_stream = io.BytesIO()

            df.to_parquet(
                out_stream,
                index=False,
            )

            out_stream.seek(0)

            blob_service_client = config.get_blob_service_client()

            blob_client = blob_service_client.get_blob_client(
                container=config.bronze_container,
                blob=blob_name,
            )

            blob_client.upload_blob(
                out_stream.getvalue(),
                overwrite=True,
            )

            print(
                "Ingested data successfully written "
                f"to Bronze Storage: "
                f"{config.bronze_container}/{blob_name}"
            )

            return

        except Exception as e:

            print(
                f"Error uploading {blob_name} "
                f"to Bronze Storage: {e}. "
                "Saving locally."
            )

    # --------------------------------------------------------
    # LOCAL FALLBACK
    # --------------------------------------------------------

    local_out_path = os.path.join(
        config.local_bronze_dir,
        blob_name,
    )

    os.makedirs(
        os.path.dirname(local_out_path),
        exist_ok=True,
    )

    df.to_parquet(
        local_out_path,
        index=False,
    )

    print(
        "Ingested data successfully written locally to: " f"{local_out_path}"
    )


# ============================================================
# MAIN BRONZE INGESTION
# ============================================================


def write_to_training_data_bronze(
    config: Config = None,
) -> None:
    """
    Pull daily and monthly coal burn/supply records from SQL
    and write them to Bronze storage.

    Outputs:

        daily/input_data.parquet
        monthly/input_data.parquet
    """

    config = config or Config()

    print("\n==================================================")
    print("Starting Bronze database ingestion")
    print("==================================================")

    # --------------------------------------------------------
    # CONNECT
    # --------------------------------------------------------

    conn = _connect(config)

    try:

        # ----------------------------------------------------
        # DAILY
        # ----------------------------------------------------

        print("\nFetching daily Bronze data...")

        daily = _fetch_query(
            DAILY_QUERY,
            conn,
            config,
            label="Daily Bronze ingest",
        )

        daily = _validate_ingested_dataframe(
            daily,
            "Daily Bronze data",
        )

        print(f"Daily records fetched: {len(daily):,}")

        # ----------------------------------------------------
        # MONTHLY
        # ----------------------------------------------------

        print("\nFetching monthly Bronze data...")

        monthly = _fetch_query(
            MONTHLY_QUERY,
            conn,
            config,
            label="Monthly Bronze ingest",
        )

        monthly = _validate_ingested_dataframe(
            monthly,
            "Monthly Bronze data",
        )

        print(f"Monthly records fetched: " f"{len(monthly):,}")

    finally:

        conn.close()

        print("\nSQL connection closed.")

    # --------------------------------------------------------
    # WRITE DAILY
    # --------------------------------------------------------

    _write_to_bronze(
        daily,
        "daily/input_data.parquet",
        config,
    )

    # --------------------------------------------------------
    # WRITE MONTHLY
    # --------------------------------------------------------

    _write_to_bronze(
        monthly,
        "monthly/input_data.parquet",
        config,
    )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print("\n==================================================")
    print("Bronze ingestion completed successfully")
    print("==================================================")

    print(f"Daily rows:   {len(daily):,}")

    print(f"Monthly rows: {len(monthly):,}")

    print(f"Daily entities: " f"{daily['entity_id'].nunique()}")

    print(f"Monthly entities: " f"{monthly['entity_id'].nunique()}")

    print(
        f"Daily date range: "
        f"{daily['event_date'].min().date()} "
        f"-> "
        f"{daily['event_date'].max().date()}"
    )

    print(
        f"Monthly date range: "
        f"{monthly['event_date'].min().date()} "
        f"-> "
        f"{monthly['event_date'].max().date()}"
    )


# ============================================================
# SCRIPT ENTRY POINT
# ============================================================

if __name__ == "__main__":
    write_to_training_data_bronze()
