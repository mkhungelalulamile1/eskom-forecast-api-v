"""
Weather time-series module.

Provides historical and forecast weather data for Eskom power-station
locations using Open-Meteo.

The module supports:

    Open-Meteo
        ↓
    local / Azure cache
        ↓
    daily weather features
        ↓
    monthly weather aggregation when required
        ↓
    quintile encoding
        ↓
    model training / inference

Important:
    Weather is requested at daily granularity, but monthly forecasting
    requires weather features aligned to month-end dates such as:

        2025-01-31
        2025-02-28
        2025-03-31

Therefore weather_features_by_date() supports both daily and monthly
date alignment.

The module also prefers cached weather data before contacting Open-Meteo.
This prevents repeated training runs from unnecessarily triggering API
rate limits.
"""

import io
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd
import requests


# ---------------------------------------------------------------------------
# IMPORT CONFIG
# ---------------------------------------------------------------------------

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "src",
    ),
)

from config import Config


# ---------------------------------------------------------------------------
# DEFAULT LOCATION
# ---------------------------------------------------------------------------

DEFAULT_LATITUDE = -26.09
DEFAULT_LONGITUDE = 28.99
DEFAULT_TIMEZONE = "Africa/Johannesburg"


# ---------------------------------------------------------------------------
# ESKOM POWER-STATION COORDINATES
# ---------------------------------------------------------------------------

ENTITY_COORDINATES = {
    "Arnot": (-25.93, 29.79),
    "Camden": (-26.65, 30.11),
    "Duvha": (-25.99, 29.34),
    "Grootvlei": (-26.79, 28.60),
    "Hendrina": (-26.02, 29.68),
    "Kendal": (-26.09, 28.99),
    "Komati": (-26.13, 29.48),
    "Kriel": (-26.27, 29.17),
    "Kriel OC": (-26.27, 29.17),
    "Kriel UG": (-26.27, 29.17),
    "Kusile": (-25.90, 28.98),
    "Kusile_Limestone": (-25.90, 28.98),
    "Lethabo": (-26.74, 27.98),
    "Majuba": (-27.09, 29.79),
    "Matimba": (-23.67, 27.61),
    "Matla": (-26.28, 29.13),
    "Medupi": (-23.68, 27.53),
    "Tutuka": (-26.77, 29.35),
}


def coordinates_for_entity(entity_id: str) -> tuple:
    """
    Return latitude/longitude for a power station.

    Unknown entities fall back to Kendal.
    """

    return ENTITY_COORDINATES.get(
        entity_id,
        (
            DEFAULT_LATITUDE,
            DEFAULT_LONGITUDE,
        ),
    )


# ---------------------------------------------------------------------------
# OPEN-METEO
# ---------------------------------------------------------------------------

ARCHIVE_API_URL = (
    "https://archive-api.open-meteo.com/v1/archive"
)

FORECAST_API_URL = (
    "https://api.open-meteo.com/v1/forecast"
)

REQUEST_TIMEOUT_SECONDS = 30


# ---------------------------------------------------------------------------
# CACHE
# ---------------------------------------------------------------------------

DEFAULT_CACHE_KEY = "default"


def _cache_blob_name(entity_id: str = None) -> str:
    """
    Generate cache filename for a power station.
    """

    safe_key = (
        entity_id or DEFAULT_CACHE_KEY
    ).replace(" ", "_")

    return (
        f"weather_cache_{safe_key}.parquet"
    )


# ---------------------------------------------------------------------------
# WEATHER VARIABLES
# ---------------------------------------------------------------------------

DAILY_VARIABLES = {
    "temperature_2m_max": "temp_max_c",
    "temperature_2m_min": "temp_min_c",
    "precipitation_sum": "rainfall_mm",
    "cloud_cover_mean": "cloud_cover_pct",
    "relative_humidity_2m_mean": "humidity_pct",
    "wind_speed_10m_max": "wind_speed_kmh",
    "weather_code": "weather_code",
    "uv_index_max": "uv_index",
    "sunshine_duration": "sunshine_seconds",
}


# ---------------------------------------------------------------------------
# WEATHER LABELS
# ---------------------------------------------------------------------------

WEATHER_CODE_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


# ---------------------------------------------------------------------------
# SOUTH AFRICAN SEASONS
# ---------------------------------------------------------------------------

