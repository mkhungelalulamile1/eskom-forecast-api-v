import {
  useMemo,
} from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  CloudRounded,
  InfoOutlined,
} from "@mui/icons-material";

import {
  useForecastChart,
} from "../hooks/useForecast";

import {
  useWeatherData,
} from "../hooks/useWeather";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  WeatherRecord,
} from "../types/weather.types";


interface WeatherCorrelationProps {
  filters: ForecastFilters;
}


interface CorrelationValue {
  key: string;
  label: string;
  value: number | null;
}


interface CorrelationRow {
  target: string;
  values: CorrelationValue[];
}


interface MatchedForecastWeather {
  forecast: ForecastRecord;
  weather: WeatherRecord;
}


/**
 * =====================================================
 * PEARSON CORRELATION
 * =====================================================
 */

const calculateCorrelation = (
  x: number[],
  y: number[]
): number | null => {

  if (
    x.length < 2 ||
    y.length < 2 ||
    x.length !== y.length
  ) {
    return null;
  }


  const meanX =
    x.reduce(
      (
        sum: number,
        value: number
      ) =>
        sum + value,
      0
    ) / x.length;


  const meanY =
    y.reduce(
      (
        sum: number,
        value: number
      ) =>
        sum + value,
      0
    ) / y.length;


  let numerator = 0;

  let denominatorX = 0;

  let denominatorY = 0;


  for (
    let index = 0;
    index < x.length;
    index += 1
  ) {

    const differenceX =
      x[index] -
      meanX;

    const differenceY =
      y[index] -
      meanY;


    numerator +=
      differenceX *
      differenceY;


    denominatorX +=
      differenceX *
      differenceX;


    denominatorY +=
      differenceY *
      differenceY;
  }


  const denominator =
    Math.sqrt(
      denominatorX *
        denominatorY
    );


  if (
    denominator === 0
  ) {
    return null;
  }


  return (
    numerator /
    denominator
  );
};


/**
 * =====================================================
 * CORRELATION DESCRIPTION
 * =====================================================
 */

const describeCorrelation = (
  value: number | null
): string => {

  if (
    value === null
  ) {
    return "Not enough data";
  }


  const absolute =
    Math.abs(value);


  if (
    absolute >= 0.7
  ) {
    return "Strong";
  }


  if (
    absolute >= 0.4
  ) {
    return "Moderate";
  }


  if (
    absolute >= 0.2
  ) {
    return "Weak";
  }


  return "Very weak";
};


/**
 * =====================================================
 * FORMAT CORRELATION
 * =====================================================
 */

const formatCorrelation = (
  value: number | null
): string => {

  if (
    value === null
  ) {
    return "—";
  }


  return value.toFixed(2);
};


/**
 * =====================================================
 * CELL BACKGROUND
 * =====================================================
 */

const getCellBackground = (
  value: number | null
): string => {

  if (
    value === null
  ) {
    return "action.hover";
  }


  const intensity =
    Math.min(
      Math.abs(value),
      1
    );


  if (
    value > 0
  ) {
    return `rgba(25, 118, 210, ${
      0.06 +
      intensity * 0.22
    })`;
  }


  if (
    value < 0
  ) {
    return `rgba(211, 47, 47, ${
      0.06 +
      intensity * 0.22
    })`;
  }


  return "action.hover";
};


/**
 * =====================================================
 * CELL TEXT COLOR
 * =====================================================
 */

const getCellColor = (
  value: number | null
): string => {

  if (
    value === null
  ) {
    return "text.secondary";
  }


  if (
    value >= 0
  ) {
    return "#1565C0";
  }


  return "#C62828";
};


/**
 * =====================================================
 * COMPONENT
 * =====================================================
 */

