import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";

import {
  AirRounded,
  CloudRounded,
  OpacityRounded,
  ThermostatRounded,
  UmbrellaRounded,
  WbSunnyRounded,
  WaterDropRounded,
} from "@mui/icons-material";

import {
  useForecastContext,
} from "../../../contexts/ForecastContext";

import {
  useWeatherOutlook,
  useWeatherSignals,
  useWeatherSummary,
} from "../hooks/useWeather";

import {
  WeatherOutlookDay,
} from "../types/weather.types";
import { useForecastEntities } from "../hooks/useForecast";


interface WeatherIntelligenceProps {
  entityId?: string;
}


type WeatherView =
  | "current"
  | "7"
  | "30";


interface WeatherEntity {
  id: string;
  label?: string;
  name?: string;
}


const WeatherIntelligence = ({
  entityId: propEntityId,
}: WeatherIntelligenceProps) => {

  const {
    entityId:
      contextEntityId,
    setEntityId,
  } = useForecastContext();


  /**
   * IMPORTANT:
   *
   * `entities` should be the dynamically loaded
   * station/entity collection from your existing
   * forecast/entity hook.
   *
   * Keep the same hook/import you already have
   * in your current working version.
   */

  const {
    data: entities = [],
  } = useForecastEntities();


  /**
   * Use prop entityId when supplied.
   * Otherwise use the global forecast context.
   */

  const entityId =
    propEntityId ||
    contextEntityId;


  const [
    view,
    setView,
  ] = useState<WeatherView>(
    "current"
  );


  /**
   * --------------------------------------------------------
   * ENSURE CURRENT ENTITY EXISTS
   * --------------------------------------------------------
   *
   * This MUST be inside useEffect because
   * setEntityId() is a state update.
   */

  useEffect(() => {
    if (entities.length === 0) {
      return;
    }

    const currentEntityExists =
      entities.some(
        (entity: WeatherEntity) =>
          entity.id ===
          contextEntityId
      );

    if (!currentEntityExists) {
      setEntityId(
        entities[0].id
      );
    }
  }, [
    entities,
    contextEntityId,
    setEntityId,
  ]);


  const days =
    view === "30"
      ? 30
      : 7;


  /**
   * --------------------------------------------------------
   * CURRENT WEATHER
   * --------------------------------------------------------
   */

  const {
    data: current,
    isLoading:
      currentLoading,
    isError:
      currentError,
  } =
    useWeatherSummary(
      entityId
    );


  /**
   * --------------------------------------------------------
   * WEATHER OUTLOOK
   * --------------------------------------------------------
   */

  const {
    data: outlook = [],
    isLoading:
      outlookLoading,
    isError:
      outlookError,
  } =
    useWeatherOutlook(
      entityId,
      days
    );


  /**
   * --------------------------------------------------------
   * WEATHER SIGNALS
   * --------------------------------------------------------
   */

  const {
    data: signals,
    isLoading:
      signalsLoading,
  } =
    useWeatherSignals(
      entityId,
      days
    );


  /**
   * --------------------------------------------------------
   * FORMAT NUMBER
   * --------------------------------------------------------
   */

  const formatNumber = (
    value:
      | number
      | null
      | undefined,
    decimals = 1
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    return value.toFixed(
      decimals
    );
  };


  /**
   * --------------------------------------------------------
   * FORMAT DATE
   * --------------------------------------------------------
   */

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
      }
    );
  };


  /**
   * --------------------------------------------------------
   * DAY NAME
   * --------------------------------------------------------
   */

  const getDayName = (
    date: string
  ) => {
    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "";
    }

    return parsed.toLocaleDateString(
      "en-US",
      {
        weekday: "short",
      }
    );
  };


  /**
   * --------------------------------------------------------
   * WEATHER ICON
   * --------------------------------------------------------
   */

  const getWeatherIcon = (
    condition:
      | string
      | null
      | undefined
  ) => {

    const text =
      (
        condition ?? ""
      ).toLowerCase();


    if (
      text.includes("rain") ||
      text.includes("shower") ||
      text.includes("drizzle")
    ) {
      return (
        <UmbrellaRounded />
      );
    }


    if (
      text.includes("cloud") ||
      text.includes("overcast")
    ) {
      return (
        <CloudRounded />
      );
    }


    if (
      text.includes("sun") ||
      text.includes("clear")
    ) {
      return (
        <WbSunnyRounded />
      );
    }


    return (
      <CloudRounded />
    );
  };


  /**
   * --------------------------------------------------------
   * CURRENT TEMPERATURE
   * --------------------------------------------------------
   */

  const currentTemperature =
    useMemo(() => {

      if (!current) {
        return null;
      }

      return (
        current.tempMax ??
        current.tempMin
      );

    }, [current]);


  const loading =
    currentLoading ||
    outlookLoading ||
    signalsLoading;


  const error =
    currentError ||
    outlookError;


  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor:
          "background.paper",
        border:
          "1px solid",
        borderColor:
          "divider",
        borderRadius:
          "12px !important",
        p: {
          xs: 2.5,
          md: 3,
        },
        boxSizing:
          "border-box",
        overflow: "auto",
        maxHeight: {
          xs: "auto",
          xl: "900px",
        },
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.4)"
            : "0 10px 30px rgba(16,32,62,0.06)",
      }}
    >

      {/* HEADER */}

      <Stack
        direction="column"
        spacing={2}
        alignItems="flex-start"
        sx={{
          minWidth: 0,
          overflow: "hidden",
          mb: 2,
        }}
      >

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          spacing={2}
          alignItems={{
            xs: "flex-start",
            sm: "center",
          }}
          justifyContent="space-between"
          sx={{
            width: "100%",
          }}
        >

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={2}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
          >

            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor:
                  "#EEF4FF",
                color:
                  "#1264FF",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexShrink: 0,
              }}
            >
              <CloudRounded
                sx={{
                  fontSize: 28,
                }}
              />
            </Box>


            <Box
              sx={{
                minWidth: 0,
                flex: 1,
              }}
            >

              <Typography
                variant="h6"
                fontWeight={800}
                color="text.primary"
              >
                Weather Intelligence
              </Typography>


              <Typography
                variant="body2"
                color="text.secondary"
                mt={0.5}
                sx={{
                  wordBreak:
                    "break-word",
                  overflowWrap:
                    "break-word",
                }}
              >
                Conditions and outlook
                for{" "}
                <strong>
                  {entityId ||
                    "selected station"}
                </strong>
              </Typography>

            </Box>

          </Stack>

        </Stack>


        {/* VIEW TOGGLE */}

        <Stack
          direction="row"
          spacing={1}
          sx={{
            flexShrink: 0,
            width: {
              xs: "100%",
              sm: "auto",
            },
          }}
        >

          <Button
            onClick={() =>
              setView("current")
            }
            variant={
              view === "current"
                ? "contained"
                : "outlined"
            }
            size="small"
            sx={{
              textTransform:
                "none",
              fontWeight: 700,
              minWidth: {
                xs: "auto",
                sm: 90,
              },
              flex: {
                xs: 1,
                sm: "0 0 auto",
              },
              borderRadius: "8px",
            }}
          >
            Current
          </Button>


          <Button
            onClick={() =>
              setView("7")
            }
            variant={
              view === "7"
                ? "contained"
                : "outlined"
            }
            size="small"
            sx={{
              textTransform:
                "none",
              fontWeight: 700,
              minWidth: {
                xs: "auto",
                sm: 90,
              },
              flex: {
                xs: 1,
                sm: "0 0 auto",
              },
              borderRadius: "8px",
            }}
          >
            7 Days
          </Button>


          <Button
            onClick={() =>
              setView("30")
            }
            variant={
              view === "30"
                ? "contained"
                : "outlined"
            }
            size="small"
            sx={{
              textTransform:
                "none",
              fontWeight: 700,
              minWidth: {
                xs: "auto",
                sm: 90,
              },
              flex: {
                xs: 1,
                sm: "0 0 auto",
              },
              borderRadius: "8px",
            }}
          >
            30 Days
          </Button>

        </Stack>

      </Stack>


      <Box
        sx={{
          borderTop:
            "1px solid",
          borderColor:
            "divider",
          my: 2,
        }}
      />


      {/* CURRENT VIEW */}

      {view === "current" && (
        <CurrentWeather
          current={current}
          temperature={
            currentTemperature
          }
          loading={
            currentLoading
          }
          error={
            currentError
          }
          formatNumber={
            formatNumber
          }
          formatDate={
            formatDate
          }
          getWeatherIcon={
            getWeatherIcon
          }
        />
      )}


      {/* OUTLOOK VIEW */}

      {view !== "current" && (
        <>
          {error ? (
            <Typography
              color="error"
              py={4}
            >
              Unable to load the
              weather outlook.
            </Typography>
          ) : loading ? (
            <Typography
              color="text.secondary"
              py={4}
            >
              Loading weather outlook...
            </Typography>
          ) : (
            <>
              <WeatherOutlookGrid
                records={outlook}
                formatNumber={
                  formatNumber
                }
                formatDate={
                  formatDate
                }
                getDayName={
                  getDayName
                }
                getWeatherIcon={
                  getWeatherIcon
                }
              />

              <WeatherSignals
                signals={signals}
                formatNumber={
                  formatNumber
                }
              />
            </>
          )}
        </>
      )}

    </Box>
  );
};


