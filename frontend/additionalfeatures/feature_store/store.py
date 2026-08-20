"""
The orchestrator: runs every registered feature and returns one merged frame.

This is the entry point the rest of the pipeline calls, and the only function
in the package that a caller normally needs.

On structure
------------
The agreed shape was a ``create_feature_store`` that returns a merged dataset,
with a function per feature underneath. That is what this is, with one
deliberate difference: the feature functions are defined at module level in
``features.py`` rather than nested inside this one. Nested functions cannot be
imported, tested, or reviewed in isolation, and with four people contributing
features independently and a leakage test that has to run against each one,
individual addressability is worth more than the tidiness of a single
enclosing function. The public contract is unchanged.
"""

from __future__ import annotations

import pandas as pd

from . import features as _features  # noqa: F401  (import registers the features)
from .contract import KEY, REGISTRY, FeatureSpec, merge_features, validate_base, validate_output

# Windows appropriate to each grain. A 90-period window means 90 days on the
# daily frame and seven and a half years on the monthly one, so the defaults
# cannot be shared.
GRAIN_OVERRIDES: dict[str, dict[str, dict]] = {
    'monthly': {
        'rolling_mean': {'windows': _features.MONTHLY_WINDOWS},
        'rolling_volatility': {'windows': _features.MONTHLY_WINDOWS},
        'rolling_extremes': {'windows': (6, 12)},
        'ewm_mean': {'halflives': (3, 12)},
        'net_flow': {'windows': (3, 6, 12)},
        'stock_proxy': {'cover_window': 3},
        'supply_burn_ratio': {'windows': (3, 6, 12)},
        'momentum': {'short': 3, 'long': 12, 'slope_window': 6},
        'disruption_regime': {'window': 12},
    },
}


def available_features(grain: str = 'daily') -> list[FeatureSpec]:
    """
    List the registered features applicable to a grain.

    Parameters
    ----------
    grain : str, optional
        'daily' or 'monthly'. Default 'daily'.

    Returns
    -------
    list of FeatureSpec
        Specs whose ``grain`` is 'any' or matches the requested grain.

    Examples
    --------
    >>> len(available_features('daily')) >= len(available_features('monthly'))
    True
    """
    return [s for s in REGISTRY.values() if s.grain in ('any', grain)]


def create_feature_store(
    df: pd.DataFrame,
    grain: str = 'daily',
    include: list[str] | None = None,
    exclude: list[str] | None = None,
    keep_measures: bool = True,
) -> pd.DataFrame:
    """
    Run every applicable feature over the base data and merge the results.

    Parameters
    ----------
    df : pd.DataFrame
        Base data with ``entity_id``, ``event_date``, ``Input`` and
        ``Replenishment``. One row per station per period.
    grain : str, optional
        'daily' or 'monthly'. Selects window defaults and drops features that
        only make sense daily. Default 'daily'.
    include : list of str, optional
        If given, run only these feature names.
    exclude : list of str, optional
        Feature names to skip. Applied after ``include``.
    keep_measures : bool, optional
        Keep ``Input`` and ``Replenishment`` in the output. Default True.

    Returns
    -------
    pd.DataFrame
        One row per input row, keyed on ``(entity_id, event_date)``, with
        every feature column merged on. Row count and order match the
        validated input.

    Raises
    ------
    FeatureContractError
        If the base frame is malformed, or any feature breaks the contract.
    KeyError
        If ``include`` names a feature that is not registered.

    Examples
    --------
    >>> out = create_feature_store(base, grain='daily')
    >>> out.shape[0] == len(base)
    True
    >>> create_feature_store(base, include=['rolling_mean']).shape[1]
    4
    """
    base = validate_base(df)

    specs = available_features(grain)
    if include is not None:
        known = {s.name for s in REGISTRY.values()}
        unknown = set(include) - known
        if unknown:
            raise KeyError(f'Unknown feature(s): {sorted(unknown)}. Known: {sorted(known)}')
        specs = [s for s in specs if s.name in include]
    if exclude:
        specs = [s for s in specs if s.name not in exclude]

    overrides = GRAIN_OVERRIDES.get(grain, {})

    parts: list[pd.DataFrame] = []
    for spec in specs:
        result = spec.fn(base, **overrides.get(spec.name, {}))
        parts.append(validate_output(result, spec.name, len(base)))

    keep = KEY + (['Input', 'Replenishment'] if keep_measures else [])
    return merge_features(base[keep], parts)


def feature_catalogue(grain: str = 'daily') -> pd.DataFrame:
    """
    Tabulate every applicable feature with its rationale and leakage note.

    Intended for documentation and for the hand-off to data engineering, so
    the reason a feature exists travels with the list of feature names rather
    than being reconstructed later.

    Parameters
    ----------
    grain : str, optional
        'daily' or 'monthly'. Default 'daily'.

    Returns
    -------
    pd.DataFrame
        Columns ``name``, ``summary``, ``rationale``, ``leakage_note``,
        ``grain``, ``tags``.

    Examples
    --------
    >>> feature_catalogue().columns.tolist()[0]
    'name'
    """
    return pd.DataFrame([
        {
            'name': s.name,
            'summary': s.summary,
            'rationale': s.rationale,
            'leakage_note': s.leakage_note,
            'grain': s.grain,
            'tags': ', '.join(s.tags),
        }
        for s in available_features(grain)
    ])