const WeatherCorrelation = ({
  filters,
}: WeatherCorrelationProps) => {


  /**
   * =====================================================
   * FIRST: GET FORECAST
   * =====================================================
   *
   * We need the forecast dates first.
   *
   * Example:
   *
   * 2025-05-29 → 2025-08-26
   *
   * These dates will then be sent to the
   * weather API.
   */

  const {
    data: forecastData = [],
    isLoading:
      forecastLoading,
    isError:
      forecastError,
  } = useForecastChart(
    filters
  );


  /**
   * =====================================================
   * DETERMINE FORECAST DATE RANGE
   * =====================================================
   */

const forecastDates =
  useMemo<string[]>(() => {

    return forecastData
      .map(
        (
          record: ForecastRecord
        ): string | null =>
          record.event_date ?? null
      )
      .filter(
        (
          value: string | null
        ): value is string =>
          value !== null &&
          value.length > 0
      )
      .sort();

  }, [
    forecastData,
  ]);

  const startDate =
    forecastDates.length > 0
      ? forecastDates[0]
      : undefined;


  const endDate =
    forecastDates.length > 0
      ? forecastDates[
          forecastDates.length - 1
        ]
      : undefined;


  /**
   * =====================================================
   * SECOND: GET WEATHER
   * =====================================================
   *
   * IMPORTANT:
   *
   * Weather is requested for the exact
   * same date range as the forecast.
   */

  const {
    data: weatherData = [],
    isLoading:
      weatherLoading,
    isError:
      weatherError,
  } = useWeatherData(
    filters.entityId,
    startDate,
    endDate
  );


  /**
   * =====================================================
   * LOADING / ERROR
   * =====================================================
   */

  const isLoading =
    weatherLoading ||
    forecastLoading;


  const isError =
    weatherError ||
    forecastError;


  /**
   * =====================================================
   * BUILD WEATHER DATE LOOKUP
   * =====================================================
   */

  const weatherByDate =
    useMemo(() => {

      const lookup =
        new Map<
          string,
          WeatherRecord
        >();


      weatherData.forEach(
        (
          record: WeatherRecord
        ) => {

          lookup.set(
            record.date,
            record
          );

        }
      );


      return lookup;

    }, [
      weatherData,
    ]);


  /**
   * =====================================================
   * MATCH FORECAST + WEATHER
   * =====================================================
   */

  const matched =
    useMemo<
      MatchedForecastWeather[]
    >(() => {

      if (
        forecastData.length === 0 ||
        weatherData.length === 0
      ) {
        return [];
      }


      return forecastData
        .map(
          (
            forecast: ForecastRecord
          ): MatchedForecastWeather | null => {

            const weather =
              weatherByDate.get(
                forecast.event_date
              );


            if (!weather) {
              return null;
            }


            return {
              forecast,
              weather,
            };
          }
        )
        .filter(
          (
            item:
              | MatchedForecastWeather
              | null
          ): item is MatchedForecastWeather =>
            item !== null
        );

    }, [
      forecastData,
      weatherData,
      weatherByDate,
    ]);


  /**
   * =====================================================
   * BUILD CORRELATION DATA
   * =====================================================
   */

  const correlationRows =
    useMemo<
      CorrelationRow[]
    >(() => {

      if (
        matched.length < 2
      ) {
        return [];
      }


      /**
       * Calculate weather variables
       * against either burn or supply.
       */

      const calculateForTarget =
        (
          target:
            | "burn"
            | "supply"
        ): CorrelationValue[] => {


          const getTargetValue =
            (
              item:
                MatchedForecastWeather
            ): number => {

              if (
                target ===
                "burn"
              ) {

                return Number(
                  item.forecast
                    .Input ?? 0
                );
              }


              return Number(
                item.forecast
                  .Replenishment ?? 0
              );
            };


          const variables: Array<{
            key: string;

            label: string;

            getValue: (
              weather: WeatherRecord
            ) => number | null;
          }> = [

            {
              key:
                "temperature",

              label:
                "Temperature",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .temp_max_c ??
                  null,
            },


            {
              key:
                "rainfall",

              label:
                "Rainfall",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .rainfall_mm ??
                  null,
            },


            {
              key:
                "cloud_cover",

              label:
                "Cloud Cover",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .cloud_cover_pct ??
                  null,
            },


            {
              key:
                "humidity",

              label:
                "Humidity",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .humidity_pct ??
                  null,
            },


            {
              key:
                "wind",

              label:
                "Wind",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .wind_speed_kmh ??
                  null,
            },


            {
              key:
                "uv",

              label:
                "UV Index",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .uv_index ??
                  null,
            },


            {
              key:
                "sunshine",

              label:
                "Sunshine",

              getValue:
                (
                  weather
                ) =>
                  weather
                    .sunshine_seconds ??
                  null,
            },
          ];


          return variables.map(
            (
              variable
            ) => {

              const x:
                number[] = [];

              const y:
                number[] = [];


              matched.forEach(
                (
                  item:
                    MatchedForecastWeather
                ) => {

                  const weatherValue =
                    variable.getValue(
                      item.weather
                    );


                  const targetValue =
                    getTargetValue(
                      item
                    );


                  if (
                    weatherValue ===
                      null ||
                    !Number.isFinite(
                      weatherValue
                    ) ||
                    !Number.isFinite(
                      targetValue
                    )
                  ) {
                    return;
                  }


                  x.push(
                    weatherValue
                  );


                  y.push(
                    targetValue
                  );

                }
              );


              return {

                key:
                  variable.key,

                label:
                  variable.label,

                value:
                  calculateCorrelation(
                    x,
                    y
                  ),
              };
            }
          );
        };


      return [

        {
          target:
            "Burn",

          values:
            calculateForTarget(
              "burn"
            ),
        },


        {
          target:
            "Supply",

          values:
            calculateForTarget(
              "supply"
            ),
        },

      ];

    }, [
      matched,
    ]);


  /**
   * =====================================================
   * MATCHED DAYS
   * =====================================================
   */

  const matchedDays =
    matched.length;


  /**
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (

    <Card
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: 12,
      }}
    >

      <CardContent
        sx={{
          p: {
            xs: 2,
            md: 3,
          },

          "&:last-child": {
            pb: {
              xs: 2,
              md: 3,
            },
          },
        }}
      >


        {/* =================================================
            HEADER
        ================================================= */}

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          alignItems={{
            xs: "flex-start",
            sm: "center",
          }}
          spacing={2}
          sx={{
            mb: 2.5,
          }}
        >

          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
          >

            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                bgcolor:
                  "action.hover",
              }}
            >

              <CloudRounded />

            </Box>


            <Box>

              <Typography
                variant="h6"
                fontWeight={700}
              >
                Weather & Forecast
                Correlation
              </Typography>


              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.25,
                }}
              >
                Relationship between
                weather conditions and
                forecast burn and supply.
              </Typography>

            </Box>

          </Stack>


          <Chip
            size="small"
            icon={
              <InfoOutlined />
            }
            label={
              `${matchedDays} matched day${
                matchedDays === 1
                  ? ""
                  : "s"
              }`
            }
            variant="outlined"
          />

        </Stack>


        <Divider
          sx={{
            mb: 2,
          }}
        />


        {/* =================================================
            DESCRIPTION
        ================================================= */}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2.5,
            maxWidth: 900,
          }}
        >
          Correlation values range from
          -1 to +1. Positive values mean
          both variables tend to move in
          the same direction, while negative
          values mean they tend to move in
          opposite directions. Correlation
          does not by itself prove that one
          variable causes the other.
        </Typography>


        {/* =================================================
            LOADING
        ================================================= */}

        {isLoading && (

          <Box
            sx={{
              minHeight: 220,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
            }}
          >

            <Stack
              spacing={1.5}
              alignItems="center"
            >

              <CircularProgress
                size={28}
              />


              <Typography
                variant="body2"
                color="text.secondary"
              >
                Calculating weather
                correlations...
              </Typography>

            </Stack>

          </Box>

        )}


        {/* =================================================
            ERROR
        ================================================= */}

        {!isLoading &&
          isError && (

            <Alert
              severity="error"
            >
              Unable to load the
              weather or forecast data
              required for correlation
              analysis.
            </Alert>

        )}


        {/* =================================================
            EMPTY
        ================================================= */}

        {!isLoading &&
          !isError &&
          correlationRows.length ===
            0 && (

            <Alert
              severity="info"
            >
              There is not enough matching
              weather and forecast data to
              calculate correlations for
              this selection.
            </Alert>

        )}


        {/* =================================================
            CORRELATION MATRIX
        ================================================= */}

        {!isLoading &&
          !isError &&
          correlationRows.length >
            0 && (

          <Box
            sx={{
              width: "100%",
              overflowX: "auto",
            }}
          >

            <Box
              sx={{
                minWidth: 760,
              }}
            >


              {/* HEADER */}

              <Box
                sx={{
                  display: "grid",

                  gridTemplateColumns:
                    "150px repeat(7, minmax(80px, 1fr))",

                  gap: 1,

                  mb: 1,
                }}
              >

                <Box />


                {correlationRows[0]
                  .values
                  .map(
                    (
                      variable
                    ) => (

                      <Box
                        key={
                          variable.key
                        }
                        sx={{
                          px: 1,
                          py: 1.25,
                          textAlign:
                            "center",
                        }}
                      >

                        <Typography
                          variant="caption"
                          fontWeight={700}
                          color="text.secondary"
                        >
                          {
                            variable.label
                          }
                        </Typography>

                      </Box>

                    )
                  )}

              </Box>


              {/* ROWS */}

              <Stack spacing={1}>

                {correlationRows.map(
                  (
                    row
                  ) => (

                    <Box
                      key={
                        row.target
                      }
                      sx={{
                        display: "grid",

                        gridTemplateColumns:
                          "150px repeat(7, minmax(80px, 1fr))",

                        gap: 1,
                      }}
                    >

                      <Box
                        sx={{
                          display: "flex",
                          alignItems:
                            "center",
                          px: 1.5,
                          borderRadius: 2,
                          bgcolor:
                            "action.hover",
                        }}
                      >

                        <Typography
                          fontWeight={700}
                        >
                          {
                            row.target
                          }
                        </Typography>

                      </Box>


                      {row.values.map(
                        (
                          item
                        ) => (

                          <Box
                            key={
                              item.key
                            }
                            sx={{
                              minHeight: 76,

                              display:
                                "flex",

                              flexDirection:
                                "column",

                              alignItems:
                                "center",

                              justifyContent:
                                "center",

                              borderRadius: 2,

                              bgcolor:
                                getCellBackground(
                                  item.value
                                ),
                            }}
                          >

                            <Typography
                              sx={{
                                fontSize: 20,
                                fontWeight: 800,

                                color:
                                  getCellColor(
                                    item.value
                                  ),
                              }}
                            >
                              {
                                formatCorrelation(
                                  item.value
                                )
                              }
                            </Typography>


                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                mt: 0.25,
                              }}
                            >
                              {
                                describeCorrelation(
                                  item.value
                                )
                              }
                            </Typography>

                          </Box>

                        )
                      )}

                    </Box>

                  )
                )}

              </Stack>


              {/* LEGEND */}

              <Stack
                direction="row"
                spacing={2}
                flexWrap="wrap"
                useFlexGap
                sx={{
                  mt: 2,
                }}
              >

                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                >

                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 1,
                      bgcolor:
                        "rgba(25,118,210,0.25)",
                    }}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Positive relationship
                  </Typography>

                </Stack>


                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                >

                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: 1,
                      bgcolor:
                        "rgba(211,47,47,0.25)",
                    }}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Negative relationship
                  </Typography>

                </Stack>

              </Stack>

            </Box>

          </Box>

        )}

      </CardContent>

    </Card>
  );
};


export default WeatherCorrelation;