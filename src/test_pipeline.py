import os
import sys
import io
import shutil
import pandas as pd
import numpy as np
import pytest
import xgboost as xgb
from azure.storage.blob import BlobServiceClient

# training/ holds weather.py and training.py; add it alongside the src/ dir
# that pytest auto-inserts, so bare `import weather` / `from training import
# ...` below resolve regardless of the current working directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training'))

# main.py (the FastAPI entry point) lives at repo root, one level up from
# src/ -- add it so `import main` below resolves regardless of pytest's rootdir.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app, convert_df_to_stack, fill_time_series_gaps
from config import Config

# get_predictions_json/get_metrics_json (src/ui.py) require Azure Storage to be
# configured; skip tests that exercise them when running purely locally.
requires_azure_storage = pytest.mark.skipif(
    not Config().connection_string,
    reason="AZURE_STORAGE_CONNECTION_STRING is not configured; this test requires Azure Storage.",
)


def test_run_verification():
    """
    Runs the pipeline against the real Bronze data already on disk and
    validates the outputs in the Gold directory.
    """
    config = Config()

    # Clear any previous outputs
    if os.path.exists("data/gold"):
        shutil.rmtree("data/gold")

    df_daily_in = pd.read_parquet("data/bronze/daily/input_data.parquet")
    df_monthly_in = pd.read_parquet("data/bronze/monthly/input_data.parquet")
    num_daily_entities = df_daily_in["entity_id"].nunique()
    num_monthly_entities = df_monthly_in["entity_id"].nunique()

    print("\nExecuting main forecasting pipeline...")
    app()

    print("\nValidating results in Gold Container...")

    # 1. Validate Daily Output
    daily_output_path = "data/gold/daily/predictions.parquet"
    assert os.path.exists(daily_output_path), "Daily forecast results not found in Gold path!"
    df_daily_out = pd.read_parquet(daily_output_path)

    print(f"Daily forecast contains columns: {list(df_daily_out.columns)}")
    print(f"Daily forecast shape: {df_daily_out.shape}")

    # Assertions for Daily
    assert "entity_id" in df_daily_out.columns
    assert "event_date" in df_daily_out.columns
    assert "horizon_step" in df_daily_out.columns
    assert "Input" in df_daily_out.columns
    assert "Replenishment" in df_daily_out.columns

    # expected rows: num_daily_entities * 90 daily horizon steps
    expected_daily_rows = num_daily_entities * 90
    assert len(df_daily_out) == expected_daily_rows, f"Expected {expected_daily_rows} rows, got {len(df_daily_out)}"
    assert sorted(df_daily_out["horizon_step"].unique()) == list(range(1, 91))
    assert df_daily_out.duplicated(subset=["entity_id", "event_date"]).sum() == 0, "Duplicate entity-date combinations found in daily predictions!"

    # 2. Validate Monthly Output
    monthly_output_path = "data/gold/monthly/predictions.parquet"
    assert os.path.exists(monthly_output_path), "Monthly forecast results not found in Gold path!"
    df_monthly_out = pd.read_parquet(monthly_output_path)

    print(f"Monthly forecast contains columns: {list(df_monthly_out.columns)}")
    print(f"Monthly forecast shape: {df_monthly_out.shape}")

    # Assertions for Monthly
    assert "entity_id" in df_monthly_out.columns
    assert "event_date" in df_monthly_out.columns
    assert "horizon_step" in df_monthly_out.columns
    assert "Input" in df_monthly_out.columns
    assert "Replenishment" in df_monthly_out.columns

    # expected rows: num_monthly_entities * 36 monthly horizon steps
    expected_monthly_rows = num_monthly_entities * 36
    assert len(df_monthly_out) == expected_monthly_rows, f"Expected {expected_monthly_rows} rows, got {len(df_monthly_out)}"
    assert sorted(df_monthly_out["horizon_step"].unique()) == list(range(1, 37))
    assert df_monthly_out.duplicated(subset=["entity_id", "event_date"]).sum() == 0, "Duplicate entity-date combinations found in monthly predictions!"

    print("\n--- ALL PIPELINE VERIFICATIONS PASSED SUCCESSFULLY! ---")


