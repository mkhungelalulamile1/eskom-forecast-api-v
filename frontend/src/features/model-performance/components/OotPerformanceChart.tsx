import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import {
  TimelineRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useOotHistory,
} from "../hooks/useModelPerformance";



import {
  cardBorderColor,
  cardFill,
  infoTint,
  raisedFill,
  softBorder,
  softText,
} from "../../../theme/surfaces";

/*
 * ======================================================
 * OOT PERFORMANCE RECORD
 * ======================================================
 *
 * These fields correspond to the OOT history returned
 * by the backend.
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


/*
 * ======================================================
 * CHART DATA
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


/*
 * ======================================================
 * PROPS
 * ======================================================
 */

interface OotPerformanceChartProps {
  entityId: string;

  horizon:
    | "daily"
    | "monthly";

  metric:
    | "Input"
    | "Replenishment"
    | "Stockpile";
}


/*
 * ======================================================
 * COMPONENT
 * ======================================================
 */

const OotPerformanceChart = ({
  entityId,
  horizon,
  metric,
}: OotPerformanceChartProps) => {

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
   * MAP METRIC TO BACKEND FIELDS
   * --------------------------------------------------
   */

  const fieldMap = {
    Input: {
      actual:
        "Input_actual",
      predicted:
        "Input_predicted",
    },

    Replenishment: {
      actual:
        "Replenishment_actual",
      predicted:
        "Replenishment_predicted",
    },

    Stockpile: {
      actual:
        "Stockpile_actual",
      predicted:
        "Stockpile_predicted",
    },
  } as const;


  const fields =
    fieldMap[metric];


  /*
   * --------------------------------------------------
   * BUILD CHART DATA
   * --------------------------------------------------
   */

  const chartData: ChartPoint[] =
    filteredRecords
      .map(
        (
          record: OotPerformanceRecord
        ): ChartPoint => ({
          date:
            record.event_date,

          actual:
            record[
              fields.actual
            ] ?? null,

          predicted:
            record[
              fields.predicted
            ] ?? null,
        })
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
        day: "2-digit",
        month: "short",
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
        maximumFractionDigits:
          1,
      }
    ).format(value);
  };


  /*
   * --------------------------------------------------
   * LOADING STATE
   * --------------------------------------------------
   */

  if (isLoading) {
    return (
      <Box
        sx={{
          bgcolor: cardFill,

          border: "1px solid",
          borderColor: cardBorderColor,

          borderRadius: "12px",

          p: 4,

          boxShadow:
            "0 8px 24px rgba(23,43,77,0.04)",
        }}
      >
        <Typography
          color="text.secondary"
        >
          Loading out-of-time
          performance...
        </Typography>
      </Box>
    );
  }


  /*
   * --------------------------------------------------
   * ERROR STATE
   * --------------------------------------------------
   */

  if (isError) {
    return (
      <Box
        sx={{
          bgcolor: cardFill,

          border: "1px solid",
          borderColor: cardBorderColor,

          borderRadius: "12px",

          p: 4,

          boxShadow:
            "0 8px 24px rgba(23,43,77,0.04)",
        }}
      >
        <Typography
          color="error"
        >
          Unable to load out-of-time
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
        bgcolor: cardFill,

        border: "1px solid",
          borderColor: cardBorderColor,

        borderRadius: "12px",

        p: {
          xs: 2.5,
          md: 4,
        },

        boxShadow:
          "0 8px 24px rgba(23,43,77,0.04)",

        minWidth: 0,

        width: "100%",
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
            <TimelineRounded />
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
              {metric} History
            </Typography>


            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              Actual versus predicted
              performance from the
              out-of-time sample.
            </Typography>

          </Box>

        </Stack>


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

              whiteSpace:
                "nowrap",
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

              color:
                "#1264FF",

              fontSize: 13,

              fontWeight: 700,

              whiteSpace:
                "nowrap",
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
            height: 320,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            textAlign:
              "center",
          }}
        >

          <Box>

            <TrendingUpRounded
              sx={{
                fontSize: 42,

                color:
                  "#CBD5E1",

                mb: 1,
              }}
            />


            <Typography
              fontWeight={700}
              color="text.secondary"
            >
              No out-of-time
              performance data
            </Typography>


            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              There are no OOT records
              available for this station,
              horizon and metric.
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
              xs: 300,
              md: 360,
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
                right: 20,
                left: 0,
                bottom: 10,
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
                  fill:
                    "#68758A",

                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />


              <YAxis
                tick={{
                  fill:
                    "#68758A",

                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                width={75}
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
                      : Number(
                          value
                        );


                  return [
                    Number.isFinite(
                      numericValue
                    )
                      ? formatNumber(
                          numericValue
                        )
                      : "—",

                    name ===
                    "actual"
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
                stroke="#F59E0B"
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


export default OotPerformanceChart;