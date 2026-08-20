import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  CompareArrowsRounded,
  CalendarMonthRounded,
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
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastScenarioData,
} from "../hooks/useForecast";


import {
  cardBorderColor,
  cardFill,
  hairline,
  infoTint,
  neutralFill,
  softBorder,
} from "../../../theme/surfaces";

interface ScenarioTrendChartProps {
  filters: ForecastFilters;
}

interface ScenarioChartPoint {
  date: string;
  baseline: number;
  scenario: number;
}

const getBackendScenarioId = (
  scenario: ForecastFilters["scenario"]
): string => {
  switch (scenario) {
    case "actual":
      return "actual";

    case "hotdry":
      return "weather_hot_dry";

    case "hotwet":
      return "weather_hot_wet";

    case "colddry":
      return "weather_cold_dry";

    case "coldwet":
      return "weather_cold_wet";

    default:
      return "actual";
  }
};

const ScenarioTrendChart = ({
  filters,
}: ScenarioTrendChartProps) => {
  const {
    data,
    isLoading,
    isError,
  } = useForecastScenarioData();

  /*
   * ---------------------------------------------------------
   * LABELS
   * ---------------------------------------------------------
   */

  const getMetricLabel = (): string => {
    switch (filters.metric) {
      case "burn":
        return "Burn";

      case "supply":
        return "Supply";

      case "stockpile":
        return "Stockpile";

      default:
        return "Forecast";
    }
  };

  const getMetricUnit = (): string => {
    if (filters.metric === "stockpile") {
      return "tonnes";
    }

    if (filters.horizon === "daily") {
      return "t/day";
    }

    return "tonnes";
  };

  const getScenarioLabel = (
    scenarioId: string
  ): string => {
    switch (scenarioId) {
      case "weather_hot_dry":
        return "Hot & Dry";

      case "weather_hot_wet":
        return "Hot & Wet";

      case "weather_cold_dry":
        return "Cold & Dry";

      case "weather_cold_wet":
        return "Cold & Wet";

      case "actual":
        return "Baseline";

      default:
        return scenarioId;
    }
  };

  /*
   * ---------------------------------------------------------
   * METRIC VALUE
   * ---------------------------------------------------------
   */

  const getMetricValue = (
    record: ForecastRecord
  ): number => {
    switch (filters.metric) {
      case "burn":
        return Number(record.Input ?? 0);

      case "supply":
        return Number(
          record.Replenishment ?? 0
        );

      case "stockpile":
        return Number(
          record.Stockpile ?? 0
        );

      default:
        return Number(record.Input ?? 0);
    }
  };

  /*
   * ---------------------------------------------------------
   * SCENARIO DATA
   * ---------------------------------------------------------
   */

  const rawRecords: ForecastRecord[] =
    filters.horizon === "monthly"
      ? data?.monthly ?? []
      : data?.daily ?? [];

  /*
   * ---------------------------------------------------------
   * SELECT BASELINE + SCENARIO
   * ---------------------------------------------------------
   */

  const entityRecords =
    filters.entityId === "all"
      ? rawRecords
      : rawRecords.filter(
          (record: ForecastRecord) =>
            record.entity_id ===
            filters.entityId
        );

  const baselineRecords =
    entityRecords.filter(
      (record: ForecastRecord) =>
        record.scenario_id === "actual"
    );

  const selectedScenarioId =
    getBackendScenarioId(
      filters.scenario
    );

  const selectedScenarioRecords =
    entityRecords.filter(
      (record: ForecastRecord) =>
        record.scenario_id ===
        selectedScenarioId
    );

  /*
   * ---------------------------------------------------------
   * MATCH RECORDS BY DATE
   * ---------------------------------------------------------
   */

  const scenarioByDate =
    new Map<string, ForecastRecord>();

  selectedScenarioRecords.forEach(
    (record: ForecastRecord) => {
      if (!record.event_date) {
        return;
      }

      scenarioByDate.set(
        record.event_date,
        record
      );
    }
  );

  /*
   * ---------------------------------------------------------
   * BUILD CHART DATA
   * ---------------------------------------------------------
   */

  const chartData: ScenarioChartPoint[] =
    baselineRecords
      .map(
        (
          baseline: ForecastRecord
        ): ScenarioChartPoint | null => {
          if (!baseline.event_date) {
            return null;
          }

          const scenario =
            scenarioByDate.get(
              baseline.event_date
            );

          if (!scenario) {
            return null;
          }

          return {
            date: baseline.event_date,
            baseline:
              getMetricValue(
                baseline
              ),
            scenario:
              getMetricValue(
                scenario
              ),
          };
        }
      )
      .filter(
        (
          point:
            ScenarioChartPoint | null
        ): point is ScenarioChartPoint =>
          point !== null
      )
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */

  const baselineValues =
    chartData.map(
      (
        point: ScenarioChartPoint
      ) => point.baseline
    );

  const scenarioValues =
    chartData.map(
      (
        point: ScenarioChartPoint
      ) => point.scenario
    );

  const baselineAverage =
    baselineValues.length > 0
      ? baselineValues.reduce(
          (
            sum: number,
            value: number
          ) => sum + value,
          0
        ) / baselineValues.length
      : 0;

  const scenarioAverage =
    scenarioValues.length > 0
      ? scenarioValues.reduce(
          (
            sum: number,
            value: number
          ) => sum + value,
          0
        ) / scenarioValues.length
      : 0;

  const scenarioDifference =
    baselineAverage !== 0
      ? (
          (scenarioAverage -
            baselineAverage) /
          Math.abs(baselineAverage)
        ) * 100
      : 0;

  /*
   * ---------------------------------------------------------
   * FORMATTING
   * ---------------------------------------------------------
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

  const selectedScenarioLabel =
    getScenarioLabel(
      selectedScenarioId
    );

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (isLoading) {
    return (
      <Box
        sx={{
          bgcolor: "transparent",
          border: softBorder,
          borderRadius: "12px",
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
              borderRadius: "12px",
              bgcolor:
                "rgba(18,100,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
            }}
          >
            <CompareArrowsRounded
              sx={{
                color: "#1264FF",
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
              Scenario Comparison
            </Typography>

            <Typography
              sx={{
                color:
                  "text.secondary",
                fontSize: 13.5,
                mt: 0.5,
              }}
            >
              Loading scenario data...
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR / EMPTY
   * ---------------------------------------------------------
   */

  if (
    isError ||
    chartData.length === 0
  ) {
    return (
      <Box
        sx={{
          bgcolor: "transparent",
          border: softBorder,
          borderRadius: "12px",
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
          spacing={1}
          alignItems="center"
          textAlign="center"
        >
          <CompareArrowsRounded
            sx={{
              fontSize: 42,
              color: "#9AA5B1",
            }}
          />

          <Typography
            sx={{
              fontWeight: 700,
              color:
                "text.primary",
            }}
          >
            No scenario comparison
            available
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 14,
              maxWidth: 420,
            }}
          >
            There is not enough matching
            baseline and scenario data
            for this selection.
          </Typography>
        </Stack>
      </Box>
    );
  }

  /*
   * ---------------------------------------------------------
   * GRADIENT
   * ---------------------------------------------------------
   */

  const gradientId =
    `scenarioComparisonGradient-${filters.metric}`;

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        bgcolor: cardFill,
        border: "1px solid",
        borderColor: cardBorderColor,
        borderRadius: "12px",
        p: {
          xs: 2.5,
          md: 3.5,
        },
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.4)"
            : "0 10px 30px rgba(16,32,62,0.06)",
      }}
    >
      {/* HEADER */}

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
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              bgcolor:
                "rgba(18,100,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
              flexShrink: 0,
            }}
          >
            <CompareArrowsRounded
              sx={{
                color: "#1264FF",
                fontSize: 27,
              }}
            />
          </Box>

          <Box>
            <Typography
              sx={{
                fontSize: {
                  xs: 21,
                  md: 25,
                },
                fontWeight: 800,
                color:
                  "text.primary",
                lineHeight: 1.2,
              }}
            >
              Scenario Comparison
            </Typography>

            <Typography
              sx={{
                color:
                  "text.secondary",
                fontSize: 14,
                mt: 0.5,
              }}
            >
              Baseline{" "}
              {getMetricLabel().toLowerCase()}{" "}
              vs{" "}
              {selectedScenarioLabel}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.8,
              px: 1.5,
              py: 0.8,
              borderRadius: "10px",
              bgcolor: infoTint,
              border: softBorder,
            }}
          >
            <CalendarMonthRounded
              sx={{
                fontSize: 18,
                color: "#1264FF",
              }}
            />

            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  "text.primary",
              }}
            >
              {chartData.length}{" "}
              periods
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* KPI ROW */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs:
              "repeat(2, minmax(0, 1fr))",
            sm:
              "repeat(3, minmax(0, 1fr))",
          },
          gap: {
            xs: 1.5,
            md: 2,
          },
          mt: 3,
        }}
      >
        {/* BASELINE */}

        <Box
          sx={{
            bgcolor: neutralFill,
            borderRadius: "12px",
            p: {
              xs: 1.75,
              md: 2,
            },
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              fontWeight: 700,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            Baseline Average
          </Typography>

          <Typography
            sx={{
              mt: 0.7,
              fontSize: {
                xs: 21,
                md: 24,
              },
              fontWeight: 800,
              color:
                "text.primary",
            }}
          >
            {formatNumber(
              baselineAverage
            )}
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              mt: 0.2,
            }}
          >
            {getMetricUnit()}
          </Typography>
        </Box>

        {/* SCENARIO */}

        <Box
          sx={{
            bgcolor: neutralFill,
            borderRadius: "12px",
            p: {
              xs: 1.75,
              md: 2,
            },
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              fontWeight: 700,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            {selectedScenarioLabel}
          </Typography>

          <Typography
            sx={{
              mt: 0.7,
              fontSize: {
                xs: 21,
                md: 24,
              },
              fontWeight: 800,
              color: "#F57C00",
            }}
          >
            {formatNumber(
              scenarioAverage
            )}
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              mt: 0.2,
            }}
          >
            {getMetricUnit()}
          </Typography>
        </Box>

        {/* DIFFERENCE */}

        <Box
          sx={{
            bgcolor: neutralFill,
            borderRadius: "12px",
            p: {
              xs: 1.75,
              md: 2,
            },
            gridColumn: {
              xs: "1 / -1",
              sm: "auto",
            },
          }}
        >
          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              fontWeight: 700,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.04em",
            }}
          >
            Scenario Impact
          </Typography>

          <Typography
            sx={{
              mt: 0.7,
              fontSize: {
                xs: 21,
                md: 24,
              },
              fontWeight: 800,
              color:
                scenarioDifference >= 0
                  ? "#2E7D32"
                  : "#C62828",
            }}
          >
            {scenarioDifference >= 0
              ? "+"
              : ""}
            {scenarioDifference.toFixed(
              1
            )}
            %
          </Typography>

          <Typography
            sx={{
              color:
                "text.secondary",
              fontSize: 12,
              mt: 0.2,
            }}
          >
            vs baseline
          </Typography>
        </Box>
      </Box>

      {/* LEGEND */}

      <Stack
        direction="row"
        spacing={2.5}
        justifyContent="center"
        sx={{
          mt: 3,
          mb: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={0.8}
          alignItems="center"
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "#1264FF",
            }}
          />

          <Typography
            sx={{
              fontSize: 13,
              color:
                "text.secondary",
              fontWeight: 600,
            }}
          >
            Baseline
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={0.8}
          alignItems="center"
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "#F57C00",
            }}
          />

          <Typography
            sx={{
              fontSize: 13,
              color:
                "text.secondary",
              fontWeight: 600,
            }}
          >
            {selectedScenarioLabel}
          </Typography>
        </Stack>
      </Stack>

      {/* CHART */}

      <Box
        sx={{
          width: "100%",
          height: {
            xs: 300,
            md: 390,
          },
          mt: 1,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 12,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#1264FF"
                  stopOpacity={0.14}
                />

                <stop
                  offset="100%"
                  stopColor="#1264FF"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 7"
              stroke="#DCE4F0"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={
                formatDate
              }
              tick={{
                fill: "#7A869A",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />

            <YAxis
              tick={{
                fill: "#7A869A",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              width={45}
              tickFormatter={(
                value: number
              ) =>
                formatNumber(value)
              }
            />

            <Tooltip
              contentStyle={{
                border: "1px solid #E2E7EF",
                borderRadius: "12px",
                boxShadow:
                  "0 8px 25px rgba(23,43,77,0.12)",
                padding:
                  "10px 12px",
              }}
              labelFormatter={(
                label
              ) =>
                formatDate(
                  String(label)
                )
              }
              formatter={(
                value:
                  number | string,
                name: string
              ) => [
                `${formatNumber(
                  Number(value)
                )} ${getMetricUnit()}`,
                name === "baseline"
                  ? "Baseline"
                  : selectedScenarioLabel,
              ]}
            />

            <Area
              type="monotone"
              dataKey="baseline"
              stroke="#1264FF"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "#FFFFFF",
              }}
            />

            <Area
              type="monotone"
              dataKey="scenario"
              stroke="#F57C00"
              strokeWidth={2.5}
              fill="transparent"
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2,
                stroke: "#FFFFFF",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {/* FOOTER */}

      <Box
        sx={{
          mt: 2,
          pt: 2,
          borderTop: hairline,
          display: "flex",
          justifyContent:
            "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color:
                "text.secondary",
              textTransform:
                "uppercase",
            }}
          >
            Baseline
          </Typography>

          <Typography
            sx={{
              fontSize: 19,
              fontWeight: 800,
              color:
                "text.primary",
              mt: 0.3,
            }}
          >
            {formatNumber(
              Math.min(
                ...baselineValues
              )
            )}{" "}
            {getMetricUnit()}
          </Typography>
        </Box>

        <Box
          sx={{
            textAlign: {
              xs: "left",
              sm: "right",
            },
          }}
        >
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color:
                "text.secondary",
              textTransform:
                "uppercase",
            }}
          >
            {selectedScenarioLabel}
          </Typography>

          <Typography
            sx={{
              fontSize: 19,
              fontWeight: 800,
              color: "#F57C00",
              mt: 0.3,
            }}
          >
            {formatNumber(
              Math.max(
                ...scenarioValues
              )
            )}{" "}
            {getMetricUnit()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ScenarioTrendChart;