/* =========================================================
   CURRENT WEATHER
========================================================= */

interface CurrentWeatherProps {
  current:
    | {
        condition: string;
        tempMax:
          | number
          | null;
        tempMin:
          | number
          | null;
        rainfall:
          | number
          | null;
        cloudCover:
          | number
          | null;
        humidity:
          | number
          | null;
        windSpeed:
          | number
          | null;
        uvIndex:
          | number
          | null;
        sunshine:
          | number
          | null;
        date: string;
      }
    | null
    | undefined;

  temperature:
    | number
    | null;

  loading: boolean;

  error: boolean;

  formatNumber: (
    value:
      | number
      | null
      | undefined,
    decimals?: number
  ) => string;

  formatDate: (
    value: string
  ) => string;

  getWeatherIcon: (
    condition:
      | string
      | null
      | undefined
  ) => React.ReactNode;
}


const CurrentWeather = ({
  current,
  temperature,
  loading,
  error,
  formatNumber,
  formatDate,
  getWeatherIcon,
}: CurrentWeatherProps) => {

  if (loading) {
    return (
      <Typography
        color="text.secondary"
      >
        Loading current weather...
      </Typography>
    );
  }


  if (error || !current) {
    return (
      <Typography
        color="text.secondary"
      >
        No current weather data is
        available for this entity.
      </Typography>
    );
  }


  const items = [
    {
      label: "Condition",
      value:
        current.condition,
      icon:
        getWeatherIcon(
          current.condition
        ),
    },
    {
      label: "High / Low",
      value: `${formatNumber(
        current.tempMax
      )} °C / ${formatNumber(
        current.tempMin
      )} °C`,
      icon:
        <ThermostatRounded />,
    },
    {
      label: "Rainfall",
      value: `${formatNumber(
        current.rainfall
      )} mm`,
      icon:
        <OpacityRounded />,
    },
    {
      label: "Cloud Cover",
      value: `${formatNumber(
        current.cloudCover,
        0
      )}%`,
      icon:
        <CloudRounded />,
    },
    {
      label: "Humidity",
      value: `${formatNumber(
        current.humidity,
        0
      )}%`,
      icon:
        <WaterDropRounded />,
    },
    {
      label: "Wind Speed",
      value: `${formatNumber(
        current.windSpeed
      )} km/h`,
      icon:
        <AirRounded />,
    },
    {
      label: "UV Index",
      value:
        formatNumber(
          current.uvIndex
        ),
      icon:
        <WbSunnyRounded />,
    },
    {
      label: "Sunshine",
      value: `${formatNumber(
        current.sunshine
      )} hrs`,
      icon:
        <WbSunnyRounded />,
    },
  ];


  return (
    <Box>

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        spacing={2}
        justifyContent="space-between"
        mb={3}
      >

        <Box>

          <Typography
            variant="h6"
            fontWeight={800}
            color="text.primary"
          >
            Current Conditions
          </Typography>


          <Typography
            color="text.secondary"
          >
            Latest available
            observation:{" "}
            {formatDate(
              current.date
            )}
          </Typography>

        </Box>


        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >

          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor:
                "#EEF4FF",
              borderRadius: 2.5,
              color:
                "text.primary",
              fontWeight: 800,
            }}
          >
            {temperature !== null
              ? `${formatNumber(
                  temperature
                )} °C`
              : "—"}
          </Box>


          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor:
                "#F5F6F8",
              borderRadius: 2.5,
              color:
                "#68758A",
              fontWeight: 700,
            }}
          >
            {current.condition}
          </Box>

        </Stack>

      </Stack>


      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs:
              "repeat(1, minmax(0, 1fr))",
            sm:
              "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >

        {items.map(
          (item) => (
            <WeatherMetric
              key={
                item.label
              }
              label={
                item.label
              }
              value={
                item.value
              }
              icon={
                item.icon
              }
            />
          )
        )}

      </Box>

    </Box>
  );
};