def test_convert_df_to_stack():
    """
    Unit test for the convert_df_to_stack data stacking function.
    Validates correct shape, column generation, daily/monthly date logic, and lag accuracy.
    """
    # 1. Daily input scenario with deterministic values
    daily_dates = pd.date_range(start="2026-06-01", periods=10)
    df_daily = pd.DataFrame({
        "entity_id": ["entity_1"] * 10,
        "event_date": daily_dates,
        "value": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
        "weight": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    })

    # Run convert_df_to_stack with a horizon of 5 steps
    stacked_daily = convert_df_to_stack(df_daily, horizon=5)

    # Assertions for daily scenario
    assert len(stacked_daily) == 5, f"Expected 5 rows, got {len(stacked_daily)}"

    from app import LAG_STEPS, ROLLING_WINDOWS
    expected_columns = [
        "entity_id", "origin_date", "event_date", "horizon_step",
        "is_weekend", "month_of_year", "week_of_year",
    ]
    for col in ["value", "weight"]:
        expected_columns += [f"{col}_lag_{lag}" for lag in LAG_STEPS]
        expected_columns += [f"{col}_roll_mean_{window}" for window in ROLLING_WINDOWS]
    expected_columns += ["temp_max_c", "temp_min_c", "humidity_pct", "season"]
    # This fixture uses generic 'value'/'weight' columns rather than
    # 'Input'/'Replenishment', so convert_df_to_stack() skips the
    # additional_features.build_origin_features() join entirely (it requires
    # Input/Replenishment by name) -- no origin-feature columns are expected
    # here. See test_convert_df_to_stack_joins_origin_features below for
    # coverage of that join on a real Input/Replenishment fixture.
    assert list(stacked_daily.columns) == expected_columns

    # Assert correct origin date (last date of input: 2026-06-10)
    assert stacked_daily["origin_date"].unique()[0] == pd.Timestamp("2026-06-10")

    # Assert prediction dates are daily offsets: 2026-06-11 to 2026-06-15
    expected_dates = pd.date_range(start="2026-06-11", periods=5)
    pd.testing.assert_index_equal(pd.DatetimeIndex(stacked_daily["event_date"]), expected_dates, check_names=False)

    # Assert date-derived features: 2026-06-11 (Thu) - 2026-06-15 (Mon), crossing
    # a weekend (Sat/Sun) and an ISO week boundary (week 24 -> 25 on Monday).
    assert list(stacked_daily["is_weekend"]) == [0, 0, 1, 1, 0]
    assert list(stacked_daily["month_of_year"]) == [6, 6, 6, 6, 6]
    assert list(stacked_daily["week_of_year"]) == [24, 24, 24, 24, 25]

    # Assert lag values -- history has only 10 elements, so lag_1..lag_10 are
    # populated (most recent first) and lag_11..lag_30/lag_358..372 are NaN.
    # value_lag_1 is the last history element (index 9: 100.0)
    # value_lag_2 is the second to last history element (index 8: 90.0)
    # value_lag_7 is the 7th element from the end (index 3: 40.0)
    # value_lag_10 is the first history element (index 0: 10.0)
    # value_roll_mean_7: mean of [40, 50, 60, 70, 80, 90, 100] = 70.0
    # value_roll_mean_30: mean of [10, 20, 30, ..., 100] = 55.0
    first_row = stacked_daily.iloc[0]
    assert first_row["value_lag_1"] == 100.0
    assert first_row["value_lag_2"] == 90.0
    assert first_row["value_lag_7"] == 40.0
    assert first_row["value_lag_10"] == 10.0
    assert pd.isna(first_row["value_lag_11"])
    assert pd.isna(first_row["value_lag_14"])
    assert pd.isna(first_row["value_lag_30"])
    assert pd.isna(first_row["value_lag_365"])
    assert first_row["value_roll_mean_7"] == pytest.approx(70.0)
    assert first_row["value_roll_mean_30"] == pytest.approx(55.0)

    # Assert weight lag values
    assert first_row["weight_lag_1"] == pytest.approx(1.0)
    assert first_row["weight_lag_2"] == pytest.approx(0.9)
    assert first_row["weight_lag_7"] == pytest.approx(0.4)
    assert first_row["weight_lag_10"] == pytest.approx(0.1)
    assert pd.isna(first_row["weight_lag_11"])
    assert pd.isna(first_row["weight_lag_14"])
    assert pd.isna(first_row["weight_lag_30"])
    assert pd.isna(first_row["weight_lag_365"])
    assert first_row["weight_roll_mean_7"] == pytest.approx(0.7)
    assert first_row["weight_roll_mean_30"] == pytest.approx(0.55)

    # 2. Monthly input scenario to verify monthly date offsets
    monthly_dates = pd.date_range(start="2026-01-01", periods=3, freq="MS")
    df_monthly = pd.DataFrame({
        "entity_id": ["entity_1"] * 3,
        "event_date": monthly_dates,
        "value": [100.0, 200.0, 300.0],
        "weight": [0.5, 0.5, 0.5]
    })

    stacked_monthly = convert_df_to_stack(df_monthly, horizon=2)

    # Origin date is last date of input: 2026-03-01
    assert stacked_monthly["origin_date"].unique()[0] == pd.Timestamp("2026-03-01")

    # Assert prediction dates are monthly offsets: 2026-04-01 and 2026-05-01
    # Note: DateOffset(months=h) preserves the calendar start dates if possible
    # We check month start alignment, matching ingest.py's DATETRUNC(month, ...)
    expected_monthly_dates = [pd.Timestamp("2026-04-01"), pd.Timestamp("2026-05-01")]
    assert list(stacked_monthly["event_date"]) == expected_monthly_dates


def test_convert_df_to_stack_joins_origin_features():
    """
    Unit test for the additional_features.build_origin_features() join inside
    convert_df_to_stack(): confirms the join actually lands on the right row
    (rather than being silently all-NaN, the same class of bug caught during
    development when additionalfeatures/create_full_training_data.py joined a
    month-start key against a month-end one) and that it is anchored to
    origin_date rather than event_date -- the anchor that keeps the join
    leakage-free, since event_date is the target date and several origin
    features (e.g. supply_to_burn_ratio, net_coal_flow) are computed from
    that exact row's own Input/Replenishment.
    """
    from additional_features import build_origin_features

    dates = pd.date_range(start="2024-01-01", periods=120, freq="D")
    df = pd.DataFrame({
        "entity_id": ["entity_1"] * 120,
        "event_date": dates,
        "Input": [100.0 + (i % 20) for i in range(120)],
        "Replenishment": [105.0 + (i % 15) for i in range(120)],
    })

    stacked = convert_df_to_stack(df, horizon=3)

    # The join must have actually populated values, not silently produced
    # an all-NaN column (which a left join on a mismatched key would do).
    assert stacked["supply_to_burn_ratio"].notna().all()
    assert stacked["net_coal_flow"].notna().all()

    # Every horizon-step row for this single entity/origin must carry the
    # SAME origin-feature value (broadcast at origin, like lag_features),
    # not a value that varies with event_date.
    assert stacked["supply_to_burn_ratio"].nunique() == 1

    # The value must match an independent computation anchored at
    # origin_date, and must NOT match what the same feature would be if
    # (incorrectly) computed at event_date -- this is the leakage check.
    origin_date = stacked["origin_date"].iloc[0]
    standalone = build_origin_features(df, grain="daily")
    expected_at_origin = standalone.loc[
        standalone["event_date"] == origin_date, "supply_to_burn_ratio"
    ].iloc[0]
    assert stacked["supply_to_burn_ratio"].iloc[0] == pytest.approx(expected_at_origin)

    for event_date in stacked["event_date"].unique():
        if event_date == origin_date:
            continue
        at_event_date = standalone.loc[
            standalone["event_date"] == event_date, "supply_to_burn_ratio"
        ]
        if not at_event_date.empty:
            assert stacked["supply_to_burn_ratio"].iloc[0] != pytest.approx(
                at_event_date.iloc[0]
            ), "Origin feature matches a value computed at event_date instead of origin_date -- possible leakage."


def test_season_for_month():
    """
    Unit test locking in the South African (Southern Hemisphere) season mapping:
    Summer=Dec-Feb, Autumn=Mar-May, Winter=Jun-Aug, Spring=Sep-Nov.
    """
    from weather import season_for_month

    summer_months = [12, 1, 2]
    autumn_months = [3, 4, 5]
    winter_months = [6, 7, 8]
    spring_months = [9, 10, 11]

    assert all(season_for_month(m) == 0 for m in summer_months)
    assert all(season_for_month(m) == 1 for m in autumn_months)
    assert all(season_for_month(m) == 2 for m in winter_months)
    assert all(season_for_month(m) == 3 for m in spring_months)


def test_coordinates_for_entity():
    """
    Verifies each real power station resolves to its own coordinates (not all
    collapsing to the Kendal default), and that an unrecognized entity_id
    falls back to Kendal's coordinates rather than raising.
    """
    from weather import coordinates_for_entity, DEFAULT_LATITUDE, DEFAULT_LONGITUDE

    medupi_coords = coordinates_for_entity("Medupi")
    kendal_coords = coordinates_for_entity("Kendal")
    assert medupi_coords != kendal_coords

    assert coordinates_for_entity("some_unknown_station") == (DEFAULT_LATITUDE, DEFAULT_LONGITUDE)


