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

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

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

const WeatherSummary = () => {
  return (
    <AppCard sx={{ height: "100%" }}>
      <CardHeader
        title="Weather Summary"
        subtitle="Current weather affecting demand"
      />

      <WeatherItem
        icon={<ThermostatRounded color="error" />}
        label="Temperature"
        value="24°C"
      />

      <Divider />

      <WeatherItem
        icon={<AirRounded color="primary" />}
        label="Wind Speed"
        value="18 km/h"
      />

      <Divider />

      <WeatherItem
        icon={<OpacityRounded color="info" />}
        label="Humidity"
        value="67%"
      />

      <Divider />

      <WeatherItem
        icon={<ThunderstormRounded color="warning" />}
        label="Rain Probability"
        value="35%"
      />

      <Box
        sx={{
          mt: 3,
          p: 2,
          borderRadius: "12px",
          bgcolor: "grey.100",
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Weather conditions are expected to have a
          minimal impact on today's generation
          forecast.
        </Typography>
      </Box>
    </AppCard>
  );
};

export default WeatherSummary;