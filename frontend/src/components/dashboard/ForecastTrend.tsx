import { useMemo, useState } from "react";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import { useTheme } from "@mui/material/styles";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

import {
  useForecastChart,
} from "../../features/forecast/hooks/useForecast";

import {
  ForecastFilters,
} from "../../features/forecast/types/forecast.types";

type TimeRange = "7" | "30" | "90";

const ForecastTrend = () => {
  const theme = useTheme();

  const [range, setRange] =
    useState<TimeRange>("7");

  /*
   * ---------------------------------------------------------
   * FORECAST FILTERS
   * ---------------------------------------------------------
   *
   * The chart uses the real backend forecast data instead
   * of the old mock forecastData array.
   *
   * "all" allows the backend service to aggregate all
   * stations.
   */
  const filters: ForecastFilters = {
    horizon: "daily",
    entityId: "all",
    scenario: "actual",
    metric: "burn",
  };

  /*
   * ---------------------------------------------------------
   * LOAD FORECAST DATA
   * ---------------------------------------------------------
   */

  const {
    data,
    isLoading,
    isError,
  } = useForecastChart(filters);

  /*
   * ---------------------------------------------------------
   * PREPARE CHART DATA
   * ---------------------------------------------------------
   */

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    const sorted = [...data].sort(
      (a, b) =>
        new Date(a.event_date).getTime() -
        new Date(b.event_date).getTime()
    );

    /*
     * Convert backend fields into the shape
     * expected by Recharts.
     *
     * Input = forecast burn.
     *
     * There is no "actual generation" field in
     * ForecastRecord, so we do not invent one.
     */
    const mapped = sorted.map((record) => ({
      date: record.event_date,

      forecast: Number(
        record.Input ?? 0
      ),
    }));

    switch (range) {
      case "7":
        return mapped.slice(-7);

      case "30":
        return mapped.slice(-30);

      case "90":
      default:
        return mapped.slice(-90);
    }
  }, [data, range]);

  /*
   * ---------------------------------------------------------
   * LOADING STATE
   * ---------------------------------------------------------
   */

  if (isLoading) {
    return (
      <AppCard sx={{ height: "100%" }}>
        <CardHeader
          title="Forecast Trend"
          subtitle="Loading forecast data..."
        />

        <Box
          sx={{
            height: {
              xs: 320,
              md: 420,
            },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            color:
              theme.palette.text.secondary,
          }}
        >
          Loading forecast data...
        </Box>
      </AppCard>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR STATE
   * ---------------------------------------------------------
   */

  if (isError) {
    return (
      <AppCard sx={{ height: "100%" }}>
        <CardHeader
          title="Forecast Trend"
          subtitle="Forecast versus actual generation"
        />

        <Box
          sx={{
            height: {
              xs: 320,
              md: 420,
            },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            color:
              theme.palette.error.main,
          }}
        >
          Unable to load forecast data.
        </Box>
      </AppCard>
    );
  }

  /*
   * ---------------------------------------------------------
   * EMPTY STATE
   * ---------------------------------------------------------
   */

  if (chartData.length === 0) {
    return (
      <AppCard sx={{ height: "100%" }}>
        <CardHeader
          title="Forecast Trend"
          subtitle="Forecast versus actual generation"
        />

        <Box
          sx={{
            height: {
              xs: 320,
              md: 420,
            },

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            color:
              theme.palette.text.secondary,
          }}
        >
          No forecast data available.
        </Box>
      </AppCard>
    );
  }

  /*
   * ---------------------------------------------------------
   * MAIN RENDER
   * ---------------------------------------------------------
   */

  return (
    <AppCard sx={{ height: "100%" }}>
      <CardHeader
        title="Forecast Trend"
        subtitle="Forecast burn over time"
        action={
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(_, value) => {
              if (value) {
                setRange(value);
              }
            }}
          >
            <ToggleButton value="7">
              7D
            </ToggleButton>

            <ToggleButton value="30">
              30D
            </ToggleButton>

            <ToggleButton value="90">
              90D
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />

      <Box
        sx={{
          height: {
            xs: 320,
            md: 420,
          },

          minWidth: 0,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 20,
              left: 10,
              bottom: 10,
            }}
          >
            <CartesianGrid
              strokeDasharray="4 4"
              stroke={
                theme.palette.divider
              }
              vertical={false}
            />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{
                fill:
                  theme.palette.text
                    .secondary,
                fontSize: 12,
              }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill:
                  theme.palette.text
                    .secondary,
                fontSize: 12,
              }}
              tickFormatter={(value) =>
                `${Math.round(
                  Number(value) / 1000
                )}k`
              }
            />

            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",

                boxShadow:
                  "0 10px 30px rgba(0,0,0,.12)",
              }}
            />

            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke={
                theme.palette.primary.main
              }
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 6,
              }}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </AppCard>
  );
};

export default ForecastTrend;