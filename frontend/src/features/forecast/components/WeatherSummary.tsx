import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  CloudRounded,
  DeviceThermostatRounded,
  OpacityRounded,
  AirRounded,
  WbSunnyRounded,
  WaterDropRounded,
} from "@mui/icons-material";

import {
  useWeatherSummary,
} from "../hooks/useWeather";

interface WeatherSummaryProps {
  entityId: string;
}

interface WeatherMetricProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  background: string;
  iconColor: string;
}

const WeatherMetric = ({
  label,
  value,
  icon,
  background,
  iconColor,
}: WeatherMetricProps) => {
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 170,
        p: {
          xs: 2,
          md: 2.5,
        },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "#DCE5F5",
        bgcolor: background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 2,
            bgcolor:
              "rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
          }}
        >
          {icon}
        </Box>

        <Typography
          variant="body2"
          fontWeight={700}
          color="#68758A"
          sx={{
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {label}
        </Typography>
      </Stack>

      <Typography
        variant="h6"
        fontWeight={800}
        color="text.primary"
        sx={{
          mt: 2,
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};


const WeatherSummary = ({
  entityId,
}: WeatherSummaryProps) => {
  const {
    data,
    isLoading,
    isError,
  } =
    useWeatherSummary(
      entityId
    );

  if (isLoading) {
    return (
      <Box
        sx={{
          p: 4,
          bgcolor: "#FFFFFF",
          border:
            "1px solid #E0E6EF",
          borderRadius: 4,
        }}
      >
        <Typography color="text.secondary">
          Loading weather conditions...
        </Typography>
      </Box>
    );
  }

  if (
    isError ||
    !data
  ) {
    return (
      <Box
        sx={{
          p: 4,
          bgcolor: "#FFFFFF",
          border:
            "1px solid #E0E6EF",
          borderRadius: 4,
        }}
      >
        <Typography color="error">
          Unable to load weather data
          for this power station.
        </Typography>
      </Box>
    );
  }

  const formatValue = (
    value:
      | number
      | null,
    suffix = ""
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    return `${value.toFixed(1)}${suffix}`;
  };

  const formatDate = (
    date: string
  ) => {
    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border:
          "1px solid #E0E6EF",
        borderRadius: 4,
        p: {
          xs: 2.5,
          md: 4,
        },
      }}
    >
      {/* HEADER */}

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        justifyContent="space-between"
        spacing={3}
        mb={4}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              flexShrink: 0,
              borderRadius: 3,
              bgcolor: "#EEF4FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1264FF",
            }}
          >
            <CloudRounded
              sx={{
                fontSize: 36,
              }}
            />
          </Box>

          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              color="text.primary"
            >
              Weather Summary
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
            >
              Latest available conditions
              for{" "}
              <strong>
                {entityId}
              </strong>
              .
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 2.5,
              bgcolor: "#EEF4FF",
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <DeviceThermostatRounded
              sx={{
                color: "#1264FF",
              }}
            />

            <Typography
              fontWeight={800}
            >
              {formatValue(
                data.tempMax,
                " °C"
              )}
            </Typography>
          </Box>

          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 2.5,
              bgcolor: "#F4F6F9",
            }}
          >
            <Typography
              fontWeight={700}
              color="#68758A"
            >
              {data.condition}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* METRICS */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <WeatherMetric
          label="Condition"
          value={data.condition}
          icon={
            <CloudRounded />
          }
          background="#F3F6FC"
          iconColor="#68758A"
        />

        <WeatherMetric
          label="High / Low"
          value={`${formatValue(
            data.tempMax,
            " °C"
          )} / ${formatValue(
            data.tempMin,
            " °C"
          )}`}
          icon={
            <DeviceThermostatRounded />
          }
          background="#FFF8ED"
          iconColor="#F59E0B"
        />

        <WeatherMetric
          label="Rainfall"
          value={formatValue(
            data.rainfall,
            " mm"
          )}
          icon={
            <OpacityRounded />
          }
          background="#F0F7FF"
          iconColor="#1683D8"
        />

        <WeatherMetric
          label="Cloud Cover"
          value={formatValue(
            data.cloudCover,
            "%"
          )}
          icon={
            <CloudRounded />
          }
          background="#F5F7FA"
          iconColor="#68758A"
        />

        <WeatherMetric
          label="Humidity"
          value={formatValue(
            data.humidity,
            "%"
          )}
          icon={
            <WaterDropRounded />
          }
          background="#F0FBFC"
          iconColor="#1297B1"
        />

        <WeatherMetric
          label="Wind Speed"
          value={formatValue(
            data.windSpeed,
            " km/h"
          )}
          icon={
            <AirRounded />
          }
          background="#F0FAF8"
          iconColor="#008C7A"
        />

        <WeatherMetric
          label="UV Index"
          value={formatValue(
            data.uvIndex
          )}
          icon={
            <WbSunnyRounded />
          }
          background="#FFF8ED"
          iconColor="#F59E0B"
        />

        <WeatherMetric
          label="Sunshine"
          value={formatValue(
            data.sunshine,
            " hrs"
          )}
          icon={
            <WbSunnyRounded />
          }
          background="#FFF8ED"
          iconColor="#F59E0B"
        />
      </Box>

      {/* FOOTER */}

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        justifyContent="space-between"
        spacing={1}
        mt={3}
        pt={3}
        borderTop="1px solid #E1E6ED"
      >
        <Typography
          color="text.secondary"
        >
          Weather conditions are being
          considered alongside the
          selected forecast.
        </Typography>

        <Typography
          color="text.secondary"
        >
          Updated{" "}
          {formatDate(
            data.date
          )}
        </Typography>
      </Stack>
    </Box>
  );
};

export default WeatherSummary;