def test_unrecognized_entity_shares_default_weather_cache(monkeypatch, tmp_path):
    """
    An entity_id not in ENTITY_COORDINATES resolves to the same (Kendal)
    coordinates as no entity_id at all, so it must fall back to the shared
    default cache on fetch failure rather than requiring (and lacking) its
    own separate cache under an unrecognized name.
    """
    import weather
    config = Config()
    monkeypatch.setattr(config, "connection_string", "")
    monkeypatch.setattr(config, "local_weather_dir", str(tmp_path))
    monkeypatch.setattr(weather, "Config", lambda: config)

    cached = pd.DataFrame({
        "date": pd.date_range("2026-06-01", periods=5),
        "temp_max_c": [20.0, 21.0, 22.0, 23.0, 24.0],
        "temp_min_c": [10.0, 11.0, 12.0, 13.0, 14.0],
        "rainfall_mm": [0.0] * 5,
        "cloud_cover_pct": [0.0] * 5,
        "humidity_pct": [50.0] * 5,
        "wind_speed_kmh": [5.0] * 5,
        "weather_code": [0] * 5,
        "uv_index": [5.0] * 5,
        "sunshine_seconds": [1000.0] * 5,
    })
    # Save under the shared default key (entity_id=None), simulating a prior
    # successful fetch for an unrecognized/no-entity caller.
    weather._save_weather_cache(cached, config, entity_id=None)

    def _raise(*args, **kwargs):
        raise ConnectionError("Open-Meteo unreachable (simulated)")

    monkeypatch.setattr(weather, "_fetch_weather_timeseries", _raise)

    result = weather.get_weather_timeseries("2026-06-02", "2026-06-04", entity_id="not_a_real_station")

    assert list(result["temp_max_c"]) == [21.0, 22.0, 23.0]


def test_convert_df_to_stack_includes_weather_features():
    """
    Verifies that convert_df_to_stack joins temperature high/low, average
    humidity, and season directly onto each stacked row's target event_date
    (not lagged), so the model can learn from weather/season as inputs.
    """
    daily_dates = pd.date_range(start="2026-06-01", periods=10)
    df_daily = pd.DataFrame({
        "entity_id": ["entity_1"] * 10,
        "event_date": daily_dates,
        "value": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
    })

    stacked_daily = convert_df_to_stack(df_daily, horizon=5)

    for col in ["temp_max_c", "temp_min_c", "humidity_pct", "season"]:
        assert col in stacked_daily.columns, f"Expected weather/season column '{col}' in stacked output"

    # Season must be a valid SA season code for every row (never lagged/NaN, since
    # it's known in advance for any date).
    assert stacked_daily["season"].isin([0, 1, 2, 3]).all()


def _synthetic_scenario_stack():
    """
    Builds a small stack with known 'season'/weather-quintile int columns
    already in place, bypassing convert_df_to_stack's live weather fetch --
    what-if scenario overrides operate on the stack itself (post-bucketing),
    not on the raw bronze dataframe, so tests only need a stack shaped like
    convert_df_to_stack's output, not a full end-to-end run.
    """
    return pd.DataFrame({
        "entity_id": ["entity_1", "entity_1", "entity_2", "entity_2"],
        "origin_date": [pd.Timestamp("2026-06-10")] * 4,
        "event_date": [pd.Timestamp("2026-06-11"), pd.Timestamp("2026-06-12")] * 2,
        "horizon_step": [1, 2, 1, 2],
        "value_lag_1": [10.0, 20.0, 30.0, 40.0],
        "season": [1, 1, 3, 3],
        "temp_max_c": [2, 2, 3, 3],
        "temp_min_c": [2, 2, 3, 3],
        "humidity_pct": [2, 2, 1, 1],
    })


def test_expand_stack_with_scenarios_shape():
    """
    Verifies expand_stack_with_scenarios produces one tagged copy of the
    input stack per scenario, with overrides applied uniformly within each
    scenario's slice and the 'actual' slice left completely unchanged.
    """
    from scenarios import expand_stack_with_scenarios
    from scenario_definitions import SCENARIO_DEFINITIONS

    stack = _synthetic_scenario_stack()
    expanded = expand_stack_with_scenarios(stack)

    assert len(expanded) == len(stack) * len(SCENARIO_DEFINITIONS)
    for scenario in SCENARIO_DEFINITIONS:
        slice_df = expanded[expanded["scenario_id"] == scenario["scenario_id"]]
        assert len(slice_df) == len(stack)
        for col, value in scenario["overrides"].items():
            assert (slice_df[col] == value).all()

    actual_slice = expanded[expanded["scenario_id"] == "actual"].drop(columns=["scenario_id"]).reset_index(drop=True)
    pd.testing.assert_frame_equal(actual_slice, stack.reset_index(drop=True), check_like=False)


def test_actual_scenario_matches_baseline():
    """
    Acceptance criterion: the 'actual' scenario (no overrides) must reproduce
    exactly what the existing non-scenario prediction path produces, since
    baseline is generated by the same mechanism as every scenario, not
    special-cased. Uses a deterministic stub model rather than the mock
    fallback (which injects random noise per call and would never compare
    equal across two separate invocations).
    """
    from scenarios import expand_stack_with_scenarios
    from app import Prediction_runner
    from config import Config

    class _DeterministicModel:
        def predict(self, X):
            # A fixed function of horizon_step so predictions are reproducible
            # and vary per row, without depending on randomness.
            return (X["horizon_step"] * 10.0).to_numpy()

    stack = _synthetic_scenario_stack()
    runner = Prediction_runner("tactical", Config())
    runner.models = {"input": _DeterministicModel(), "replenishment": _DeterministicModel()}

    baseline_preds = runner.generate_predictions(stack).sort_values(
        ["entity_id", "event_date", "horizon_step"]
    ).reset_index(drop=True)

    expanded = expand_stack_with_scenarios(stack)
    scenario_preds = runner.generate_predictions(expanded)
    actual_preds = scenario_preds[scenario_preds["scenario_id"] == "actual"].sort_values(
        ["entity_id", "event_date", "horizon_step"]
    ).reset_index(drop=True)

    assert actual_preds["Input"].tolist() == pytest.approx(baseline_preds["Input"].tolist())
    assert actual_preds["Replenishment"].tolist() == pytest.approx(baseline_preds["Replenishment"].tolist())


def test_single_batched_predict_call(monkeypatch):
    """
    Acceptance criterion: scoring must call .predict() exactly once per
    target across the ENTIRE expanded stack, not once per scenario --
    scenario_id is just extra row-multiplicity, like entity_id/horizon_step.
    """
    from scenarios import expand_stack_with_scenarios
    from app import Prediction_runner
    from config import Config

    stack = _synthetic_scenario_stack()
    expanded = expand_stack_with_scenarios(stack)

    runner = Prediction_runner("tactical", Config())
    call_counts = {"input": 0, "replenishment": 0}

    class _CountingMockModel:
        def __init__(self, var):
            self.var = var

        def predict(self, X):
            call_counts[self.var] += 1
            return np.zeros(len(X))

    runner.models = {"input": _CountingMockModel("input"), "replenishment": _CountingMockModel("replenishment")}
    runner.generate_predictions(expanded)

    assert call_counts == {"input": 1, "replenishment": 1}


