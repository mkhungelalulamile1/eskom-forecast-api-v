import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  PlayCircleOutlineRounded,
  VisibilityRounded,
} from "@mui/icons-material";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastChart,
} from "../hooks/useForecast";


interface ForecastResultsProps {
  filters: ForecastFilters;
}


interface ResultRow {
  id: string;
  date: string;
  prediction: number;
  stockpile: number;
}


const ForecastResults = ({
  filters,
}: ForecastResultsProps) => {

  const {
    data,
    isLoading,
    isError,
  } = useForecastChart(filters);


  const records: ForecastRecord[] =
    data ?? [];


  const metricLabel =
    filters.metric === "burn"
      ? "Burn"
      : filters.metric === "supply"
      ? "Supply"
      : "Stockpile";


  const metricUnit =
    filters.metric === "stockpile"
      ? "tonnes"
      : filters.horizon === "daily"
      ? "t/day"
      : "tonnes";


  const getMetricValue = (
    record: ForecastRecord
  ): number => {

    switch (
      filters.metric
    ) {

      case "burn":
        return Number(
          record.Input
        );

      case "supply":
        return Number(
          record.Replenishment
        );

      case "stockpile":
        return Number(
          record.Stockpile
        );

      default:
        return Number(
          record.Input
        );
    }
  };


  const formatNumber = (
    value: number
  ): string => {

    return new Intl.NumberFormat(
      "en-US",
      {
        maximumFractionDigits: 2,
      }
    )
      .format(value)
      .replace(
        /,/g,
        " "
      );
  };


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
        year: "numeric",
      }
    );
  };


  const resultRows: ResultRow[] =
    records
      .slice()
      .sort(
        (
          a: ForecastRecord,
          b: ForecastRecord
        ) =>
          new Date(
            b.event_date
          ).getTime() -
          new Date(
            a.event_date
          ).getTime()
      )
      .slice(0, 10)
      .map(
        (
          record: ForecastRecord
        ): ResultRow => ({
          id:
            `${record.entity_id}-${record.event_date}-${record.horizon_step}`,

          date:
            record.event_date,

          prediction:
            getMetricValue(record),

          stockpile:
            Number(
              record.Stockpile
            ),
        })
      );


  /*
   * ------------------------------------------------------
   * LOADING
   * ------------------------------------------------------
   */

  if (isLoading) {

    return (
      <Box
        sx={{
          bgcolor:
            "background.paper",

          border:
            "1px solid",

          borderColor:
            "divider",

          borderRadius: 4,

          p: {
            xs: 2.5,
            md: 4,
          },
        }}
      >

        <Typography
          color="text.secondary"
        >
          Loading forecast results...
        </Typography>

      </Box>
    );
  }


  /*
   * ------------------------------------------------------
   * ERROR
   * ------------------------------------------------------
   */

  if (isError) {

    return (
      <Box
        sx={{
          bgcolor:
            "background.paper",

          border:
            "1px solid",

          borderColor:
            "divider",

          borderRadius: 4,

          p: {
            xs: 2.5,
            md: 4,
          },
        }}
      >

        <Typography
          color="error"
        >
          Unable to load forecast results.
        </Typography>

      </Box>
    );
  }


  /*
   * ------------------------------------------------------
   * EMPTY
   * ------------------------------------------------------
   */

  if (
    resultRows.length === 0
  ) {

    return (
      <Box
        sx={{
          bgcolor:
            "background.paper",

          border:
            "1px solid",

          borderColor:
            "divider",

          borderRadius: 4,

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
          Forecast Results
        </Typography>

        <Typography
          color="text.secondary"
          mt={1}
        >
          No forecast results are available
          for the selected context.
        </Typography>

      </Box>
    );
  }


  /*
   * ------------------------------------------------------
   * MAIN UI
   * ------------------------------------------------------
   */

  return (
    <Box
      sx={{
        bgcolor:
          "background.paper",

        border:
          "1px solid",

        borderColor:
          "divider",

        borderRadius: 4,

        p: {
          xs: 2.5,
          md: 4,
        },

        width: "100%",
        minWidth: 0,

        overflow: "hidden",
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

        <Box>

          <Typography
            variant="h5"
            fontWeight={800}
            color="text.primary"
          >
            Forecast Results
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mt={0.75}
          >
            Detailed forecast predictions
            for the selected context.
          </Typography>

          <Typography
            variant="body2"
            fontWeight={700}
            color="#1264FF"
            mt={1}
          >
            {filters.entityId}
            {" • "}
            {metricLabel}
            {" • "}
            {filters.horizon ===
            "daily"
              ? "Tactical"
              : "Strategic"}
            {" • "}
            {filters.scenario}
          </Typography>

        </Box>


        <Chip
          icon={
            <VisibilityRounded />
          }
          label={`${resultRows.length} results`}
          sx={{
            fontWeight: 700,
            bgcolor:
              "rgba(18, 100, 255, 0.08)",
            color: "#1264FF",
            flexShrink: 0,
          }}
        />

      </Stack>


      {/* TABLE */}

      <Box
        sx={{
          width: "100%",
          overflowX: "auto",
        }}
      >

        <Box
          component="table"
          sx={{
            width: "100%",
            minWidth: 760,
            borderCollapse:
              "collapse",

            "& th": {
              textAlign: "left",
              backgroundColor:
                "#F7F9FC",
              color:
                "#475569",
              fontSize: 13,
              fontWeight: 700,
              padding:
                "16px 18px",
              borderBottom:
                "1px solid #E5EAF0",
              whiteSpace:
                "nowrap",
            },

            "& td": {
              padding:
                "17px 18px",
              borderBottom:
                "1px solid #EEF1F5",
              color:
                "text.primary",
              fontSize: 14,
              whiteSpace:
                "nowrap",
            },

            "& tbody tr:hover": {
              backgroundColor:
                "#FAFBFD",
            },

            "& tbody tr:last-child td": {
              borderBottom:
                "none",
            },
          }}
        >

          <thead>

            <tr>

              <th>
                Forecast Date
              </th>

              <th>
                {metricLabel}
              </th>

              <th>
                Stockpile
              </th>

              <th>
                Horizon Step
              </th>

              <th>
                Status
              </th>

            </tr>

          </thead>


          <tbody>

            {resultRows.map(
              (
                row: ResultRow
              ) => {

                const negativeStockpile =
                  row.stockpile < 0;

                return (
                  <tr
                    key={row.id}
                  >

                    <td>
                      <Typography
                        fontWeight={600}
                      >
                        {formatDate(
                          row.date
                        )}
                      </Typography>
                    </td>


                    <td>
                      <Typography
                        fontWeight={700}
                      >
                        {formatNumber(
                          row.prediction
                        )}{" "}
                        {metricUnit}
                      </Typography>
                    </td>


                    <td>

                      <Typography
                        fontWeight={700}
                        color={
                          negativeStockpile
                            ? "#D32F2F"
                            : "text.primary"
                        }
                      >
                        {formatNumber(
                          row.stockpile
                        )}{" "}
                        tonnes
                      </Typography>

                    </td>


                    <td>
                      {records.find(
                        (
                          record: ForecastRecord
                        ) =>
                          record.event_date ===
                          row.date
                      )?.horizon_step ??
                        "—"}
                    </td>


                    <td>

                      <Chip
                        size="small"
                        icon={
                          negativeStockpile ? (
                            <ErrorOutlineRounded />
                          ) : (
                            <CheckCircleRounded />
                          )
                        }
                        label={
                          negativeStockpile
                            ? "Attention"
                            : "Available"
                        }
                        sx={{
                          fontWeight: 700,

                          bgcolor:
                            negativeStockpile
                              ? "rgba(211,47,47,0.08)"
                              : "rgba(46,125,50,0.08)",

                          color:
                            negativeStockpile
                              ? "#D32F2F"
                              : "#2E7D32",

                          "& .MuiChip-icon": {
                            color:
                              "inherit",
                          },
                        }}
                      />

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </Box>

      </Box>

    </Box>
  );
};


export default ForecastResults;