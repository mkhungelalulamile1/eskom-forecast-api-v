"""
Origin-anchored bridge onto the additionalfeatures/feature_store and
additionalfeatures/feature_experiments feature families.

The production stacking pipeline (``app.py::convert_df_to_stack``,
``training.py::prepare_training_dataset``) computes lag/rolling features once
per entity at the forecast **origin** date and broadcasts those same values
across every horizon-step row, because neither training nor inference may see
anything dated after the origin. ``feature_store`` and ``feature_experiments``
instead compute features per row at that row's own ``event_date`` using
trailing windows.

``build_origin_features()`` bridges the two: it runs every feature_store
family plus every feature_experiments blue-sky feature once over the raw
historical data, producing one row per ``(entity_id, event_date)``. Callers
join that table onto a stack using the stack's ``origin_date`` -- never its
``event_date`` -- so every horizon-step row for a given origin receives the
same, already-known-at-origin feature values. Joining on ``event_date``
instead would leak the target: several of these features (e.g.
``net_coal_flow``, ``supply_to_burn_ratio``) are computed from that exact
row's own ``Input``/``Replenishment``, which at a future ``event_date`` is
precisely what is being predicted.
"""

import os
import sys

import pandas as pd

# feature_store and feature_experiments live in additionalfeatures/, a
# sibling of both src/ and training/; add it to sys.path so this resolves
# regardless of which directory the importing module was run from.
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '..', 'additionalfeatures'
    ),
)
from feature_experiments import apply_blue_sky_features  # noqa: E402
from feature_store import create_feature_store  # noqa: E402
from feature_store.contract import MEASURES, merge_features  # noqa: E402

# feature_store.create_feature_store() discovers features by scanning the
# shared feature_store.contract.REGISTRY, and importing feature_experiments
# above registers its own @feature functions into that same registry. Naming
# the feature_store features explicitly keeps create_feature_store() running
# only its own ten, regardless of what else happens to be imported alongside
# it in the same process.
STORE_FEATURE_NAMES = [
    'rolling_mean',
    'rolling_volatility',
    'rolling_extremes',
    'ewm_mean',
    'net_flow',
    'stock_proxy',
    'supply_burn_ratio',
    'momentum',
    'disruption_regime',
    'calendar_context',
]


def build_origin_features(df: pd.DataFrame, grain: str = 'daily') -> pd.DataFrame:
    """
    Build one feature row per ``(entity_id, event_date)`` for later origin join.

    Runs every registered ``feature_store`` family and every
    ``feature_experiments`` blue-sky feature over the raw historical data,
    and merges the results. The output is keyed on ``(entity_id,
    event_date)`` and is meant to be joined by a caller onto a stack's
    ``origin_date`` -- see the module docstring for why ``event_date`` itself
    must not be used as the join key against a stack.

    Parameters
    ----------
    df : pd.DataFrame
        Raw historical data with ``entity_id``, ``event_date``, ``Input``
        and ``Replenishment``. One row per station per period.
    grain : str, optional
        ``'daily'`` or ``'monthly'`` -- selects window defaults in
        ``create_feature_store`` and, for ``apply_blue_sky_features``,
        whether features are returned per row (``'daily'``) or averaged per
        entity per calendar month (``'monthly'``). Default ``'daily'``.

    Returns
    -------
    pd.DataFrame
        ``entity_id``, ``event_date`` plus every feature_store and
        blue-sky feature column. ``Input``/``Replenishment`` are not
        included -- callers already have them on the frame being joined
        onto.

    Examples
    --------
    >>> origin_features = build_origin_features(raw_df, grain='daily')
    >>> 'supply_to_burn_ratio' in origin_features.columns
    True
    """
    store = create_feature_store(
        df, grain=grain, keep_measures=False, include=STORE_FEATURE_NAMES
    )
    blue_sky = apply_blue_sky_features(df, grain=grain)
    blue_sky = blue_sky.drop(columns=[c for c in MEASURES if c in blue_sky.columns])

    return merge_features(df[['entity_id', 'event_date']], [store, blue_sky])