SEASON_BY_MONTH = {
    12: 0,
    1: 0,
    2: 0,
    3: 1,
    4: 1,
    5: 1,
    6: 2,
    7: 2,
    8: 2,
    9: 3,
    10: 3,
    11: 3,
}


def season_for_month(month: int) -> int:
    """
    0 = Summer
    1 = Autumn
    2 = Winter
    3 = Spring
    """

    return SEASON_BY_MONTH[month]


# ---------------------------------------------------------------------------
# FEATURE DEFINITIONS
# ---------------------------------------------------------------------------

QUANTILE_WEATHER_COLS = [
    "temp_max_c",
    "temp_min_c",
    "humidity_pct",
]

WEATHER_FEATURE_COLS = [
    "temp_max_c",
    "temp_min_c",
    "humidity_pct",
    "season",
]

N_QUANTILES = 5


# ---------------------------------------------------------------------------
# NUMBER CLEANING
# ---------------------------------------------------------------------------


def _numeric_or_nan(value):
    """
    Safely convert a value to float.
    """

    if value is None:
        return float("nan")

    try:
        number = float(value)
    except (
        TypeError,
        ValueError,
    ):
        return float("nan")

    if not pd.notna(number):
        return float("nan")

    return number


# ---------------------------------------------------------------------------
# OPEN-METEO REQUEST
# ---------------------------------------------------------------------------


def _request_daily_weather(
    url: str,
    params: dict,
) -> pd.DataFrame:
    """
    Request daily weather from Open-Meteo.
    """

    response = requests.get(
        url,
        params=params,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    response.raise_for_status()

    payload = response.json()

    daily = payload.get(
        "daily",
        {},
    )

    dates = daily.get(
        "time",
        [],
    )

    data = {
        "date": pd.to_datetime(dates)
    }

    for (
        source_key,
        column_name,
    ) in DAILY_VARIABLES.items():

        values = daily.get(
            source_key,
            [None] * len(dates),
        )

        data[column_name] = values

    result = pd.DataFrame(data)

    if not result.empty:
        result["date"] = pd.to_datetime(
            result["date"]
        ).dt.normalize()

    return result


# ---------------------------------------------------------------------------
# HISTORICAL WEATHER
# ---------------------------------------------------------------------------


def get_historical_weather(
    start_date: str,
    end_date: str,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    timezone: str = DEFAULT_TIMEZONE,
) -> pd.DataFrame:

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(
            DAILY_VARIABLES.keys()
        ),
        "timezone": timezone,
    }

    logging.info(
        "Fetching historical weather "
        f"{start_date} → {end_date} "
        f"for ({latitude}, {longitude})"
    )

    return _request_daily_weather(
        ARCHIVE_API_URL,
        params,
    )


# ---------------------------------------------------------------------------
# FORECAST WEATHER
# ---------------------------------------------------------------------------


def get_forecast_weather(
    forecast_days: int = 16,
    past_days: int = 0,
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    timezone: str = DEFAULT_TIMEZONE,
) -> pd.DataFrame:

    forecast_days = max(
        1,
        min(
            forecast_days,
            16,
        ),
    )

    past_days = max(
        0,
        min(
            past_days,
            92,
        ),
    )

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": ",".join(
            DAILY_VARIABLES.keys()
        ),
        "timezone": timezone,
        "forecast_days": forecast_days,
        "past_days": past_days,
    }

    logging.info(
        "Fetching weather forecast "
        f"forecast_days={forecast_days}, "
        f"past_days={past_days} "
        f"for ({latitude}, {longitude})"
    )

    return _request_daily_weather(
        FORECAST_API_URL,
        params,
    )


# ---------------------------------------------------------------------------
# CACHE HELPERS
# ---------------------------------------------------------------------------


def _weather_cache_exists(
    config: Config,
    entity_id: str = None,
) -> bool:

    blob_name = _cache_blob_name(
        entity_id
    )

    if config.has_storage_access():

        try:

            blob_service_client = (
                config.get_blob_service_client()
            )

            blob_client = (
                blob_service_client.get_blob_client(
                    container=config.weather_container,
                    blob=blob_name,
                )
            )

            if blob_client.exists():
                return True

        except Exception as exc:

            logging.warning(
                "Could not check Azure weather cache: %s",
                exc,
            )

    local_path = os.path.join(
        config.local_weather_dir,
        blob_name,
    )

    return os.path.exists(
        local_path
    )


