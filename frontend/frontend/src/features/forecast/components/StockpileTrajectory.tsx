import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";

import {
  WarningAmberRounded,
  TrendingDownRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useForecastContext } from "../../../contexts/ForecastContext";

import {
  ForecastFilters,
  ForecastRecord,
  ForecastEntity,
} from "../types/forecast.types";

import {
  useForecastChart,
  useForecastEntities,
} from "../hooks/useForecast";

interface StockpileTrajectoryProps {
  filters: ForecastFilters;
}

type StockpileUnit = "tons" | "days";

interface StockpileChartPoint {
  date: string;
  stockpile: number;
}

const StockpileTrajectory = ({
  filters,
}: StockpileTrajectoryProps) => {
  const [stockpileUnit, setStockpileUnit] =
    useState<StockpileUnit>("tons");

  /**
   * --------------------------------------------------------
   * FORECAST CONTEXT
   * --------------------------------------------------------
   *
   * The selected station comes from the global ForecastContext.
   * No station names are hardcoded in this component.
   */
  const {
    entityId,
  } = useForecastContext();

  /**
   * --------------------------------------------------------
   * DYNAMIC FORECAST ENTITIES
   * --------------------------------------------------------
   *
   * Stations/entities are retrieved from the backend through
   * the same hook used by ForecastContextBar.
   *
   * This means:
   *
   * Backend entities
   *       ↓
   * useForecastEntities()
   *       ↓
   * ForecastContextBar / this component
   *
   * If a station is added or removed from the backend,
   * the frontend automatically receives the new list.
   */
  const {
    data: forecastEntities,
    isLoading: entitiesLoading,
    isError: entitiesError,
  } = useForecastEntities();

  const forecastStations = useMemo<ForecastEntity[]>(
    () => forecastEntities ?? [],
    [forecastEntities]
  );

  /**
   * --------------------------------------------------------
   * CURRENT STATION
   * --------------------------------------------------------
   *
   * Find the currently selected station dynamically.
   */
  const selectedStation = useMemo(
    () =>
      forecastStations.find(
        (entity) => entity.id === entityId
      ),
    [forecastStations, entityId]
  );

  /**
   * --------------------------------------------------------
   * FORECAST FILTERS
   * --------------------------------------------------------
   *
   * The global ForecastContext determines the station.
   *
   * We explicitly request:
   *   - stockpile data for the stockpile chart
   *   - burn data for Days of Supply calculation
   */
  const stockpileFilters: ForecastFilters = {
    ...filters,
    entityId,
    metric: "stockpile",
  };

  const burnFilters: ForecastFilters = {
    ...filters,
    entityId,
    metric: "burn",
  };

  /**
   * --------------------------------------------------------
   * STOCKPILE DATA
   * --------------------------------------------------------
   */
  const {
    data,
    isLoading,
    isError,
  } = useForecastChart(stockpileFilters);

  /**
   * --------------------------------------------------------
   * BURN DATA
   * --------------------------------------------------------
   *
   * Used to calculate estimated Days of Supply:
   *
   * Days of Supply =
   *
   * projected stockpile
   * -------------------
   * average daily burn
   */
  const {
    data: burnData,
    isLoading: isBurnLoading,
    isError: isBurnError,
  } = useForecastChart(burnFilters);

  /**
   * --------------------------------------------------------
   * AVERAGE DAILY BURN
   * --------------------------------------------------------
   */
  const averageDailyBurn = useMemo(() => {
    const records: ForecastRecord[] =
      burnData ?? [];

    if (records.length === 0) {
      return 0;
    }

    const totalBurn = records.reduce(
      (
        sum: number,
        record: ForecastRecord
      ): number => {
        return (
          sum +
          Number(record.Input || 0)
        );
      },
      0
    );

    return totalBurn / records.length;
  }, [burnData]);

  /**
   * --------------------------------------------------------
   * DAYS OF SUPPLY AVAILABILITY
   * --------------------------------------------------------
   */
  const canShowDaysOfSupply =
    !isBurnLoading &&
    !isBurnError &&
    Number.isFinite(averageDailyBurn) &&
    averageDailyBurn > 0;

  /**
   * --------------------------------------------------------
   * CHART DATA
   * --------------------------------------------------------
   */
  const chartData = useMemo<StockpileChartPoint[]>(
    () => {
      const records: ForecastRecord[] =
        data ?? [];

      return records.map(
        (
          record: ForecastRecord
        ): StockpileChartPoint => {
          const stockpile = Number(
            record.Stockpile || 0
          );

          const value =
            stockpileUnit === "days" &&
            canShowDaysOfSupply
              ? stockpile / averageDailyBurn
              : stockpile;

          return {
            date: record.event_date,
            stockpile: value,
          };
        }
      );
    },
    [
      data,
      stockpileUnit,
      canShowDaysOfSupply,
      averageDailyBurn,
    ]
  );

  /**
   * --------------------------------------------------------
   * SUMMARY VALUES
   * --------------------------------------------------------
   */
  const minStockpile =
    chartData.length > 0
      ? Math.min(
          ...chartData.map(
            (item: StockpileChartPoint) =>
              item.stockpile
          )
        )
      : 0;

  const maxStockpile =
    chartData.length > 0
      ? Math.max(
          ...chartData.map(
            (item: StockpileChartPoint) =>
              item.stockpile
          )
        )
      : 0;

  const negativePeriods =
    chartData.filter(
      (item: StockpileChartPoint) =>
        item.stockpile < 0
    ).length;

  const hasNegativeStockpile =
    minStockpile < 0;

  /**
   * --------------------------------------------------------
   * FORMATTING
   * --------------------------------------------------------
   */
  const formatDate = (
    value: string
  ): string => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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

  const formatNumber = (
    value: number
  ): string => {
    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits:
          stockpileUnit === "days"
            ? 1
            : 0,
      }
    )
      .format(value)
      .replace(/,/g, " ");
  };

  const unitLabel =
    stockpileUnit === "days"
      ? "days"
      : "tonnes";

  /**
   * --------------------------------------------------------
   * RENDER
   * --------------------------------------------------------
   */
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 12,
        p: {
          xs: 2.5,
          sm: 3,
          md: 3.5,
        },
        boxSizing: "border-box",
        overflow: "hidden",
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.4)"
            : "0 10px 30px rgba(16,32,62,0.06)",
      }}
    >
      {/* =====================================================
          HEADER
          ===================================================== */}

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
        flexWrap="wrap"
        useFlexGap
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: "text.primary",
              fontSize: {
                xs: 22,
                md: 25,
              },
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Stockpile Trajectory
          </Typography>

          <Typography
            sx={{
              mt: 0.75,
              color: "text.secondary",
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 560,
            }}
          >
            Projected stockpile movement across
            the selected forecast horizon.
            Switch between tonnes and estimated
            days of supply.
          </Typography>

          {/* Dynamic station label */}
          <Typography
            sx={{
              mt: 1,
              color: "text.secondary",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {entitiesLoading
              ? "Loading station..."
              : selectedStation
              ? selectedStation.label
              : entityId || "No station selected"}
          </Typography>
        </Box>

        {/* =================================================
            UNIT SELECTOR
            ================================================= */}

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{
            flexShrink: 0,
            p: 0.5,
            borderRadius: 2,
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            sx={{
              px: 1,
              color: "text.secondary",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Stockpile unit
          </Typography>

          <Button
            size="small"
            variant={
              stockpileUnit === "tons"
                ? "contained"
                : "text"
            }
            onClick={() =>
              setStockpileUnit("tons")
            }
            sx={{
              minWidth: 72,
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 800,
            }}
          >
            Tonnes
          </Button>

          <Button
            size="small"
            variant={
              stockpileUnit === "days"
                ? "contained"
                : "text"
            }
            disabled={!canShowDaysOfSupply}
            onClick={() =>
              setStockpileUnit("days")
            }
            sx={{
              minWidth: 116,
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 800,
            }}
          >
            Days of Supply
          </Button>
        </Stack>

        {/* =================================================
            RISK WARNING
            ================================================= */}

        {hasNegativeStockpile && (
          <Box
            sx={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              backgroundColor:
                "rgba(245, 124, 0, 0.08)",
              border:
                "1px solid rgba(245, 124, 0, 0.14)",
              maxWidth: {
                xs: "100%",
                sm: 270,
              },
            }}
          >
            <WarningAmberRounded
              sx={{
                color: "#F57C00",
                fontSize: 20,
                flexShrink: 0,
              }}
            />

            <Box>
              <Typography
                sx={{
                  color: "#C45F00",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.3,
                }}
              >
                Negative stockpile
              </Typography>

              <Typography
                sx={{
                  color: "#C45F00",
                  fontSize: 11,
                  mt: 0.25,
                  lineHeight: 1.3,
                }}
              >
                {negativePeriods} projected{" "}
                {negativePeriods === 1
                  ? "period"
                  : "periods"}{" "}
                below zero
              </Typography>
            </Box>
          </Box>
        )}
      </Stack>

      {/* =====================================================
          DAYS OF SUPPLY EXPLANATION
          ===================================================== */}

      {stockpileUnit === "days" && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            mt: 1.5,
          }}
        >
          Days of Supply is calculated from
          projected stockpile divided by the
          selected station&apos;s average daily
          Burn.
        </Typography>
      )}

      {/* =====================================================
          CHART
          ===================================================== */}

      {!isLoading &&
        !isError &&
        chartData.length > 0 && (
          <Box
            sx={{
              width: "100%",
              height: {
                xs: 300,
                sm: 340,
                md: 370,
              },
              mt: {
                xs: 2.5,
                md: 3,
              },
              minWidth: 0,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={chartData}
                margin={{
                  top: 12,
                  right: 8,
                  left: -10,
                  bottom: 8,
                }}
              >
                <defs>
                  <linearGradient
                    id="stockpileGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#1264FF"
                      stopOpacity={0.18}
                    />

                    <stop
                      offset="100%"
                      stopColor="#1264FF"
                      stopOpacity={0.015}
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
                  tickFormatter={formatDate}
                  tick={{
                    fill: "#7A869A",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={35}
                />

                <YAxis
                  tick={{
                    fill: "#7A869A",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                  tickFormatter={(value: number) =>
                    formatNumber(value)
                  }
                />

                <ReferenceLine
                  y={0}
                  stroke="#98A2B3"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                />

                <Tooltip
                  formatter={(value: number) => [
                    `${formatNumber(
                      value
                    )} ${unitLabel}`,
                    "Stockpile",
                  ]}
                  labelFormatter={(label) =>
                    formatDate(String(label))
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border:
                      "1px solid #E3E8EF",
                    boxShadow:
                      "0 12px 30px rgba(23,43,77,0.10)",
                    padding: "10px 14px",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="stockpile"
                  stroke="#1264FF"
                  strokeWidth={3}
                  fill="url(#stockpileGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2,
                    fill: "#FFFFFF",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      {!isLoading &&
        !isError &&
        chartData.length > 0 && (
          <Box
            sx={{
              mt: 2,
              pt: 2.5,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: {
                xs: 2,
                sm: 1,
              },
            }}
          >
            {/* Lowest */}

            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
              >
                <TrendingDownRounded
                  sx={{
                    color:
                      minStockpile < 0
                        ? "#D32F2F"
                        : "text.secondary",
                    fontSize: 18,
                  }}
                />

                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Lowest projected
                </Typography>
              </Stack>

              <Typography
                sx={{
                  mt: 0.5,
                  color:
                    minStockpile < 0
                      ? "#D32F2F"
                      : "text.primary",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {formatNumber(minStockpile)}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {unitLabel}
                </Box>
              </Typography>
            </Box>

            {/* Highest */}

            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
              >
                <TrendingUpRounded
                  sx={{
                    color: "#2E7D32",
                    fontSize: 18,
                  }}
                />

                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Highest projected
                </Typography>
              </Stack>

              <Typography
                sx={{
                  mt: 0.5,
                  color: "text.primary",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {formatNumber(maxStockpile)}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {unitLabel}
                </Box>
              </Typography>
            </Box>

            {/* Risk */}

            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
              >
                <WarningAmberRounded
                  sx={{
                    color:
                      negativePeriods > 0
                        ? "#F57C00"
                        : "#2E7D32",
                    fontSize: 18,
                  }}
                />

                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Stockpile risk
                </Typography>
              </Stack>

              <Typography
                sx={{
                  mt: 0.5,
                  color:
                    negativePeriods > 0
                      ? "#F57C00"
                      : "#2E7D32",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                {negativePeriods}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  below zero
                </Box>
              </Typography>
            </Box>
          </Box>
        )}

      {/* =====================================================
          LOADING
          ===================================================== */}

      {isLoading && (
        <Box
          sx={{
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">
            Loading stockpile trajectory...
          </Typography>
        </Box>
      )}

      {/* =====================================================
          ERROR
          ===================================================== */}

      {isError && (
        <Box
          sx={{
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="error">
            Unable to load stockpile data.
          </Typography>
        </Box>
      )}

      {/* =====================================================
          ENTITY ERROR
          ===================================================== */}

      {entitiesError && (
        <Typography
          variant="caption"
          color="error"
          sx={{
            display: "block",
            mt: 1,
          }}
        >
          Unable to load station information.
        </Typography>
      )}

      {/* =====================================================
          EMPTY
          ===================================================== */}

      {!isLoading &&
        !isError &&
        chartData.length === 0 && (
          <Box
            sx={{
              height: 360,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              No stockpile forecast data
              available for the selected
              context.
            </Typography>
          </Box>
        )}
    </Box>
  );
};

export default StockpileTrajectory;