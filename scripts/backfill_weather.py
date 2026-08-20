import os
import sys
import time
import logging
from pathlib import Path
from datetime import datetime

import pandas as pd
import requests

# Make project modules importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "training"))

from training import weather

ENTITY_COORDINATES = weather.ENTITY_COORDINATES
ARCHIVE_API_URL = weather.ARCHIVE_API_URL
DAILY_VARIABLES = weather.DAILY_VARIABLES
from config import Config


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

START_DATE = "2014-01-01"
END_DATE = "2025-06-30"

REQUEST_TIMEOUT = 60

# Wait between successful requests so we don't hammer Open-Meteo.
REQUEST_DELAY_SECONDS = 5

# Retries for HTTP 429 / temporary failures.
MAX_RETRIES = 6

CACHE_DIR = Path("data/weather")

# Only the columns required by the model need to be populated,
# but we keep the full weather response because the application
# also uses these fields.
WEATHER_COLUMNS = [
    "date",
    "temp_max_c",
    "temp_min_c",
    "rainfall_mm",
    "cloud_cover_pct",
    "humidity_pct",
    "wind_speed_kmh",
    "weather_code",
    "uv_index",
    "sunshine_seconds",
]


# ---------------------------------------------------------
# Open-Meteo
# ---------------------------------------------------------

def fetch_weather(
    entity_id: str,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:

    latitude, longitude = ENTITY_COORDINATES.get(
        entity_id,
        (-26.09, 28.99),
    )

    daily_variables = ",".join(DAILY_VARIABLES.keys())

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": daily_variables,
        "timezone": "Africa/Johannesburg",
    }

    for attempt in range(1, MAX_RETRIES + 1):

        try:
            logging.info(
                "Fetching weather for %s: %s -> %s",
                entity_id,
                start_date,
                end_date,
            )

            response = requests.get(
                ARCHIVE_API_URL,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )

            if response.status_code == 429:

                retry_after = response.headers.get("Retry-After")

                if retry_after:
                    wait_seconds = max(
                        int(retry_after),
                        REQUEST_DELAY_SECONDS,
                    )
                else:
                    wait_seconds = min(
                        10 * (2 ** (attempt - 1)),
                        120,
                    )

                logging.warning(
                    "Open-Meteo rate limited %s. "
                    "Attempt %d/%d. Waiting %d seconds.",
                    entity_id,
                    attempt,
                    MAX_RETRIES,
                    wait_seconds,
                )

                time.sleep(wait_seconds)
                continue

            response.raise_for_status()

            payload = response.json()

            if "daily" not in payload:
                raise RuntimeError(
                    f"No daily weather data returned for {entity_id}"
                )

            daily = payload["daily"]

            dates = pd.to_datetime(daily["time"])

            result = pd.DataFrame(
                {
                    "date": dates,
                    "temp_max_c": daily.get(
                        "temperature_2m_max"
                    ),
                    "temp_min_c": daily.get(
                        "temperature_2m_min"
                    ),
                    "rainfall_mm": daily.get(
                        "precipitation_sum"
                    ),
                    "cloud_cover_pct": daily.get(
                        "cloud_cover_mean"
                    ),
                    "humidity_pct": daily.get(
                        "relative_humidity_2m_mean"
                    ),
                    "wind_speed_kmh": daily.get(
                        "wind_speed_10m_max"
                    ),
                    "weather_code": daily.get(
                        "weather_code"
                    ),
                    "uv_index": daily.get(
                        "uv_index_max"
                    ),
                    "sunshine_seconds": daily.get(
                        "sunshine_duration"
                    ),
                }
            )

            result["date"] = pd.to_datetime(
                result["date"]
            ).dt.normalize()

            result = (
                result
                .drop_duplicates("date")
                .sort_values("date")
                .reset_index(drop=True)
            )

            logging.info(
                "Received %d weather records for %s",
                len(result),
                entity_id,
            )

            return result

        except requests.RequestException as exc:

            if attempt == MAX_RETRIES:
                raise RuntimeError(
                    f"Failed to download weather for "
                    f"{entity_id} after {MAX_RETRIES} attempts: {exc}"
                ) from exc

            wait_seconds = min(
                10 * (2 ** (attempt - 1)),
                120,
            )

            logging.warning(
                "Weather request failed for %s: %s. "
                "Retrying in %d seconds.",
                entity_id,
                exc,
                wait_seconds,
            )

            time.sleep(wait_seconds)

    raise RuntimeError(
        f"Unable to download weather for {entity_id}"
    )


