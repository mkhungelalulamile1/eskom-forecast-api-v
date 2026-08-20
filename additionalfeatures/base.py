import pandas as pd

######################################FEATURE ENGINEERING####################################

######DAILY######


def create_temporal_features(df):
    """
    Add day-of-week, month-of-year, week-of-year and weekend flag columns.

    Parameters
    ----------
    df : pandas.DataFrame
        Must contain an ``event_date`` column of datetime dtype.

    Returns
    -------
    pandas.DataFrame
        `df` with ``DOW``, ``MOY``, ``WOY`` and ``is_weekend`` columns added.
    """
    df['DOW'] = df.event_date.dt.day_of_week
    df['MOY'] = df.event_date.dt.month
    df['WOY'] = df.event_date.dt.day_of_year // 7
    # day_of_week is Monday=0 .. Sunday=6, so the weekend is (5, 6).
    df['is_weekend'] = df.event_date.dt.day_of_week.isin((5, 6))

    return df


def add_lag_features(data, measures, lags):
    """
    Add per-station lagged columns for each measure.

    Parameters
    ----------
    data : pandas.DataFrame
        Must contain ``entity_id``, ``event_date`` and every column in
        `measures`.
    measures : list of str
        Column names to generate lags for.
    lags : list of int
        Lag periods (in rows) to shift each measure by.

    Returns
    -------
    pandas.DataFrame
        One row per (station, event_date), with a ``station`` column and one
        ``{measure}_{lag}`` column per measure/lag combination.
    """
    all_data = []
    for station in data.entity_id.unique():
        temp_data = data[data.entity_id == station].copy()
        temp_data = temp_data.set_index('event_date')
        for measure in measures:
            for lag in lags:
                temp_data[f'{measure}_{lag}'] = temp_data[measure].shift(lag)
        temp_data['station'] = station
        all_data.append(temp_data.reset_index())
    return pd.concat(all_data)


def add_resampled_mean_features(data, measures, periods):
    """
    Add per-station trailing resampled-mean columns for each measure.

    Each period is forward-filled back onto the original daily/monthly index
    so every row carries the mean of the most recently completed bin.

    Parameters
    ----------
    data : pandas.DataFrame
        Must contain ``entity_id``, ``event_date`` and every column in
        `measures`.
    measures : list of str
        Column names to generate resampled means for.
    periods : list of str
        Pandas resample offset aliases (e.g. ``'W'``, ``'QE'``, ``'YE'``).
        ``'MS'`` is deliberately excluded: resample('MS') labels each bin at
        the START of the month and the bin spans the whole month, so the
        forward fill assigns the full-month mean to every day inside it --
        including days after the forecast origin. ``'W'``, ``'QE'`` and
        ``'YE'`` are right-labelled and therefore look strictly backward.

    Returns
    -------
    pandas.DataFrame
        One row per (station, event_date), with a ``station`` column and one
        ``{measure}_{period}`` column per measure/period combination.
    """
    all_data = []
    for station in data.entity_id.unique():
        temp_data = data[data.entity_id == station].copy()
        temp_data = temp_data.set_index('event_date')
        for measure in measures:
            for period in periods:
                resampled = temp_data[measure].resample(period).mean()
                temp_data[f'{measure}_{period}'] = resampled.reindex(
                    temp_data.index, method='ffill'
                )
        temp_data['station'] = station
        all_data.append(temp_data.reset_index())
    return pd.concat(all_data)


def add_future_target_features(data, measures, horizon):
    """
    Add per-station forward-shifted (future) target columns for each measure.

    Parameters
    ----------
    data : pandas.DataFrame
        Must contain ``entity_id``, ``event_date`` and every column in
        `measures`.
    measures : list of str
        Column names to generate future targets for.
    horizon : int
        Number of future periods to generate targets for, inclusive
        (targets are generated for offsets ``1..horizon``).

    Returns
    -------
    pandas.DataFrame
        One row per (station, event_date), with a ``station`` column and one
        ``{measure}_f{future}`` column per measure/offset combination.
    """
    all_data = []
    for station in data.entity_id.unique():
        temp_data = data[data.entity_id == station].copy()
        temp_data = temp_data.set_index('event_date')
        for measure in measures:
            for future in range(1, horizon + 1):
                temp_data[f'{measure}_f{future}'] = (
                    temp_data[measure].shift(-future)
                )
        temp_data['station'] = station
        all_data.append(temp_data.reset_index())
    return pd.concat(all_data)