def _load_weather_cache(
    config: Config,
    entity_id: str = None,
) -> pd.DataFrame:

    blob_name = _cache_blob_name(
        entity_id
    )

    # ---------------------------------------------------------
    # Azure
    # ---------------------------------------------------------

    if config.has_storage_access():

        try:

            blob_service_client = (
                config.get_blob_service_client()
            )

            blob_client = (
                blob_service_client.get_blob_client(
                    container=config.weather_container,
                    blob=blob_name,
                )
            )

            if blob_client.exists():

                data = (
                    blob_client.download_blob()
                    .readall()
                )

                df = pd.read_parquet(
                    io.BytesIO(data)
                )

                if not df.empty:

                    df["date"] = pd.to_datetime(
                        df["date"]
                    ).dt.normalize()

                return df

        except Exception as exc:

            logging.warning(
                "Could not load Azure weather cache: %s",
                exc,
            )

    # ---------------------------------------------------------
    # Local
    # ---------------------------------------------------------

    local_path = os.path.join(
        config.local_weather_dir,
        blob_name,
    )

    if not os.path.exists(local_path):
        return pd.DataFrame()

    try:

        df = pd.read_parquet(
            local_path
        )

        if not df.empty:

            df["date"] = pd.to_datetime(
                df["date"]
            ).dt.normalize()

        return df

    except Exception as exc:

        logging.warning(
            "Could not load local weather cache %s: %s",
            local_path,
            exc,
        )

        return pd.DataFrame()


def _save_weather_cache(
    df: pd.DataFrame,
    config: Config,
    entity_id: str = None,
) -> None:

    if df.empty:
        return

    blob_name = _cache_blob_name(
        entity_id
    )

    df = df.copy()

    df["date"] = pd.to_datetime(
        df["date"]
    ).dt.normalize()

    df = (
        df.sort_values("date")
        .drop_duplicates(
            subset="date",
            keep="last",
        )
        .reset_index(drop=True)
    )

    # ---------------------------------------------------------
    # Local cache
    # ---------------------------------------------------------

    local_path = os.path.join(
        config.local_weather_dir,
        blob_name,
    )

    os.makedirs(
        os.path.dirname(local_path),
        exist_ok=True,
    )

    df.to_parquet(
        local_path,
        index=False,
    )

    # ---------------------------------------------------------
    # Azure cache
    # ---------------------------------------------------------

    if config.has_storage_access():

        try:

            out_stream = io.BytesIO()

            df.to_parquet(
                out_stream,
                index=False,
            )

            out_stream.seek(0)

            blob_service_client = (
                config.get_blob_service_client()
            )

            blob_client = (
                blob_service_client.get_blob_client(
                    container=config.weather_container,
                    blob=blob_name,
                )
            )

            blob_client.upload_blob(
                out_stream.getvalue(),
                overwrite=True,
            )

        except Exception as exc:

            logging.warning(
                "Could not upload weather cache: %s",
                exc,
            )


# ---------------------------------------------------------------------------
# FETCH WEATHER TIMESERIES
# ---------------------------------------------------------------------------


def _fetch_weather_timeseries(
    start_date: str,
    end_date: str,
    latitude: float,
    longitude: float,
    timezone: str,
) -> pd.DataFrame:

    start = datetime.strptime(
        start_date,
        "%Y-%m-%d",
    ).date()

    end = datetime.strptime(
        end_date,
        "%Y-%m-%d",
    ).date()

    if end < start:
        raise ValueError(
            "end_date must not be before start_date"
        )

    today = date.today()

    frames = []

    # ---------------------------------------------------------
    # Historical
    # ---------------------------------------------------------

    if start < today:

        historical_end = min(
            end,
            today - timedelta(days=1),
        )

        if historical_end >= start:

            frames.append(
                get_historical_weather(
                    start_date=start.isoformat(),
                    end_date=historical_end.isoformat(),
                    latitude=latitude,
                    longitude=longitude,
                    timezone=timezone,
                )
            )

    # ---------------------------------------------------------
    # Forecast
    # ---------------------------------------------------------

    if end >= today:

        forecast_start = max(
            start,
            today,
        )

        forecast_days = max(
            (end - today).days + 1,
            1,
        )

        frames.append(
            get_forecast_weather(
                forecast_days=forecast_days,
                past_days=0,
                latitude=latitude,
                longitude=longitude,
                timezone=timezone,
            )
        )

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(
        frames,
        ignore_index=True,
    )

    if combined.empty:
        return combined

    combined["date"] = pd.to_datetime(
        combined["date"]
    ).dt.normalize()

    combined = (
        combined
        .drop_duplicates(
            subset="date",
            keep="last",
        )
        .sort_values("date")
        .reset_index(drop=True)
    )

    mask = (
        (combined["date"] >= pd.Timestamp(start))
        &
        (combined["date"] <= pd.Timestamp(end))
    )

    return combined.loc[
        mask
    ].reset_index(drop=True)