def test_new_scenario_row_requires_no_code_changes():
    """
    Acceptance criterion: adding a new scenario means only appending a row to
    the definitions table, with no branching/code changes elsewhere.
    """
    from scenarios import expand_stack_with_scenarios
    from scenario_definitions import SCENARIO_DEFINITIONS

    stack = _synthetic_scenario_stack()
    extended = list(SCENARIO_DEFINITIONS) + [
        {"scenario_id": "test_extra", "label": "Test Extra", "overrides": {"humidity_pct": 3}}
    ]

    expanded = expand_stack_with_scenarios(stack, definitions=extended)
    extra_slice = expanded[expanded["scenario_id"] == "test_extra"]
    assert len(extra_slice) == len(stack)
    assert (extra_slice["humidity_pct"] == 3).all()


def test_reconstruct_stockpile_per_scenario_entity():
    """
    Verifies cumulative Stockpile resets independently at each
    (scenario_id, entity_id) boundary -- one scenario's stockpile trajectory
    must never leak into another's, nor one entity's into another's.
    """
    from scenarios import reconstruct_stockpile

    predictions_df = pd.DataFrame({
        "scenario_id": ["actual", "actual", "actual", "actual", "hot", "hot", "hot", "hot"],
        "entity_id": ["e1", "e1", "e2", "e2", "e1", "e1", "e2", "e2"],
        "event_date": [pd.Timestamp("2026-06-11"), pd.Timestamp("2026-06-12")] * 4,
        "horizon_step": [1, 2, 1, 2, 1, 2, 1, 2],
        "Input": [10.0, 10.0, 5.0, 5.0, 20.0, 20.0, 8.0, 8.0],
        "Replenishment": [12.0, 12.0, 4.0, 4.0, 25.0, 25.0, 6.0, 6.0],
    })

    result = reconstruct_stockpile(predictions_df)

    actual_e1 = result[(result["scenario_id"] == "actual") & (result["entity_id"] == "e1")]["Stockpile"].tolist()
    assert actual_e1 == pytest.approx([2.0, 4.0])

    actual_e2 = result[(result["scenario_id"] == "actual") & (result["entity_id"] == "e2")]["Stockpile"].tolist()
    assert actual_e2 == pytest.approx([-1.0, -2.0])

    hot_e1 = result[(result["scenario_id"] == "hot") & (result["entity_id"] == "e1")]["Stockpile"].tolist()
    assert hot_e1 == pytest.approx([5.0, 10.0])


def test_validate_scenario_definitions_rejects_out_of_range_override():
    """
    A scenario overriding a column to a value outside its trained quintile/
    season domain must raise, not silently send the model an
    out-of-distribution input.
    """
    from scenario_definitions import validate_scenario_definitions

    bad_definitions = [
        {"scenario_id": "actual", "label": "Actual", "overrides": {}},
        {"scenario_id": "bad", "label": "Bad", "overrides": {"season": 7}},
    ]
    with pytest.raises(ValueError):
        validate_scenario_definitions(bad_definitions)


def test_validate_scenario_definitions_rejects_duplicate_scenario_id():
    from scenario_definitions import validate_scenario_definitions

    bad_definitions = [
        {"scenario_id": "dup", "label": "A", "overrides": {}},
        {"scenario_id": "dup", "label": "B", "overrides": {"season": 0}},
    ]
    with pytest.raises(ValueError):
        validate_scenario_definitions(bad_definitions)


@requires_azure_storage
def test_scenario_predictions_json_shape():
    """
    Verifies get_scenario_predictions_json returns the expected top-level
    keys and, if data is present, that each record carries the fields the
    frontend's scenario dropdown depends on.
    """
    from ui import get_scenario_predictions_json

    config = Config()
    data = get_scenario_predictions_json(config)

    assert "daily" in data
    assert "monthly" in data

    for key in ["daily", "monthly"]:
        for record in data[key]:
            for field in ["scenario_id", "label", "entity_id", "horizon_step", "Input", "Replenishment", "Stockpile"]:
                assert field in record
            assert isinstance(record["event_date"], str)
            assert len(record["event_date"]) == 10


def test_weather_falls_back_to_cache_on_fetch_failure(monkeypatch, tmp_path):
    """
    Verifies get_weather_timeseries() serves the last cached weather data
    (rather than raising) when Open-Meteo is unreachable, so the dashboard
    and training/inference feature prep degrade gracefully instead of failing.
    """
    import weather
    config = Config()
    monkeypatch.setattr(config, "connection_string", "")
    monkeypatch.setattr(config, "local_weather_dir", str(tmp_path))
    monkeypatch.setattr(weather, "Config", lambda: config)

    cached = pd.DataFrame({
        "date": pd.date_range("2026-06-01", periods=5),
        "temp_max_c": [20.0, 21.0, 22.0, 23.0, 24.0],
        "temp_min_c": [10.0, 11.0, 12.0, 13.0, 14.0],
        "rainfall_mm": [0.0] * 5,
        "cloud_cover_pct": [0.0] * 5,
        "humidity_pct": [50.0] * 5,
        "wind_speed_kmh": [5.0] * 5,
        "weather_code": [0] * 5,
        "uv_index": [5.0] * 5,
        "sunshine_seconds": [1000.0] * 5,
    })
    weather._save_weather_cache(cached, config)

    def _raise(*args, **kwargs):
        raise ConnectionError("Open-Meteo unreachable (simulated)")

    monkeypatch.setattr(weather, "_fetch_weather_timeseries", _raise)

    result = weather.get_weather_timeseries("2026-06-02", "2026-06-04")

    assert list(result["date"]) == list(pd.date_range("2026-06-02", periods=3))
    assert list(result["temp_max_c"]) == [21.0, 22.0, 23.0]


def test_refresh_weather_cache_retries_then_succeeds(monkeypatch):
    """
    A station whose Open-Meteo fetch fails on its first attempt(s) (e.g. a
    transient rate-limit error) should succeed once refresh_weather_cache()
    retries it, without needing a pre-existing cache to fall back to.
    """
    import weather
    monkeypatch.setattr(weather, "ENTITY_COORDINATES", {"Kusile_Limestone": (-25.90, 28.98)})
    monkeypatch.setattr(weather, "time", type("_NoSleep", (), {"sleep": staticmethod(lambda _: None)})())

    call_count = {"n": 0}

    def _flaky(start_date, end_date, entity_id=None):
        call_count["n"] += 1
        if call_count["n"] < 2:
            raise ConnectionError("429 Too Many Requests (simulated)")
        return pd.DataFrame({"date": pd.date_range(start_date, periods=1)})

    monkeypatch.setattr(weather, "get_weather_timeseries", _flaky)

    results = weather.refresh_weather_cache(max_retries=3, retry_backoff_seconds=0)

    assert results == {"Kusile_Limestone": True}
    assert call_count["n"] == 2


