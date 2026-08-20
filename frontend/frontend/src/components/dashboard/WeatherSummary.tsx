// Used ONLY by the unrouted Dashboard page (components/dashboard variant —
// distinct from features/forecast/components/WeatherSummary.tsx).
// [DATA: DYNAMIC] wraps useWeatherSummary (/api/weather-data).
import {
  AirRounded,
  OpacityRounded,
  ThermostatRounded,
  ThunderstormRounded,
} from "@mui/icons-material";

import {
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

// Backend interface for weather data from /api/weather-data
interface WeatherData {
  date: string;
  temp_max_c?: number;
  temp_min_c?: number;
  humidity_pct?: number;
  wind_speed_kmh?: number;
  precipitation_mm?: number;
  cloud_cover_pct?: number;
}

// Fetches current weather from /api/weather-data (uses default entity Kendal)
const fetchWeatherSummary = async () => {
  const response = await axios.get<WeatherData[]>("/api/weather-data");

  // Get the most recent weather record (today or latest available)
  const today = new Date().toISOString().split("T")[0];
  const todayData = response.data.find((d) => d.date === today) || response.data[response.data.length - 1];

  return todayData || null;
};

// React Query hook for weather data with 1 hour refresh
const useWeatherSummary = () => {
  return useQuery<WeatherData | null>({
    queryKey: ["weather-summary"],
    queryFn: fetchWeatherSummary,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 60 * 60 * 1000, // Refresh every hour
  });
};

interface WeatherItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const WeatherItem = ({
  icon,
  label,
  value,
}: WeatherItemProps) => (
  <Stack
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    sx={{ py: 2 }}
  >
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
    >
      {icon}

      <Typography color="text.secondary">
        {label}
      </Typography>
    </Stack>

    <Typography fontWeight={700}>
      {value}
    </Typography>
  </Stack>
);

// Weather summary component - displays current weather from /api/weather-data
const WeatherSummary = () => {
  const { data: weather, isLoading, isError } = useWeatherSummary();

  // Calculate rain probability from precipitation (rough estimate)
  const rainProbability = weather?.precipitation_mm
    ? Math.min(100, Math.round((weather.precipitation_mm / 10) * 100))
    : 0;

  return (
    <AppCard sx={{ height: "100%" }}>
      <CardHeader
        title="Weather Summary"
        subtitle={isLoading ? "Loading..." : "Current weather affecting demand"}
      />

      {isLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Loading weather data...
        </Typography>
      )}

      {isError && (
        <Typography variant="body2" color="error" sx={{ py: 2 }}>
          Unable to load weather data
        </Typography>
      )}

      {!isLoading && !isError && weather && (
        <>
          <WeatherItem
            icon={<ThermostatRounded color="error" />}
            label="Temperature"
            value={weather.temp_max_c ? `${Math.round(weather.temp_max_c)}°C` : "N/A"}
          />

          <Divider />

          <WeatherItem
            icon={<AirRounded color="primary" />}
            label="Wind Speed"
            value={weather.wind_speed_kmh ? `${Math.round(weather.wind_speed_kmh)} km/h` : "N/A"}
          />

          <Divider />

          <WeatherItem
            icon={<OpacityRounded color="info" />}
            label="Humidity"
            value={weather.humidity_pct ? `${Math.round(weather.humidity_pct)}%` : "N/A"}
          />

          <Divider />

          <WeatherItem
            icon={<ThunderstormRounded color="warning" />}
            label="Rain Probability"
            value={`${rainProbability}%`}
          />

          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 3,
              bgcolor: "grey.100",
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Weather conditions are expected to have a
              {rainProbability > 50 ? " significant" : " minimal"} impact on today's generation
              forecast.
            </Typography>
          </Box>
        </>
      )}
    </AppCard>
  );
};

export default WeatherSummary;