import { useEffect, useMemo, useState } from "react";

import {
  Box,
  CardHeader,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  CalendarMonthRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppCard from "../../../components/common/AppCard";
import { useForecastContext } from "../../../contexts/ForecastContext";
import forecastService from "../service/forecast.service";
import { ForecastRecord } from "../types/forecast.types";



const ForecastTrend = () => {
  const {
    horizon,
    entityId,
  } = useForecastContext();

  const [records, setRecords] =
    useState<ForecastRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);

        const data =
          await forecastService.getForecastChart({
            horizon,
            entityId,
            scenario: "actual",
            metric: "burn",
          });

        if (mounted) {
          setRecords(data);
        }
      } catch (error) {
        console.error(
          "[ForecastTrend] Failed to load forecast data:",
          error
        );

        if (mounted) {
          setRecords([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [horizon, entityId]);

  const chartData = useMemo(() => {
    return records
      .map((record) => ({
        date: record.event_date,

        value: Number(
          record.Input ?? 0
        ),
      }))
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );
  }, [records]);

  const averageForecast = useMemo(() => {
    if (chartData.length === 0) {
      return 0;
    }

    const total = chartData.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

    return total / chartData.length;
  }, [chartData]);

  const peakForecast = useMemo(() => {
    if (chartData.length === 0) {
      return 0;
    }

    return Math.max(
      ...chartData.map(
        (item) => item.value
      )
    );
  }, [chartData]);

  const formatDate = (
    value: string
  ) => {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
      }
    );
  };

  const formatNumber = (
    value: number
  ) => {
    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 1,
      }
    )
      .format(value)
      .replace(/,/g, " ");
  };

  return (
    <AppCard
      sx={{
        p: 4,
      }}
    >
      <CardHeader
        title="Tactical Daily Burn Forecast"
        subtitle="Displaying predictions for selected power station and scenario"
      />

      <Stack
        direction="row"
        spacing={2}
        sx={{
          mt: 2,
          mb: 3,
        }}
      >
        <Chip
          icon={
            <CalendarMonthRounded />
          }
          label={
            horizon === "monthly"
              ? "Monthly"
              : "Daily"
          }
          variant="outlined"
        />

        <Chip
          icon={
            <TrendingUpRounded />
          }
          label={
            loading
              ? "Loading..."
              : "Forecast Generated"
          }
          color="success"
        />
      </Stack>

      <Box
        sx={{
          height: {
            xs: 320,
            md: 420,
          },
        }}
      >
        {loading ? (
          <Stack
            height="100%"
            alignItems="center"
            justifyContent="center"
          >
            <Typography
              color="text.secondary"
            >
              Loading forecast data...
            </Typography>
          </Stack>
        ) : chartData.length === 0 ? (
          <Stack
            height="100%"
            alignItems="center"
            justifyContent="center"
          >
            <Typography
              color="text.secondary"
            >
              No forecast data available.
            </Typography>
          </Stack>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={chartData}
              margin={{
                top: 20,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid
                strokeDasharray="5 5"
                opacity={0.2}
              />

              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 12,
                }}
                tickFormatter={formatDate}
              />

              <YAxis
                tick={{
                  fontSize: 12,
                }}
              />

              <Tooltip
                content={({
                  active,
                  payload,
                }) => {
                  if (
                    active &&
                    payload &&
                    payload.length
                  ) {
                    const point =
                      payload[0]
                        .payload;

                    return (
                      <Box
                        sx={{
                          bgcolor:
                            "background.paper",
                          p: 2,
                          borderRadius: 2,
                          boxShadow: 4,
                        }}
                      >
                        <Typography
                          fontWeight={700}
                        >
                          Forecast
                        </Typography>

                        <Typography>
                          {formatDate(
                            point.date
                          )}
                        </Typography>

                        <Typography
                          color="primary"
                          fontWeight={700}
                        >
                          {formatNumber(
                            point.value
                          )}{" "}
                          t/day
                        </Typography>
                      </Box>
                    );
                  }

                  return null;
                }}
              />

              <Line
                type="monotone"
                dataKey="value"
                name="Burn Forecast"
                stroke="#0057B8"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        spacing={8}
        mt={4}
      >
        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
          >
            Average Forecast
          </Typography>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            {formatNumber(
              averageForecast
            )}{" "}
            t/day
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
          >
            Peak Forecast
          </Typography>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            {formatNumber(
              peakForecast
            )}{" "}
            t/day
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
          >
            Forecast Horizon
          </Typography>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            {horizon === "monthly"
              ? "Monthly"
              : "Daily"}
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
          >
            Records
          </Typography>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            {chartData.length}
          </Typography>
        </Box>
      </Stack>
    </AppCard>
  );
};

export default ForecastTrend;