def test_refresh_weather_cache_gives_up_after_max_retries(monkeypatch):
    """
    A station whose Open-Meteo fetch fails on every attempt should be
    reported as False after exactly max_retries attempts, not retried
    indefinitely.
    """
    import weather
    monkeypatch.setattr(weather, "ENTITY_COORDINATES", {"Lethabo": (-26.74, 27.98)})
    monkeypatch.setattr(weather, "time", type("_NoSleep", (), {"sleep": staticmethod(lambda _: None)})())

    call_count = {"n": 0}

    def _always_fails(start_date, end_date, entity_id=None):
        call_count["n"] += 1
        raise ConnectionError("429 Too Many Requests (simulated)")

    monkeypatch.setattr(weather, "get_weather_timeseries", _always_fails)

    results = weather.refresh_weather_cache(max_retries=3, retry_backoff_seconds=0)

    assert results == {"Lethabo": False}
    assert call_count["n"] == 3


def test_ensure_weather_cache_ready_only_fetches_missing_stations(monkeypatch, tmp_path):
    """
    main._ensure_weather_cache_ready() should skip stations that already
    have a cache entry and only fetch the ones missing one, so a
    run-forecast call with a mostly-warm cache doesn't re-fetch everything.
    """
    import weather
    import main
    config = Config()
    monkeypatch.setattr(config, "connection_string", "")
    monkeypatch.setattr(config, "local_weather_dir", str(tmp_path))

    cached = pd.DataFrame({
        "date": pd.date_range("2026-06-01", periods=5),
        "temp_max_c": [20.0] * 5,
        "temp_min_c": [10.0] * 5,
        "rainfall_mm": [0.0] * 5,
        "cloud_cover_pct": [0.0] * 5,
        "humidity_pct": [50.0] * 5,
        "wind_speed_kmh": [5.0] * 5,
        "weather_code": [0] * 5,
        "uv_index": [5.0] * 5,
        "sunshine_seconds": [1000.0] * 5,
    })
    weather._save_weather_cache(cached, config, entity_id="Kendal")

    fetched = []

    def _fake_fetch(start_date, end_date, entity_id=None):
        fetched.append(entity_id)

    monkeypatch.setattr(main, "get_weather_timeseries", _fake_fetch)
    monkeypatch.setattr(main, "time", type("_NoSleep", (), {"sleep": staticmethod(lambda _: None)})())

    main._ensure_weather_cache_ready(["Kendal", "Kusile_Limestone"], config)

    assert fetched == ["Kusile_Limestone"]


def test_ensure_weather_cache_ready_raises_after_exhausting_retries(monkeypatch, tmp_path):
    """
    If a missing station's weather fetch fails on every retry attempt,
    _ensure_weather_cache_ready() must re-raise so run_forecast's own
    try/except reports a clear failure, rather than silently proceeding
    into a forecast run that will fail deep inside weather_features_by_date
    with a less actionable error.
    """
    import main
    config = Config()
    monkeypatch.setattr(config, "connection_string", "")
    monkeypatch.setattr(config, "local_weather_dir", str(tmp_path))

    def _always_fails(start_date, end_date, entity_id=None):
        raise ConnectionError("429 Too Many Requests (simulated)")

    monkeypatch.setattr(main, "get_weather_timeseries", _always_fails)
    monkeypatch.setattr(main, "time", type("_NoSleep", (), {"sleep": staticmethod(lambda _: None)})())
    monkeypatch.setattr(main, "WEATHER_PREFLIGHT_MAX_RETRIES", 2)

    with pytest.raises(ConnectionError):
        main._ensure_weather_cache_ready(["Kusile_Limestone"], config)


def test_training_pipeline():
    """
    Unit test for the training pipeline.
    Validates that model files are correctly trained and saved to the models folder,
    using the real Bronze data already on disk.
    """
    from training import train_models
    config = Config()

    # 1. Clear any existing models to ensure we verify the training output
    if os.path.exists(config.local_models_dir):
        shutil.rmtree(config.local_models_dir)
    os.makedirs(config.local_models_dir, exist_ok=True)

    # 2. Execute model training against real Bronze data
    train_models()
    
    # 4. Verify that the four required model files are generated
    expected_models = [
        "tactical_input_model.json",
        "tactical_replenishment_model.json",
        "strategic_input_model.json",
        "strategic_replenishment_model.json"
    ]
    
    for model_name in expected_models:
        model_path = os.path.join(config.local_models_dir, model_name)
        assert os.path.exists(model_path), f"Expected model file {model_name} was not created!"
        
        # Load and verify it is a valid XGBoost model
        reg = xgb.XGBRegressor()
        reg.load_model(model_path)
        assert reg is not None


def test_time_series_gaps_ffill():
    """
    Unit test to verify detection of gaps in a time-series and correct forward-filling (ffill).
    """
    # Create input with a daily gap (missing 2026-06-02)
    df_gaps = pd.DataFrame({
        "entity_id": ["entity_1", "entity_1"],
        "event_date": [pd.Timestamp("2026-06-01"), pd.Timestamp("2026-06-03")],
        "value": [10.0, 30.0],
        "weight": [0.5, 0.9]
    })
    
    # Call the gap filling function
    df_filled = fill_time_series_gaps(df_gaps)
    
    # Assertions
    # 1. Output must have 3 rows (2026-06-01, 2026-06-02, 2026-06-03)
    assert len(df_filled) == 3, f"Expected 3 rows, got {len(df_filled)}"
    
    # 2. Check event dates
    expected_dates = [pd.Timestamp("2026-06-01"), pd.Timestamp("2026-06-02"), pd.Timestamp("2026-06-03")]
    assert list(df_filled["event_date"]) == expected_dates
    
    # 3. Check values (the gap at 2026-06-02 must be forward filled from 2026-06-01)
    row_gap = df_filled[df_filled["event_date"] == pd.Timestamp("2026-06-02")].iloc[0]
    assert row_gap["value"] == 10.0
    assert row_gap["weight"] == 0.5
    assert row_gap["entity_id"] == "entity_1"


def test_time_series_gaps_monthly_no_gaps_preserves_values():
    """
    Regression test: monthly reindexing must use month-START ("MS") frequency,
    matching ingest.py's DATETRUNC(month, ...) (and generate_mock_data.py's
    generation convention), not month-END ("ME"). A gapless, month-start-indexed
    series must pass through fill_time_series_gaps() completely unchanged --
    with "ME" the reindex grid lands on month-end dates that never match the
    real month-start dates, so every row is spuriously treated as missing,
    replaced with NaN, and (here, with nothing earlier to forward-fill from)
    silently dropped instead of preserved.
    """
    monthly_dates = pd.date_range(start="2026-01-01", periods=3, freq="MS")
    df_monthly = pd.DataFrame({
        "entity_id": ["entity_1"] * 3,
        "event_date": monthly_dates,
        "value": [100.0, 200.0, 300.0],
        "weight": [0.5, 0.6, 0.7],
    })

    df_filled = fill_time_series_gaps(df_monthly)

    assert len(df_filled) == 3, f"Expected 3 rows (no real gaps), got {len(df_filled)}"
    assert list(df_filled["event_date"]) == list(monthly_dates)
    assert list(df_filled["value"]) == [100.0, 200.0, 300.0]
    assert list(df_filled["weight"]) == [0.5, 0.6, 0.7]


