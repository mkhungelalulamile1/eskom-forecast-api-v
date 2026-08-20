import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  StackedLineChartRounded,
  TimelineRounded,
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
  useOotHistory,
} from "../hooks/useModelPerformance";



import {
  infoTint,
  raisedFill,
  softBorder,
  softText,
} from "../../../theme/surfaces";

/**
 * ======================================================
 * BACKEND OOT RECORD
 * ======================================================
 */

interface OotPerformanceRecord {
  entity_id: string;

  event_date: string;

  horizon:
    | string
    | null
    | undefined;

  Input_actual:
    | number
    | null
    | undefined;

  Input_predicted:
    | number
    | null
    | undefined;

  Replenishment_actual:
    | number
    | null
    | undefined;

  Replenishment_predicted:
    | number
    | null
    | undefined;

  Stockpile_actual:
    | number
    | null
    | undefined;

  Stockpile_predicted:
    | number
    | null
    | undefined;
}


/**
 * ======================================================
 * METRIC
 * ======================================================
 */

type PerformanceMetric =
  | "Input"
  | "Replenishment"
  | "Stockpile";


/**
 * ======================================================
 * CHART POINT
 * ======================================================
 */

interface ChartPoint {
  date: string;

  actual:
    | number
    | null;

  predicted:
    | number
    | null;
}


/**
 * ======================================================
 * PROPS
 * ======================================================
 */

interface CumulativeBurnHistoryProps {
  entityId: string;

  horizon:
    | "daily"
    | "monthly";

  metric: PerformanceMetric;
}


/**
 * ======================================================
 * COMPONENT
 * ======================================================
 */

