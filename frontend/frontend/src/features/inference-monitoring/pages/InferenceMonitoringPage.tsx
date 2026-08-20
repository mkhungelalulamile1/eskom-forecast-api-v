import React from "react";

import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";

import {
  useInferenceMonitoring,
} from "../hooks/useInferenceMonitoring";

import MonitoringSummary from "../components/MonitoringSummary";
import ResourceHealth from "../components/ResourceHealth";
import LatencyChart from "../components/LatencyChart";
import InferenceActivity from "../components/InferenceActivity";
import ResourceActivityTable from "../components/ResourceActivityTable";
import RecentErrors from "../components/RecentErrors";
import RunForecastButton from "../components/RunForecastButton";


const InferenceMonitoringPage = () => {
  const {
    summary,
    events,
    isLoading,
    isError,
    error,
  } = useInferenceMonitoring();


  /*
   * ------------------------------------------------------------
   * Loading
   * ------------------------------------------------------------
   */

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }


  /*
   * ------------------------------------------------------------
   * Error
   * ------------------------------------------------------------
   */

  if (isError || !summary) {
    return (
      <Box
        sx={{
          p: {
            xs: 2,
            md: 3,
          },
        }}
      >
        <Alert severity="error">
          <Typography fontWeight={600}>
            Unable to load inference monitoring data.
          </Typography>

          {error instanceof Error && (
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
              }}
            >
              {error.message}
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }


  /*
   * ------------------------------------------------------------
   * Safe data references
   *
   * The backend may legitimately return empty arrays when no
   * inference has run since the API process started.
   * ------------------------------------------------------------
   */

  const runs =
    summary.runs ?? [];


  const resources =
    summary.resources ?? [];


  const monitoringEvents =
    events ?? [];


  return (
    <Box
      sx={{
        width: "100%",
        boxSizing: "border-box",
      }}
    >

      {/* ======================================================
          PAGE HEADER / RUN FORECAST
          ====================================================== */}

      <Box
        sx={{
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

          mb: 3,
        }}
      >

        <Box>
          <Typography
            variant="h5"
            fontWeight={800}
          >
            Inference Monitoring
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
            }}
          >
            Monitor forecasting executions,
            resource health and inference activity.
          </Typography>
        </Box>


        <RunForecastButton />

      </Box>


      {/* ======================================================
          SUMMARY / KPIs
          ====================================================== */}

      <MonitoringSummary
        summary={summary}
      />


      {/* ======================================================
          LATENCY + RECENT ERRORS
          ====================================================== */}

      <Grid
        container
        spacing={2}
        sx={{
          mb: 3,
        }}
      >

        <Grid
          item
          xs={12}
          lg={7}
        >
          <LatencyChart
            runs={runs}
          />
        </Grid>


        <Grid
          item
          xs={12}
          lg={5}
        >
          <RecentErrors
            events={monitoringEvents}
          />
        </Grid>

      </Grid>


      {/* ======================================================
          RESOURCE HEALTH
          ====================================================== */}

      <Box
        sx={{
          mb: 3,
        }}
      >
        <ResourceHealth
          resources={resources}
        />
      </Box>


      {/* ======================================================
          INFERENCE ACTIVITY
          ====================================================== */}

      <Box
        sx={{
          mb: 3,
        }}
      >
        <InferenceActivity
          runs={runs}
        />
      </Box>


      {/* ======================================================
          RESOURCE ACTIVITY
          ====================================================== */}

      <Box
        sx={{
          mb: 3,
        }}
      >
        <ResourceActivityTable
          events={monitoringEvents}
        />
      </Box>


      {/* ======================================================
          FOOTER / MONITORING WINDOW
          ====================================================== */}

      <Box
        sx={{
          pt: 1,
          pb: 2,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
        >
          Monitoring data refreshes automatically
          every 30 seconds.
        </Typography>
      </Box>

    </Box>
  );
};


export default InferenceMonitoringPage;