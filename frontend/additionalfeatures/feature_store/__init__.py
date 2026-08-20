"""
Feature store for the Eskom coal stockpile forecast.

Ten feature families that extend the base lag/temporal set produced by
``EDA.py``, written to a single contract so that independently authored
features compose without coordination and can all be leakage-tested by one
mechanical check.

Usage
-----
>>> import pandas as pd
>>> from feature_store import create_feature_store
>>> base = pd.read_csv('data/daily/clean_burn.csv')
>>> base.columns = ['entity_id', 'event_date', 'Input', 'Replenishment']
>>> features = create_feature_store(base, grain='daily')

To see what each feature does and why it exists:

>>> from feature_store import feature_catalogue
>>> feature_catalogue()[['name', 'summary']]
"""

from .contract import (
    KEY,
    MEASURES,
    REGISTRY,
    FeatureContractError,
    FeatureSpec,
    feature,
    validate_base,
    validate_output,
)
from .features import (
    calendar_context,
    disruption_regime,
    ewm_mean,
    momentum,
    net_flow,
    rolling_extremes,
    rolling_mean,
    rolling_volatility,
    stock_proxy,
    supply_burn_ratio,
)
from .store import available_features, create_feature_store, feature_catalogue

__all__ = [
    'KEY',
    'MEASURES',
    'REGISTRY',
    'FeatureContractError',
    'FeatureSpec',
    'available_features',
    'calendar_context',
    'create_feature_store',
    'disruption_regime',
    'ewm_mean',
    'feature',
    'feature_catalogue',
    'momentum',
    'net_flow',
    'rolling_extremes',
    'rolling_mean',
    'rolling_volatility',
    'stock_proxy',
    'supply_burn_ratio',
    'validate_base',
    'validate_output',
]