const CumulativeBurnHistory = ({
  entityId,
  horizon,
  metric,
}: CumulativeBurnHistoryProps) => {

  const {
    data,
    isLoading,
    isError,
  } = useOotHistory();


  /*
   * --------------------------------------------------
   * NORMALISE API DATA
   * --------------------------------------------------
   */

  const records: OotPerformanceRecord[] =
    Array.isArray(data)
      ? (data as OotPerformanceRecord[])
      : [];


  /*
   * --------------------------------------------------
   * FRONTEND → BACKEND HORIZON
   * --------------------------------------------------
   *
   * daily   → tactical
   * monthly → strategic
   */

  const horizonKey =
    horizon === "daily"
      ? "tactical"
      : "strategic";


  /*
   * --------------------------------------------------
   * METRIC CONFIGURATION
   * --------------------------------------------------
   */

  const metricConfig: Record<
    PerformanceMetric,
    {
      label: string;
      actualKey: keyof OotPerformanceRecord;
      predictedKey: keyof OotPerformanceRecord;
      description: string;
      unit: string;
    }
  > = {
    Input: {
      label: "Burn",
      actualKey: "Input_actual",
      predictedKey: "Input_predicted",
      description:
        "Cumulative burn predictions versus what actually happened across the out-of-time sample.",
      unit: "tonnes",
    },

    Replenishment: {
      label: "Supply",
      actualKey: "Replenishment_actual",
      predictedKey: "Replenishment_predicted",
      description:
        "Cumulative supply predictions versus what actually happened across the out-of-time sample.",
      unit: "tonnes",
    },

    Stockpile: {
      label: "Stockpile",
      actualKey: "Stockpile_actual",
      predictedKey: "Stockpile_predicted",
      description:
        "Cumulative stockpile predictions versus actual stockpile levels across the out-of-time sample.",
      unit: "tonnes",
    },
  };


  const selectedMetric =
    metricConfig[metric];


  /*
   * --------------------------------------------------
   * FILTER RECORDS
   * --------------------------------------------------
   */

  const filteredRecords: OotPerformanceRecord[] =
    records
      .filter(
        (
          record: OotPerformanceRecord
        ) =>
          record.entity_id ===
          entityId
      )
      .filter(
        (
          record: OotPerformanceRecord
        ) =>
          record.horizon ===
          horizonKey
      )
      .sort(
        (
          a: OotPerformanceRecord,
          b: OotPerformanceRecord
        ) =>
          new Date(
            a.event_date
          ).getTime() -
          new Date(
            b.event_date
          ).getTime()
      );


  /*
   * --------------------------------------------------
   * BUILD CUMULATIVE DATA
   * --------------------------------------------------
   *
   * The selected metric determines which backend
   * actual/predicted fields are used.
   */

  let cumulativeActual = 0;
  let cumulativePredicted = 0;


  const chartData: ChartPoint[] =
    filteredRecords
      .map(
        (
          record: OotPerformanceRecord
        ): ChartPoint => {

          const actual =
            record[
              selectedMetric.actualKey
            ] as
              | number
              | null
              | undefined;


          const predicted =
            record[
              selectedMetric.predictedKey
            ] as
              | number
              | null
              | undefined;


          if (
            actual !== null &&
            actual !== undefined &&
            Number.isFinite(actual)
          ) {
            cumulativeActual += actual;
          }


          if (
            predicted !== null &&
            predicted !== undefined &&
            Number.isFinite(predicted)
          ) {
            cumulativePredicted +=
              predicted;
          }


          return {
            date:
              record.event_date,

            actual:
              actual !== null &&
              actual !== undefined &&
              Number.isFinite(actual)
                ? cumulativeActual
                : null,

            predicted:
              predicted !== null &&
              predicted !== undefined &&
              Number.isFinite(predicted)
                ? cumulativePredicted
                : null,
          };
        }
      )
      .filter(
        (
          item: ChartPoint
        ): boolean =>
          item.actual !== null ||
          item.predicted !== null
      );


  /*
   * --------------------------------------------------
   * FORMAT DATE
   * --------------------------------------------------
   */

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
        month: "short",
        year: "numeric",
      }
    );
  };


  /*
   * --------------------------------------------------
   * FORMAT NUMBER
   * --------------------------------------------------
   */

  const formatNumber = (
    value:
      | number
      | null
      | undefined
  ): string => {

    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(value)
    ) {
      return "—";
    }


    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 0,
      }
    ).format(value);
  };


  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
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
            md: 4,
          },
          boxShadow:
            "0 8px 24px rgba(23,43,77,0.04)",
        }}
      >
        <Typography
          color="text.secondary"
        >
          Loading {selectedMetric.label.toLowerCase()} history...
        </Typography>
      </Box>
    );
  }


  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  if (isError) {
    return (
      <Box
        sx={{
          bgcolor: "transparent",
          border: softBorder,
          borderRadius: "12px",
          p: {
            xs: 2.5,
            md: 4,
          },
          boxShadow:
            "0 8px 24px rgba(23,43,77,0.04)",
        }}
      >
        <Typography
          color="error"
          fontWeight={600}
        >
          Unable to load cumulative{" "}
          {selectedMetric.label.toLowerCase()}{" "}
          performance data.
        </Typography>
      </Box>
    );
  }


  /*
   * --------------------------------------------------
   * UI
   * --------------------------------------------------
   */

  return (
    <Box
      sx={{
        bgcolor: "transparent",
        border: softBorder,
        borderRadius: "12px",
        p: {
          xs: 2.5,
          md: 4,
        },
        boxShadow:
          "0 8px 24px rgba(23,43,77,0.04)",
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >

      {/* ================================================= */}
      {/* HEADER                                            */}
      {/* ================================================= */}

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
          minWidth={0}
        >

          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: infoTint,
              color: "#1264FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <StackedLineChartRounded />
          </Box>


          <Box
            sx={{
              minWidth: 0,
            }}
          >

            <Typography
              variant="h5"
              fontWeight={800}
              color="text.primary"
            >
              {selectedMetric.label} History — Actual vs Predicted
            </Typography>


            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              {selectedMetric.description}
            </Typography>

          </Box>

        </Stack>


        {/* ================================================= */}
        {/* HEADER BADGES                                     */}
        {/* ================================================= */}

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
        >

          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: "10px",
              bgcolor: raisedFill,
              color: softText,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {horizon === "daily"
              ? "Tactical Daily"
              : "Strategic Monthly"}
          </Box>


          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: "10px",
              bgcolor: infoTint,
              color: "#1264FF",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {selectedMetric.label}
          </Box>


          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: "10px",
              bgcolor: raisedFill,
              color: softText,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {chartData.length} points
          </Box>

        </Stack>

      </Stack>


      {/* ================================================= */}
      {/* NO DATA                                           */}
      {/* ================================================= */}

      {chartData.length === 0 ? (

        <Box
          sx={{
            height: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >

          <Box>

            <TrendingUpRounded
              sx={{
                fontSize: 42,
                color: "#CBD5E1",
                mb: 1,
              }}
            />


            <Typography
              fontWeight={700}
              color="text.secondary"
            >
              No {selectedMetric.label.toLowerCase()} history data
            </Typography>


            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              There are no OOT{" "}
              {selectedMetric.label.toLowerCase()}{" "}
              records available for this station and
              forecast horizon.
            </Typography>

          </Box>

        </Box>

      ) : (

        /* ================================================= */
        /* CHART                                             */
        /* ================================================= */

        <Box
          sx={{
            width: "100%",
            height: {
              xs: 320,
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
                right: 24,
                left: 10,
                bottom: 20,
              }}
            >

              <CartesianGrid
                strokeDasharray="4 6"
                vertical={false}
                stroke="#E8ECF2"
              />


              <XAxis
                dataKey="date"
                tickFormatter={
                  formatDate
                }
                tick={{
                  fill: "#68758A",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={45}
              />


              <YAxis
                tick={{
                  fill: "#68758A",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                width={80}
                tickFormatter={
                  formatNumber
                }
              />


              {/* ================================================= */}
              {/* TOOLTIP                                            */}
              {/* ================================================= */}

              <Tooltip
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
                    typeof value ===
                    "number"
                      ? value
                      : Number(value);


                  return [
                    Number.isFinite(
                      numericValue
                    )
                      ? formatNumber(
                          numericValue
                        )
                      : "—",

                    name === "actual"
                      ? "Actual"
                      : "Predicted",
                  ];
                }}

                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #E2E7EF",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,0.08)",
                }}

                labelStyle={{
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              />


              {/* ================================================= */}
              {/* ACTUAL                                             */}
              {/* ================================================= */}

              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#1264FF"
                strokeWidth={3}
                dot={false}
                activeDot={{
                  r: 5,
                }}
                connectNulls
              />


              {/* ================================================= */}
              {/* PREDICTED                                          */}
              {/* ================================================= */}

              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted"
                stroke="#F57C00"
                strokeWidth={3}
                strokeDasharray="6 5"
                dot={false}
                activeDot={{
                  r: 5,
                }}
                connectNulls
              />

            </LineChart>

          </ResponsiveContainer>

        </Box>

      )}

    </Box>
  );
};


export default CumulativeBurnHistory;