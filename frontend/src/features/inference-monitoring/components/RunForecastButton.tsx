import React, { useState } from "react";

import {
  Alert,
  Button,
  CircularProgress,
  Snackbar,
} from "@mui/material";

import {
  PlayArrowRounded,
} from "@mui/icons-material";

import {
  useQueryClient,
} from "@tanstack/react-query";
import { useForecastContext } from "../../../contexts/ForecastContext";



type ForecastHorizon =
  | "daily"
  | "monthly";


interface RunForecastResponse {
  status?: string;
  message?: string;
  error?: string;
}


const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "http://127.0.0.1:8000";


const RunForecastButton = () => {

  const {
    horizon,
  } = useForecastContext();


  const queryClient =
    useQueryClient();


  const [
    isRunning,
    setIsRunning,
  ] = useState(false);


  const [
    snackbar,
    setSnackbar,
  ] = useState<{
    open: boolean;
    severity:
      | "success"
      | "error";
    message: string;
  }>({
    open: false,
    severity: "success",
    message: "",
  });


  const runForecast = async () => {

    const selectedHorizon =
      horizon as ForecastHorizon;


    setIsRunning(true);


    try {

      const response =
        await fetch(
          `${API_BASE_URL}/api/run-forecast`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              horizon:
                selectedHorizon,
            }),
          }
        );


      let data:
        RunForecastResponse = {};


      try {

        data =
          await response.json();

      } catch {
        // Backend returned no JSON.
      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          data.message ||
          `Forecast request failed (HTTP ${response.status}).`
        );

      }


      /*
       * The forecast has now been generated.
       *
       * Refresh all React Query data so the
       * dashboard picks up the newly generated
       * forecast and monitoring information.
       */
      await queryClient.invalidateQueries();


      setSnackbar({
        open: true,

        severity:
          "success",

        message:
          data.message ||
          `${
            selectedHorizon === "daily"
              ? "Daily"
              : "Monthly"
          } forecast completed successfully.`,
      });


    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : "Unable to run the forecast.";


      setSnackbar({
        open: true,

        severity:
          "error",

        message,
      });


    } finally {

      setIsRunning(false);

    }

  };


  const horizonLabel =
    horizon === "daily"
      ? "Daily Forecast"
      : "Monthly Forecast";


  return (
    <>
      <Button
        variant="contained"

        onClick={
          runForecast
        }

        disabled={
          isRunning
        }

        startIcon={
          isRunning ? (
            <CircularProgress
              size={18}
              color="inherit"
            />
          ) : (
            <PlayArrowRounded />
          )
        }

        sx={{
          minWidth: 175,

          height: 42,

          px: 2,

          borderRadius: 2.5,

          textTransform:
            "none",

          fontWeight: 800,

          boxShadow:
            "0 6px 16px rgba(0,56,150,0.18)",
        }}
      >
        {isRunning
          ? "Running..."
          : `Run ${horizonLabel}`}
      </Button>


      <Snackbar
        open={
          snackbar.open
        }

        autoHideDuration={
          6000
        }

        onClose={() =>
          setSnackbar(
            (current) => ({
              ...current,

              open: false,
            })
          )
        }

        anchorOrigin={{
          vertical:
            "bottom",

          horizontal:
            "right",
        }}
      >

        <Alert
          severity={
            snackbar.severity
          }

          variant="filled"

          onClose={() =>
            setSnackbar(
              (current) => ({
                ...current,

                open: false,
              })
            )
          }
        >
          {
            snackbar.message
          }
        </Alert>

      </Snackbar>
    </>
  );
};


export default RunForecastButton;