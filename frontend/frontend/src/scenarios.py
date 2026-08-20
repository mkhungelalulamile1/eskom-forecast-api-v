"""
What-if scenario batch scoring: expands an inference stack into one copy per
scenario, scores every scenario in a single batched .predict() call per
target, reconstructs cumulative Stockpile per scenario, and saves the result
as a combined Gold artifact alongside the baseline forecast.

Inference-only: no model is retrained or given new features. Every scenario
override only ever touches columns the models were already trained on, using
values already inside that column's trained domain -- see
training/scenario_definitions.py for the full rationale.
"""
import os
import io
import sys
import pandas as pd
from config import Config
from app import (
    fetch_data_from_bronze_storage,
    data_format_validation,
    convert_df_to_stack,
    Prediction_runner,
)

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'training'))
from scenario_definitions import SCENARIO_DEFINITIONS, validate_scenario_definitions


def expand_stack_with_scenarios(stack: pd.DataFrame, definitions=None) -> pd.DataFrame:
    """
    Expands a baseline inference stack into one copy per scenario, with that
    scenario's feature overrides applied and a leading 'scenario_id' column
    added, then concatenates all copies into a single dataframe.

    Overrides are applied to the STACK (post convert_df_to_stack), not the
    raw bronze dataframe -- by this point season/weather columns are already
    the final integer codes (0-3 / 0-4) the model consumes directly, so an
    override is just a column-wide scalar assignment, with no re-bucketing
    or re-derivation required.

    Parameters
    ----------
    stack : pd.DataFrame
        The baseline stacked inference dataframe, as produced by
        app.convert_df_to_stack().
    definitions : list[dict], optional
        Scenario definitions to expand against. Defaults to
        SCENARIO_DEFINITIONS.

    Returns
    -------
    pd.DataFrame
        `stack` repeated once per scenario, each copy tagged with
        'scenario_id' and its overrides applied. Row count is
        `len(stack) * len(definitions)`.
    """
    if definitions is None:
        definitions = SCENARIO_DEFINITIONS
    validate_scenario_definitions(definitions)

    frames = []
    for scenario in definitions:
        df_copy = stack.copy()
        for col, value in scenario["overrides"].items():
            df_copy[col] = value
        df_copy.insert(0, "scenario_id", scenario["scenario_id"])
        frames.append(df_copy)
    return pd.concat(frames, ignore_index=True)


