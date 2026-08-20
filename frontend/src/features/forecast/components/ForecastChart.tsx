import { useEffect, useState } from "react";

import { Box, CircularProgress, Typography } from "@mui/material";
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

import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";

import { useForecastContext } from "../../../contexts/ForecastContext";
import forecastService from "../service/forecast.service";
import { ForecastRecord } from "../types/forecast.types";

interface ChartPoint {
  date: string;
  forecast: number;
  actual: number;
}

const ForecastChart = () => {
  const theme = useTheme();

  const {
    horizon,
    entityId,
  } = useForecastContext();

  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const records: ForecastRecord[] =
          await forecastService.getForecastChart({
            horizon,
            entityId,
            scenario: "actual",
            metric: "burn",
          });

        if (!mounted) {
          return;
        }

        const chartData = records
          .map((record) => ({
            date: record.event_date,
            forecast: Number(record.Input ?? 0),
            actual: Number(record.Input ?? 0),
          }))
          .sort(
            (a, b) =>
              new Date(a.date).getTime() -
              new Date(b.date).getTime()
          );

        setData(chartData);
      } catch (err) {
        console.error(
          "[ForecastChart] Failed to load forecast data:",
          err
        );

        if (mounted) {
          setError("Unable to load forecast data.");
          setData([]);
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

  return (
    <AppCard>
      <CardHeader
        title="Forecast Trend"
        subtitle="Forecast data from the selected forecast context"
      />

      <Box
        height={500}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">
            {error}
          </Typography>
        ) : data.length === 0 ? (
          <Typography color="text.secondary">
            No forecast data available.
          </Typography>
        ) : (
          <ResponsiveContainer>
            <LineChart data={data}>
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
              />

              <YAxis />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke={theme.palette.primary.main}
                strokeWidth={3}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={theme.palette.success.main}
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    </AppCard>
  );
};

export default ForecastChart;