import { Stack } from "@mui/material";

import ForecastContextBar from "../../../components/forecast/ForecastContextBar";

import InferenceStatistics from "../components/InferenceStatistics";
import PipelineStatus from "../components/PipelineStatus";
import ResourceLogs from "../components/ResourceLogs";
import ApiMetrics from "../components/ApiMetrics";
import InferenceHistory from "../components/InferenceHistory";
import ErrorMonitor from "../components/ErrorMonitor";


const InferencePage = () => {

  return (

    <Stack
      spacing={4}
      sx={{
        pb:4,
      }}
    >


      {/*
        Shared forecast context.

        Keeps the same selection
        across Forecast,
        Model Performance,
        and Inference.

        Controls:
        - Horizon
        - Station
        - Scenario
        - Forecast type
      */}
      <ForecastContextBar />



      {/*
        System health summary.

        Shows:

        - API availability
        - Data pipeline status
        - Model service status
        - Last successful inference
      */}
      <InferenceStatistics />



      {/*
        Pipeline execution visibility.

        Shows the journey:

        Data ingestion
              ↓
        Feature processing
              ↓
        Model execution
              ↓
        Prediction generation
              ↓
        Storage update

      */}
      <PipelineStatus />



      {/*
        Resource interaction monitoring.

        Answers:

        "What happened between
         the application and external resources?"

        Examples:

        Azure Storage
        Weather API
        Database
        Model Service

      */}
      <ResourceLogs />



      {/*
        API behaviour monitoring.

        Shows:

        - Request volume
        - Response times
        - Failures
        - Success rate

      */}
      <ApiMetrics />



      {/*
        Inference execution history.

        Provides audit trail:

        - Run ID
        - Model version
        - Duration
        - Status

      */}
      <InferenceHistory />



      {/*
        Error monitoring.

        Shows:

        - Failed operations
        - Error messages
        - Resolution status

      */}
      <ErrorMonitor />


    </Stack>

  );

};


export default InferencePage;