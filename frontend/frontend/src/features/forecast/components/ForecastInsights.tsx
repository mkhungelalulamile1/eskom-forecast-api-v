import {
  useEffect,
} from "react";

import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  AutoGraphRounded,
  TrendingUpRounded,
  WarningAmberRounded,
  ErrorOutlineRounded,
} from "@mui/icons-material";

import { useForecastContext } from "../../../contexts/ForecastContext";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastChart,
} from "../hooks/useForecast";


// IMPORTANT:
// Keep this import if your project already has a hook that
// dynamically loads the available stations/entities.
//
// Replace the path/name ONLY if your existing project uses
// a different entity hook.
import {
  useForecastEntities,
} from "../hooks/useForecast";


interface ForecastInsightsProps {
  filters: ForecastFilters;
}


interface InsightCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  backgroundColor: string;
  valueColor?: string;
}


interface ForecastEntity {
  id: string;
  label?: string;
  name?: string;
}


const InsightCard = ({
  title,
  value,
  description,
  icon,
  backgroundColor,
  valueColor = "text.primary",
}: InsightCardProps) => {
  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        px: {
          xs: 1.75,
          sm: 2,
        },
        py: {
          xs: 1.75,
          sm: 2,
        },
        borderRadius: 2.5,
        backgroundColor,
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="flex-start"
        sx={{
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>

        <Typography
          sx={{
            minWidth: 0,
            color: "text.secondary",
            fontSize: {
              xs: 10,
              sm: 10.5,
            },
            lineHeight: 1.35,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.035em",
            whiteSpace: "normal",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </Typography>
      </Stack>

      <Typography
        sx={{
          mt: 1.25,
          color: valueColor,
          fontSize: {
            xs: 24,
            sm: 26,
          },
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>

      <Typography
        sx={{
          mt: 0.75,
          color: "text.secondary",
          fontSize: {
            xs: 11,
            sm: 11.5,
          },
          lineHeight: 1.45,
          minHeight: 32,
        }}
      >
        {description}
      </Typography>
    </Box>
  );
};


const ForecastInsights = ({
  filters,
}: ForecastInsightsProps) => {

  /**
   * --------------------------------------------------------
   * FORECAST CONTEXT
   * --------------------------------------------------------
   */

  const {
    horizon,
    metric,
    entityId,
    setEntityId,
    scenario,
  } = useForecastContext();


  /**
   * --------------------------------------------------------
   * DYNAMIC ENTITIES
   * --------------------------------------------------------
   *
   * Stations are NOT hardcoded here.
   *
   * The entity list comes from the backend through
   * useForecastEntities().
   */

  const {
    data: entities = [],
  } = useForecastEntities();


  /**
   * --------------------------------------------------------
   * ENSURE CURRENT ENTITY EXISTS
   * --------------------------------------------------------
   *
   * This is a side effect, so it must run inside useEffect.
   */

  useEffect(() => {
    if (entities.length === 0) {
      return;
    }

    const currentEntityExists =
      entities.some(
        (entity: ForecastEntity) =>
          entity.id === entityId
      );

    if (!currentEntityExists) {
      setEntityId(entities[0].id);
    }
  }, [
    entities,
    entityId,
    setEntityId,
  ]);


  /**
   * --------------------------------------------------------
   * FORECAST DATA
   * --------------------------------------------------------
   */

  const {
    data,
    isLoading,
    isError,
  } = useForecastChart(
    filters
  );


  const records: ForecastRecord[] =
    data ?? [];


  /**
   * --------------------------------------------------------
   * BURN VALUES
   * --------------------------------------------------------
   */

  const burnValues: number[] =
    records
      .map(
        (
          record: ForecastRecord
        ) =>
          Number(
            record.Input
          )
      )
      .filter(
        (
          value: number
        ) =>
          Number.isFinite(value)
      );


  /**
   * --------------------------------------------------------
   * STOCKPILE VALUES
   * --------------------------------------------------------
   */

  const stockpileValues: number[] =
    records
      .map(
        (
          record: ForecastRecord
        ) =>
          Number(
            record.Stockpile
          )
      )
      .filter(
        (
          value: number
        ) =>
          Number.isFinite(value)
      );


  /**
   * --------------------------------------------------------
   * AVERAGE BURN
   * --------------------------------------------------------
   */

  const averageBurn =
    burnValues.length > 0
      ? burnValues.reduce(
        (
          sum: number,
          value: number
        ) =>
          sum + value,
        0
      ) /
      burnValues.length
      : 0;


  /**
   * --------------------------------------------------------
   * PEAK BURN
   * --------------------------------------------------------
   */

  const peakBurn =
    burnValues.length > 0
      ? Math.max(
        ...burnValues
      )
      : 0;


  /**
   * --------------------------------------------------------
   * LOWEST STOCKPILE
   * --------------------------------------------------------
   */

  const lowestStockpile =
    stockpileValues.length > 0
      ? Math.min(
        ...stockpileValues
      )
      : 0;


  /**
   * --------------------------------------------------------
   * NEGATIVE PERIODS
   * --------------------------------------------------------
   */

  const negativePeriods =
    stockpileValues.filter(
      (
        value: number
      ) =>
        value < 0
    ).length;


  /**
   * --------------------------------------------------------
   * PEAK VS AVERAGE
   * --------------------------------------------------------
   */

  const peakVsAverage =
    averageBurn !== 0
      ? (
        (
          peakBurn -
          averageBurn
        ) /
        Math.abs(
          averageBurn
        )
      ) *
      100
      : 0;


  /**
   * --------------------------------------------------------
   * NUMBER FORMATTER
   * --------------------------------------------------------
   */

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


  /**
   * --------------------------------------------------------
   * METRIC UNIT
   * --------------------------------------------------------
   */

  const metricUnit =
    horizon === "daily"
      ? "t/day"
      : "tonnes";


  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        bgcolor:
          "background.paper",
        border:
          "1px solid",
        borderColor:
          "divider",
        borderRadius: 12,
        p: {
          xs: 2.5,
          sm: 3,
          md: 3.5,
        },
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.4)"
            : "0 10px 30px rgba(16,32,62,0.06)",
      }}
    >

      {/* ------------------------------------------------ */}
      {/* HEADER                                           */}
      {/* ------------------------------------------------ */}

      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
      >

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >

          <Box
            sx={{
              width: {
                xs: 44,
                sm: 48,
              },
              height: {
                xs: 44,
                sm: 48,
              },
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2.5,
              backgroundColor:
                "#EEF4FF",
            }}
          >
            <AutoGraphRounded
              sx={{
                color:
                  "#1264FF",
                fontSize: {
                  xs: 24,
                  sm: 27,
                },
              }}
            />
          </Box>


          <Box
            sx={{
              minWidth: 0,
            }}
          >

            <Typography
              sx={{
                color:
                  "text.primary",
                fontSize: {
                  xs: 22,
                  md: 25,
                },
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              Forecast Insights
            </Typography>


            <Typography
              sx={{
                mt: 0.5,
                color:
                  "text.secondary",
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              Key signals from the
              current forecast.
            </Typography>

          </Box>

        </Stack>

      </Stack>


      {/* ------------------------------------------------ */}
      {/* CONTENT                                          */}
      {/* ------------------------------------------------ */}

      {isLoading && (
        <Box
          sx={{
            flex: 1,
            minHeight: 360,
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
            Analysing forecast...
          </Typography>
        </Box>
      )}


      {isError && (
        <Box
          sx={{
            flex: 1,
            minHeight: 360,
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >
          <Typography
            color="error"
          >
            Unable to load forecast
            insights.
          </Typography>
        </Box>
      )}


      {!isLoading &&
        !isError && (
          <>

            {/* ---------------------------------------- */}
            {/* INSIGHT GRID                             */}
            {/* ---------------------------------------- */}

            <Box
              sx={{
                mt: {
                  xs: 2.5,
                  md: 3,
                },
                width: "100%",
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm:
                    "repeat(2, minmax(0, 1fr))",
                },
                gap: 1.5,
                minWidth: 0,
              }}
            >

              {/* PEAK BURN */}

              <InsightCard
                title="Peak Burn"
                value={
                  formatNumber(
                    peakBurn
                  )
                }
                description={`Highest projected ${metricUnit}`}
                icon={
                  <TrendingUpRounded
                    sx={{
                      color:
                        "#1264FF",
                      fontSize: 21,
                    }}
                  />
                }
                backgroundColor="#F6F8FC"
              />


              {/* PEAK VS AVERAGE */}

              <InsightCard
                title="Peak vs Average"
                value={`${
                  peakVsAverage >=
                    0
                    ? "+"
                    : ""
                }${peakVsAverage.toFixed(
                  1
                )}%`}
                description="Above average forecast"
                icon={
                  <TrendingUpRounded
                    sx={{
                      color:
                        "#F57C00",
                      fontSize: 21,
                    }}
                  />
                }
                backgroundColor="#F6F8FC"
              />


              {/* LOWEST STOCKPILE */}

              <InsightCard
                title="Lowest Stockpile"
                value={
                  formatNumber(
                    lowestStockpile
                  )
                }
                description="Minimum projected stockpile"
                icon={
                  <ErrorOutlineRounded
                    sx={{
                      color:
                        lowestStockpile <
                          0
                          ? "#D32F2F"
                          : "#2E7D32",
                      fontSize: 21,
                    }}
                  />
                }
                backgroundColor={
                  lowestStockpile <
                    0
                    ? "#FFF6F6"
                    : "#F6FAF7"
                }
                valueColor={
                  lowestStockpile <
                    0
                    ? "#D32F2F"
                    : "text.primary"
                }
              />


              {/* STOCKPILE RISK */}

              <InsightCard
                title="Stockpile Risk"
                value={
                  String(
                    negativePeriods
                  )
                }
                description={
                  negativePeriods ===
                    1
                    ? "Projected period below zero"
                    : "Projected periods below zero"
                }
                icon={
                  <WarningAmberRounded
                    sx={{
                      color:
                        negativePeriods >
                          0
                          ? "#F57C00"
                          : "#2E7D32",
                      fontSize: 21,
                    }}
                  />
                }
                backgroundColor={
                  negativePeriods >
                    0
                    ? "#FFF8F0"
                    : "#F6FAF7"
                }
                valueColor={
                  negativePeriods >
                    0
                    ? "#F57C00"
                    : "#2E7D32"
                }
              />

            </Box>


            {/* ---------------------------------------- */}
            {/* DIVIDER                                   */}
            {/* ---------------------------------------- */}

            <Box
              sx={{
                width: "100%",
                borderTop:
                  "1px solid",
                borderColor:
                  "divider",
                mt: {
                  xs: 2.5,
                  md: 3,
                },
              }}
            />


            {/* ---------------------------------------- */}
            {/* NARRATIVE                                 */}
            {/* ---------------------------------------- */}

            <Box
              sx={{
                mt: 2.5,
              }}
            >

              <Typography
                sx={{
                  color:
                    "text.secondary",
                  fontSize: {
                    xs: 13,
                    sm: 14,
                  },
                  lineHeight: 1.7,
                }}
              >
                The forecast currently
                projects an average burn
                of{" "}
                <Box
                  component="span"
                  sx={{
                    color:
                      "text.primary",
                    fontWeight: 800,
                  }}
                >
                  {formatNumber(
                    averageBurn
                  )}{" "}
                  {metricUnit}
                </Box>
                . The highest projected
                burn is{" "}
                <Box
                  component="span"
                  sx={{
                    color:
                      "text.primary",
                    fontWeight: 800,
                  }}
                >
                  {formatNumber(
                    peakBurn
                  )}{" "}
                  {metricUnit}
                </Box>
                .
              </Typography>


              {lowestStockpile <
                0 && (
                <Typography
                  sx={{
                    mt: 1,
                    color:
                      "text.secondary",
                    fontSize: {
                      xs: 13,
                      sm: 14,
                    },
                    lineHeight: 1.7,
                  }}
                >
                  Negative stockpile
                  levels are projected
                  within the selected
                  horizon and should be
                  reviewed for operational
                  planning.
                </Typography>
              )}

            </Box>


            {/* ---------------------------------------- */}
            {/* OPERATIONAL ALERT                         */}
            {/* ---------------------------------------- */}

            <Box
              sx={{
                mt: 2.5,
                p: 1.5,
                borderRadius: 2,
                backgroundColor:
                  negativePeriods >
                    0
                    ? "#FFF8F0"
                    : "#F2FAF4",
                border:
                  "1px solid",
                borderColor:
                  negativePeriods >
                    0
                    ? "rgba(245,124,0,0.18)"
                    : "rgba(46,125,50,0.15)",
              }}
            >

              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
              >

                <WarningAmberRounded
                  sx={{
                    flexShrink: 0,
                    color:
                      negativePeriods >
                        0
                        ? "#F57C00"
                        : "#2E7D32",
                    fontSize: 19,
                    mt: 0.1,
                  }}
                />

                <Box>

                  <Typography
                    sx={{
                      color:
                        negativePeriods >
                          0
                          ? "#C45F00"
                          : "#2E7D32",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {negativePeriods >
                      0
                      ? "Operational attention required"
                      : "Forecast operating normally"}
                  </Typography>


                  <Typography
                    sx={{
                      mt: 0.25,
                      color:
                        "text.secondary",
                      fontSize: 11.5,
                      lineHeight: 1.45,
                    }}
                  >
                    {negativePeriods >
                      0
                      ? `${negativePeriods} forecast ${
                        negativePeriods ===
                          1
                          ? "period"
                          : "periods"
                      } fall below zero stockpile.`
                      : "No negative stockpile periods are currently projected."}
                  </Typography>

                </Box>

              </Stack>

            </Box>

          </>
        )}

    </Box>
  );
};


export default ForecastInsights;