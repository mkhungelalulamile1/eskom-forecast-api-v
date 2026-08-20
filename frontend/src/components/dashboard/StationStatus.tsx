import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import AppCard from "../common/AppCard";
import StatusChip from "../common/StatusChip";

import { useEffect, useState } from "react";

import forecastService from "../../features/forecast/service/forecast.service";
import { ForecastEntity } from "../../features/forecast/types/forecast.types";

const StationStatus = () => {
  const [stations, setStations] =
    useState<ForecastEntity[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadStations = async () => {
      try {
        const entities =
          await forecastService.getEntities();

        if (mounted) {
          setStations(entities);
        }
      } catch (error) {
        console.error(
          "[StationStatus] Failed to load stations:",
          error
        );

        if (mounted) {
          setStations([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadStations();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppCard>
      <Typography
        variant="h6"
        fontWeight={700}
        mb={3}
      >
        Station Status
      </Typography>

      {loading ? (
        <Stack
          alignItems="center"
          py={3}
        >
          <CircularProgress size={24} />
        </Stack>
      ) : stations.length === 0 ? (
        <Typography color="text.secondary">
          No stations available.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {stations.map((station) => (
            <Stack
              key={station.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography>
                {station.label}
              </Typography>

              <StatusChip status="active" />
            </Stack>
          ))}
        </Stack>
      )}
    </AppCard>
  );
};

export default StationStatus;