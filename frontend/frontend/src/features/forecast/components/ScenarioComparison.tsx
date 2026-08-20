import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ForecastFilters,
  ForecastRecord,
  ForecastScenarioApiResponse,
} from "../types/forecast.types";

import {
  useQuery,
} from "@tanstack/react-query";

import forecastService from "../service/forecast.service";

interface ScenarioComparisonProps {
  filters: ForecastFilters;
}

interface ScenarioChartPoint {
  date: string;
  baseline: number | null;
  scenario: number | null;
}

const scenarioLabels: Record<
  string,
  string
> = {
  actual: "Actual",
  weather_hot_dry: "Hot & Dry",
  weather_hot_wet: "Hot & Wet",
  weather_cold_dry: "Cold & Dry",
  weather_cold_wet: "Cold & Wet",
};

const scenarioColors: Record<
  string,
  string
> = {
  actual: "#F57C00",
  weather_hot_dry: "#D32F2F",
  weather_hot_wet: "#9C27B0",
  weather_cold_dry: "#455A64",
  weather_cold_wet: "#2E7D32",
};

const getBackendScenarioId = (
  scenario: string
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
      return "weather_hot_dry";
  }
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

const ScenarioComparison = ({
  filters,
}: ScenarioComparisonProps) => {
  const {
    data,
    isLoading,
    isError,
  } = useQuery<ForecastScenarioApiResponse>({
    queryKey: [
      "scenario-comparison",
      filters.horizon,
      filters.entityId,
      filters.metric,
      filters.scenario,
    ],

    queryFn: () =>
      forecastService.getScenarioData(),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });

  const getMetricValue = (
    record: ForecastRecord
  ): number => {
    switch (filters.metric) {
      case "burn":
        return Number(
          record.Input ?? 0
        );

      case "supply":
        return Number(
          record.Replenishment ?? 0
        );

      case "stockpile":
        return Number(
          record.Stockpile ?? 0
        );

      default:
        return Number(
          record.Input ?? 0
        );
    }
  };

  const getMetricLabel = (): string => {
    switch (filters.metric) {
      case "burn":
        return "Burn";

      case "supply":
        return "Replenishment";

      case "stockpile":
        return "Stockpile";

      default:
        return "Forecast";
    }
  };

  const getMetricUnit = (): string => {
    if (
      filters.metric ===
      "stockpile"
    ) {
      return "tonnes";
    }

    if (
      filters.horizon ===
      "daily"
    ) {
      return "t/day";
    }

    return "tonnes";
  };

  const selectedScenarioId =
    getBackendScenarioId(
      filters.scenario
    );

  const selectedScenarioLabel =
    scenarioLabels[
      selectedScenarioId
    ] ??
    "Selected Scenario";

  const selectedScenarioColor =
    scenarioColors[
      selectedScenarioId
    ] ??
    "#F57C00";

  const source: ForecastRecord[] =
    data
      ? filters.horizon === "monthly"
        ? data.monthly
        : data.daily
      : [];

  const entityRecords =
    source.filter(
      (
        record: ForecastRecord
      ): boolean => {
        if (
          filters.entityId ===
          "all"
        ) {
          return true;
        }

        return (
          record.entity_id ===
          filters.entityId
        );
      }
    );

  const baselineRecords =
    entityRecords.filter(
      (
        record: ForecastRecord
      ): boolean =>
        record.scenario_id ===
        "actual"
    );

  const scenarioRecords =
    entityRecords.filter(
      (
        record: ForecastRecord
      ): boolean =>
        record.scenario_id ===
        selectedScenarioId
    );

  const dateMap =
    new Map<
      string,
      ScenarioChartPoint
    >();

  baselineRecords.forEach(
    (
      record: ForecastRecord
    ) => {
      const date =
        record.event_date;

      if (!date) {
        return;
      }

      const existing =
        dateMap.get(date);

      dateMap.set(
        date,
        {
          date,

          baseline:
            getMetricValue(
              record
            ),

          scenario:
            existing?.scenario ??
            null,
        }
      );
    }
  );

  scenarioRecords.forEach(
    (
      record: ForecastRecord
    ) => {
      const date =
        record.event_date;

      if (!date) {
        return;
      }

      const existing =
        dateMap.get(date);

      dateMap.set(
        date,
        {
          date,

          baseline:
            existing?.baseline ??
            null,

          scenario:
            getMetricValue(
              record
            ),
        }
      );
    }
  );

  const chartData:
    ScenarioChartPoint[] =
    Array.from(
      dateMap.values()
    ).sort(
      (a, b) =>
        new Date(
          a.date
        ).getTime() -
        new Date(
          b.date
        ).getTime()
    );

  const validBaseline =
    chartData
      .map(
        (
          item
        ) =>
          item.baseline
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null &&
          Number.isFinite(value)
      );

  const validScenario =
    chartData
      .map(
        (
          item
        ) =>
          item.scenario
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null &&
          Number.isFinite(value)
      );

  const baselineAverage =
    validBaseline.length > 0
      ? validBaseline.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        validBaseline.length
      : 0;

  const scenarioAverage =
    validScenario.length > 0
      ? validScenario.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        validScenario.length
      : 0;

  const scenarioDifference =
    baselineAverage !== 0
      ? (
          (
            scenarioAverage -
            baselineAverage
          ) /
          Math.abs(
            baselineAverage
          )
        ) *
        100
      : 0;

  const scenarioIncreases =
    scenarioDifference >= 0;

  const hasData =
    chartData.length > 0 &&
    (
      validBaseline.length >
        0 ||
      validScenario.length >
        0
    );

  if (isLoading) {
    return (
      <Box
        sx={{
          bgcolor:
            "#FFFFFF",
          border:
            "1px solid #E3E8EF",
          borderRadius: 4,
          p: {
            xs: 2.5,
            md: 3.5,
          },
          minHeight: 520,
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >
          <TrendingUpRounded
            sx={{
              color:
                "#1264FF",
            }}
          />

          <Typography
            color="text.secondary"
          >
            Loading scenario data...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box
        sx={{
          bgcolor:
            "#FFFFFF",
          border:
            "1px solid #E3E8EF",
          borderRadius: 4,
          p: {
            xs: 2.5,
            md: 3.5,
          },
          minHeight: 300,
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
        }}
      >
        <Typography color="error">
          Unable to load scenario comparison data.
        </Typography>
      </Box>
    );
  }

  if (!hasData) {
    return (
      <Box
        sx={{
          bgcolor:
            "#FFFFFF",
          border:
            "1px solid #E3E8EF",
          borderRadius: 4,
          p: {
            xs: 2.5,
            md: 3.5,
          },
          minHeight: 300,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          mb={2}
        >
          <TrendingUpRounded
            sx={{
              color:
                "#1264FF",
            }}
          />

          <Box>
            <Typography
              sx={{
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              Scenario Comparison
            </Typography>

            <Typography
              color="text.secondary"
              fontSize={13.5}
            >
              Baseline vs{" "}
              {selectedScenarioLabel}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            bgcolor:
              "#F4F7FC",
            borderRadius: 3,
            p: 2.5,
          }}
        >
          <Typography
            color="text.secondary"
          >
            There is not enough scenario data available for this selection.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        bgcolor:
          "background.paper",
        border: "1px solid",
        borderColor:
          "divider",
        borderRadius: 12,
        p: {
          xs: 2.5,
          md: 3.5,
        },
        overflow: "hidden",
        boxShadow: (theme) =>
          theme.palette.mode ===
          "dark"
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
        mb={3}
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
              alignItems:
                "center",
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
                fontSize: {
                  xs: 16,
                  md: 18,
                },
                fontWeight: 800,
              }}
            >
              Scenario Comparison
            </Typography>

            <Typography
              color="text.secondary"
              fontSize={13.5}
              mt={0.5}
            >
              Baseline{" "}
              {getMetricLabel().toLowerCase()}{" "}
              vs{" "}
              {selectedScenarioLabel}{" "}
              {getMetricLabel().toLowerCase()}.
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderRadius: 2.5,
            border:
              "1px solid #D7E3FF",
            bgcolor:
              "#F5F8FF",
            minWidth: 110,
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {chartData.length}
          </Typography>

          <Typography
            fontSize={12}
            color="#718096"
          >
            periods
          </Typography>
        </Box>
      </Stack>

      {/* SUMMARY */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(3, 1fr)",
          },
          gap: 1.5,
          mb: 3,
        }}
      >
        <Box
          sx={{
            bgcolor:
              "#F7F9FC",
            borderRadius: 3,
            p: 2,
          }}
        >
          <Typography
            fontSize={12}
            fontWeight={700}
            color="#718096"
            textTransform="uppercase"
          >
            Baseline Average
          </Typography>

          <Typography
            mt={0.5}
            fontSize={23}
            fontWeight={800}
          >
            {formatNumber(
              baselineAverage
            )}
          </Typography>

          <Typography
            fontSize={12.5}
            color="#718096"
          >
            {getMetricUnit()}
          </Typography>
        </Box>

        <Box
          sx={{
            bgcolor:
              "#F7F9FC",
            borderRadius: 3,
            p: 2,
          }}
        >
          <Typography
            fontSize={12}
            fontWeight={700}
            color="#718096"
            textTransform="uppercase"
          >
            {selectedScenarioLabel}
          </Typography>

          <Typography
            mt={0.5}
            fontSize={23}
            fontWeight={800}
            color={
              selectedScenarioColor
            }
          >
            {formatNumber(
              scenarioAverage
            )}
          </Typography>

          <Typography
            fontSize={12.5}
            color="#718096"
          >
            {getMetricUnit()}
          </Typography>
        </Box>

        <Box
          sx={{
            bgcolor:
              "#F7F9FC",
            borderRadius: 3,
            p: 2,
          }}
        >
          <Typography
            fontSize={12}
            fontWeight={700}
            color="#718096"
            textTransform="uppercase"
          >
            Scenario Impact
          </Typography>

          <Typography
            mt={0.5}
            fontSize={23}
            fontWeight={800}
            color={
              scenarioIncreases
                ? "#2E7D32"
                : "#C62828"
            }
          >
            {scenarioIncreases
              ? "+"
              : ""}
            {formatNumber(
              scenarioDifference
            )}
            %
          </Typography>

          <Typography
            fontSize={12.5}
            color="#718096"
          >
            vs baseline
          </Typography>
        </Box>
      </Box>

      {/* LEGEND */}

      <Stack
        direction="row"
        spacing={3}
        justifyContent="center"
        alignItems="center"
        mb={1.5}
      >
        <Stack
          direction="row"
          spacing={0.8}
          alignItems="center"
        >
          <Box
            sx={{
              width: 26,
              height: 0,
              borderTop:
                "3px dashed #1264FF",
            }}
          />

          <Typography
            fontSize={13}
            fontWeight={700}
            color="#52637A"
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
              width: 26,
              height: 0,
              borderTop:
                `3px solid ${selectedScenarioColor}`,
            }}
          />

          <Typography
            fontSize={13}
            fontWeight={700}
            color="#52637A"
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
            xs: 360,
            md: 430,
          },
          minWidth: 0,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 10,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 7"
              stroke="#DCE4EF"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={
                formatDate
              }
              tick={{
                fill: "#718096",
                fontSize: 12,
              }}
              axisLine={{
                stroke:
                  "#DCE4EF",
              }}
              tickLine={false}
              minTickGap={35}
            />

            <YAxis
              tick={{
                fill: "#718096",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={
                formatNumber
              }
              width={55}
            />

            <Tooltip
              contentStyle={{
                border:
                  "1px solid #E3E8EF",
                borderRadius: 12,
                boxShadow:
                  "0 8px 24px rgba(23,43,77,0.12)",
                padding:
                  "12px 14px",
              }}
              labelFormatter={(
                label
              ) =>
                formatDate(
                  String(label)
                )
              }
              formatter={(
                value,
                name
              ) => {
                const numericValue =
                  Number(value);

                const displayName =
                  name === "baseline"
                    ? "Baseline"
                    : selectedScenarioLabel;

                return [
                  `${formatNumber(
                    numericValue
                  )} ${getMetricUnit()}`,
                  displayName,
                ];
              }}
            />

            <Line
              type="monotone"
              dataKey="scenario"
              name="scenario"
              stroke={
                selectedScenarioColor
              }
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 5,
              }}
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="baseline"
              name="baseline"
              stroke="#1264FF"
              strokeWidth={2.5}
              strokeDasharray="10 7"
              dot={false}
              activeDot={{
                r: 5,
              }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* FOOTER */}

      <Box
        sx={{
          mt: 2,
          pt: 2.5,
          borderTop:
            "1px solid #E3E8EF",
          display: "flex",
          justifyContent:
            "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            fontSize={12}
            fontWeight={700}
            color="#718096"
            textTransform="uppercase"
          >
            Baseline Average
          </Typography>

          <Typography
            fontSize={20}
            fontWeight={800}
            mt={0.4}
          >
            {formatNumber(
              baselineAverage
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
            fontSize={12}
            fontWeight={700}
            color="#718096"
            textTransform="uppercase"
          >
            {selectedScenarioLabel} Average
          </Typography>

          <Typography
            fontSize={20}
            fontWeight={800}
            color={
              selectedScenarioColor
            }
            mt={0.4}
          >
            {formatNumber(
              scenarioAverage
            )}{" "}
            {getMetricUnit()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ScenarioComparison;