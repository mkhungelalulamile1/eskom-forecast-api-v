import os
import pandas as pd
import numpy as np


def generate_mock_data(num_entities: int = 15, num_years: int = 20):
    """
    Generate dummy/mock input time-series data for daily and monthly horizons.

    Writes two Parquet files under `data/bronze/`: one with daily-granularity
    records and one with monthly-granularity records, each spanning
    `num_years` of history for `num_entities` distinct entities.

    Parameters
    ----------
    num_entities : int, optional
        Number of distinct entities to generate records for (default 15).
    num_years : int, optional
        Number of years of historical data to generate for each entity
        (default 20).

    Returns
    -------
    None
        This function writes output directly to disk and does not return
        a value.

    Output
    ------
    - `data/bronze/daily/input_data.parquet`
        Columns: `entity_id`, `event_date`, `value`.
        One row per entity per day (`num_entities * num_years * 365` rows).
    - `data/bronze/monthly/input_data.parquet`
        Columns: `entity_id`, `event_date`, `value`.
        One row per entity per month (`num_entities * num_years * 12` rows).

    Examples
    --------
    >>> generate_mock_data(num_entities=15, num_years=20)
    Generating mock inputs in Bronze directory with 15 entities and 20 years of history...
    Creating daily records dataframe...
    Creating monthly records dataframe...
    Mock data successfully written.
    """
    print(f"Generating mock inputs in Bronze directory with {num_entities} entities and {num_years} years of history...")
    os.makedirs("data/bronze/daily", exist_ok=True)
    os.makedirs("data/bronze/monthly", exist_ok=True)
    
    entities = [f"entity_{i}" for i in range(1, num_entities + 1)]
    
    # 1. Daily Mock Data (20 years of daily data = 7300 days)
    daily_dates = pd.date_range(end="2026-06-25", periods=num_years * 365)
    n_days = len(daily_dates)
    
    print("Creating daily records dataframe...")
    entity_ids = np.repeat(entities, n_days)
    dates_repeated = np.tile(daily_dates, num_entities)
    values = 100 + np.random.randint(-10, 10, size=num_entities * n_days)
    df_daily = pd.DataFrame({
        "entity_id": entity_ids,
        "event_date": dates_repeated,
        "value": values
    })
    df_daily.to_parquet("data/bronze/daily/input_data.parquet", index=False)
    
    # 2. Monthly Mock Data (20 years of monthly data = 240 months)
    print("Creating monthly records dataframe...")
    monthly_dates = pd.date_range(end="2026-06-01", periods=num_years * 12, freq="MS")
    n_months = len(monthly_dates)
    
    entity_ids_m = np.repeat(entities, n_months)
    dates_repeated_m = np.tile(monthly_dates, num_entities)
    # Monthly figures must be approximately 30.5 times larger than daily figures (daily ~100 -> monthly ~3050)
    values_m = 3050 + np.random.randint(-300, 300, size=num_entities * n_months)

    df_monthly = pd.DataFrame({
        "entity_id": entity_ids_m,
        "event_date": dates_repeated_m,
        "value": values_m
    })
    df_monthly.to_parquet("data/bronze/monthly/input_data.parquet", index=False)
    print("Mock data successfully written.")
