import React, {
  Fragment,
} from "react";

import {
  Box,
  Chip,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";

import {
  ErrorRounded,
  TableChartRounded,
} from "@mui/icons-material";

import {
  ModelMetricRecord,
  PerformanceHorizon,
} from "../types/model-performance.types";

import {
  useModelMetrics,
} from "../hooks/useModelPerformance";




import {
  cardBorderColor,
  cardFill,
  hairlineColor,
  infoTint,
  softBorderColor,
  softText,
} from "../../../theme/surfaces";

import {
  useForecastContext,
} from "../../../contexts/ForecastContext";

interface ModelAccuracyMatrixProps {
  horizon: PerformanceHorizon;
  entityId: string;
}



type Target =
  | "Input"
  | "Replenishment"
  | "Stockpile";



type Status =
  | "good"
  | "warning"
  | "poor"
  | "neutral";



const ModelAccuracyMatrix = ({
  horizon,
  entityId,
}: ModelAccuracyMatrixProps) => {
  const {
    data,
    isLoading,
    isError,
  } = useModelMetrics();

  const theme = useTheme();

  const isDark =
    theme.palette.mode === "dark";

  /*
   * The matrix is a station picker as well as a table:
   * clicking a row selects that power station globally.
   */
  const { setEntityId } =
    useForecastContext();

  /* Shared surface tones for the table chrome. */
  const headBg = isDark
    ? "#16243C"
    : "#F8FAFD";

  /*
   * The station column is sticky while the metric columns scroll
   * underneath it, so it has to stay opaque — a transparent cell
   * would let the numbers bleed through it.
   */
  const stationBg = isDark
    ? "#121F36"
    : "#FFFFFF";

  const selectedBg = isDark
    ? "rgba(79,181,234,0.16)"
    : "#EEF4FF";

  const selectedInk = isDark
    ? "#6FC5F0"
    : "#1264FF";

  const rowBorder = hairlineColor(theme);



  /*
   * --------------------------------------------------
   * HORIZON
   * --------------------------------------------------
   */

  const horizonKey =
    horizon === "daily"
      ? "tactical"
      : "strategic";



  /*
   * --------------------------------------------------
   * FILTER BACKEND DATA
   * --------------------------------------------------
   *
   * Backend targets:
   *
   * Input          -> Burn
   * Replenishment  -> Supply
   * Stockpile      -> Stockpile
   */

  const rows: ModelMetricRecord[] =
    (data ?? [])
      .filter(
        (
          record: ModelMetricRecord
        ) =>
          record.horizon ===
          horizonKey
      )
      .filter(
        (
          record: ModelMetricRecord
        ) =>
          record.target ===
            "Input" ||
          record.target ===
            "Replenishment" ||
          record.target ===
            "Stockpile"
      );



  /*
   * --------------------------------------------------
   * POWER STATIONS
   * --------------------------------------------------
   */

  const entities: string[] =
    Array.from(
      new Set(
        rows.map(
          (
            record: ModelMetricRecord
          ) =>
            record.entity_id
        )
      )
    );



  /*
   * --------------------------------------------------
   * HELPERS
   * --------------------------------------------------
   */

  const getStationLabel = (
    entity: string
  ): string => {
    return entity
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  };



  /*
   * --------------------------------------------------
   * GET METRIC FOR STATION + TARGET
   * --------------------------------------------------
   */

  const getMetric = (
    entity: string,
    target: Target
  ): ModelMetricRecord | null => {
    return (
      rows.find(
        (
          record: ModelMetricRecord
        ) =>
          record.entity_id ===
            entity &&
          record.target ===
            target
      ) ?? null
    );
  };



  /*
   * --------------------------------------------------
   * PERFORMANCE STATUS
   * --------------------------------------------------
   *
   * NRMSE:
   *
   * <= 25  -> Good
   * <= 50  -> Review
   * > 50   -> Attention
   */

  const statusFor = (
    metric:
      | ModelMetricRecord
      | null
  ): Status => {
    if (!metric) {
      return "neutral";
    }

    if (
      metric.nrmse !==
        null &&
      metric.nrmse !==
        undefined &&
      metric.nrmse <= 25
    ) {
      return "good";
    }

    if (
      metric.nrmse !==
        null &&
      metric.nrmse !==
        undefined &&
      metric.nrmse <= 50
    ) {
      return "warning";
    }

    if (
      metric.nrmse !==
        null &&
      metric.nrmse !==
        undefined
    ) {
      return "poor";
    }

    return "neutral";
  };



  /*
   * --------------------------------------------------
   * TARGET CONFIGURATION
   * --------------------------------------------------
   */

  const targetConfig: {
    target: Target;
    label: string;
    color: string;
    lightColor: string;
    borderColor: string;
  }[] = [
    {
      target: "Input",
      label: "Burn",
      color: isDark ? "#6FC5F0" : "#1264FF",
      lightColor: isDark
        ? alpha("#4FB5EA", 0.14)
        : "#EEF4FF",
      borderColor: isDark
        ? alpha("#4FB5EA", 0.5)
        : "#D7E5FF",
    },

    {
      target: "Replenishment",
      label: "Supply",
      color: isDark ? "#5AD9A6" : "#008C6A",
      lightColor: isDark
        ? alpha("#34C48B", 0.14)
        : "#ECF8F3",
      borderColor: isDark
        ? alpha("#34C48B", 0.5)
        : "#CDEDE1",
    },

    {
      target: "Stockpile",
      label: "Stockpile",
      /* amber text on the light amber tint needs to be darker to stay
         readable (the bright #F59E0B only scored 2:1) */
      color: isDark ? "#FFD25E" : "#B45309",
      lightColor: isDark
        ? alpha("#F5BC2C", 0.14)
        : "#FFF7E8",
      borderColor: isDark
        ? alpha("#F5BC2C", 0.5)
        : "#F7DFC0",
    },
  ];



  /*
   * --------------------------------------------------
   * LOADING
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
          Loading model accuracy
          metrics...
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
          bgcolor: "background.paper",

          border:
            "1px solid #F0C7CC",

          borderRadius: "12px",

          p: {
            xs: 2.5,
            md: 4,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
        >
          <ErrorRounded
            sx={{
              color: "#DC2626",
            }}
          />

          <Box>
            <Typography
              fontWeight={800}
              color="text.primary"
            >
              Unable to load model
              performance
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.25}
            >
              The backend did not return
              model accuracy metrics.
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }



  /*
   * --------------------------------------------------
   * EMPTY STATE
   * --------------------------------------------------
   */

  if (entities.length === 0) {
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

          textAlign: "center",
        }}
      >
        <TableChartRounded
          sx={{
            fontSize: 42,
            color: softText,
            mb: 1,
          }}
        />

        <Typography
          fontWeight={800}
          color="text.primary"
        >
          No model performance
          data available
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mt={0.5}
        >
          There are no evaluation metrics
          available for the selected
          horizon.
        </Typography>
      </Box>
    );
  }



  /*
   * --------------------------------------------------
   * MAIN COMPONENT
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
          xs: 2,
          sm: 2.5,
          md: 4,
        },

        boxShadow:
          "0 8px 24px rgba(23,43,77,0.04)",

        overflow: "hidden",
      }}
    >
      {/* ==================================================
          HEADER
      ================================================== */}

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
        mb={3}
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
              bgcolor: infoTint,
              color: selectedInk,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TableChartRounded />
          </Box>

          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
              color="text.primary"
            >
              Model Accuracy by Power
              Station
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              mt={0.5}
            >
              {horizon === "daily"
                ? "Tactical Daily"
                : "Strategic Monthly"}{" "}
              evaluation across Burn,
              Supply and Stockpile models.
            </Typography>
          </Box>
        </Stack>



        <Chip
          label={
            entityId
              ? `Selected: ${getStationLabel(
                  entityId
                )}`
              : `${entities.length} stations`
          }
          sx={{
            bgcolor: "transparent",
            color: softText,
            border: `1px solid ${softBorderColor(theme)}`,
            fontWeight: 700,
            borderRadius: "10px",
          }}
        />
      </Stack>



      {/* ==================================================
          MODEL LEGEND
      ================================================== */}

      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(3, minmax(0, 1fr))",
          },

          gap: 1.5,

          mb: 3,
        }}
      >
        {targetConfig.map(
          (config) => (
            <Box
              key={
                config.target
              }
              sx={{
                border:
                  `1px solid ${config.borderColor}`,

                bgcolor: isDark
                  ? "transparent"
                  : config.lightColor,

                borderRadius: "12px",

                px: 2,

                py: 1.5,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius:
                      "50%",
                    bgcolor:
                      config.color,
                  }}
                />

                <Typography
                  fontWeight={800}
                  color={
                    config.color
                  }
                >
                  {config.label}
                </Typography>
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display:
                    "block",
                  mt: 0.5,
                }}
              >
                {config.target ===
                "Input"
                  ? "Coal burn forecasting"
                  : config.target ===
                      "Replenishment"
                    ? "Supply forecasting"
                    : "Stockpile position forecasting"}
              </Typography>
            </Box>
          )
        )}
      </Box>



      {/* ==================================================
          TABLE
      ================================================== */}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: {
            xs: "block",
            xl: "none",
          },
          mb: 1,
          fontWeight: 600,
        }}
      >
        Tip: select a row to switch the dashboard to that power
        station · scroll sideways for the Stockpile model →
      </Typography>

      <Box
        sx={{
          width: "100%",
          overflowX: "auto",

          border: "1px solid",
          borderColor: "divider",

          borderRadius: "12px",

          "&::-webkit-scrollbar":
            {
              height: 8,
            },

          "&::-webkit-scrollbar-thumb":
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.28)"
                : "#CBD5E1",

              borderRadius: "12px",
            },
        }}
      >
        <Box
          component="table"
          sx={{
            width: "100%",

            minWidth: 1180,

            borderCollapse:
              "separate",

            borderSpacing: 0,

            tableLayout:
              "fixed",

            /*
             * -----------------------------------------
             * TABLE HEAD
             * -----------------------------------------
             */

            "& th": {
              fontSize:
                "0.72rem",

              fontWeight: 800,

              letterSpacing:
                0.6,

              textTransform:
                "uppercase",

              color: softText,

              borderBottom:
                "1px solid",
              borderColor:
                "divider",

              whiteSpace:
                "nowrap",
            },

            /*
             * -----------------------------------------
             * TABLE CELLS
             * -----------------------------------------
             */

            "& td": {
              borderBottom: `1px solid ${rowBorder}`,

              color:
                "text.primary",

              fontSize:
                "0.875rem",

              whiteSpace:
                "nowrap",
            },

            /*
             * -----------------------------------------
             * ROW HOVER
             * -----------------------------------------
             */

            "& tbody tr:hover td":
              {
                bgcolor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "#F4F7FC",
              },

            "& tbody tr:last-child td":
              {
                borderBottom:
                  "none",
              },
          }}
        >
          <colgroup>
            <col
              style={{
                width: 190,
              }}
            />

            <col
              span={4}
              style={{
                width: 125,
              }}
            />

            <col
              span={4}
              style={{
                width: 125,
              }}
            />

            <col
              span={4}
              style={{
                width: 125,
              }}
            />
          </colgroup>



          {/* ==================================================
              HEADER ROW 1 — MODEL GROUPS
          ================================================== */}

          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  position:
                    "sticky",

                  left: 0,

                  zIndex: 5,

                  background: headBg,

                  textAlign:
                    "left",

                  padding:
                    "18px 16px",
                }}
              >
                Power Station
              </th>



              {targetConfig.map(
                (config) => (
                  <th
                    key={
                      config.target
                    }
                    colSpan={4}
                    style={{
                      padding:
                        "14px 12px",

                      textAlign:
                        "center",

                      background:
                        config.lightColor,

                      color:
                        config.color,

                      borderBottom:
                        `2px solid ${config.borderColor}`,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Box
                        sx={{
                          width: 9,
                          height: 9,
                          borderRadius:
                            "50%",

                          bgcolor:
                            config.color,
                        }}
                      />

                      <Typography
                        component="span"
                        fontSize="0.78rem"
                        fontWeight={800}
                      >
                        {config.label}
                      </Typography>
                    </Stack>
                  </th>
                )
              )}
            </tr>



            {/* ==================================================
                HEADER ROW 2 — METRICS
            ================================================== */}

            <tr>
              {targetConfig.map(
                (config) => {
                  const headers =
                    config.target ===
                    "Stockpile"
                      ? [
                          "RMSE",
                          "MAE",
                          "R²",
                          "NRMSE (%)",
                        ]
                      : [
                          "RMSE",
                          "MAE",
                          "SMAPE (%)",
                          "NRMSE (%)",
                        ];

                  return headers.map(
                    (
                      header,
                      index
                    ) => (
                      <th
                        key={`${config.target}-${header}-${index}`}
                        style={{
                          padding:
                            "12px",

                          textAlign:
                            "right",

                          background: headBg,
                        }}
                      >
                        {header}
                      </th>
                    )
                  );
                }
              )}
            </tr>
          </thead>



          {/* ==================================================
              BODY
          ================================================== */}

          <tbody>
            {entities.map(
              (entity) => {
                const isSelected =
                  entity ===
                  entityId;

                return (
                  <Box
                    component="tr"
                    key={entity}
                    onClick={() =>
                      setEntityId(entity)
                    }
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onKeyDown={(
                      event: React.KeyboardEvent
                    ) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        setEntityId(entity);
                      }
                    }}
                    sx={{
                      cursor: "pointer",

                      /* Selected station highlights the whole row. */
                      "& td": isSelected
                        ? {
                            bgcolor: selectedBg,
                          }
                        : undefined,

                      "&:hover td": {
                        bgcolor: isSelected
                          ? selectedBg
                          : isDark
                            ? "rgba(255,255,255,0.06)"
                            : "#F4F7FC",
                      },

                      "&:focus-visible": {
                        outline: `2px solid ${selectedInk}`,
                        outlineOffset: -2,
                      },
                    }}
                  >
                    {/* ------------------------------------------
                        STATION
                    ------------------------------------------ */}

                    <Box
                      component="td"
                      sx={{
                        position:
                          "sticky",

                        left: 0,

                        zIndex: 2,

                        bgcolor: isSelected
                          ? selectedBg
                          : stationBg,

                        p: "14px 16px",

                        borderRight: `1px solid ${rowBorder}`,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                      >
                        {isSelected && (
                          <Box
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius:
                                "50%",

                              bgcolor:
                                selectedInk,

                              flexShrink:
                                0,
                            }}
                          />
                        )}

                        <Typography
                          fontWeight={
                            isSelected
                              ? 800
                              : 600
                          }
                          color={
                            isSelected
                              ? selectedInk
                              : "text.primary"
                          }
                        >
                          {getStationLabel(
                            entity
                          )}
                        </Typography>
                      </Stack>
                    </Box>



                    {/* ------------------------------------------
                        EACH MODEL
                    ------------------------------------------ */}

                    {targetConfig.map(
                      (config) => {
                        const metric =
                          getMetric(
                            entity,
                            config.target
                          );

                        const status =
                          statusFor(
                            metric
                          );

                        return (
                          <Fragment
                            key={
                              config.target
                            }
                          >
                            <MetricCell
                              value={
                                metric?.rmse
                              }
                              status={
                                status
                              }
                            />

                            <MetricCell
                              value={
                                metric?.mae
                              }
                              status={
                                status
                              }
                            />

                            {config.target ===
                            "Stockpile" ? (
                              <MetricCell
                                value={
                                  metric?.r2
                                }
                                status={
                                  status
                                }
                              />
                            ) : (
                              <MetricCell
                                value={
                                  metric?.smape
                                }
                                status={
                                  status
                                }
                                suffix="%"
                              />
                            )}

                            <MetricCell
                              value={
                                metric?.nrmse
                              }
                              status={
                                status
                              }
                              suffix="%"
                            />
                          </Fragment>
                        );
                      }
                    )}
                  </Box>
                );
              }
            )}
          </tbody>
        </Box>
      </Box>



      {/* ==================================================
          LEGEND
      ================================================== */}

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        spacing={{
          xs: 1,
          sm: 3,
        }}
        mt={2}
        alignItems={{
          xs: "flex-start",
          sm: "center",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
        >
          NRMSE performance:
        </Typography>

        <StatusLegend
          color="#16A34A"
          label="Good ≤ 25%"
        />

        <StatusLegend
          color="#F59E0B"
          label="Review 25–50%"
        />

        <StatusLegend
          color="#DC2626"
          label="Attention > 50%"
        />
      </Stack>



      {/* ==================================================
          EXPLANATION
      ================================================== */}

      <Box
        sx={{
          mt: 2.5,
          p: 2,

          borderRadius: "12px",

          bgcolor: "transparent",

          border: `1px solid ${softBorderColor(theme)}`,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            lineHeight: 1.7,
          }}
        >
          <strong>
            How to read this table:
          </strong>{" "}
          Lower RMSE, MAE, SMAPE and NRMSE
          generally indicate smaller prediction
          errors. For Stockpile, R² is shown
          instead of SMAPE because stockpile is
          a signed cumulative quantity that can
          cross zero. The table is populated
          directly from the model evaluation
          metrics returned by the backend.
        </Typography>
      </Box>
    </Box>
  );
};