# ---------------------------------------------------------------------------
# PUBLIC WEATHER TIMESERIES
# ---------------------------------------------------------------------------


def get_weather_timeseries(
    start_date: str,
    end_date: str = None,
    entity_id: str = None,
    latitude: float = None,
    longitude: float = None,
    timezone: str = DEFAULT_TIMEZONE,
) -> pd.DataFrame:
    """
    Return daily weather for the requested period.

    Resolution order:

    1. Return fully covered cached weather.
    2. Attempt Open-Meteo.
    3. Merge successful fresh data into cache.
    4. If Open-Meteo fails, return the portion of cache that exists.
    5. If the requested historical range is unavailable, return an empty
       dataframe so get_weather_features() can apply its climatological
       fallback.

    Cached recent weather is NEVER copied into unrelated historical dates.
    """

    if end_date is None:
        end_date = date.today().isoformat()

    if latitude is None or longitude is None:
        latitude, longitude = coordinates_for_entity(entity_id)

    config = Config()

    requested_start = pd.Timestamp(start_date).normalize()
    requested_end = pd.Timestamp(end_date).normalize()

    if requested_end < requested_start:
        raise ValueError(
            f"end_date ({requested_end.date()}) cannot be before "
            f"start_date ({requested_start.date()})"
        )

    cached = _load_weather_cache(
        config,
        entity_id,
    )

    if not cached.empty:
        cached["date"] = pd.to_datetime(
            cached["date"]
        ).dt.normalize()

        cached = (
            cached
            .sort_values("date")
            .drop_duplicates(
                subset="date",
                keep="last",
            )
            .reset_index(drop=True)
        )

        cached_start = cached["date"].min()
        cached_end = cached["date"].max()

        # Full cache coverage.
        if (
            cached_start <= requested_start
            and cached_end >= requested_end
        ):
            logging.info(
                "Returning fully cached weather for %s: %s -> %s",
                entity_id,
                requested_start.date(),
                requested_end.date(),
            )

            return cached[
                (cached["date"] >= requested_start)
                & (cached["date"] <= requested_end)
            ].reset_index(drop=True)

    # ---------------------------------------------------------
    # Open-Meteo
    # ---------------------------------------------------------

    try:
        fresh = _fetch_weather_timeseries(
            start_date=requested_start.strftime("%Y-%m-%d"),
            end_date=requested_end.strftime("%Y-%m-%d"),
            latitude=latitude,
            longitude=longitude,
            timezone=timezone,
        )

        if not fresh.empty:
            fresh["date"] = pd.to_datetime(
                fresh["date"]
            ).dt.normalize()

            if not cached.empty:
                combined = pd.concat(
                    [cached, fresh],
                    ignore_index=True,
                )
            else:
                combined = fresh.copy()

            combined["date"] = pd.to_datetime(
                combined["date"]
            ).dt.normalize()

            combined = (
                combined
                .drop_duplicates(
                    subset="date",
                    keep="last",
                )
                .sort_values("date")
                .reset_index(drop=True)
            )

            _save_weather_cache(
                combined,
                config,
                entity_id,
            )

            result = combined[
                (combined["date"] >= requested_start)
                & (combined["date"] <= requested_end)
            ].reset_index(drop=True)

            if not result.empty:
                return result

    except Exception as exc:
        logging.error(
            "Open-Meteo request failed for %s: %s. "
            "Falling back to cached weather data.",
            entity_id,
            exc,
        )

    # ---------------------------------------------------------
    # Partial cache fallback
    # ---------------------------------------------------------

    if not cached.empty:
        result = cached[
            (cached["date"] >= requested_start)
            & (cached["date"] <= requested_end)
        ].reset_index(drop=True)

        if not result.empty:
            logging.warning(
                "Returning partial cached weather for %s: %s -> %s",
                entity_id,
                requested_start.date(),
                requested_end.date(),
            )
            return result

    # ---------------------------------------------------------
    # No usable weather data.
    #
    # IMPORTANT:
    # Do not fabricate historical weather here.
    # get_weather_features() handles the climatological fallback.
    # ---------------------------------------------------------

    logging.warning(
        "No weather data available for %s %s -> %s",
        entity_id,
        requested_start.date(),
        requested_end.date(),
    )

    return pd.DataFrame(
        columns=[
            "date",
            *DAILY_VARIABLES.values(),
        ]
    )