# ---------------------------------------------------------
# Cache
# ---------------------------------------------------------

def cache_path(entity_id: str) -> Path:

    safe_name = entity_id.replace(" ", "_")

    return CACHE_DIR / f"weather_cache_{safe_name}.parquet"


def load_existing_cache(entity_id: str) -> pd.DataFrame:

    path = cache_path(entity_id)

    if not path.exists():
        return pd.DataFrame(columns=WEATHER_COLUMNS)

    try:

        df = pd.read_parquet(path)

        if "date" not in df.columns:
            logging.warning(
                "Cache %s does not contain date column.",
                path,
            )
            return pd.DataFrame(columns=WEATHER_COLUMNS)

        df["date"] = pd.to_datetime(
            df["date"]
        ).dt.normalize()

        return df

    except Exception as exc:

        logging.warning(
            "Could not read cache %s: %s",
            path,
            exc,
        )

        return pd.DataFrame(columns=WEATHER_COLUMNS)


def merge_cache(
    entity_id: str,
    new_weather: pd.DataFrame,
) -> None:

    CACHE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    existing = load_existing_cache(entity_id)

    if existing.empty:
        merged = new_weather.copy()
    else:
        merged = pd.concat(
            [
                existing,
                new_weather,
            ],
            ignore_index=True,
        )

    # Ensure all expected columns exist.
    for column in WEATHER_COLUMNS:

        if column not in merged.columns:
            merged[column] = pd.NA

    merged = merged[WEATHER_COLUMNS]

    merged["date"] = pd.to_datetime(
        merged["date"]
    ).dt.normalize()

    merged = (
        merged
        .drop_duplicates(
            subset=["date"],
            keep="last",
        )
        .sort_values("date")
        .reset_index(drop=True)
    )

    path = cache_path(entity_id)

    merged.to_parquet(
        path,
        index=False,
    )

    logging.info(
        "Saved %s: %d records (%s -> %s)",
        path,
        len(merged),
        merged["date"].min(),
        merged["date"].max(),
    )


# ---------------------------------------------------------
# Backfill
# ---------------------------------------------------------

def backfill_entity(entity_id: str) -> None:

    path = cache_path(entity_id)

    existing = load_existing_cache(entity_id)

    required_start = pd.Timestamp(
        START_DATE
    )

    required_end = pd.Timestamp(
        END_DATE
    )

    logging.info(
        "\n%s\n%s\n",
        "=" * 70,
        f"Processing {entity_id}",
    )

    if not existing.empty:

        existing_start = existing["date"].min()
        existing_end = existing["date"].max()

        logging.info(
            "Existing cache: %s -> %s (%d records)",
            existing_start,
            existing_end,
            len(existing),
        )

        # If the entire requested training period is already present,
        # don't download it again.
        if (
            existing_start <= required_start
            and existing_end >= required_end
        ):
            logging.info(
                "%s already contains the complete "
                "training weather period.",
                entity_id,
            )
            return

    # We deliberately fetch the complete historical training period.
    # The result is merged with the existing cache, so existing recent
    # forecast data is preserved.
    weather = fetch_weather(
        entity_id,
        START_DATE,
        END_DATE,
    )

    merge_cache(
        entity_id,
        weather,
    )

    time.sleep(
        REQUEST_DELAY_SECONDS
    )


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    CACHE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    entities = list(
        ENTITY_COORDINATES.keys()
    )

    logging.info(
        "Starting weather backfill"
    )

    logging.info(
        "Period: %s -> %s",
        START_DATE,
        END_DATE,
    )

    logging.info(
        "Stations: %d",
        len(entities),
    )

    for index, entity_id in enumerate(
        entities,
        start=1,
    ):

        logging.info(
            "\n[%d/%d] %s",
            index,
            len(entities),
            entity_id,
        )

        try:

            backfill_entity(
                entity_id
            )

        except Exception as exc:

            logging.error(
                "FAILED %s: %s",
                entity_id,
                exc,
            )

            # Continue with the other stations.
            continue

    logging.info(
        "\nWeather backfill completed."
    )


if __name__ == "__main__":
    main()
