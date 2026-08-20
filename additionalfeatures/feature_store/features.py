"""
Ten feature families for the Eskom coal stockpile forecast.

Every function here obeys the contract in `contract.py`: base dataframe in,
``(entity_id, event_date)`` plus feature columns out, using only information
available at or before each row's own date.

On window convention
--------------------
A window **ends at and includes the current row's date**. At forecast origin
`t` we are predicting `t+1 .. t+90`, so the value at `t` is known and using it
is not leakage. This matches the existing base dataset, which already exposes
``Input`` and ``Replenishment`` at `t` as columns alongside the lagged ones.

``min_periods`` equals the window everywhere. A "90-day mean" computed from
three observations is not a 90-day mean, and silently emitting one produces a
feature whose meaning changes with position in the series. Early rows are NaN
instead, which the gradient-boosting models handle natively.

On what can and cannot be shown here
------------------------------------
The synthetic data these run against is, by construction, independent normal
draws around a fixed per-station mean (``sigma = 0.25 * mean``), with burn and
supply drawn from separate seeds. It therefore contains no trend, no
seasonality, no autocorrelation and no burn-supply relationship. **No feature
in this module can demonstrate predictive value on it**, and none is expected
to. What the tests here prove is correctness and the absence of leakage.
Predictive strength is measured separately, against real data.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .contract import KEY, MEASURES, feature, validate_base

# Trailing windows. Daily defaults span a week, fortnight, month and quarter,
# which is the range over which coal burn and delivery behaviour plausibly
# carries information. Monthly grain needs its own set, since a 90-period
# window on monthly data would be seven and a half years.
DAILY_WINDOWS = (7, 14, 28, 90)
MONTHLY_WINDOWS = (3, 6, 12)

# Below this fraction of a station's own trailing median, a period counts as
# disrupted. Relative rather than absolute so it means the same thing at
# Grootvlei and at Majuba, whose burn differs by an order of magnitude.
#
# Choosing the value. For a series with standard deviation s and mean m, a
# fraction f sits (1 - f) * m / s standard deviations below the mean, so the
# rate at which ordinary noise trips the flag is fixed by f and the series'
# own coefficient of variation. At the project's synthetic profile
# (s = 0.25 * m) that gives:
#
#     f = 0.50  ->  2.0 sigma  ->  ~2.3% of quiet days flagged
#     f = 0.35  ->  2.6 sigma  ->  ~0.5%
#     f = 0.25  ->  3.0 sigma  ->  ~0.1%
#
# 0.25 is the default because a genuine outage drops burn to near zero and
# trips it unambiguously, while ordinary variation almost never does. A
# looser threshold buys sensitivity to partial outages at the cost of a
# steady drizzle of false flags, which is the worse trade for a feature whose
# whole purpose is to mark an unusual regime.
DISRUPTION_FRACTION = 0.25

# Guards division where a denominator can legitimately be zero (a station on
# full outage burns nothing). Chosen well below any plausible real tonnage so
# it never perturbs a genuine value.
_EPS = 1e-9


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
    return pd.concat([df[KEY].reset_index(drop=True),
                      pd.DataFrame(cols).reset_index(drop=True)], axis=1)


def _roll(df: pd.DataFrame, measure: str, window: int, how: str) -> pd.Series:
    """
    Trailing rolling aggregate of one measure, computed within each station.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame, sorted by station then date.
    measure : str
        'Input' or 'Replenishment'.
    window : int
        Number of periods, inclusive of the current row.
    how : str
        Any reduction pandas' rolling supports: 'mean', 'std', 'min', 'max',
        'median', 'sum'.

    Returns
    -------
    pd.Series
        Index-aligned with ``df``. NaN until ``window`` observations exist.

    Examples
    --------
    >>> _roll(base, 'Input', 7, 'mean').isna().iloc[0]
    True
    """
    grouped = df.groupby('entity_id', sort=False)[measure]
    return grouped.transform(lambda s: getattr(s.rolling(window, min_periods=window), how)())


# --------------------------------------------------------------------------
# 1. Trailing means
# --------------------------------------------------------------------------

@feature(
    summary='Trailing mean of burn and supply over several window lengths.',
    rationale=(
        'The recent average level is the single strongest baseline for any demand series, '
        'and the existing base set does not contain one. What it has instead are calendar-'
        'period means built with resample().mean() and a forward fill, which is a different '
        'quantity: it is the mean of the calendar bin a date falls in, not the mean of the '
        'window preceding it. A trailing mean is what the model actually needs.'
    ),
    leakage_note=(
        'rolling() looks strictly backward from the current row. No row can see a later date, '
        'and the calculation runs inside a per-station groupby so no station can see another.'
    ),
    tags=('level', 'baseline'),
)
def rolling_mean(df: pd.DataFrame, windows: tuple[int, ...] = DAILY_WINDOWS) -> pd.DataFrame:
    """
    Trailing mean of each measure over each requested window.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    windows : tuple of int, optional
        Window lengths in periods. Default ``DAILY_WINDOWS``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_roll_mean_{w}`` per measure and window.

    Examples
    --------
    >>> rolling_mean(base, windows=(7,)).columns.tolist()
    ['entity_id', 'event_date', 'Input_roll_mean_7', 'Replenishment_roll_mean_7']
    """
    df = validate_base(df)
    cols = {
        f'{m}_roll_mean_{w}': _roll(df, m, w, 'mean')
        for m in MEASURES for w in windows
    }
    return _out(df, cols)


# --------------------------------------------------------------------------
# 2. Trailing volatility
# --------------------------------------------------------------------------

@feature(
    summary='Trailing standard deviation and coefficient of variation.',
    rationale=(
        'Volatility is absent from the base set entirely, and it is the natural companion to '
        'the level. Two stations burning the same average tonnage carry very different '
        'stockpile risk if one is steady and the other swings, because the buffer a planner '
        'needs is driven by variability rather than by the mean. The coefficient of variation '
        '(std divided by mean) makes that comparable across stations that differ in size by an '
        'order of magnitude.'
    ),
    leakage_note=(
        'Both terms come from the same strictly backward rolling window, so the statistic at '
        'date t is computed only from dates at or before t.'
    ),
    tags=('volatility', 'risk'),
)
def rolling_volatility(df: pd.DataFrame, windows: tuple[int, ...] = DAILY_WINDOWS) -> pd.DataFrame:
    """
    Trailing standard deviation and coefficient of variation per measure.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    windows : tuple of int, optional
        Window lengths in periods. Default ``DAILY_WINDOWS``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_roll_std_{w}`` and ``{measure}_roll_cv_{w}``.

    Examples
    --------
    >>> 'Input_roll_cv_7' in rolling_volatility(base, windows=(7,)).columns
    True
    """
    df = validate_base(df)
    cols: dict[str, pd.Series] = {}
    for m in MEASURES:
        for w in windows:
            std = _roll(df, m, w, 'std')
            mean = _roll(df, m, w, 'mean')
            cols[f'{m}_roll_std_{w}'] = std
            cols[f'{m}_roll_cv_{w}'] = std / (mean.abs() + _EPS)
    return _out(df, cols)


# --------------------------------------------------------------------------
# 3. Trailing extremes
# --------------------------------------------------------------------------

@feature(
    summary='Trailing min, max, range, and where the current value sits in that range.',
    rationale=(
        'The range describes the operating envelope a station has recently been working in, '
        'and the position within it says whether today is near the top or the bottom of that '
        'envelope. That is a different signal from the mean or the standard deviation: a '
        'station can sit at a stable average while pressed against the top of its range, which '
        'is exactly the state that precedes a supply problem. Position is scaled to 0-1 so it '
        'is comparable across stations.'
    ),
    leakage_note=(
        'Min and max are taken over the same backward window as every other rolling feature. '
        'The position term divides two quantities that are themselves backward-looking.'
    ),
    tags=('range', 'regime'),
)
def rolling_extremes(df: pd.DataFrame, windows: tuple[int, ...] = (28, 90)) -> pd.DataFrame:
    """
    Trailing minimum, maximum, range and normalised position within range.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    windows : tuple of int, optional
        Window lengths in periods. Default ``(28, 90)``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_roll_range_{w}`` and
        ``{measure}_roll_pos_{w}`` per measure and window.

    Examples
    --------
    >>> out = rolling_extremes(base, windows=(28,))
    >>> out['Input_roll_pos_28'].dropna().between(0, 1).all()
    True
    """
    df = validate_base(df)
    cols: dict[str, pd.Series] = {}
    for m in MEASURES:
        for w in windows:
            lo = _roll(df, m, w, 'min')
            hi = _roll(df, m, w, 'max')
            rng = hi - lo
            cols[f'{m}_roll_range_{w}'] = rng
            cols[f'{m}_roll_pos_{w}'] = (df[m].to_numpy() - lo) / (rng + _EPS)
    return _out(df, cols)


# --------------------------------------------------------------------------
# 4. Exponentially weighted level
# --------------------------------------------------------------------------

@feature(
    summary='Exponentially weighted mean of each measure at two half-lives.',
    rationale=(
        'A flat trailing mean treats a value from 90 days ago as being worth exactly as much '
        'as yesterday. An exponentially weighted mean does not, which suits a fleet whose '
        'composition and coal sourcing have changed structurally over the available history. '
        'It also mirrors the recency weighting the training design already applies to samples, '
        'so the feature and the loss agree about what "recent" means.'
    ),
    leakage_note=(
        'ewm() with adjust=False is a recursive backward filter: the value at t depends only on '
        't and the state accumulated from earlier rows.'
    ),
    tags=('level', 'recency'),
)
def ewm_mean(df: pd.DataFrame, halflives: tuple[int, ...] = (7, 30)) -> pd.DataFrame:
    """
    Exponentially weighted trailing mean at each requested half-life.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    halflives : tuple of int, optional
        Half-lives in periods. Default ``(7, 30)``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_ewm_{h}`` per measure and half-life.

    Examples
    --------
    >>> ewm_mean(base, halflives=(7,)).shape[0] == len(base)
    True
    """
    df = validate_base(df)
    cols = {
        f'{m}_ewm_{h}': df.groupby('entity_id', sort=False)[m].transform(
            lambda s, h=h: s.ewm(halflife=h, adjust=False).mean()
        )
        for m in MEASURES for h in halflives
    }
    return _out(df, cols)


# --------------------------------------------------------------------------
# 5. Net flow
# --------------------------------------------------------------------------

@feature(
    summary='Trailing sum of supply minus burn, and the single-period net flow.',
    rationale=(
        'Supply minus burn is the quantity that actually moves the stockpile, and it is the '
        'arithmetic the whole product is built on. The base set carries burn and supply as '
        'separate series and never combines them, so the model has to rediscover the '
        'relationship from two columns. Handing it the difference directly is cheap and it is '
        'the term a coal planner reasons in.'
    ),
    leakage_note=(
        'Computed from measures at or before t only. The rolling sum uses the same backward '
        'window as every other feature here.'
    ),
    tags=('flow', 'stock'),
)
def net_flow(df: pd.DataFrame, windows: tuple[int, ...] = (7, 30, 90)) -> pd.DataFrame:
    """
    Period net flow and its trailing sum over each window.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    windows : tuple of int, optional
        Window lengths in periods. Default ``(7, 30, 90)``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``net_flow`` and ``net_flow_sum_{w}`` per window.

    Examples
    --------
    >>> 'net_flow' in net_flow(base, windows=(7,)).columns
    True
    """
    df = validate_base(df)
    flow = df['Replenishment'] - df['Input']
    work = df.assign(_flow=flow)

    cols: dict[str, pd.Series] = {'net_flow': flow}
    for w in windows:
        cols[f'net_flow_sum_{w}'] = work.groupby('entity_id', sort=False)['_flow'].transform(
            lambda s, w=w: s.rolling(w, min_periods=w).sum()
        )
    return _out(df, cols)


# --------------------------------------------------------------------------
# 6. Stock proxy and cover
# --------------------------------------------------------------------------

@feature(
    summary='Cumulative net flow as a stock proxy, and periods of cover it implies.',
    rationale=(
        'Days of cover -- stock divided by recent daily burn -- is the number a procurement '
        'planner actually decides on, and the business ask is framed in exactly those terms: '
        'optimal stock levels and early warning. Neither the stock position nor the cover '
        'appears anywhere in the base set. Giving the model the operational decision variable '
        'rather than making it infer one is the single most business-aligned feature here.'
    ),
    leakage_note=(
        'The cumulative sum runs forward through time within a station, so the value at t '
        'includes t and every earlier row and nothing later. The cover term divides it by a '
        'backward rolling mean.'
    ),
    tags=('stock', 'business-critical'),
)
def stock_proxy(df: pd.DataFrame, cover_window: int = 7) -> pd.DataFrame:
    """
    Cumulative net flow and the periods of cover it implies.

    The absolute level is **a proxy, not a measured stockpile**. The base
    dataset carries no opening balance, so the cumulative sum starts from
    zero at each station's first observation and the series is therefore
    offset by an unknown constant. The *shape* -- whether the position is
    building or drawing down, and how fast -- is correct and is what carries
    the signal. Where a true opening balance becomes available the offset
    should be added and this docstring updated.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    cover_window : int, optional
        Window for the trailing mean burn used as the denominator. Default 7.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``stock_proxy``, ``stock_cover_periods`` and
        ``stock_proxy_chg_{cover_window}``.

    Examples
    --------
    >>> 'stock_cover_periods' in stock_proxy(base).columns
    True
    """
    df = validate_base(df)
    work = df.assign(_flow=df['Replenishment'] - df['Input'])

    cum = work.groupby('entity_id', sort=False)['_flow'].cumsum()
    burn_rate = _roll(df, 'Input', cover_window, 'mean')

    work = work.assign(_cum=cum)
    change = work.groupby('entity_id', sort=False)['_cum'].transform(
        lambda s: s.diff(cover_window)
    )

    return _out(df, {
        'stock_proxy': cum,
        'stock_cover_periods': cum / (burn_rate.abs() + _EPS),
        f'stock_proxy_chg_{cover_window}': change,
    })


# --------------------------------------------------------------------------
# 7. Supply to burn ratio
# --------------------------------------------------------------------------

@feature(
    summary='Trailing ratio of supply to burn.',
    rationale=(
        'The ratio says whether a station is being replenished faster than it consumes, on a '
        'scale-free basis. Above one the pile grows, below one it shrinks, and the distance '
        'from one is the rate. Unlike the net flow in tonnes, this is directly comparable '
        'across stations of very different size, which matters because the model is pooled '
        'across the whole fleet and has to learn one mapping for all of them.'
    ),
    leakage_note=(
        'Numerator and denominator are both trailing sums over the same backward window.'
    ),
    tags=('flow', 'scale-free'),
)
def supply_burn_ratio(df: pd.DataFrame, windows: tuple[int, ...] = (7, 30, 90)) -> pd.DataFrame:
    """
    Trailing supply-to-burn ratio over each window.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    windows : tuple of int, optional
        Window lengths in periods. Default ``(7, 30, 90)``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``supply_burn_ratio_{w}`` per window.

    Examples
    --------
    >>> (supply_burn_ratio(base, windows=(7,))['supply_burn_ratio_7'].dropna() >= 0).all()
    True
    """
    df = validate_base(df)
    cols = {
        f'supply_burn_ratio_{w}':
            _roll(df, 'Replenishment', w, 'sum') / (_roll(df, 'Input', w, 'sum').abs() + _EPS)
        for w in windows
    }
    return _out(df, cols)


# --------------------------------------------------------------------------
# 8. Momentum
# --------------------------------------------------------------------------

def _rolling_slope(series: pd.Series, window: int) -> pd.Series:
    """
    Ordinary least squares slope of a series against time, over a window.

    Uses the closed form for evenly spaced x, so the only per-window work is
    one dot product.

    Parameters
    ----------
    series : pd.Series
        Values for a single station, in date order.
    window : int
        Number of periods, inclusive of the current row.

    Returns
    -------
    pd.Series
        Slope in units of measure per period. NaN until the window fills.

    Examples
    --------
    >>> _rolling_slope(pd.Series([1., 2., 3., 4.]), 4).iloc[-1].round(6)
    np.float64(1.0)
    """
    x = np.arange(window, dtype=float)
    x_centred = x - x.mean()
    denom = float((x_centred ** 2).sum())

    def slope(y: np.ndarray) -> float:
        return float(np.dot(x_centred, y - y.mean()) / denom)

    return series.rolling(window, min_periods=window).apply(slope, raw=True)


@feature(
    summary='Short-to-long mean ratio, and the normalised trend slope.',
    rationale=(
        'Level and volatility both describe where a station is; neither says which way it is '
        'moving. The ratio of a short trailing mean to a long one is a standard, cheap '
        'acceleration signal -- above one means recent burn is running hot against its own '
        'baseline. The slope adds the direction and steepness of the trend explicitly, '
        'normalised by the window mean so it is scale-free and comparable across the fleet.'
    ),
    leakage_note=(
        'Both terms are computed from backward windows ending at t. The slope is fitted only '
        'to observations inside its own window.'
    ),
    tags=('trend', 'momentum'),
)
def momentum(
    df: pd.DataFrame,
    short: int = 7,
    long: int = 90,
    slope_window: int = 28,
) -> pd.DataFrame:
    """
    Short-to-long trailing mean ratio and normalised OLS trend slope.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    short : int, optional
        Short window. Default 7.
    long : int, optional
        Long window. Default 90.
    slope_window : int, optional
        Window the slope is fitted over. Default 28.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_mom_ratio_{short}_{long}`` and
        ``{measure}_slope_{slope_window}`` per measure.

    Examples
    --------
    >>> 'Input_slope_28' in momentum(base).columns
    True
    """
    df = validate_base(df)
    cols: dict[str, pd.Series] = {}
    for m in MEASURES:
        short_mean = _roll(df, m, short, 'mean')
        long_mean = _roll(df, m, long, 'mean')
        cols[f'{m}_mom_ratio_{short}_{long}'] = short_mean / (long_mean.abs() + _EPS)

        raw_slope = df.groupby('entity_id', sort=False)[m].transform(
            lambda s: _rolling_slope(s, slope_window)
        )
        window_mean = _roll(df, m, slope_window, 'mean')
        cols[f'{m}_slope_{slope_window}'] = raw_slope / (window_mean.abs() + _EPS)
    return _out(df, cols)


# --------------------------------------------------------------------------
# 9. Disruption regime
# --------------------------------------------------------------------------

@feature(
    summary='How long since, and how often, a measure fell well below its own norm.',
    rationale=(
        'Outages drive burn and delivery interruptions drive supply, and both are first-order. '
        'The GPSS plant-performance feed that would report them directly is deliberately '
        'excluded from the model because several of its metrics are forward-looking and were '
        'the source of leakage in an earlier iteration. This derives an equivalent signal from '
        'the series own past instead, which is leakage-free by construction and needs no new '
        'feed. The threshold is a fraction of the station trailing median rather than an '
        'absolute tonnage, so it means the same thing at every station.'
    ),
    leakage_note=(
        'The threshold is a backward rolling median. Both the recency counter and the count '
        'are computed by scanning already-observed rows only, never forward.'
    ),
    tags=('regime', 'outage-proxy'),
)
def disruption_regime(
    df: pd.DataFrame,
    window: int = 90,
    fraction: float = DISRUPTION_FRACTION,
) -> pd.DataFrame:
    """
    Recency and frequency of periods well below a station's own recent norm.

    On the project's synthetic dataset this fires on roughly one day in a
    thousand at the default threshold, and every one of those is noise rather
    than a real disruption -- that data has no outages in it to find. The
    feature is designed for real data, where burn collapses during an outage
    and deliveries arrive in lumps. See ``DISRUPTION_FRACTION`` for how the
    threshold maps onto a false-flag rate.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    window : int, optional
        Window for the reference median and the disruption count. Default 90.
    fraction : float, optional
        Fraction of the trailing median below which a period counts as
        disrupted. Default ``DISRUPTION_FRACTION``.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``{measure}_disrupted``,
        ``{measure}_periods_since_disruption`` and
        ``{measure}_disruption_count_{window}`` per measure.

    Examples
    --------
    >>> 'Input_disrupted' in disruption_regime(base).columns
    True
    """
    df = validate_base(df)
    cols: dict[str, pd.Series] = {}

    for m in MEASURES:
        threshold = _roll(df, m, window, 'median') * fraction
        disrupted = (df[m] < threshold).where(threshold.notna())

        work = df.assign(_d=disrupted.fillna(False).astype(int))

        # Periods since the last disrupted row, counted within each station.
        # cumsum of the flag gives a group id per run; ranking within it gives
        # the distance. Rows before any disruption stay NaN rather than being
        # given a misleading zero.
        def _since(s: pd.Series) -> pd.Series:
            marker = s.cumsum()
            counter = s.groupby(marker).cumcount()
            return counter.where(marker > 0)

        cols[f'{m}_disrupted'] = work['_d']
        cols[f'{m}_periods_since_disruption'] = (
            work.groupby('entity_id', sort=False)['_d'].transform(_since)
        )
        cols[f'{m}_disruption_count_{window}'] = (
            work.groupby('entity_id', sort=False)['_d'].transform(
                lambda s: s.rolling(window, min_periods=window).sum()
            )
        )

    return _out(df, cols)


# --------------------------------------------------------------------------
# 10. Calendar context
# --------------------------------------------------------------------------

@feature(
    summary='Position within the month, and South African public holiday proximity.',
    rationale=(
        'Two distinct effects. First, month boundaries are structural on this project rather '
        'than merely seasonal: the source system locks a month after the fifth day of the '
        'following month, so behaviour and data quality genuinely differ across that boundary. '
        'Second, public holidays move electricity demand and halt coal transport, and South '
        'Africa has twelve of them plus a Sunday-to-Monday observance rule that shifts dates '
        'year to year. The base set has neither: it carries day of week, month of year and a '
        'week index, and its weekend flag is the only calendar signal beyond those.'
    ),
    leakage_note=(
        'Every column is a deterministic function of the row own date. A calendar is knowable '
        'arbitrarily far ahead, which is what makes these among the few features that are '
        'legitimately available for the forecast window itself and not only at the origin.'
    ),
    grain='daily',
    tags=('calendar', 'known-forward'),
)
def calendar_context(df: pd.DataFrame, country: str = 'ZA') -> pd.DataFrame:
    """
    Month-position and public-holiday features derived from the date alone.

    Parameters
    ----------
    df : pd.DataFrame
        Validated base frame.
    country : str, optional
        ISO country code passed to the ``holidays`` package. Default 'ZA'.

    Returns
    -------
    pd.DataFrame
        Key columns plus ``day_of_month``, ``days_into_month``,
        ``days_to_month_end``, ``month_progress``, ``is_month_start``,
        ``is_month_end``, ``is_public_holiday``, ``days_to_next_holiday``,
        ``days_since_last_holiday`` and ``is_weekend_correct``.

    Notes
    -----
    ``is_weekend_correct`` is included deliberately. The base set already has
    an ``is_weekend``, but it tests ``day_of_week in (5, 0)``; pandas numbers
    Monday as 0, so it flags Saturday and Monday and misses Sunday. This
    column is the corrected version, named distinctly so both can coexist
    until the original is fixed.

    Examples
    --------
    >>> out = calendar_context(base)
    >>> out['is_public_holiday'].dtype == bool
    True
    """
    import holidays as holidays_pkg

    df = validate_base(df)
    dates = df['event_date']

    years = sorted({int(y) for y in dates.dt.year.unique()})
    calendar = holidays_pkg.country_holidays(country, years=years)
    holiday_dates = pd.DatetimeIndex(sorted(calendar.keys()))

    is_holiday = dates.isin(holiday_dates)

    # searchsorted on a sorted index gives the neighbouring holidays in one
    # pass rather than a per-row scan.
    values = dates.to_numpy(dtype='datetime64[ns]')
    marks = holiday_dates.to_numpy(dtype='datetime64[ns]')
    right = np.searchsorted(marks, values, side='left')
    left = right - 1

    day = np.timedelta64(1, 'D')
    to_next = np.where(
        right < len(marks),
        (marks[np.clip(right, 0, len(marks) - 1)] - values) / day,
        np.nan,
    )
    since_last = np.where(
        left >= 0,
        (values - marks[np.clip(left, 0, len(marks) - 1)]) / day,
        np.nan,
    )

    # Truncating to 'datetime64[M]' floors each date to the first of its month.
    month_start = pd.to_datetime(dates.to_numpy().astype('datetime64[M]'))
    month_end = dates + pd.offsets.MonthEnd(0)
    days_into = (dates - month_start).dt.days
    days_left = (month_end - dates).dt.days

    return _out(df, {
        'day_of_month': dates.dt.day,
        'days_into_month': days_into,
        'days_to_month_end': days_left,
        'month_progress': days_into / (days_into + days_left + 1),
        'is_month_start': dates.dt.is_month_start,
        'is_month_end': dates.dt.is_month_end,
        'is_public_holiday': is_holiday,
        'days_to_next_holiday': pd.Series(to_next, index=df.index),
        'days_since_last_holiday': pd.Series(since_last, index=df.index),
        'is_weekend_correct': dates.dt.day_of_week.isin((5, 6)),
    })