# ---------------------------------------------------------------------------
# WEATHER FEATURES
# ---------------------------------------------------------------------------


def get_weather_features(
    start_date: str,
    end_date: str = None,
    entity_id: str = None,
    latitude: float = None,
    longitude: float = None,
    timezone: str = DEFAULT_TIMEZONE,
) -> pd.DataFrame:
    """
    Build weather features for model training/inference.

    Weather is obtained in this order:

    1. Existing local/Azure weather cache or Open-Meteo via
       get_weather_timeseries().
    2. If the requested historical range is unavailable, use a deterministic
       climatological fallback.

    The fallback exists because Open-Meteo can return HTTP 429 rate-limit
    responses and the local cache may only contain recent weather. It does
    NOT copy recent cached weather into historical years.

    The fallback is deterministic and produces a complete daily feature table
    so training/inference never receives an all-NaN weather block.

    Returns
    -------
    pd.DataFrame
        Columns:
            date
            temp_max_c
            temp_min_c
            humidity_pct
            season
    """

    requested_start = pd.Timestamp(start_date).normalize()

    if end_date is None:
        requested_end = pd.Timestamp.today().normalize()
    else:
        requested_end = pd.Timestamp(end_date).normalize()

    if requested_end < requested_start:
        raise ValueError(
            f"end_date ({requested_end.date()}) cannot be before "
            f"start_date ({requested_start.date()})"
        )

    # ------------------------------------------------------------------
    # First choice: real weather data / cache.
    # ------------------------------------------------------------------

    df = get_weather_timeseries(
        start_date=requested_start.strftime("%Y-%m-%d"),
        end_date=requested_end.strftime("%Y-%m-%d"),
        entity_id=entity_id,
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
    )

    if not df.empty:
        features = df[
            [
                "date",
                "temp_max_c",
                "temp_min_c",
                "humidity_pct",
            ]
        ].copy()

        features["date"] = (
            pd.to_datetime(features["date"])
            .dt.normalize()
        )

        for column in QUANTILE_WEATHER_COLS:
            features[column] = pd.to_numeric(
                features[column],
                errors="coerce",
            )

        features["season"] = (
            features["date"]
            .dt.month
            .map(SEASON_BY_MONTH)
        )

        # Return real/cached data when all required weather values are
        # available. Partial data is not allowed to leak NaNs into the
        # model feature matrix.
        if features[QUANTILE_WEATHER_COLS].notna().all().all():
            return (
                features[
                    [
                        "date",
                        "temp_max_c",
                        "temp_min_c",
                        "humidity_pct",
                        "season",
                    ]
                ]
                .sort_values("date")
                .drop_duplicates(
                    subset="date",
                    keep="last",
                )
                .reset_index(drop=True)
            )

    # ------------------------------------------------------------------
    # Historical fallback.
    # ------------------------------------------------------------------
    #
    # The current local caches observed during development contain only
    # recent dates, while the monthly Bronze dataset goes back to 2014.
    # Open-Meteo is also currently returning HTTP 429.
    #
    # Never reuse the recent cache as historical weather. Instead construct
    # a deterministic climatological series. This keeps the feature matrix
    # complete and preserves the broad Southern Hemisphere seasonal cycle.
    #
    # IMPORTANT:
    # This is a resilience fallback, not a substitute for genuine historical
    # weather. When a proper historical weather source is available, it
    # should be used for retraining.
    # ------------------------------------------------------------------

    logging.warning(
        "Using climatological weather fallback for %s: %s -> %s",
        entity_id or DEFAULT_CACHE_KEY,
        requested_start.date(),
        requested_end.date(),
    )

    dates = pd.date_range(
        start=requested_start,
        end=requested_end,
        freq="D",
    )

    if dates.empty:
        return pd.DataFrame(
            columns=[
                "date",
                "temp_max_c",
                "temp_min_c",
                "humidity_pct",
                "season",
            ]
        )

    # Use station latitude to distinguish the warmer northern stations
    # (Matimba/Medupi area) from the cooler Highveld stations. These are
    # broad climatological defaults only; they are not claimed to be
    # observed station measurements.
    station_profiles = {
        "Arnot": (23.5, 11.0, 65.0),
        "Camden": (22.5, 11.0, 68.0),
        "Duvha": (23.0, 11.0, 66.0),
        "Grootvlei": (22.5, 11.5, 67.0),
        "Hendrina": (22.5, 11.0, 66.0),
        "Kendal": (23.0, 11.5, 65.0),
        "Komati": (23.0, 11.0, 66.0),
        "Kriel": (23.0, 11.5, 64.0),
        "Kriel OC": (23.0, 11.5, 64.0),
        "Kriel UG": (23.0, 11.5, 64.0),
        "Kusile": (23.0, 11.5, 65.0),
        "Kusile_Limestone": (23.0, 11.5, 65.0),
        "Lethabo": (23.5, 12.0, 67.0),
        "Majuba": (22.0, 11.5, 67.0),
        "Matimba": (29.0, 14.0, 60.0),
        "Matla": (23.0, 11.5, 64.0),
        "Medupi": (30.0, 14.0, 59.0),
        "Tutuka": (22.5, 11.0, 67.0),
    }

    default_profile = (23.0, 11.5, 65.0)

    base_max, diurnal_range, base_humidity = station_profiles.get(
        entity_id,
        default_profile,
    )

    # Create a smooth annual cycle with summer (January) as the warmest
    # point and winter (July) as the coolest point. A small deterministic
    # second harmonic gives the feature distribution more variation than
    # four constant seasonal values, which is useful if quantile edges are
    # recomputed during a future training run.
    day_of_year = dates.dayofyear.to_numpy(dtype=float)

    annual_angle = (
        2.0
        * 3.141592653589793
        * (day_of_year - 15.0)
        / 365.25
    )

    warm_cycle = (
        0.5
        + 0.5 * np.cos(annual_angle)
    )

    second_cycle = np.sin(
        2.0 * annual_angle
    )

    temp_max = (
        base_max
        + 7.0 * warm_cycle
        + 0.7 * second_cycle
    )

    temp_min = (
        temp_max
        - diurnal_range
        - 1.0 * second_cycle
    )

    humidity = (
        base_humidity
        + 9.0 * warm_cycle
        - 2.5 * second_cycle
    )

    # Keep values in sensible broad ranges.
    temp_max = pd.Series(temp_max).clip(
        lower=5.0,
        upper=38.0,
    ).to_numpy()

    temp_min = pd.Series(temp_min).clip(
        lower=-2.0,
        upper=25.0,
    ).to_numpy()

    humidity = pd.Series(humidity).clip(
        lower=20.0,
        upper=95.0,
    ).to_numpy()

    features = pd.DataFrame(
        {
            "date": dates,
            "temp_max_c": temp_max,
            "temp_min_c": temp_min,
            "humidity_pct": humidity,
        }
    )

    features["season"] = (
        features["date"]
        .dt.month
        .map(SEASON_BY_MONTH)
        .astype(int)
    )

    for column in QUANTILE_WEATHER_COLS:
        features[column] = pd.to_numeric(
            features[column],
            errors="coerce",
        )

    # Final safety guard. This should never be needed, but it guarantees
    # that a malformed fallback value cannot reintroduce NaNs.
    for column in QUANTILE_WEATHER_COLS:
        if features[column].isna().any():
            features[column] = features[column].fillna(
                features[column].median()
            )

        if features[column].isna().any():
            raise ValueError(
                f"Weather fallback produced invalid values for '{column}'."
            )

    return (
        features[
            [
                "date",
                "temp_max_c",
                "temp_min_c",
                "humidity_pct",
                "season",
            ]
        ]
        .sort_values("date")
        .drop_duplicates(
            subset="date",
            keep="last",
        )
        .reset_index(drop=True)
    )


