"""
Assemble the full training dataset from every available feature source.

Combines the base lag/temporal features, the ``features_extra.csv`` side
table, the blue-sky experiments in ``feature_experiments.py`` and the
registered feature store in ``feature_store``, using
``feature_store.contract.merge_features`` so every source is joined the same
way -- keyed on ``(entity_id, event_date)``, with duplicate feature columns
across sources rejected rather than silently overwritten.

Set ``GRAIN`` to ``'daily'`` or ``'monthly'`` to select which base dataset is
read and which feature-store window defaults apply. At ``'monthly'``,
``feature_experiments`` features are computed daily and then averaged per
entity per calendar month, since they have no native monthly form.
"""

import pandas as pd

from feature_experiments import apply_blue_sky_features
from feature_store import create_feature_store
from feature_store.contract import MEASURES, merge_features

GRAIN = 'daily'

# feature_store.create_feature_store() discovers features by scanning the
# shared contract.REGISTRY, and importing feature_experiments above
# registers its own @feature functions into that same registry. Naming the
# feature_store features explicitly keeps create_feature_store() running
# only its own ten, regardless of what else happens to be imported.
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

BASE_PATHS = {
    'daily': r'data\daily\features-and-target.csv',
    'monthly': r'data\monthly\features-and-target.csv',
}
OUTPUT_PATHS = {
    'daily': 'training_data.csv',
    'monthly': 'training_data_monthly.csv',
}

base = pd.read_csv(BASE_PATHS[GRAIN], parse_dates=['event_date'])

# feature_store has no monthly feature families of its own to average --
# create_feature_store(grain='monthly') already substitutes its monthly
# window defaults (see GRAIN_OVERRIDES in feature_store/store.py) and
# returns one row per input row, same as at daily grain.
blue_sky = apply_blue_sky_features(base, grain=GRAIN)
store = create_feature_store(
    base, grain=GRAIN, keep_measures=False, include=STORE_FEATURE_NAMES
)

if GRAIN == 'daily':
    features_extra = pd.read_csv(
        'data/daily/features_extra.csv', parse_dates=['event_date']
    )
    # apply_blue_sky_features() merges Input and Replenishment back onto its
    # output alongside its own feature columns. merge_features() rejects
    # duplicate columns across parts, so those measures are dropped here --
    # they already live on `base`.
    combined = merge_features(
        base, [features_extra, blue_sky.drop(columns=MEASURES), store]
    )
else:
    # At monthly grain, blue_sky is keyed on (entity_id, event_date) with
    # event_date stamped as each month's last day (see
    # feature_experiments._monthly_average), while base/store still carry
    # whatever event_date the monthly source data uses -- month-start, per
    # ingest.py's DATETRUNC(month, ...) convention. Joining on event_date
    # directly would compare a month-start date to a month-end date and
    # match nothing, so the join uses a month-end key derived from base's
    # own event_date and keeps base's original event_date as the output key.
    combined = merge_features(base, [store])
    join_key = combined['event_date'] + pd.offsets.MonthEnd(0)
    combined = combined.merge(
        blue_sky,
        left_on=['entity_id', join_key],
        right_on=['entity_id', 'event_date'],
        how='left',
        suffixes=('', '_blue_sky'),
    ).drop(columns=['event_date_blue_sky'])

combined.to_csv(OUTPUT_PATHS[GRAIN], index=False)