def _drop_duplicate_merge_columns(df):
    """
    Drop columns produced by a suffixed merge collision.

    Parameters
    ----------
    df : pandas.DataFrame
        A dataframe merged with ``suffixes=("", "_drop")``.

    Returns
    -------
    pandas.DataFrame
        `df` with every ``*_drop`` column removed, in place.
    """
    df.drop(
        columns=[col for col in df.columns if "_drop" in col],
        inplace=True,
    )
    return df


def build_feature_and_target_data(
    data, measures, lags, resample_periods, horizon
):
    """
    Assemble lag, resampled-mean and future-target features for one grain.

    Parameters
    ----------
    data : pandas.DataFrame
        Base dataframe with ``entity_id``, ``event_date`` and every column
        in `measures`.
    measures : list of str
        Column names to generate features for.
    lags : list of int
        Lag periods (in rows) passed to `add_lag_features`.
    resample_periods : list of str
        Resample offset aliases passed to `add_resampled_mean_features`.
    horizon : int
        Future horizon passed to `add_future_target_features`.

    Returns
    -------
    pandas.DataFrame
        `data` merged with lag, resampled-mean, future-target and temporal
        features, one row per (station, event_date).
    """
    lagged = add_lag_features(data, measures, lags)
    resampled = add_resampled_mean_features(data, measures, resample_periods)
    future = add_future_target_features(data, measures, horizon)

    merge_keys = ['entity_id', 'event_date']
    drop_cols = measures + ['station']

    result = pd.merge(
        lagged.drop(drop_cols, axis=1),
        resampled,
        how='left',
        on=merge_keys,
        suffixes=("", "_drop"),
    )
    _drop_duplicate_merge_columns(result)

    result = pd.merge(
        result.drop(drop_cols, axis=1),
        future,
        how='left',
        on=merge_keys,
        suffixes=("", "_drop"),
    )
    _drop_duplicate_merge_columns(result)

    result = create_temporal_features(result)

    return result


def build_daily_features(daily_data):
    """
    Build the daily feature and target dataset and write it to CSV.

    Parameters
    ----------
    daily_data : pandas.DataFrame
        Daily base dataframe with ``entity_id``, ``event_date``, ``Input``
        and ``Replenishment`` columns.

    Returns
    -------
    pandas.DataFrame
        The assembled daily feature and target dataset, as written to
        ``data/daily/features-and-target.csv``.
    """
    daily_data = build_feature_and_target_data(
        daily_data,
        measures=['Input', 'Replenishment'],
        lags=[1, 7, 14, 30, 90, 180, 365],
        resample_periods=['W', 'QE', 'YE'],
        horizon=90,
    )

    daily_data.to_csv('data/daily/features-and-target.csv', index=False)

    return daily_data


def build_monthly_features(monthly_data):
    """
    Build the monthly feature and target dataset and write it to CSV.

    Parameters
    ----------
    monthly_data : pandas.DataFrame
        Monthly base dataframe with ``entity_id``, ``event_date``, ``Input``
        and ``Replenishment`` columns.

    Returns
    -------
    pandas.DataFrame
        The assembled monthly feature and target dataset, as written to
        ``data/monthly/features-and-target.csv``.
    """
    monthly_data = build_feature_and_target_data(
        monthly_data,
        measures=['Input', 'Replenishment'],
        lags=[1, 3, 6, 12, 18, 24, 36],
        resample_periods=['QE', 'YE'],
        horizon=36,
    )

    monthly_data.to_csv('data/monthly/features-and-target.csv', index=False)

    return monthly_data


if __name__ == "__main__":
    daily_data = build_daily_features(daily_data)
    monthly_data = build_monthly_features(monthly_data)