def reconstruct_stockpile(predictions_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes cumulative Stockpile (Replenishment - Input, cumulative from
    zero) independently per (scenario_id, entity_id), so each scenario's
    stockpile trajectory never leaks into another's.

    Mirrors ui.get_predictions_json()'s per-entity cumsum shape, extended to
    also group by scenario_id.

    Parameters
    ----------
    predictions_df : pd.DataFrame
        Must contain 'scenario_id', 'entity_id', 'event_date', 'Input',
        'Replenishment' columns.

    Returns
    -------
    pd.DataFrame
        `predictions_df` sorted by (scenario_id, entity_id, event_date) with
        an added 'Stockpile' column.
    """
    df = predictions_df.sort_values(["scenario_id", "entity_id", "event_date"]).reset_index(drop=True)
    df["Stockpile"] = (
        (df["Replenishment"] - df["Input"])
        .groupby([df["scenario_id"], df["entity_id"]])
        .cumsum()
    )
    return df


def save_scenario_predictions_to_gold(scenario_df: pd.DataFrame, horizon: str, config: Config) -> None:
    """
    Saves the combined (all-scenarios) prediction dataframe to the Gold
    storage container in Parquet format, mirroring
    Prediction_runner.save_predictions_to_gold's blob-first, local-fallback
    save, under a distinct filename so it never collides with the baseline
    predictions.parquet.

    Parameters
    ----------
    scenario_df : pd.DataFrame
        Combined predictions across all scenarios, with 'scenario_id',
        'entity_id', 'event_date', 'horizon_step', 'Input', 'Replenishment',
        'Stockpile' columns.
    horizon : str
        'tactical' or 'strategic'.
    config : Config
    """
    scenario_df = scenario_df.copy()
    round_cols = [c for c in ["Input", "Replenishment", "Stockpile"] if c in scenario_df.columns]
    scenario_df[round_cols] = scenario_df[round_cols].round(2)
    output_blob_name = f"{'daily' if horizon == 'tactical' else 'monthly'}/scenario_predictions.parquet"

    if config.has_storage_access():
        try:
            out_stream = io.BytesIO()
            scenario_df.to_parquet(out_stream, index=False)
            out_stream.seek(0)

            blob_service_client = config.get_blob_service_client()
            blob_client = blob_service_client.get_blob_client(container=config.gold_container, blob=output_blob_name)
            blob_client.upload_blob(out_stream.getvalue(), overwrite=True)
            print(f"Scenario predictions successfully written to Gold Storage: {config.gold_container}/{output_blob_name}")
            return
        except Exception as e:
            print(f"Error uploading scenario predictions to Gold Storage: {e}. Saving locally.")

    local_out_path = os.path.join(config.local_gold_dir, output_blob_name)
    os.makedirs(os.path.dirname(local_out_path), exist_ok=True)
    scenario_df.to_parquet(local_out_path, index=False)
    print(f"Scenario predictions successfully written locally to: {local_out_path}")


def run_scenario_forecast_for_stack(stack: pd.DataFrame, horizon: str, config: Config, runner: Prediction_runner = None) -> None:
    """
    Runs the what-if scenario pipeline (expand -> score -> reconstruct
    Stockpile -> save) against an already-built baseline inference stack,
    reusing the given Prediction_runner (or building/loading a new one if
    not provided) rather than recomputing the stack from bronze data.

    This is the entry point called from app.run_single_forecast() right
    after the baseline forecast succeeds, so scenario generation rides the
    same production inference run with no separate fetch/stack step.

    Parameters
    ----------
    stack : pd.DataFrame
        The baseline stacked inference dataframe already built for this
        horizon by convert_df_to_stack().
    horizon : str
        'tactical' or 'strategic'.
    config : Config
    runner : Prediction_runner, optional
        An already-initialized (and ideally already model-loaded) runner for
        this horizon. If not provided, a new one is created and its models
        loaded.
    """
    if runner is None:
        runner = Prediction_runner(horizon, config)
        runner.load_models()

    expanded_stack = expand_stack_with_scenarios(stack)
    predictions_df = runner.generate_predictions(expanded_stack)
    scenario_df = reconstruct_stockpile(predictions_df)
    save_scenario_predictions_to_gold(scenario_df, horizon, config)


def run_scenario_forecast(horizon_type: str, config: Config = None) -> None:
    """
    Standalone entry point for the what-if scenario pipeline: fetches bronze
    data, builds the stack, and runs the full expand/score/save sequence.
    Kept for manual re-runs and tests -- the production path
    (app.run_single_forecast) reuses an already-built stack via
    run_scenario_forecast_for_stack() instead of calling this, to avoid
    fetching/stacking bronze data twice.

    Parameters
    ----------
    horizon_type : str
        'daily' or 'monthly'.
    config : Config, optional
    """
    if config is None:
        config = Config()

    if horizon_type == "daily":
        df = fetch_data_from_bronze_storage(config, horizon_type="daily")
        if data_format_validation(df, expected_entities=config.num_entities, expected_years=config.num_years):
            stack = convert_df_to_stack(df, horizon=90, horizon_key="tactical", config=config)
            run_scenario_forecast_for_stack(stack, horizon="tactical", config=config)
    elif horizon_type == "monthly":
        df = fetch_data_from_bronze_storage(config, horizon_type="monthly")
        if data_format_validation(df, expected_entities=config.num_entities, expected_years=config.num_years):
            stack = convert_df_to_stack(df, horizon=36, horizon_key="strategic", config=config)
            run_scenario_forecast_for_stack(stack, horizon="strategic", config=config)
    else:
        raise ValueError(f"Unknown horizon type: {horizon_type}")
