import { useEffect, useState } from "react";

import Grid from "@mui/material/Grid";

import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import {
  useForecastContext,
} from "../../contexts/ForecastContext";

import forecastService from "../../features/forecast/service/forecast.service";

const ForecastMetrics = () => {
  const {
    horizon,
    entityId,
    scenario,
  } = useForecastContext();

  const [average, setAverage] =
    useState(0);

  const [peak, setPeak] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadMetrics = async () => {
      try {
        setLoading(true);

        const statistics =
          await forecastService.getStatistics({
            horizon,
            entityId,
            scenario,
            metric: "burn",
          });

        if (mounted) {
          setAverage(
            Number(statistics.average ?? 0)
          );

          setPeak(
            Number(statistics.peak ?? 0)
          );
        }
      } catch (error) {
        console.error(
          "[ForecastMetrics] Failed to load statistics:",
          error
        );

        if (mounted) {
          setAverage(0);
          setPeak(0);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadMetrics();

    return () => {
      mounted = false;
    };
  }, [horizon, entityId, scenario]);

  if (loading) {
    return (
      <Stack
        alignItems="center"
        py={3}
      >
        <CircularProgress size={24} />
      </Stack>
    );
  }

  return (
    <Grid
      container
      spacing={3}
      mb={3}
    >
      <Grid
        item
        xs={12}
        md={4}
      >
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Peak Forecast
        </Typography>

        <Typography
          variant="h5"
          fontWeight={700}
        >
          {peak.toLocaleString()}
        </Typography>
      </Grid>

      <Grid
        item
        xs={12}
        md={4}
      >
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Average Forecast
        </Typography>

        <Typography
          variant="h5"
          fontWeight={700}
        >
          {average.toLocaleString()}
        </Typography>
      </Grid>

      <Grid
        item
        xs={12}
        md={4}
      >
        <Typography
          variant="body2"
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
      </Grid>
    </Grid>
  );
};

export default ForecastMetrics;