import {
  Box,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import {
  FactCheckRounded,
} from "@mui/icons-material";

import ForecastContextBar from "../../../components/layout/ForecastContextBar";

import {
  useForecastContext,
} from "../../../contexts/ForecastContext";

import ModelPerformanceKPIs from "../components/ModelPerformanceKPIs";
import OotPerformanceChart from "../components/OotPerformanceChart";
import CumulativeBurnHistory from "../components/CumulativeBurnHistory";
import ModelAccuracyMatrix from "../components/ModelAccuracyMatrix";

import {
  PerformanceHorizon,
  PerformanceTarget,
} from "../types/model-performance.types";


/**
 * MODEL PERFORMANCE PAGE — layout + shared filters.
 *
 * Sections and their data sources:
 *  - ForecastContextBar  → see that component (station list broken today).
 *  - Evaluation View     → [DATA: STATIC-UI + USER-STATE] fixed header text;
 *                          the Tactical/Strategic toggle writes the shared
 *                          horizon (drives every child's API filtering).
 *  - ModelPerformanceKPIs → [DATA: DYNAMIC] GET /api/forecast-metrics.
 *  - OotPerformanceChart  → [DATA: DYNAMIC] GET /api/oot-history.
 *  - CumulativeBurnHistory→ [DATA: DYNAMIC] GET /api/oot-history.
 *  - ModelAccuracyMatrix  → [DATA: DYNAMIC] GET /api/forecast-metrics.
 *
 * Metric → parquet column mapping passed to children:
 *   burn → Input, supply → Replenishment, stockpile → Stockpile
 * (each with _actual/_predicted suffixes in the OOT payload).
 *
 * NOTE: the local metrics parquet only contains horizon "tactical"/"
 * tactical_oot" rows, so the Strategic Monthly view renders empty until
 * monthly (strategic) metrics exist in the backend data.
 */
const ModelPerformancePage = () => {

  const {
    horizon,
    metric,
    entityId,
  } = useForecastContext();


  /*
   * -----------------------------------------------------
   * FORECAST HORIZON
   * -----------------------------------------------------
   *
   * daily   -> tactical
   * monthly -> strategic
   */

  const performanceHorizon:
    PerformanceHorizon =
    horizon === "monthly"
      ? "monthly"
      : "daily";


  /*
   * -----------------------------------------------------
   * FORECAST METRIC
   * -----------------------------------------------------
   *
   * burn      -> Input
   * supply    -> Replenishment
   * stockpile -> Stockpile
   */

  const target:
    PerformanceTarget =
    metric === "supply"
      ? "Replenishment"
      : metric === "stockpile"
      ? "Stockpile"
      : "Input";


  const ootMetric:
    | "Input"
    | "Replenishment"
    | "Stockpile" =
    target;


  return (

    <Box
      sx={{
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >

      <Stack spacing={3}>

        {/* ================================================= */}
        {/* FORECAST CONTEXT                                  */}
        {/* ================================================= */}

        <ForecastContextBar />


        {/* ================================================= */}
        {/* EVALUATION VIEW                                  */}
        {/* ================================================= */}

        <Box
          sx={{
            bgcolor:
              "background.paper",

            border:
              "1px solid #E4EAF3",

            borderRadius: 12,

            boxShadow:
              "0 10px 30px rgba(16,32,62,0.05)",

            px: {
              xs: 2.5,
              md: 4,
            },

            py: 2.25,

            display: "flex",

            flexWrap: "wrap",

            justifyContent:
              "space-between",

            alignItems: "center",

            gap: 2,
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
                width: 44,
                height: 44,
                borderRadius: 2.5,

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                bgcolor:
                  "rgba(0,84,166,0.1)",

                color:
                  "primary.main",
              }}
            >

              <FactCheckRounded />

            </Box>


            <Box
              sx={{
                minWidth: 0,
              }}
            >

              <Typography
                variant="subtitle1"
                fontWeight={800}
                color="text.primary"
              >
                Evaluation View
              </Typography>


              <Typography
                variant="body2"
                color="text.secondary"
              >
                Accuracy metrics for the
                selected forecast context.
              </Typography>

            </Box>

          </Stack>


          <ToggleButtonGroup
            exclusive
            value={performanceHorizon}
            size="small"
            disabled
            sx={{
              flexShrink: 0,
            }}
          >

            <ToggleButton
              value="daily"
              sx={{
                fontWeight: 700,
              }}
            >
              Tactical Daily
            </ToggleButton>


            <ToggleButton
              value="monthly"
              sx={{
                fontWeight: 700,
              }}
            >
              Strategic Monthly
            </ToggleButton>

          </ToggleButtonGroup>

        </Box>


        {/* ================================================= */}
        {/* PERFORMANCE DASHBOARD                            */}
        {/* ================================================= */}

        <Stack
          spacing={3}
          minWidth={0}
        >

          {/* ================================================= */}
          {/* KPIs                                              */}
          {/* ================================================= */}

          <ModelPerformanceKPIs
            horizon={performanceHorizon}
            entityId={entityId}
          />


          {/* ================================================= */}
          {/* OOT PERFORMANCE                                  */}
          {/* ================================================= */}

          <OotPerformanceChart
            horizon={performanceHorizon}
            entityId={entityId}
            metric={ootMetric}
          />


          {/* ================================================= */}
          {/* CUMULATIVE METRIC HISTORY                        */}
          {/* ================================================= */}

          <CumulativeBurnHistory
            horizon={performanceHorizon}
            entityId={entityId}
            metric={ootMetric}
          />


          {/* ================================================= */}
          {/* MODEL ACCURACY MATRIX                             */}
          {/* ================================================= */}

          <ModelAccuracyMatrix
            horizon={performanceHorizon}
            entityId={entityId}
          />

        </Stack>

      </Stack>

    </Box>
  );
};


export default ModelPerformancePage;