/* =========================================================
   WEATHER OUTLOOK
========================================================= */

interface WeatherOutlookGridProps {
  records:
    WeatherOutlookDay[];

  formatNumber: (
    value:
      | number
      | null
      | undefined,
    decimals?: number
  ) => string;

  formatDate: (
    value: string
  ) => string;

  getDayName: (
    value: string
  ) => string;

  getWeatherIcon: (
    condition:
      | string
      | null
      | undefined
  ) => React.ReactNode;
}


const WeatherOutlookGrid = ({
  records,
  formatNumber,
  formatDate,
  getDayName,
  getWeatherIcon,
}: WeatherOutlookGridProps) => {

  if (
    records.length === 0
  ) {
    return (
      <Typography
        color="text.secondary"
        py={4}
      >
        No weather outlook data is
        available.
      </Typography>
    );
  }


  return (
    <Box>

      <Typography
        variant="h6"
        fontWeight={800}
        color="text.primary"
        mb={0.5}
      >
        Weather Outlook
      </Typography>


      <Typography
        color="text.secondary"
        mb={2.5}
      >
        Daily weather conditions
        available to the
        forecasting pipeline.
      </Typography>


      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs:
              "repeat(1, minmax(0, 1fr))",
            sm:
              "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
          maxHeight: {
            xl: "500px",
          },
          overflowY: {
            xl: "auto",
          },
          overflowX: "hidden",
          pr: {
            xl: 1,
          },
        }}
      >

        {records.map(
          (
            record:
              WeatherOutlookDay
          ) => (

            <Box
              key={
                record.date
              }
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor:
                  "#F7F9FC",
                border:
                  "1px solid #E4E9F0",
                minWidth: 0,
              }}
            >

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={1.5}
              >

                <Box>

                  <Typography
                    fontWeight={800}
                    color="text.primary"
                  >
                    {getDayName(
                      record.date
                    )}
                  </Typography>


                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    {formatDate(
                      record.date
                    )}
                  </Typography>

                </Box>


                <Box
                  sx={{
                    color:
                      "#1264FF",
                  }}
                >
                  {getWeatherIcon(
                    record.condition
                  )}
                </Box>

              </Stack>


              <Typography
                variant="body2"
                fontWeight={700}
                color="#68758A"
                noWrap
                title={
                  record.condition
                }
              >
                {record.condition}
              </Typography>


              <Typography
                variant="h6"
                fontWeight={800}
                color="text.primary"
                mt={1}
              >
                {formatNumber(
                  record.tempMax
                )}°

                <Box
                  component="span"
                  sx={{
                    color:
                      "#8995A7",
                    fontWeight: 600,
                    fontSize:
                      "0.85rem",
                  }}
                >
                  {" "}
                  /{" "}
                  {formatNumber(
                    record.tempMin
                  )}°
                </Box>
              </Typography>


              <Stack
                direction="row"
                spacing={1.5}
                mt={1.5}
                flexWrap="wrap"
                useFlexGap
              >

                <Typography
                  variant="caption"
                  color="#1683D8"
                  fontWeight={700}
                >
                  💧{" "}
                  {formatNumber(
                    record.rainfall
                  )} mm
                </Typography>


                <Typography
                  variant="caption"
                  color="#68758A"
                  fontWeight={700}
                >
                  💨{" "}
                  {formatNumber(
                    record.windSpeed
                  )} km/h
                </Typography>

              </Stack>

            </Box>

          )
        )}

      </Box>

    </Box>
  );
};