def test_time_series_gaps_monthly_fills_missing_month():
    """
    Verifies a genuine missing month (2026-02-01) is detected and
    forward-filled on the month-start ("MS") grid, mirroring
    test_time_series_gaps_ffill()'s daily-gap case but for the monthly
    cadence used by ingest.py's DATETRUNC(month, ...) output.
    """
    df_gaps = pd.DataFrame({
        "entity_id": ["entity_1", "entity_1"],
        "event_date": [pd.Timestamp("2026-01-01"), pd.Timestamp("2026-03-01")],
        "value": [100.0, 300.0],
        "weight": [0.5, 0.7],
    })

    df_filled = fill_time_series_gaps(df_gaps)

    assert len(df_filled) == 3, f"Expected 3 rows (2026-01-01, 2026-02-01, 2026-03-01), got {len(df_filled)}"
    expected_dates = [pd.Timestamp("2026-01-01"), pd.Timestamp("2026-02-01"), pd.Timestamp("2026-03-01")]
    assert list(df_filled["event_date"]) == expected_dates

    row_gap = df_filled[df_filled["event_date"] == pd.Timestamp("2026-02-01")].iloc[0]
    assert row_gap["value"] == 100.0
    assert row_gap["weight"] == 0.5
    assert row_gap["entity_id"] == "entity_1"


