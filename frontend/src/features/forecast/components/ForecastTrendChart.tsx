import { useState } from "react";

import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  TrendingUpRounded,
  CalendarMonthRounded,
} from "@mui/icons-material";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartType,
  ChartTypeToggle,
} from "../../../components/common/CardFilters";

import { useForecastContext } from "../../../contexts/ForecastContext";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastChart,
} from "../hooks/useForecast";

interface ForecastTrendChartProps {
  filters: ForecastFilters;
}

interface ForecastChartPoint {
  date: string;
  burn: number;
  supply: number;
}

interface ForecastTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    dataKey?: string;
    color?: string;
  }>;
  label?: string;
}

const ForecastTooltip = ({
  active,
  payload,
  label,
}: ForecastTooltipProps) => {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  const formatValue = (
    value: number
  ): string => {
    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 1,
      }
    )
      .format(value)
      .replace(/,/g, " ");
  };

  const formatDate = (
    value: string
  ): string => {
    const date = new Date(value);

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
        year: "numeric",
      }
    );
  };

  return (
    <Box
      sx={{
        bgcolor: "#FFFFFF",
        border:
          "1px solid #E1E6EF",
        borderRadius: 2.5,
        px: 2,
        py: 1.5,
        boxShadow:
          "0 8px 28px rgba(23,43,77,0.12)",
        minWidth: 190,
      }}
    >
      <Typography
        sx={{
          color: "text.primary",
          fontSize: 14,
          fontWeight: 800,
          mb: 1,
        }}
      >
        {label
          ? formatDate(label)
          : ""}
      </Typography>

      <Stack spacing={0.75}>
        {payload.map(
          (
            item,
            index
          ) => {
            const value =
              Number(
                item.value ?? 0
              );

            const isBurn =
              item.dataKey ===
              "burn";

            return (
              <Stack
                key={`${item.dataKey}-${index}`}
                direction="row"
                justifyContent="space-between"
                spacing={2}
                alignItems="center"
              >
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius:
                        "50%",
                      bgcolor:
                        isBurn
                          ? "#1264FF"
                          : "#2E7D32",
                    }}
                  />

                  <Typography
                    sx={{
                      color:
                        "text.secondary",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {isBurn
                      ? "Burn"
                      : "Supply"}
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    color:
                      isBurn
                        ? "#1264FF"
                        : "#2E7D32",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {formatValue(
                    value
                  )}{" "}
                  t/day
                </Typography>
              </Stack>
            );
          }
        )}
      </Stack>
    </Box>
  );
};

