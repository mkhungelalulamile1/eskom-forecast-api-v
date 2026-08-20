import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  AirRounded,
  OpacityRounded,
  ThermostatRounded,
  WbSunnyRounded,
} from "@mui/icons-material";

import {
  useWeatherSignals,
} from "../hooks/useWeather";


interface WeatherSignalsProps {
  entityId: string;

  /**
   * Number of weather days to analyse.
   *
   * Examples:
   * 7  = 7-day outlook
   * 30 = 30-day outlook
   */
  days?: number;
}


const WeatherSignals = ({
  entityId,
  days = 7,
}: WeatherSignalsProps) => {
  const {
    data,
    isLoading,
    isError,
  } = useWeatherSignals(
    entityId,
    days
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
        <Typography
          color="text.secondary"
        >
          Calculating weather signals...
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
          Unable to calculate weather
          signals.
        </Typography>
      </Box>
    );
  }


  const format = (
    value:
      | number
      | null
      | undefined,
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

      {/* =================================================
          HEADER
      ================================================= */}

      <Box mb={3}>
        <Typography
          variant="h5"
          fontWeight={800}
          color="text.primary"
        >
          Weather Signals
        </Typography>

        <Typography
          color="text.secondary"
          mt={0.5}
        >
          Aggregated weather indicators
          from the selected {days}-day
          outlook.
        </Typography>
      </Box>


      {/* =================================================
          MAIN SIGNALS
      ================================================= */}

      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs:
              "minmax(0, 1fr)",

            sm:
              "repeat(2, minmax(0, 1fr))",

            lg:
              "repeat(4, minmax(0, 1fr))",
          },

          gap: 2,

          "& > *": {
            minWidth: 0,
          },
        }}
      >

        <Signal
          label="Average temperature"
          value={format(
            data.averageTemperature,
            " °C"
          )}
          icon={
            <ThermostatRounded />
          }
          color="#F59E0B"
          background="#FFF8ED"
        />


        <Signal
          label="Expected rainfall"
          value={format(
            data.totalRainfall,
            " mm"
          )}
          icon={
            <OpacityRounded />
          }
          color="#1683D8"
          background="#F0F7FF"
        />


        <Signal
          label="Average wind"
          value={format(
            data.averageWindSpeed,
            " km/h"
          )}
          icon={
            <AirRounded />
          }
          color="#008C7A"
          background="#F0FAF8"
        />


        <Signal
          label="Average UV index"
          value={format(
            data.averageUvIndex
          )}
          icon={
            <WbSunnyRounded />
          }
          color="#F59E0B"
          background="#FFF8ED"
        />

      </Box>


      {/* =================================================
          SECONDARY SIGNALS
      ================================================= */}

      <Box
        sx={{
          mt: 3,
          p: 2.5,
          borderRadius: 3,
          bgcolor: "#F7F9FC",
          border:
            "1px solid #E6EBF2",
        }}
      >

        <Box
          sx={{
            display: "grid",

            gridTemplateColumns: {
              xs:
                "repeat(2, minmax(0, 1fr))",

              sm:
                "repeat(4, minmax(0, 1fr))",
            },

            gap: {
              xs: 2,
              sm: 0,
            },

            "& > *": {
              minWidth: 0,
            },
          }}
        >

          <MiniSignal
            label="Forecast days"
            value={
              data.forecastDays
            }
          />


          <MiniSignal
            label="Rainy days"
            value={
              data.rainyDays
            }
          />


          <MiniSignal
            label="Hot days"
            value={
              data.hotDays
            }
          />


          <MiniSignal
            label="Average humidity"
            value={format(
              data.averageHumidity,
              "%"
            )}
          />

        </Box>
      </Box>


      {/* =================================================
          EXPLANATION
      ================================================= */}

      <Typography
        variant="body2"
        color="text.secondary"
        mt={3}
      >
        These indicators summarize the
        weather conditions available to the
        forecasting pipeline. They provide
        environmental context for interpreting
        forecast demand, coal burn and
        stockpile projections.
      </Typography>

    </Box>
  );
};


/* =====================================================
   SIGNAL CARD
===================================================== */

interface SignalProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  background: string;
}


const Signal = ({
  label,
  value,
  icon,
  color,
  background,
}: SignalProps) => {
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: background,
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
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
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor:
              "rgba(255,255,255,0.75)",
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>


        <Typography
          variant="body2"
          color="#68758A"
          fontWeight={700}
          sx={{
            minWidth: 0,
            overflowWrap:
              "anywhere",
          }}
        >
          {label}
        </Typography>

      </Stack>


      <Typography
        variant="h5"
        fontWeight={800}
        color="text.primary"
        mt={2}
        sx={{
          overflowWrap:
            "anywhere",
        }}
      >
        {value}
      </Typography>

    </Box>
  );
};


/* =====================================================
   MINI SIGNAL
===================================================== */

interface MiniSignalProps {
  label: string;
  value: string | number;
}


const MiniSignal = ({
  label,
  value,
}: MiniSignalProps) => {
  return (
    <Box
      sx={{
        px: {
          xs: 0,
          sm: 2,
        },

        py: 1,

        minWidth: 0,

        borderRight: {
          xs: "none",
          sm:
            "1px solid #DDE3EB",
        },

        "&:last-child": {
          borderRight:
            "none",
        },
      }}
    >

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          overflowWrap:
            "anywhere",
        }}
      >
        {label}
      </Typography>


      <Typography
        variant="h6"
        fontWeight={800}
        color="text.primary"
        mt={0.5}
      >
        {value}
      </Typography>

    </Box>
  );
};


export default WeatherSignals;