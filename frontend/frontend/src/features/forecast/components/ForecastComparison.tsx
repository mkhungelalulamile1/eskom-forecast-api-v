import { useEffect, useState } from "react";

import {
  Box,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";

import {
  useForecastContext,
} from "../../../contexts/ForecastContext";

import forecastService from "../service/forecast.service";

interface ComparisonPoint {
  date: string;
  forecast: number;
}

const ForecastComparison = () => {
  const {
    horizon,
    entityId,
    scenario,
  } = useForecastContext();

  const [data, setData] =
    useState<ComparisonPoint[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);

        const records =
          await forecastService.getForecastChart({
            horizon,
            entityId,
            scenario,
            metric: "burn",
          });

        if (mounted) {
          setData(
            records
              .map((record) => ({
                date: record.event_date,
                forecast: Number(
                  record.Input ?? 0
                ),
              }))
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() -
                  new Date(b.date).getTime()
              )
          );
        }
      } catch (error) {
        console.error(
          "[ForecastComparison] Failed to load data:",
          error
        );

        if (mounted) {
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
  }, [horizon, entityId, scenario]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="h5"
        fontWeight={700}
      >
        Forecast Comparison
      </Typography>

      <Typography
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        Forecast values returned by the backend.
      </Typography>

      <Box
        sx={{
          height: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <CircularProgress />
        ) : data.length === 0 ? (
          <Typography color="text.secondary">
            No forecast data available.
          </Typography>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis dataKey="date" />

              <YAxis />

              <Tooltip />

              <Legend />

              <Bar
                dataKey="forecast"
                name="Forecast"
                fill="#1976d2"
                radius={[
                  4,
                  4,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Paper>
  );
};

export default ForecastComparison;