# ---------------------------------------------------------------------------
# MONTHLY WEATHER AGGREGATION
# ---------------------------------------------------------------------------


def aggregate_weather_monthly(
    features: pd.DataFrame,
) -> pd.DataFrame:
    """
    Convert daily weather features to month-end weather features.

    This is critical for the strategic/monthly forecasting model.

    Example:

        2025-01-01
        2025-01-02
        ...
        2025-01-31

    becomes:

        2025-01-31

    Aggregation:

        temp_max_c   -> monthly mean
        temp_min_c   -> monthly mean
        humidity_pct -> monthly mean
        season       -> season of the month
    """

    if features.empty:
        return features.copy()

    df = features.copy()

    df["date"] = pd.to_datetime(
        df["date"]
    ).dt.normalize()

    numeric_columns = [
        "temp_max_c",
        "temp_min_c",
        "humidity_pct",
    ]

    for column in numeric_columns:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df["_month"] = (
        df["date"]
        .dt.to_period("M")
    )

    monthly = (
        df.groupby("_month", as_index=False)
        .agg(
            {
                "temp_max_c": "mean",
                "temp_min_c": "mean",
                "humidity_pct": "mean",
            }
        )
    )

    monthly["date"] = (
        monthly["_month"]
        .dt.to_timestamp("M")
    )

    monthly["season"] = (
        monthly["date"]
        .dt.month
        .map(SEASON_BY_MONTH)
    )

    return monthly[
        [
            "date",
            "temp_max_c",
            "temp_min_c",
            "humidity_pct",
            "season",
        ]
    ].sort_values(
        "date"
    ).reset_index(
        drop=True
    )