const ForecastTrendChart = ({
  filters,
}: ForecastTrendChartProps) => {
  const { entityId } = useForecastContext();

  /* Chart type toggle (line/area/bar) */
  const [chartType, setChartType] = useState<ChartType>("line");

  const effectiveFilters: ForecastFilters = {
    ...filters,
    entityId: entityId,
  };

  const {
    data,
    isLoading,
    isError,
  } = useForecastChart(effectiveFilters);

  /*
   * =========================================================
   * FORMATTERS
   * =========================================================
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
      .replace(/,/g, " ");
  };

  const formatDate = (
    value: string
  ): string => {
    const date = new Date(value);

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

  /*
   * =========================================================
   * CHART DATA
   * =========================================================
   *
   * Burn:
   *   ForecastRecord.Input
   *
   * Replenishment / Supply:
   *   ForecastRecord.Replenishment
   *
   * Stockpile is deliberately NOT included here.
   */

  const records: ForecastRecord[] =
    data ?? [];

  const chartData: ForecastChartPoint[] =
    records.map(
      (
        record: ForecastRecord
      ): ForecastChartPoint => ({
        date:
          record.event_date,

        burn:
          Number(
            record.Input ?? 0
          ),

        supply:
          Number(
            record.Replenishment ??
            0
          ),
      })
    );

  /*
   * =========================================================
   * BURN STATISTICS
   * =========================================================
   *
   * The headline KPIs describe Burn because this is the
   * main forecast shown by this component.
   */

  const burnValues: number[] =
    chartData.map(
      (
        point: ForecastChartPoint
      ) => point.burn
    );

  const supplyValues: number[] =
    chartData.map(
      (
        point: ForecastChartPoint
      ) => point.supply
    );

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

  const peakBurn =
    burnValues.length > 0
      ? Math.max(
        ...burnValues
      )
      : 0;

  const lowestBurn =
    burnValues.length > 0
      ? Math.min(
        ...burnValues
      )
      : 0;

  const firstBurn =
    burnValues.length > 0
      ? burnValues[0]
      : 0;

  const lastBurn =
    burnValues.length > 0
      ? burnValues[
      burnValues.length - 1
      ]
      : 0;

  const trendPercentage =
    firstBurn !== 0
      ? ((lastBurn - firstBurn) /
        Math.abs(firstBurn)) *
      100
      : 0;

  const isIncreasing =
    lastBurn >= firstBurn;

  const peakBurnIndex =
    burnValues.length > 0
      ? burnValues.indexOf(
        peakBurn
      )
      : -1;

  const peakBurnDate =
    peakBurnIndex >= 0
      ? chartData[
        peakBurnIndex
      ]?.date
      : undefined;

  /*
   * =========================================================
   * SUPPLY STATISTICS
   * =========================================================
   */

  const averageSupply =
    supplyValues.length > 0
      ? supplyValues.reduce(
        (
          sum: number,
          value: number
        ) =>
          sum + value,
        0
      ) /
      supplyValues.length
      : 0;

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (isLoading) {
    return (
      <Box
        sx={{
          bgcolor: "#FFFFFF",
          border:
            "1px solid #E3E8EF",
          borderRadius: 4,
          p: {
            xs: 2.5,
            md: 3.5,
          },
          minHeight: 520,
          boxShadow:
            "0 4px 18px rgba(23,43,77,0.04)",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor:
                "rgba(18,100,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
            }}
          >
            <TrendingUpRounded
              sx={{
                color:
                  "#1264FF",
              }}
            />
          </Box>

          <Box>
            <Typography
              sx={{
                fontSize: 23,
                fontWeight: 800,
                color:
                  "text.primary",
              }}
            >
              Forecast Trend
            </Typography>

            <Typography
              sx={{
                color:
                  "text.secondary",
                fontSize: 13.5,
                mt: 0.5,
              }}
            >
              Loading forecast
              data...
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }

  /*
   * =========================================================
   * ERROR / EMPTY
   * =========================================================
   */

  if (
    isError ||
    chartData.length === 0
  ) {
    return (
      <Box
        sx={{
          bgcolor: "#FFFFFF",
          border:
            "1px solid #E3E8EF",
          borderRadius: 4,
          minHeight: 520,
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          p: 4,
          boxShadow:
            "0 4px 18px rgba(23,43,77,0.04)",
        }}
      >
        <Stack
          alignItems="center"
          spacing={1}
          textAlign="center"
        >
          <TrendingUpRounded
            sx={{
              fontSize: 42,
              color:
                "#9AA5B5",
            }}
          />

          <Typography
            sx={{
              color:
                "text.primary",
              fontWeight: 700,
            }}
          >
            Forecast data
            unavailable
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 13,
              maxWidth: 360,
            }}
          >
            There is no forecast
            data available for
            the selected context.
          </Typography>
        </Stack>
      </Box>
    );
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 12,
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

      <Box
        sx={{
          px: {
            xs: 2.5,
            md: 4,
          },
          pt: {
            xs: 2.5,
            md: 3.5,
          },
          pb: 2,
        }}
      >
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
        >
          {/* TITLE */}

          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                bgcolor:
                  "rgba(18,100,255,0.08)",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexShrink: 0,
              }}
            >
              <TrendingUpRounded
                sx={{
                  color:
                    "#1264FF",
                  fontSize: 25,
                }}
              />
            </Box>

            <Box>
              <Typography
                sx={{
                  color:
                    "text.primary",
                  fontSize: {
                    xs: 13,
                    md: 16,
                  },
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing:
                    "-0.02em",
                }}
              >
                {filters.horizon ===
                  "daily"
                  ? "Tactical Daily"
                  : "Strategic Monthly"}{" "}
                Burn Forecast
              </Typography>

              <Typography
                sx={{
                  color:
                    "text.secondary",
                  fontSize: 13.5,
                  mt: 0.5,
                }}
              >
                Projected coal burn
                and supply
                across the selected
                forecast horizon.
              </Typography>
            </Box>
          </Stack>

          {/* CONTEXT BADGES */}

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
          >
            <Box
              sx={{
                display: "flex",
                alignItems:
                  "center",
                gap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                bgcolor:
                  "rgba(18,100,255,0.06)",
                border:
                  "1px solid rgba(18,100,255,0.10)",
              }}
            >
              <CalendarMonthRounded
                sx={{
                  fontSize: 17,
                  color:
                    "#1264FF",
                }}
              />

              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    "text.primary",
                }}
              >
                {filters.horizon ===
                  "daily"
                  ? `${chartData.length} Days`
                  : `${chartData.length} Months`}
              </Typography>
            </Box>

            <Box
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                bgcolor:
                  "rgba(46,125,50,0.07)",
                border:
                  "1px solid rgba(46,125,50,0.10)",
              }}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    "#2E7D32",
                }}
              >
                Forecast Generated
              </Typography>
            </Box>

            {/* Chart view toggle */}
            <ChartTypeToggle value={chartType} onChange={setChartType} />
          </Stack>
        </Stack>
      </Box>

      {/* =====================================================
          KPI STRIP
          ===================================================== */}

      <Box
        sx={{
          px: {
            xs: 2.5,
            md: 4,
          },
          pb: 2.5,
          display: "grid",
          gridTemplateColumns: {
            xs:
              "1fr 1fr",
            md:
              "repeat(4, 1fr)",
          },
          gap: {
            xs: 1,
            md: 1.5,
          },
        }}
      >
        {/* AVERAGE BURN */}

        <Box
          sx={{
            px: 1.75,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor:
              "#F7F9FC",
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 10.5,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.06em",
            }}
          >
            Average Burn
          </Typography>

          <Typography
            sx={{
              color:
                "text.primary",
              fontSize: 22,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {formatNumber(
              averageBurn
            )}
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
            }}
          >
            t/day
          </Typography>
        </Box>

        {/* PEAK BURN */}

        <Box
          sx={{
            px: 1.75,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor:
              "#F7F9FC",
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 10.5,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.06em",
            }}
          >
            Peak Burn
          </Typography>

          <Typography
            sx={{
              color:
                "#1264FF",
              fontSize: 22,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {formatNumber(
              peakBurn
            )}
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
            }}
          >
            t/day
          </Typography>
        </Box>

        {/* TREND */}

        <Box
          sx={{
            px: 1.75,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor:
              "#F7F9FC",
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 10.5,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.06em",
            }}
          >
            Horizon Trend
          </Typography>

          <Typography
            sx={{
              color:
                isIncreasing
                  ? "#2E7D32"
                  : "#D32F2F",
              fontSize: 22,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {trendPercentage >=
              0
              ? "+"
              : ""}
            {trendPercentage.toFixed(
              1
            )}
            %
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
            }}
          >
            {isIncreasing
              ? "increase"
              : "decrease"}
          </Typography>
        </Box>

        {/* PERIODS */}

        <Box
          sx={{
            px: 1.75,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor:
              "#F7F9FC",
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 10.5,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.06em",
            }}
          >
            Periods
          </Typography>

          <Typography
            sx={{
              color:
                "text.primary",
              fontSize: 22,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {chartData.length}
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
            }}
          >
            forecast points
          </Typography>
        </Box>
      </Box>

      {/* =====================================================
          LEGEND
          ===================================================== */}

      <Stack
        direction="row"
        spacing={3}
        justifyContent="center"
        alignItems="center"
        sx={{
          pb: 1.5,
          px: 2,
        }}
      >
        {/* BURN */}

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius:
                "50%",
              bgcolor:
                "#1264FF",
            }}
          />

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Burn
          </Typography>
        </Stack>

        {/* REPLENISHMENT */}

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius:
                "50%",
              bgcolor:
                "#2E7D32",
            }}
          />

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Supply
          </Typography>
        </Stack>
      </Stack>

      {/* =====================================================
          CHART
          ===================================================== */}

      <Box
        sx={{
          px: {
            xs: 1.5,
            md: 3.5,
          },
          pb: 1,
          height: {
            xs: 400,
            md: 500,
          },
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <ComposedChart
            data={chartData}
            margin={{
              top: 10,
              right: 12,
              left: 8,
              bottom: 8,
            }}
          >
            <defs>
              <linearGradient
                id="burnForecastGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#1264FF"
                  stopOpacity={0.16}
                />

                <stop
                  offset="100%"
                  stopColor="#1264FF"
                  stopOpacity={0}
                />
              </linearGradient>

              <linearGradient
                id="supplyForecastGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#2E7D32"
                  stopOpacity={0.16}
                />

                <stop
                  offset="100%"
                  stopColor="#2E7D32"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 7"
              stroke="#DDE3EC"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={
                formatDate
              }
              tick={{
                fill:
                  "#7A869A",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />

            <YAxis
              tick={{
                fill:
                  "#7A869A",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(
                value: number
              ) =>
                formatNumber(
                  value
                )
              }
            />

            <Tooltip
              content={
                <ForecastTooltip />
              }
              cursor={{
                stroke:
                  "#1264FF",
                strokeDasharray:
                  "4 4",
              }}
            />

            {/* AVERAGE BURN */}

            <ReferenceLine
              y={averageBurn}
              stroke="#93A4BC"
              strokeDasharray="6 6"
              label={{
                value: `Average ${formatNumber(
                  averageBurn
                )}`,
                position:
                  "insideRight",
                fill:
                  "#7A869A",
                fontSize: 12,
              }}
            />

            {/* =================================================
                CHART SERIES  (view type selectable — NEW)
                Line / Area / Bar via the card's ChartType toggle
                ================================================= */}

            {chartType === "area" && (
              <>
                <Area
                  type="monotone"
                  dataKey="burn"
                  stroke="#1264FF"
                  strokeWidth={2.5}
                  fill="url(#burnForecastGradient)"
                  activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2, fill: "#1264FF" }}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="supply"
                  stroke="#2E7D32"
                  strokeWidth={2.5}
                  fill="url(#supplyForecastGradient)"
                  activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2, fill: "#2E7D32" }}
                  dot={false}
                />
              </>
            )}

            {chartType === "bar" && (
              <>
                <Bar dataKey="burn" name="Burn" fill="#1264FF" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                <Bar dataKey="supply" name="Replenishment" fill="#2E7D32" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
              </>
            )}

            {chartType === "line" && (
              <>
                <Line
                  type="monotone"
                  dataKey="burn"
                  name="Burn"
                  stroke="#1264FF"
                  strokeWidth={3.5}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2, fill: "#1264FF" }}
                />
                <Line
                  type="monotone"
                  dataKey="supply"
                  name="Replenishment"
                  stroke="#2E7D32"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2, fill: "#2E7D32" }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>

      {/* =====================================================
          FOOTER
          ===================================================== */}

      <Box
        sx={{
          mx: {
            xs: 2.5,
            md: 4,
          },
          borderTop:
            "1px solid #E3E8EF",
          py: 2.5,
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: {
            xs: "flex-start",
            md: "center",
          },
          flexDirection: {
            xs: "column",
            md: "row",
          },
          gap: 2,
        }}
      >
        {/* LOWEST */}

        <Box>
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            Lowest Projected
          </Typography>

          <Typography
            sx={{
              color:
                "text.primary",
              fontSize: 20,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {formatNumber(
              lowestBurn
            )}{" "}
            t/day
          </Typography>
        </Box>

        {/* SUPPLY SUMMARY */}

        <Box
          sx={{
            textAlign: {
              xs: "left",
              md: "center",
            },
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            Avg Supply
          </Typography>

          <Typography
            sx={{
              color:
                "#2E7D32",
              fontSize: 20,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {formatNumber(
              averageSupply
            )}{" "}
            t/day
          </Typography>
        </Box>

        {/* PEAK */}

        <Box
          sx={{
            textAlign: {
              xs: "left",
              md: "right",
            },
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 11,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            Peak Projected
          </Typography>

          <Typography
            sx={{
              color:
                "#1264FF",
              fontSize: 20,
              fontWeight: 800,
              mt: 0.5,
            }}
          >
            {formatNumber(
              peakBurn
            )}{" "}
            t/day
          </Typography>

          {peakBurnDate && (
            <Typography
              sx={{
                color:
                  "text.secondary",
                fontSize: 11,
                mt: 0.25,
              }}
            >
              {formatDate(
                peakBurnDate
              )}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ForecastTrendChart;