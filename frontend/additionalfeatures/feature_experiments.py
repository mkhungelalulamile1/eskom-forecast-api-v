"""
Blue-sky feature experiments, refactored onto the ``feature_store`` contract.

Every feature function here obeys the contract in ``feature_store.contract``:
base dataframe in, ``(entity_id, event_date)`` plus feature columns out,
using only information available at or before each row's own date. See
``feature_store/contract.py`` for the full rule set.
"""

from __future__ import annotations

import pandas as pd

from feature_store.contract import KEY, feature, merge_features, validate_base

# Guards division where a denominator can legitimately be zero (a station on
# full outage burns nothing). Chosen well below any plausible real tonnage so
# it never perturbs a genuine value.
_EPS = 1e-6


@feature(
    summary='Trailing ratio of coal supply (Replenishment) to burn (Input).',
    rationale=(
        'A single-row ratio of supply to burn says whether a station received more coal than '
        'it burned on that day, which is the simplest possible signal for stockpile direction.'
    ),
    leakage_note=(
        'Computed row-wise from Input and Replenishment at the row own date only. No shift, '
        'window or groupby is involved, so there is nothing to look forward through.'
    ),
    tags=('flow', 'scale-free'),
)
def add_supply_to_burn_ratio(df: pd.DataFrame) -> pd.DataFrame:
    """
    Row-wise ratio of supply to burn.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``supply_to_burn_ratio``.

    Examples
    --------
    >>> 'supply_to_burn_ratio' in add_supply_to_burn_ratio(base).columns
    True
    """
    df = validate_base(df)

    ratio = df['Replenishment'] / (df['Input'] + _EPS)

    return _out(df, {'supply_to_burn_ratio': ratio})


@feature(
    summary='Percentage change of a measure over one or more trailing periods.',
    rationale=(
        'The percentage change over a trailing period is a scale-free way to see how fast a '
        'measure is moving relative to its own recent level, comparable across stations that '
        'differ in size by an order of magnitude.'
    ),
    leakage_note=(
        'pct_change(periods=p) compares the current row only to a row p periods earlier, within '
        'a per-station groupby, so no row can see a later date and no station can see another.'
    ),
    tags=('momentum', 'scale-free'),
)
def add_rate_of_change(
    df: pd.DataFrame,
    column: str,
    periods: list[int],
) -> pd.DataFrame:
    """
    Percentage change of a measure over each requested trailing period.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    column : str
        Measure column to compute the rate of change for.
    periods : list of int
        Trailing periods, in rows, to compute the percentage change over.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{column}_pct_change_{p}d`` per period.

    Examples
    --------
    >>> out = add_rate_of_change(base, column='Input', periods=[1])
    >>> 'input_pct_change_1d' in out.columns
    True
    """
    df = validate_base(df)

    cols = {
        f'{column.lower()}_pct_change_{p}d': (
            df.groupby('entity_id', sort=False)[column].pct_change(periods=p)
        )
        for p in periods
    }

    return _out(df, cols)


@feature(
    summary='Second difference (change in the rate of change) of a measure.',
    rationale=(
        'A double difference captures acceleration: whether the measure is not just rising or '
        'falling but doing so at an increasing or decreasing rate, which a single lag or a plain '
        'rate of change cannot distinguish.'
    ),
    leakage_note=(
        'diff().diff() is computed within a per-station groupby and each difference looks '
        'strictly backward, so no row depends on a later date or another station.'
    ),
    tags=('momentum',),
)
def add_acceleration(df: pd.DataFrame, column: str) -> pd.DataFrame:
    """
    Second difference (acceleration) of a measure.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    column : str
        Measure column to compute acceleration for.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{column}_acceleration``.

    Examples
    --------
    >>> 'input_acceleration' in add_acceleration(base, column='Input').columns
    True
    """
    df = validate_base(df)

    feature_name = f'{column.lower()}_acceleration'
    acceleration = df.groupby('entity_id', sort=False)[column].diff().diff()

    return _out(df, {feature_name: acceleration})


@feature(
    summary='Single-period net coal flow and its per-station cumulative sum.',
    rationale=(
        'Supply minus burn is the quantity that actually moves the stockpile. Its cumulative '
        'sum traces the running stock position implied by that flow, from a zero baseline at '
        'each station first observation.'
    ),
    leakage_note=(
        'net_coal_flow is computed row-wise from measures at the row own date. The cumulative '
        'sum runs forward through time within a per-station groupby, so the value at t includes '
        't and every earlier row for that station and nothing later, and nothing from another '
        'station.'
    ),
    tags=('flow', 'stock'),
)
def add_net_coal_flow(df: pd.DataFrame) -> pd.DataFrame:
    """
    Net coal flow and its per-station cumulative sum.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``net_coal_flow`` and ``cumulative_net_flow``.

    Examples
    --------
    >>> 'cumulative_net_flow' in add_net_coal_flow(base).columns
    True
    """
    df = validate_base(df)

    net_flow = df['Replenishment'] - df['Input']
    work = df.assign(_net_flow=net_flow)
    cumulative = work.groupby('entity_id', sort=False)['_net_flow'].cumsum()

    return _out(df, {
        'net_coal_flow': net_flow,
        'cumulative_net_flow': cumulative,
    })


