"""
The contract every feature function in this package obeys, plus the registry
and merge helpers that `store.create_feature_store` builds on.

The contract exists so that four people can write features independently and
have them compose without coordination, and so that a single leakage test can
be applied mechanically to all of them.

A feature function:

1. Takes the base dataframe as its first positional argument.
2. Returns a dataframe keyed on ``(entity_id, event_date)`` plus one or more
   feature columns, and nothing else.
3. Uses only information available at or before each row's ``event_date``.
   Never a value from a later date, for any station.
4. Is pure: same input, same output. No file or network access, no globals.
5. Is registered with ``@feature`` so the store can discover it.

Rule 3 is the one that matters. It is enforced mechanically by
``tests/test_leakage.py`` rather than trusted, because feature leakage is the
documented technical reason an earlier iteration of this project produced
laboratory metrics that did not survive contact with out-of-time data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import reduce
from typing import Callable, Iterable

import pandas as pd

# The two columns that identify a row. Every feature returns exactly these
# plus its own outputs, so merges are unambiguous.
KEY = ['entity_id', 'event_date']

# The two measures the base dataset carries. `Input` is coal burned;
# `Replenishment` is coal delivered. The naming is inherited from the
# existing pipeline and is kept rather than improved, so that features written
# here drop straight into it.
MEASURES = ['Input', 'Replenishment']


class FeatureContractError(ValueError):
    """Raised when a feature function violates the contract in this module."""


@dataclass(frozen=True)
class FeatureSpec:
    """
    A registered feature function and the metadata needed to explain it.

    The prose fields are not decoration. This project has to defend every
    feature to a client that has rejected three previous iterations, so the
    reason a feature exists travels with the code rather than living in
    someone's memory.

    Attributes
    ----------
    name : str
        Short identifier, matching the function name.
    fn : Callable
        The feature function itself.
    summary : str
        One line: what it computes.
    rationale : str
        Why it should carry signal for coal stockpile forecasting.
    leakage_note : str
        Why it cannot see the future. Written per feature deliberately: a
        generic assurance is worth nothing.
    grain : str
        'any' if it works on daily and monthly data, otherwise 'daily'.
    """

    name: str
    fn: Callable[..., pd.DataFrame]
    summary: str
    rationale: str
    leakage_note: str
    grain: str = 'any'
    tags: tuple[str, ...] = field(default_factory=tuple)


REGISTRY: dict[str, FeatureSpec] = {}


def feature(
    *,
    summary: str,
    rationale: str,
    leakage_note: str,
    grain: str = 'any',
    tags: Iterable[str] = (),
) -> Callable:
    """
    Register a feature function so `create_feature_store` can discover it.

    Parameters
    ----------
    summary : str
        One line describing what the function computes.
    rationale : str
        Why this should carry predictive signal for burn or supply.
    leakage_note : str
        The specific reason this feature cannot see beyond its own row's date.
    grain : str, optional
        'any' (daily and monthly) or 'daily'. Default 'any'.
    tags : iterable of str, optional
        Free-form labels, e.g. 'volatility', 'stock'.

    Returns
    -------
    Callable
        The original function, unchanged, now present in ``REGISTRY``.

    Examples
    --------
    >>> @feature(summary='Trailing mean', rationale='...', leakage_note='...')
    ... def rolling_mean(df):
    ...     ...
    """

    def decorate(fn: Callable[..., pd.DataFrame]) -> Callable[..., pd.DataFrame]:
        REGISTRY[fn.__name__] = FeatureSpec(
            name=fn.__name__,
            fn=fn,
            summary=summary,
            rationale=rationale,
            leakage_note=leakage_note,
            grain=grain,
            tags=tuple(tags),
        )
        return fn

    return decorate


def validate_base(df: pd.DataFrame) -> pd.DataFrame:
    """
    Check the base dataframe is usable, and return a normalised copy.

    Normalisation is deliberately minimal: parse ``event_date``, sort by
    station then date, and reset the index. Sorting matters because every
    rolling and shifting operation in this package assumes chronological
    order within a station, and a silently unsorted frame produces features
    that look plausible and are wrong.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain ``entity_id``, ``event_date`` and both measures.

    Returns
    -------
    pd.DataFrame
        Copy, sorted by ``entity_id`` then ``event_date``, index reset.

    Raises
    ------
    FeatureContractError
        Missing columns, empty frame, unparseable dates, or duplicate
        station-date rows.

    Examples
    --------
    >>> validate_base(base_df).columns.tolist()[:2]
    ['entity_id', 'event_date']
    """
    if df is None or len(df) == 0:
        raise FeatureContractError('Base dataframe is empty or None.')

    required = set(KEY) | set(MEASURES)
    missing = required - set(df.columns)
    if missing:
        raise FeatureContractError(
            f'Base dataframe is missing required column(s): {sorted(missing)}'
        )

    out = df.loc[:, [c for c in df.columns]].copy()

    try:
        out['event_date'] = pd.to_datetime(out['event_date'])
    except (ValueError, TypeError) as exc:
        raise FeatureContractError(f"'event_date' could not be parsed as dates: {exc}") from exc

    duplicated = out.duplicated(subset=KEY).sum()
    if duplicated:
        raise FeatureContractError(
            f'Base dataframe has {duplicated} duplicate (entity_id, event_date) rows. '
            'Aggregate to one row per station-date before building features.'
        )

    return out.sort_values(KEY).reset_index(drop=True)


def validate_output(result: pd.DataFrame, name: str, expected_rows: int) -> pd.DataFrame:
    """
    Check a feature function's return value obeys the contract.

    Parameters
    ----------
    result : pd.DataFrame
        Whatever the feature function returned.
    name : str
        Feature name, used in error messages.
    expected_rows : int
        Row count of the base frame it was given.

    Returns
    -------
    pd.DataFrame
        The result, unchanged.

    Raises
    ------
    FeatureContractError
        Wrong type, missing key columns, wrong row count, duplicate keys,
        or no feature columns beyond the key.

    Examples
    --------
    >>> validate_output(out, 'rolling_mean', len(base))  # doctest: +SKIP
    """
    if not isinstance(result, pd.DataFrame):
        raise FeatureContractError(f"'{name}' returned {type(result).__name__}, expected DataFrame.")

    missing = set(KEY) - set(result.columns)
    if missing:
        raise FeatureContractError(f"'{name}' output is missing key column(s): {sorted(missing)}")

    produced = [c for c in result.columns if c not in KEY]
    if not produced:
        raise FeatureContractError(f"'{name}' produced no feature columns beyond the key.")

    if len(result) != expected_rows:
        raise FeatureContractError(
            f"'{name}' returned {len(result)} rows, expected {expected_rows}. "
            'A feature must not add or drop rows.'
        )

    if result.duplicated(subset=KEY).any():
        raise FeatureContractError(f"'{name}' output has duplicate (entity_id, event_date) rows.")

    stripped = [c for c in produced if c != c.strip()]
    if stripped:
        raise FeatureContractError(
            f"'{name}' produced column name(s) with leading/trailing whitespace: {stripped}. "
            'Whitespace in column names breaks lookup by name silently.'
        )

    return result


def merge_features(base: pd.DataFrame, parts: list[pd.DataFrame]) -> pd.DataFrame:
    """
    Left-join every feature frame onto the base frame on the key.

    A left join on a validated key is used rather than concatenation so that
    row alignment is by station and date rather than by position. Positional
    alignment is the kind of thing that works until one feature sorts
    differently and then silently mislabels every row.

    Parameters
    ----------
    base : pd.DataFrame
        The validated base frame.
    parts : list of pd.DataFrame
        Feature frames, each keyed on ``(entity_id, event_date)``.

    Returns
    -------
    pd.DataFrame
        Base plus every feature column.

    Raises
    ------
    FeatureContractError
        If two features produce a column of the same name.

    Examples
    --------
    >>> merge_features(base, [f1, f2]).shape[0] == base.shape[0]
    True
    """
    seen: dict[str, str] = {}
    for part in parts:
        for col in part.columns:
            if col in KEY:
                continue
            if col in seen:
                raise FeatureContractError(
                    f"Duplicate feature column '{col}'. Two feature functions produced it; "
                    'rename one.'
                )
            seen[col] = col

    return reduce(lambda left, right: left.merge(right, on=KEY, how='left'), parts, base)