# ---------------------------------------------------------------------------
# QUANTILE EDGES
# ---------------------------------------------------------------------------


def compute_quantile_edges(
    features: pd.DataFrame,
) -> dict:

    if (
        features.empty
        or
        features[
            QUANTILE_WEATHER_COLS
        ].isna().all().all()
    ):

        raise ValueError(
            "Cannot compute quantile edges: "
            "weather feature table is empty or "
            "all-NaN."
        )

    edges = {}

    for column in QUANTILE_WEATHER_COLS:

        values = pd.to_numeric(
            features[column],
            errors="coerce",
        ).dropna()

        if values.empty:

            raise ValueError(
                f"No valid weather values "
                f"available for {column}."
            )

        _, bin_edges = pd.qcut(
            values,
            q=N_QUANTILES,
            retbins=True,
            duplicates="drop",
        )

        if (
            len(bin_edges) < 2
            or
            pd.isna(bin_edges).any()
        ):

            raise ValueError(
                f"Cannot compute quantile edges "
                f"for '{column}'."
            )

        edges[column] = [
            float(value)
            for value in bin_edges
        ]

    return edges


# ---------------------------------------------------------------------------
# QUANTILE APPLICATION
# ---------------------------------------------------------------------------


def apply_quantile_edges(
    features: pd.DataFrame,
    edges: dict,
) -> pd.DataFrame:

    features = features.copy()

    for column in QUANTILE_WEATHER_COLS:

        if column not in edges:
            raise ValueError(
                f"Missing weather edges for "
                f"'{column}'."
            )

        bin_edges = list(
            edges[column]
        )

        if len(bin_edges) < 2:
            raise ValueError(
                f"Invalid weather bin edges "
                f"for '{column}'."
            )

        numeric_values = pd.to_numeric(
            features[column],
            errors="coerce",
        )

        # Fill missing values using the
        # training distribution midpoint.
        if numeric_values.isna().any():

            midpoint = (
                bin_edges[0]
                +
                bin_edges[-1]
            ) / 2

            numeric_values = (
                numeric_values.fillna(
                    midpoint
                )
            )

        clipped = numeric_values.clip(
            lower=bin_edges[0],
            upper=bin_edges[-1],
        )

        features[column] = pd.cut(
            clipped,
            bins=bin_edges,
            labels=list(
                range(
                    len(bin_edges) - 1
                )
            ),
            include_lowest=True,
        ).astype(int)

    return features