/* =========================================================
   WEATHER SIGNALS
========================================================= */

interface WeatherSignalsProps {
  signals:
    | {
        forecastDays: number;
        averageTemperature:
          | number
          | null;
        totalRainfall:
          | number
          | null;
        averageWindSpeed:
          | number
          | null;
        averageUvIndex:
          | number
          | null;
        averageHumidity:
          | number
          | null;
        rainyDays: number;
        hotDays: number;
      }
    | undefined;

  formatNumber: (
    value:
      | number
      | null
      | undefined,
    decimals?: number
  ) => string;
}


const WeatherSignals = ({
  signals,
  formatNumber,
}: WeatherSignalsProps) => {

  if (!signals) {
    return null;
  }


  const items = [
    {
      label:
        "Average temperature",
      value: `${formatNumber(
        signals.averageTemperature
      )} °C`,
      icon:
        <ThermostatRounded />,
      color:
        "#F59E0B",
      bg:
        "#FFF8ED",
    },
    {
      label:
        "Expected rainfall",
      value: `${formatNumber(
        signals.totalRainfall
      )} mm`,
      icon:
        <OpacityRounded />,
      color:
        "#1683D8",
      bg:
        "#F0F7FF",
    },
    {
      label:
        "Average wind",
      value: `${formatNumber(
        signals.averageWindSpeed
      )} km/h`,
      icon:
        <AirRounded />,
      color:
        "#008C7A",
      bg:
        "#F0FAF8",
    },
    {
      label:
        "Average UV",
      value:
        formatNumber(
          signals.averageUvIndex
        ),
      icon:
        <WbSunnyRounded />,
      color:
        "#F59E0B",
      bg:
        "#FFF8ED",
    },
  ];


  return (
    <Box mt={4}>

      <Typography
        variant="h6"
        fontWeight={800}
        color="text.primary"
      >
        Weather Signals
      </Typography>


      <Typography
        color="text.secondary"
        mt={0.5}
        mb={2}
      >
        Aggregated weather
        indicators from the
        selected outlook.
      </Typography>


      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs:
              "repeat(1, minmax(0, 1fr))",
            sm:
              "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >

        {items.map(
          (item) => (

            <Box
              key={
                item.label
              }
              sx={{
                p: 2.5,
                borderRadius: 3,
                bgcolor:
                  item.bg,
                minWidth: 0,
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
                    bgcolor:
                      "rgba(255,255,255,0.8)",
                    color:
                      item.color,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>


                <Typography
                  variant="body2"
                  fontWeight={700}
                  color="#68758A"
                >
                  {
                    item.label
                  }
                </Typography>

              </Stack>


              <Typography
                variant="h5"
                fontWeight={800}
                color="text.primary"
                mt={2}
              >
                {
                  item.value
                }
              </Typography>

            </Box>

          )
        )}

      </Box>


      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs:
              "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
          mt: 1.5,
        }}
      >

        <MiniSignal
          label="Forecast days"
          value={
            signals.forecastDays
          }
        />


        <MiniSignal
          label="Rainy days"
          value={
            signals.rainyDays
          }
        />


        <MiniSignal
          label="Hot days"
          value={
            signals.hotDays
          }
        />


        <MiniSignal
          label="Average humidity"
          value={`${formatNumber(
            signals.averageHumidity,
            0
          )}%`}
        />

      </Box>

    </Box>
  );
};


const MiniSignal = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => {

  return (
    <Box
      sx={{
        p: 2,
        bgcolor:
          "#F7F9FC",
        border:
          "1px solid #E4E9F0",
        borderRadius: 3,
      }}
    >

      <Typography
        variant="caption"
        color="text.secondary"
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


/* =========================================================
   GENERIC WEATHER METRIC
========================================================= */

const WeatherMetric = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => {

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor:
          "#F7F9FC",
        border:
          "1px solid #E4E9F0",
        minWidth: 0,
        overflow: "hidden",
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
            width: 38,
            height: 38,
            borderRadius: 1.5,
            bgcolor:
              "#FFFFFF",
            color:
              "#1264FF",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>


        <Typography
          variant="body2"
          fontWeight={700}
          color="#68758A"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </Typography>

      </Stack>


      <Typography
        variant="h6"
        fontWeight={800}
        color="text.primary"
        mt={1.5}
        sx={{
          overflowWrap:
            "anywhere",
          wordBreak:
            "break-word",
        }}
      >
        {value}
      </Typography>

    </Box>
  );
};


export default WeatherIntelligence;