@requires_azure_storage
def test_ui_endpoints():
    """
    Unit test to verify get_dashboard_html and get_predictions_json helper functions.
    """
    import os
    from ui import get_predictions_json
    config = Config()
    
    # 1. Test static frontend/index.html file presence and structure
    frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")
    assert os.path.exists(frontend_path), f"Frontend file does not exist at {frontend_path}"
    
    with open(frontend_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    assert isinstance(html_content, str)
    assert "<!DOCTYPE html>" in html_content
    assert "forecastChart" in html_content
    assert "horizon-select" in html_content
    assert "metric-select" in html_content
    
    # 2. Test get_predictions_json
    data = get_predictions_json(config)
    assert isinstance(data, dict)
    assert "daily" in data
    assert "monthly" in data
    
    # Check shape/keys if predictions were generated during prior test
    if len(data["daily"]) > 0:
        first_record = data["daily"][0]
        assert "entity_id" in first_record
        assert "event_date" in first_record
        assert "horizon_step" in first_record
        assert "Input" in first_record
        assert "Replenishment" in first_record
        assert isinstance(first_record["event_date"], str)
        assert len(first_record["event_date"]) == 10
        print(f"UI data verification passed with {len(data['daily'])} daily records.")


def _read_metrics_parquet_from_source(config: Config) -> pd.DataFrame:
    """Reads model_metrics.parquet from wherever get_metrics_json actually reads it from (Azure or local)."""
    blob_name = "model_metrics.parquet"
    if config.connection_string:
        blob_service_client = BlobServiceClient.from_connection_string(config.connection_string)
        blob_client = blob_service_client.get_blob_client(container=config.metrics_container, blob=blob_name)
        stream = io.BytesIO()
        blob_client.download_blob().readinto(stream)
        stream.seek(0)
        return pd.read_parquet(stream)
    return pd.read_parquet(os.path.join(config.local_metrics_dir, blob_name))


@requires_azure_storage
def test_ui_metrics_endpoint():
    """
    Unit test to verify get_metrics_json returns correctly structured per-entity
    accuracy metrics, backed by the actual Metrics parquet file (Azure or local,
    matching get_metrics_json's own strict Azure-required read path).
    """
    from ui import get_metrics_json
    config = Config()

    # (Re)generate metrics via training against the real Bronze data on disk,
    # so the cross-check below reflects the current training pipeline's output.
    from training import train_models
    train_models()

    metrics = get_metrics_json(config)

    assert isinstance(metrics, list)
    assert len(metrics) > 0, "Expected at least one metrics record"

    # "_oot" horizon variants hold out-of-time (post-2024-12-31 cutoff) metrics
    # alongside the regular in-time validation metrics for the same horizon.
    valid_horizons = {"tactical", "strategic", "tactical_oot", "strategic_oot"}

    expected_keys = {"horizon", "target", "entity_id", "rmse", "mae", "smape", "r2"}
    for record in metrics:
        assert expected_keys.issubset(record.keys()), f"Missing expected keys in metrics record: {record}"
        assert record["horizon"] in valid_horizons
        assert record["target"] in ("Input", "Replenishment", "Residual")
        assert isinstance(record["rmse"], float)
        assert isinstance(record["mae"], float)
        # smape/r2 are NaN for Residual rows, a float otherwise
        assert record["smape"] is None or isinstance(record["smape"], float)
        assert record["r2"] is None or isinstance(record["r2"], float)

    # Cross-check against the parquet file directly (from the same source get_metrics_json reads)
    df_metrics = _read_metrics_parquet_from_source(config)
    assert len(metrics) == len(df_metrics), "get_metrics_json record count does not match model_metrics.parquet"

    horizons_present = {record["horizon"] for record in metrics}
    targets_present = {record["target"] for record in metrics}
    assert horizons_present.issubset(valid_horizons)
    assert {"Input", "Replenishment"}.issubset(targets_present)


def test_ingest_raises_without_sql_config():
    """
    Verifies write_to_training_data_bronze() raises a clear RuntimeError
    (rather than a confusing pyodbc error) when SQL_SERVER_HOSTNAME/
    SQL_DATABASE_NAME aren't configured.
    """
    import ingest

    config = Config()
    config.sql_server_hostname = ""
    config.sql_database_name = ""

    with pytest.raises(RuntimeError, match="SQL_SERVER_HOSTNAME"):
        ingest.write_to_training_data_bronze(config)


def test_ingest_writes_daily_and_monthly_bronze_from_sql(monkeypatch, tmp_path):
    """
    Verifies write_to_training_data_bronze() queries the source database for
    both daily and monthly data and writes each to the expected Bronze path,
    in the entity_id/event_date/Input/Replenishment schema
    fetch_data_from_bronze_storage() (app.py) expects -- with the DB
    connection and Azure AD token acquisition both mocked out, since this is
    a unit test with no real database or Azure Storage available.
    """
    import ingest

    config = Config()
    config.connection_string = ""
    config.storage_account_url = ""
    config.sql_server_hostname = "test-server.database.windows.net"
    config.sql_database_name = "test-db"
    config.local_bronze_dir = str(tmp_path)

    class _FakeConnection:
        def close(self):
            pass

    monkeypatch.setattr(ingest, "_connect", lambda cfg: _FakeConnection())

    daily_df = pd.DataFrame({
        "entity_id": ["Kendal", "Kendal"],
        "event_date": pd.to_datetime(["2026-01-01", "2026-01-02"]),
        "Input": [100.0, 110.0],
        "Replenishment": [90.0, 95.0],
    })
    monthly_df = pd.DataFrame({
        "entity_id": ["Kendal"],
        "event_date": pd.to_datetime(["2026-01-01"]),
        "Input": [3100.0],
        "Replenishment": [2800.0],
    })

    def _fake_fetch_query(query, conn, config, label=""):
        return daily_df if query is ingest.DAILY_QUERY else monthly_df

    monkeypatch.setattr(ingest, "_fetch_query", _fake_fetch_query)

    ingest.write_to_training_data_bronze(config)

    written_daily = pd.read_parquet(os.path.join(str(tmp_path), "daily", "input_data.parquet"))
    written_monthly = pd.read_parquet(os.path.join(str(tmp_path), "monthly", "input_data.parquet"))

    assert list(written_daily.columns) == ["entity_id", "event_date", "Input", "Replenishment"]
    assert len(written_daily) == 2
    assert list(written_monthly.columns) == ["entity_id", "event_date", "Input", "Replenishment"]
    assert len(written_monthly) == 1


def test_ui_metrics_raises_without_azure_storage(tmp_path):
    """
    Verifies get_metrics_json raises a clear RuntimeError (rather than silently
    returning empty data) when no Azure Storage access is configured (neither
    a connection string nor a managed-identity account URL), since metrics
    must always be read from Azure Storage.
    """
    from ui import get_metrics_json

    config = Config()
    config.local_metrics_dir = str(tmp_path / "no_metrics_here")
    config.connection_string = ""
    config.storage_account_url = ""

    with pytest.raises(RuntimeError, match="No Azure Storage access is configured"):
        get_metrics_json(config)


def _read_gold_parquet_from_source(config: Config, blob_name: str) -> pd.DataFrame:
    """Reads a Gold predictions parquet from wherever get_predictions_json actually reads it from (Azure or local)."""
    if config.connection_string:
        blob_service_client = BlobServiceClient.from_connection_string(config.connection_string)
        blob_client = blob_service_client.get_blob_client(container=config.gold_container, blob=blob_name)
        stream = io.BytesIO()
        blob_client.download_blob().readinto(stream)
        stream.seek(0)
        return pd.read_parquet(stream)
    return pd.read_parquet(os.path.join(config.local_gold_dir, blob_name))


@requires_azure_storage
def test_visualization_vs_gold_parquet():
    """
    Validates the visualization data returned by get_predictions_json
    against the actual source parquet files in the Gold container/folder
    (Azure or local, matching get_predictions_json's own strict Azure-required read path).
    """
    from ui import get_predictions_json
    from training import train_models
    from app import app as run_app
    config = Config()

    # (Re)generate Gold predictions against the real Bronze data on disk, so the
    # cross-check below reflects the current pipeline's output.
    train_models()
    run_app()

    # Load the gold parquet files from the same source get_predictions_json reads
    df_daily_gold = _read_gold_parquet_from_source(config, "daily/predictions.parquet")
    df_monthly_gold = _read_gold_parquet_from_source(config, "monthly/predictions.parquet")
    
    # Fetch visualization data structure
    vis_data = get_predictions_json(config)
    
    # Verify both horizons
    for key, df_gold in [("daily", df_daily_gold), ("monthly", df_monthly_gold)]:
        vis_list = vis_data[key]
        
        # Verify row counts match
        assert len(vis_list) == len(df_gold), f"Row count mismatch for {key}: {len(vis_list)} vs {len(df_gold)}"
        
        # Convert visualization list back to DataFrame for comparison
        df_vis = pd.DataFrame(vis_list)
        
        # Verify essential columns are present
        for col in ["entity_id", "event_date", "Input", "Replenishment"]:
            assert col in df_vis.columns, f"Column '{col}' missing from visualization data for {key}"
        
        # Format the gold DataFrame event_date and numeric columns to align with get_predictions_json processing
        df_gold_formatted = df_gold.copy()
        df_gold_formatted['event_date'] = pd.to_datetime(df_gold_formatted['event_date']).dt.strftime('%Y-%m-%d')
        for col in ["Input", "Replenishment"]:
            if col in df_gold_formatted.columns:
                df_gold_formatted[col] = df_gold_formatted[col].astype(float)
                
        # Sort both datasets to ensure matching row comparisons
        df_gold_sorted = df_gold_formatted.sort_values(by=["entity_id", "event_date"]).reset_index(drop=True)
        df_vis_sorted = df_vis.sort_values(by=["entity_id", "event_date"]).reset_index(drop=True)
        
        # Assert each series is equal
        pd.testing.assert_series_equal(df_vis_sorted["entity_id"], df_gold_sorted["entity_id"])
        pd.testing.assert_series_equal(df_vis_sorted["event_date"], df_gold_sorted["event_date"])
        pd.testing.assert_series_equal(df_vis_sorted["Input"], df_gold_sorted["Input"])
        pd.testing.assert_series_equal(df_vis_sorted["Replenishment"], df_gold_sorted["Replenishment"])
        
        if "weight" in df_gold_sorted.columns:
            pd.testing.assert_series_equal(df_vis_sorted["weight"], df_gold_sorted["weight"])

        for metric in ["Input", "Replenishment"]:
            # Per-entity aggregates (sum, mean)
            vis_by_entity = df_vis_sorted.groupby("entity_id")[metric].agg(["sum", "mean"])
            gold_by_entity = df_gold_sorted.groupby("entity_id")[metric].agg(["sum", "mean"])
            pd.testing.assert_frame_equal(vis_by_entity, gold_by_entity, check_exact=False)

            # Per-date aggregates (sum, mean)
            vis_by_date = df_vis_sorted.groupby("event_date")[metric].agg(["sum", "mean"])
            gold_by_date = df_gold_sorted.groupby("event_date")[metric].agg(["sum", "mean"])
            pd.testing.assert_frame_equal(vis_by_date, gold_by_date, check_exact=False)

            # Grand totals (sum, mean, max, count)
            assert df_vis_sorted[metric].sum() == pytest.approx(df_gold_sorted[metric].sum())
            assert df_vis_sorted[metric].mean() == pytest.approx(df_gold_sorted[metric].mean())
            assert df_vis_sorted[metric].max() == pytest.approx(df_gold_sorted[metric].max())
            assert df_vis_sorted[metric].count() == df_gold_sorted[metric].count()

    print("\n--- VISUALIZATION VS GOLD PARQUET VERIFICATION PASSED SUCCESSFULLY! ---")


def _read_frontend_html() -> str:
    frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")
    with open(frontend_path, "r", encoding="utf-8") as f:
        return f.read()


@requires_azure_storage
def test_frontend_predictions_fields_match_backend():
    """
    Guards against the frontend and get_predictions_json silently drifting apart:
    every record field the dashboard JS reads from /api/forecast-data (r.entity_id,
    r.event_date, r[metric] for Input/Replenishment/Stockpile) must actually be
    produced by get_predictions_json, using the real Gold parquet data on disk.
    """
    from ui import get_predictions_json

    html_content = _read_frontend_html()
    for js_field in ["entity_id", "event_date", "Input", "Replenishment", "Stockpile"]:
        assert js_field in html_content, f"Frontend no longer references expected field '{js_field}'"

    config = Config()
    data = get_predictions_json(config)

    for horizon in ["daily", "monthly"]:
        records = data.get(horizon, [])
        if not records:
            continue
        first_record = records[0]
        for field in ["entity_id", "event_date", "Input", "Replenishment", "Stockpile"]:
            assert field in first_record, f"Backend '{horizon}' predictions missing field '{field}' expected by frontend"


@requires_azure_storage
def test_frontend_metrics_fields_match_backend():
    """
    Guards against the frontend and get_metrics_json silently drifting apart:
    every field the metrics table JS reads (row.entity_id, row.rmse, row.mae,
    row.smape, row.r2, row.nrmse, m.horizon, m.target) must actually be
    produced by get_metrics_json. R² is shown in place of SMAPE for Stockpile
    specifically (a signed, zero-crossing quantity SMAPE isn't meaningful
    for -- see compute_per_entity_metrics's docstring); NRMSE (RMSE / mean
    |actual|) is shown for every target as a scale-free companion metric.

    Also guards against a real production incident: Residual rows (and any
    row with <2 validation samples or a zero-variance target) legitimately
    have NaN smape/r2/nrmse. json.dumps serializes float('nan') as the
    invalid JSON literal `NaN`, which throws in the browser's
    response.json() and silently empties the whole metrics table
    client-side -- so every record must round-trip through
    json.dumps/json.loads intact, and any missing metric must show up as
    None (JSON null), never NaN.
    """
    import json
    import math
    from ui import get_metrics_json

    html_content = _read_frontend_html()
    for js_field in ["entity_id", "rmse", "mae", "smape", "r2", "nrmse", "horizon", "target"]:
        assert js_field in html_content, f"Frontend no longer references expected metrics field '{js_field}'"

    config = Config()
    metrics = get_metrics_json(config)
    assert len(metrics) > 0, "Expected at least one metrics record to validate field mapping"

    expected_fields = {"entity_id", "rmse", "mae", "smape", "r2", "nrmse", "horizon", "target"}
    numeric_fields = {"rmse", "mae", "smape", "r2", "nrmse"}
    for record in metrics:
        assert expected_fields.issubset(record.keys()), f"Backend metrics record missing expected fields: {record}"
        for field in numeric_fields:
            val = record[field]
            assert val is None or not (isinstance(val, float) and math.isnan(val)), (
                f"Metrics record has a raw NaN in '{field}' instead of None: {record}"
            )

    # The actual failure mode: json.dumps(allow_nan=True) (the default, and what
    # function_app.py uses) would emit invalid `NaN` tokens for any leftover NaN,
    # which JSON.parse rejects. Force allow_nan=False to catch that authoritatively.
    json.dumps(metrics, allow_nan=False)


@requires_azure_storage
def test_frontend_oot_history_fields_match_backend():
    """
    Guards against the frontend and get_oot_history_json silently drifting apart:
    every field the Stockpile History chart JS reads (r.horizon, r.entity_id,
    r.event_date, r.Stockpile_actual, r.Stockpile_predicted) must actually be
    produced by get_oot_history_json.

    Does not assert len(records) > 0: OOT history is legitimately empty until a
    training run has been executed since this feature was added.
    """
    import json
    import math
    from ui import get_oot_history_json

    html_content = _read_frontend_html()
    for js_field in ["horizon", "entity_id", "event_date", "Stockpile_actual", "Stockpile_predicted"]:
        assert js_field in html_content, f"Frontend no longer references expected OOT history field '{js_field}'"

    config = Config()
    records = get_oot_history_json(config)
    if not records:
        return

    expected_fields = {"horizon", "entity_id", "event_date", "Stockpile_actual", "Stockpile_predicted"}
    numeric_fields = {"Stockpile_actual", "Stockpile_predicted"}
    for record in records:
        assert expected_fields.issubset(record.keys()), f"Backend OOT history record missing expected fields: {record}"
        for field in numeric_fields:
            val = record[field]
            assert val is None or not (isinstance(val, float) and math.isnan(val)), (
                f"OOT history record has a raw NaN in '{field}' instead of None: {record}"
            )

    json.dumps(records, allow_nan=False)


def test_frontend_weather_fields_match_backend():
    """
    Guards against the frontend and get_weather_json silently drifting apart:
    the weather panel/chart JS indexes /api/weather-data records by r.date
    (see allWeather[r.date] = r) and then reads the weather fields below off
    that stored record, which must match the fields actually produced by
    get_weather_json.
    """
    from ui import get_weather_json

    expected_fields = {
        "date", "temp_max_c", "temp_min_c", "rainfall_mm", "cloud_cover_pct",
        "humidity_pct", "wind_speed_kmh", "weather_code", "weather_label",
        "uv_index", "sunshine_seconds",
    }

    html_content = _read_frontend_html()
    for js_field in ["r.date", "w.rainfall_mm", "w.weather_label"]:
        assert js_field in html_content, f"Frontend no longer references expected weather field '{js_field}'"

    data = get_weather_json(lookback_days=5, forecast_days=5)
    assert len(data) > 0, "Expected at least one weather record to validate field mapping"

    # Some variables (e.g. uv_index) are unavailable for historical dates and
    # come back as None rather than NaN, so json.dumps emits valid JSON null.
    numeric_fields = expected_fields - {"date", "weather_code", "weather_label"}
    for record in data:
        assert expected_fields.issubset(record.keys()), f"Backend weather record missing expected fields: {record}"
        for field in numeric_fields:
            assert record[field] is None or isinstance(record[field], float), (
                f"Expected '{field}' to be a float or None, got {type(record[field])}"
            )


if __name__ == "__main__":
    test_time_series_gaps_ffill()
    test_convert_df_to_stack()
    test_convert_df_to_stack_joins_origin_features()
    test_season_for_month()
    test_coordinates_for_entity()
    test_convert_df_to_stack_includes_weather_features()
    test_training_pipeline()  # Run training pipeline test first to train the actual models!
    test_run_verification()  # Verification test will run using the newly trained models!
    test_ui_endpoints()      # Verify the UI dashboard and data retrieval helpers!
    test_ui_metrics_endpoint()  # Verify the UI metrics retrieval helper!
    test_visualization_vs_gold_parquet()  # Verify visualization data against gold files!
    test_frontend_predictions_fields_match_backend()  # Guard frontend/backend prediction field drift!
    test_frontend_metrics_fields_match_backend()      # Guard frontend/backend metrics field drift!
    test_frontend_weather_fields_match_backend()      # Guard frontend/backend weather field drift!