# ---------------------------------------------------------------------------
# WEATHER FEATURES BY DATE
# ---------------------------------------------------------------------------


def weather_features_by_date(
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
    entity_id: str = None,
    edges: dict = None,
) -> dict:
    """
    Return weather features indexed by date.

    Supports both daily and monthly forecasting.

    For monthly requests, daily weather is first aggregated to month-end.
    Continuous weather variables are then converted into integer quintile
    buckets using the supplied fixed edges.
    """

    start_date = pd.Timestamp(start_date).normalize()
    end_date = pd.Timestamp(end_date).normalize()

    if end_date < start_date:
        raise ValueError(
            f"end_date ({end_date.date()}) cannot be before "
            f"start_date ({start_date.date()})"
        )

    features = get_weather_features(
        start_date=start_date.strftime("%Y-%m-%d"),
        end_date=end_date.strftime("%Y-%m-%d"),
        entity_id=entity_id,
    )

    if features.empty:
        return {}

    # A monthly request is identified when both boundaries are month-end.
    start_is_month_end = (
        start_date
        == start_date.to_period("M").to_timestamp("M")
    )

    end_is_month_end = (
        end_date
        == end_date.to_period("M").to_timestamp("M")
    )

    requested_monthly = (
        start_is_month_end
        and end_is_month_end
    )

    if requested_monthly:
        features = aggregate_weather_monthly(features)

    # Use supplied training edges when available.
    # Otherwise calculate edges from the current feature table.
    if edges is None:
        edges = compute_quantile_edges(features)

    features = apply_quantile_edges(
        features,
        edges,
    )

    features["date"] = pd.to_datetime(
        features["date"]
    ).dt.normalize()

    result = {}

    for _, row in features.iterrows():
        timestamp = pd.Timestamp(
            row["date"]
        ).normalize()

        result[timestamp] = {
            "temp_max_c": int(row["temp_max_c"]),
            "temp_min_c": int(row["temp_min_c"]),
            "humidity_pct": int(row["humidity_pct"]),
            "season": int(row["season"]),
        }

    return result


# ---------------------------------------------------------------------------
# WEATHER LABEL
# ---------------------------------------------------------------------------


def weather_code_label(code) -> str:

    if code is None:
        return "Unknown"

    try:

        if pd.isna(code):
            return "Unknown"

        return WEATHER_CODE_LABELS.get(
            int(code),
            "Unknown",
        )

    except (
        TypeError,
        ValueError,
    ):

        return "Unknown"

def refresh_weather_cache(lookback_days: int = 90, forecast_days: int = 16) -> dict:
    """
    Proactively refreshes the Azure weather cache for every known power
    station, independent of any dashboard request or training/inference run.

    The cache normally only updates opportunistically, as a side effect of
    get_weather_timeseries() succeeding wherever weather happens to be
    requested (ui.get_weather_json(), training/inference feature prep). A
    station whose weather is never requested (or whose first request happens
    to fail) never gets a cache entry -- this function exists to keep every
    known station's cache warm regardless, e.g. via a daily scheduled call.

    Parameters
    ----------
    lookback_days : int
        Number of past days of weather history to include, matching
        ui.get_weather_json()'s default dashboard window.
    forecast_days : int
        Number of forecast days ahead to include, matching
        ui.get_weather_json()'s default dashboard window.

    Returns
    -------
    dict
        Maps entity_id -> True if that station's cache was refreshed
        successfully, False if the refresh failed (logged, not raised).
    """
    start_date = (date.today() - timedelta(days=lookback_days)).isoformat()
    end_date = (date.today() + timedelta(days=forecast_days - 1)).isoformat()

    results = {}
    for entity_id in ENTITY_COORDINATES:
        try:
            get_weather_timeseries(start_date=start_date, end_date=end_date, entity_id=entity_id)
            results[entity_id] = True
            logging.info(f"Refreshed weather cache for '{entity_id}'.")
        except Exception as e:
            results[entity_id] = False
            logging.error(f"Failed to refresh weather cache for '{entity_id}': {e}")
    return results

