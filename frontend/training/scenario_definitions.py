"""
What-if scenario definitions for inference-time batch scoring.

This feature is inference-only. No model is retrained, fine-tuned, or given
new features. Every scenario below only ever overrides columns that already
exist in the trained models' feature set (`season`, `temp_max_c`, `temp_min_c`,
`humidity_pct`) with values already inside that column's trained domain
(quintile buckets 0-4, season codes 0-3) -- the model has already seen every
one of these exact values during training via real historical weather/season
variation, so scenario inference is a legitimate use of the existing trained
model, not extrapolation. Per Context.md: "this implementation only deals
with inference; re-training is done offline at a yet-to-be-decided cadence."
"""

# Columns that are safe to override, and their valid post-bucketing domain.
# season: 0=Summer, 1=Autumn, 2=Winter, 3=Spring (Southern Hemisphere, see
# weather.SEASON_BY_MONTH). temp_max_c/temp_min_c/humidity_pct: quintile
# buckets 0 (lowest fifth of that station's history) to 4 (highest fifth),
# see weather.apply_quantile_edges().
OVERRIDABLE_COLUMNS = {
    "season": set(range(4)),
    "temp_max_c": set(range(5)),
    "temp_min_c": set(range(5)),
    "humidity_pct": set(range(5)),
}

# One row per scenario. `overrides` maps a stack column name to the literal
# value broadcast across every row of that scenario's copy of the stack.
# `overrides == {}` means "no overrides" -- the baseline/actual forecast is
# produced by the exact same mechanism as every other scenario, not
# special-cased elsewhere in the code. Adding a new scenario requires only
# appending a row here -- no other code changes.
SCENARIO_DEFINITIONS = [
    {
        "scenario_id": "actual",
        "label": "Actual (baseline)",
        "overrides": {},
    },
    {
        "scenario_id": "weather_hot_dry",
        "label": "Hot & Dry",
        "overrides": {"temp_max_c": 4, "temp_min_c": 4, "humidity_pct": 0},
    },
    {
        "scenario_id": "weather_hot_wet",
        "label": "Hot & Wet",
        "overrides": {"temp_max_c": 4, "temp_min_c": 4, "humidity_pct": 4},
    },
    {
        "scenario_id": "weather_cold_dry",
        "label": "Cold & Dry",
        "overrides": {"temp_max_c": 0, "temp_min_c": 0, "humidity_pct": 0},
    },
    {
        "scenario_id": "weather_cold_wet",
        "label": "Cold & Wet",
        "overrides": {"temp_max_c": 0, "temp_min_c": 0, "humidity_pct": 4},
    },
]


def validate_scenario_definitions(definitions=None) -> None:
    """
    Raises ValueError if any scenario's override falls outside
    OVERRIDABLE_COLUMNS' valid domain, references an unknown column, or if
    scenario_id is duplicated across rows.

    Parameters
    ----------
    definitions : list[dict], optional
        Scenario definitions to validate. Defaults to SCENARIO_DEFINITIONS.
    """
    if definitions is None:
        definitions = SCENARIO_DEFINITIONS

    seen_ids = set()
    for scenario in definitions:
        scenario_id = scenario["scenario_id"]
        if scenario_id in seen_ids:
            raise ValueError(f"Duplicate scenario_id: '{scenario_id}'")
        seen_ids.add(scenario_id)

        for col, value in scenario["overrides"].items():
            if col not in OVERRIDABLE_COLUMNS:
                raise ValueError(
                    f"Scenario '{scenario_id}' overrides unknown column '{col}'; "
                    f"only {sorted(OVERRIDABLE_COLUMNS)} may be overridden."
                )
            if value not in OVERRIDABLE_COLUMNS[col]:
                raise ValueError(
                    f"Scenario '{scenario_id}' sets '{col}' to {value!r}, outside "
                    f"its valid domain {sorted(OVERRIDABLE_COLUMNS[col])}."
                )
