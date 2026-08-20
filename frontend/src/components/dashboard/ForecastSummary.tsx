import { useEffect, useMemo, useState } from "react";

import {
  Box,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { useTheme } from "@mui/material/styles";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";
import ForecastMetrics from "./ForecastMetrics";

import { useForecastContext } from "../../contexts/ForecastContext";

import forecastService from "../../features/forecast/service/forecast.service";
import { ForecastRecord } from "../../features/forecast/types/forecast.types";

type TimeRange = "7" | "30" | "90";

const ForecastSummary = () => {
  const theme = useTheme();

  const {
    entityId,
    scenario,
  } = useForecastContext();

  const [range, setRange] =
    useState<TimeRange>("7");

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
            horizon: "daily",
            entityId,
            scenario,
            metric: "burn",
          });

        if (mounted) {
          setRecords(data);
        }
      } catch (error) {
        console.error(
          "[ForecastSummary] Failed to load data:",
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
  }, [entityId, scenario]);

  const chartData = useMemo(() => {
    const limit = Number(range);

    return records
      .slice(0, limit)
      .map((record) => ({
        date: record.event_date,
        forecast: Number(record.Input ?? 0),
      }))
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );
  }, [records, range]);

  const handleRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    value: TimeRange | null
  ) => {
    if (value !== null) {
      setRange(value);
    }
  };

  return (
    <AppCard>
      <CardHeader
        title="Forecast Summary"
        subtitle="Forecast data from the selected context"
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            onChange={handleRangeChange}
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

      <ForecastMetrics />

      <Box
        sx={{
          width: "100%",
          height: 380,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <CircularProgress />
        ) : chartData.length === 0 ? (
          <Typography color="text.secondary">
            No forecast data available.
          </Typography>
        ) : (
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
                stroke={theme.palette.divider}
              />

              <XAxis
                dataKey="date"
                tick={{
                  fill: theme.palette.text.secondary,
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fill: theme.palette.text.secondary,
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke={
                  theme.palette.primary.main
                }
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </AppCard>
  );
};

export default ForecastSummary;