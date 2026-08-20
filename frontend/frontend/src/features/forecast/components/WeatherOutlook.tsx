import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  CloudRounded,
  WaterDropRounded,
  ThermostatRounded,
  AirRounded,
} from "@mui/icons-material";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useQuery,
} from "@tanstack/react-query";

import axios from "axios";

import {
  WeatherRecord,
} from "../types/weather.types";



import {
  cardBorderColor,
  cardFill,
  softBorder,
  softText,
} from "../../../theme/surfaces";

/* ======================================================
   TYPES
====================================================== */

interface WeatherOutlookProps {
  entityId: string;
}

interface WeatherChartPoint {
  date: string;
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
}


/* ======================================================
   COMPONENT
====================================================== */

const WeatherOutlook = ({
  entityId,
}: WeatherOutlookProps) => {

  /* ====================================================
     FETCH WEATHER DATA
  ==================================================== */

  const {
    data,
    isLoading,
    isError,
  } = useQuery<WeatherRecord[]>({
    queryKey: [
      "weather-outlook",
      entityId,
    ],

    queryFn: async (): Promise<WeatherRecord[]> => {

      const response =
        await axios.get<WeatherRecord[]>(
          "/api/weather-data",
          {
            params: {
              entity_id:
                entityId,
            },
          }
        );

      return response.data;
    },

    enabled:
      Boolean(entityId),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });


  /* ====================================================
     DATE FORMATTER
  ==================================================== */

  const formatDate = (
    value: string
  ): string => {

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
      }
    );
  };


  /* ====================================================
     NUMBER FORMATTER
  ==================================================== */

  const formatNumber = (
    value: number
  ): string => {

    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 1,
      }
    )
      .format(value)
      .replace(
        /,/g,
        " "
      );
  };


  /* ====================================================
     CHART DATA
  ==================================================== */

  const chartData: WeatherChartPoint[] =
    (data ?? [])
      .slice()
      .sort(
        (
          a: WeatherRecord,
          b: WeatherRecord
        ) =>
          new Date(
            a.date
          ).getTime() -
          new Date(
            b.date
          ).getTime()
      )
      .map(
        (
          record: WeatherRecord
        ): WeatherChartPoint => ({
          date:
            formatDate(
              record.date
            ),

          temperature:
            Number(
              record.temp_max_c
            ),

          rainfall:
            Number(
              record.rainfall_mm
            ),

          humidity:
            Number(
              record.humidity_pct
            ),

          windSpeed:
            Number(
              record.wind_speed_kmh
            ),
        })
      );


  /* ====================================================
     SUMMARY CALCULATIONS
  ==================================================== */

  const totalRainfall: number =
    (data ?? []).reduce(
      (
        total: number,
        record: WeatherRecord
      ): number =>
        total +
        Number(
          record.rainfall_mm
        ),
      0
    );


  const averageTemperature: number =
    data &&
    data.length > 0
      ? data.reduce(
          (
            total: number,
            record: WeatherRecord
          ): number =>
            total +
            Number(
              record.temp_max_c
            ),
          0
        ) /
        data.length
      : 0;


  const averageHumidity: number =
    data &&
    data.length > 0
      ? data.reduce(
          (
            total: number,
            record: WeatherRecord
          ): number =>
            total +
            Number(
              record.humidity_pct
            ),
          0
        ) /
        data.length
      : 0;


  const averageWindSpeed: number =
    data &&
    data.length > 0
      ? data.reduce(
          (
            total: number,
            record: WeatherRecord
          ): number =>
            total +
            Number(
              record.wind_speed_kmh
            ),
          0
        ) /
        data.length
      : 0;


  /* ====================================================
     LOADING
  ==================================================== */

  if (isLoading) {

    return (
      <Box
        sx={{
          width: "100%",
          minHeight: 420,

          bgcolor: cardFill,

          border: "1px solid",

          borderColor: cardBorderColor,

          borderRadius: "12px",

          p: {
            xs: 2.5,
            md: 4,
          },

          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >

        <Typography
          color="text.secondary"
        >
          Loading weather outlook...
        </Typography>

      </Box>
    );
  }


  /* ====================================================
     ERROR
  ==================================================== */

  if (isError) {

    return (
      <Box
        sx={{
          width: "100%",

          bgcolor: cardFill,

          border: "1px solid",

          borderColor: cardBorderColor,

          borderRadius: "12px",

          p: {
            xs: 2.5,
            md: 4,
          },
        }}
      >

        <Typography
          variant="h5"
          fontWeight={800}
          color="text.primary"
        >
          Weather Outlook
        </Typography>

        <Typography
          color="error"
          mt={1}
        >
          Unable to load weather data
          for the selected power station.
        </Typography>

      </Box>
    );
  }


  /* ====================================================
     MAIN UI
  ==================================================== */

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,

        bgcolor: cardFill,

        border: "1px solid",

        borderColor: cardBorderColor,

        borderRadius: "12px",

        p: {
          xs: 2.5,
          md: 4,
        },

        overflow: "hidden",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs: "flex-start",
          md: "center",
        }}
        spacing={2}
        mb={4}
      >

        <Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            mb={0.5}
          >

            <CloudRounded
              sx={{
                color:
                  "#1264FF",
                fontSize: 26,
              }}
            />

            <Typography
              variant="h5"
              fontWeight={800}
              color="text.primary"
            >
              Weather Outlook
            </Typography>

          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Weather conditions across the
            available forecast period for
            the selected power station.
          </Typography>

        </Box>


        <Typography
          variant="body2"
          fontWeight={700}
          color="#1264FF"
          sx={{
            flexShrink: 0,
          }}
        >
          {chartData.length} observations
        </Typography>

      </Stack>


      {/* ==================================================
          SUMMARY CARDS
      ================================================== */}

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

          mb: 4,

          "& > *": {
            minWidth: 0,
          },
        }}
      >

        {/* TEMPERATURE */}

        <Box
          sx={{
            p: 2.5,
            borderRadius: "12px",
            bgcolor:
              "rgba(245, 124, 0, 0.07)",
            border:
              "1px solid rgba(245, 124, 0, 0.12)",
          }}
        >

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            mb={1}
          >

            <ThermostatRounded
              sx={{
                color:
                  "#F57C00",
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              AVG TEMPERATURE
            </Typography>

          </Stack>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            {formatNumber(
              averageTemperature
            )}
            °C
          </Typography>

        </Box>


        {/* RAINFALL */}

        <Box
          sx={{
            p: 2.5,
            borderRadius: "12px",
            bgcolor:
              "rgba(18, 100, 255, 0.07)",
            border:
              "1px solid rgba(18, 100, 255, 0.12)",
          }}
        >

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            mb={1}
          >

            <WaterDropRounded
              sx={{
                color:
                  "#1264FF",
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              TOTAL RAINFALL
            </Typography>

          </Stack>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            {formatNumber(
              totalRainfall
            )}
            mm
          </Typography>

        </Box>


        {/* HUMIDITY */}

        <Box
          sx={{
            p: 2.5,
            borderRadius: "12px",
            bgcolor:
              "rgba(46, 125, 50, 0.07)",
            border:
              "1px solid rgba(46, 125, 50, 0.12)",
          }}
        >

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            mb={1}
          >

            <WaterDropRounded
              sx={{
                color:
                  "#2E7D32",
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              AVG HUMIDITY
            </Typography>

          </Stack>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            {formatNumber(
              averageHumidity
            )}
            %
          </Typography>

        </Box>


        {/* WIND */}

        <Box
          sx={{
            p: 2.5,
            borderRadius: "12px",
            bgcolor:
              "rgba(69, 90, 100, 0.07)",
            border:
              "1px solid rgba(69, 90, 100, 0.12)",
          }}
        >

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            mb={1}
          >

            <AirRounded
              sx={{
                color: softText,
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              AVG WIND
            </Typography>

          </Stack>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            {formatNumber(
              averageWindSpeed
            )}
            km/h
          </Typography>

        </Box>

      </Box>


      {/* ==================================================
          TEMPERATURE CHART
      ================================================== */}

      {chartData.length > 0 && (

        <Box
          sx={{
            width: "100%",
            minWidth: 0,
            height: {
              xs: 280,
              sm: 320,
              md: 360,
            },
          }}
        >

          <Typography
            variant="subtitle1"
            fontWeight={800}
            color="text.primary"
            mb={2}
          >
            Temperature Outlook
          </Typography>


          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 20,
                left: 0,
                bottom: 10,
              }}
            >

              <defs>

                <linearGradient
                  id="weatherTemperatureGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="0%"
                    stopColor="#F57C00"
                    stopOpacity={0.25}
                  />

                  <stop
                    offset="100%"
                    stopColor="#F57C00"
                    stopOpacity={0.02}
                  />

                </linearGradient>

              </defs>


              <CartesianGrid
                strokeDasharray="4 6"
                vertical={false}
                stroke="#E8ECF2"
              />


              <XAxis
                dataKey="date"
                tick={{
                  fill:
                    "text.secondary",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={35}
              />


              <YAxis
                tick={{
                  fill:
                    "text.secondary",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={(
                  value: number
                ) =>
                  `${value}°`
                }
              />


              <Tooltip
                formatter={(
                  value: number
                ) => [
                  `${formatNumber(
                    value
                  )} °C`,
                  "Temperature",
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #E2E7EF",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,0.08)",
                }}
              />


              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#F57C00"
                strokeWidth={3}
                fill="url(#weatherTemperatureGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                }}
              />

            </AreaChart>

          </ResponsiveContainer>

        </Box>

      )}


      {/* ==================================================
          EMPTY STATE
      ================================================== */}

      {chartData.length === 0 && (

        <Box
          sx={{
            minHeight: 280,
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >

          <Typography
            color="text.secondary"
          >
            No weather observations are
            available for this power station.
          </Typography>

        </Box>

      )}

    </Box>
  );
};


export default WeatherOutlook;