def _out(df: pd.DataFrame, cols: dict[str, pd.Series]) -> pd.DataFrame:
    """
    Assemble a contract-shaped output frame from computed columns.

    Parameters
    ----------
    df : pd.DataFrame
        The validated base frame, used for its key columns.
    cols : dict of str to pd.Series
        Feature name to values, index-aligned with ``df``.

    Returns
    -------
    pd.DataFrame
        ``entity_id``, ``event_date`` and the supplied feature columns.

    Examples
    --------
    >>> _out(base, {'x': pd.Series([1, 2])}).columns.tolist()
    ['entity_id', 'event_date', 'x']
    """
    return pd.concat(
        [df[KEY].reset_index(drop=True), pd.DataFrame(cols).reset_index(drop=True)],
        axis=1,
    )


def _monthly_average(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse a daily blue-sky feature frame to one monthly-mean row.

    Rows are grouped by ``entity_id`` and calendar month, and every column
    besides the key is replaced by its mean over that month. The grouped
    ``event_date`` is stamped as the last day of the month, rather than the
    first, for consistency with the monthly convention used elsewhere in
    this package (``feature_store.features``, ``base.py``).

    Parameters
    ----------
    daily : pd.DataFrame
        A contract-shaped blue-sky feature frame at daily grain, i.e. the
        output of ``apply_blue_sky_features(df, grain='daily')``.

    Returns
    -------
    pd.DataFrame
        One row per ``entity_id`` per calendar month, keyed on
        ``(entity_id, event_date)`` with ``event_date`` set to that month's
        last day, and every feature column replaced by its monthly mean.

    Examples
    --------
    >>> out = _monthly_average(daily)
    >>> out['event_date'].dt.is_month_end.all()
    True
    """
    month_end = daily['event_date'] + pd.offsets.MonthEnd(0)
    feature_cols = [c for c in daily.columns if c not in KEY]

    monthly = (
        daily.assign(event_date=month_end)
        .groupby(['entity_id', 'event_date'], sort=False, as_index=False)[feature_cols]
        .mean()
    )

    return monthly[KEY + feature_cols]


def apply_blue_sky_features(df: pd.DataFrame, grain: str = 'daily') -> pd.DataFrame:
    """
    Run every blue-sky feature over the base data and merge the results.

    Parameters
    ----------
    df : pd.DataFrame
        Base data with ``entity_id``, ``event_date``, ``Input`` and
        ``Replenishment``. One row per station per period.
    grain : str, optional
        ``'daily'`` returns one row per input row. ``'monthly'`` computes
        the same daily features first, then collapses each ``entity_id``
        and calendar month to a single row by taking the mean of every
        feature column; ``Input`` and ``Replenishment`` are dropped rather
        than averaged, since they are base measures and not blue-sky
        features. Default ``'daily'``.

    Returns
    -------
    pd.DataFrame
        At ``grain='daily'``, `df` plus every blue-sky feature column, one
        row per input row. At ``grain='monthly'``, one row per
        ``entity_id`` per calendar month, keyed on ``(entity_id,
        event_date)`` with ``event_date`` set to the month's last day, and
        only the feature columns (``Input``/``Replenishment`` dropped).

    Raises
    ------
    ValueError
        If `grain` is not ``'daily'`` or ``'monthly'``.

    Examples
    --------
    >>> apply_blue_sky_features(base).shape[0] == len(base)
    True
    """
    if grain not in ('daily', 'monthly'):
        raise ValueError(f"grain must be 'daily' or 'monthly', got {grain!r}")

    base = validate_base(df)

    parts = [
        add_supply_to_burn_ratio(base),
        add_net_coal_flow(base),
        add_rate_of_change(base, column='Input', periods=[1, 7, 14]),
        add_rate_of_change(base, column='Replenishment', periods=[1, 7, 14]),
        add_acceleration(base, column='Input'),
        add_acceleration(base, column='Replenishment'),
    ]

    daily = merge_features(base, parts)

    if grain == 'monthly':
        return _monthly_average(daily.drop(columns=['Input', 'Replenishment']))

    return daily