/*
 * ==================================================
 * METRIC CELL
 * ==================================================
 */

interface MetricCellProps {
  value:
    | number
    | null
    | undefined;

  status: Status;

  suffix?: string;
}



const MetricCell = ({
  value,
  status,
  suffix = "",
}: MetricCellProps) => {
  const statusColor =
    status === "good"
      ? "#16A34A"
      : status === "warning"
        ? "#F59E0B"
        : status === "poor"
          ? "#DC2626"
          : "#7C8BA6";

  return (
    <td
      style={{
        padding:
          "14px 12px",

        textAlign:
          "right",
      }}
    >
      <Stack
        direction="row"
        spacing={0.8}
        justifyContent="flex-end"
        alignItems="center"
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius:
              "50%",

            bgcolor:
              statusColor,

            flexShrink: 0,
          }}
        />

        <Typography
          component="span"
          fontSize="0.875rem"
          fontWeight={700}
          color="text.primary"
        >
          {value ===
            null ||
          value ===
            undefined ||
          !Number.isFinite(
            value
          )
            ? "—"
            : `${value.toLocaleString(
                "en-US",
                {
                  minimumFractionDigits:
                    2,

                  maximumFractionDigits:
                    2,
                }
              )}${suffix}`}
        </Typography>
      </Stack>
    </td>
  );
};



/*
 * ==================================================
 * STATUS LEGEND
 * ==================================================
 */

interface StatusLegendProps {
  color: string;
  label: string;
}



const StatusLegend = ({
  color,
  label,
}: StatusLegendProps) => {
  return (
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
          bgcolor: color,
        }}
      />

      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
      >
        {label}
      </Typography>
    </Stack>
  );
};



export default ModelAccuracyMatrix;