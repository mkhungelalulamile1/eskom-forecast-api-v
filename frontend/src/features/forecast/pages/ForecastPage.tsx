import {
  Box,
  Stack,
} from "@mui/material";

import ForecastContextBar from "../../../components/layout/ForecastContextBar";

import ForecastOverview from "../components/ForecastOverview";

import ExportForecast from "../components/ExportForecast";

import {
  useForecastContext,
} from "../../../contexts/ForecastContext";

import {
  ForecastFilters,
} from "../types/forecast.types";


/**
 * FORECAST PAGE — sticky ForecastContextBar (Horizon / Metric / Power
 * Station / Scenario / Export CSV / Reset — see its per-control data
 * tags) above ForecastOverview, which lays out every live card:
 * KPI statistics, trend chart, scenario comparison, weather
 * intelligence, stockpile trajectory, insights, station fleet and
 * weather correlation. All children are [DATA: DYNAMIC] via
 * /api/scenario-data and /api/weather-data — see each component.
 */

const ForecastPage = () => {

  const {
    horizon,
    metric,
    entityId,
    scenario,
  } = useForecastContext();


  const filters:
    ForecastFilters = {
      horizon,
      metric,
      entityId,
      scenario,
    };


  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
      }}
    >

      <Stack
        spacing={0}
        sx={{
          width: "100%",
          minWidth: 0,
        }}
      >

        {/* ==================================================
            STICKY FORECAST CONTEXT
        ================================================== */}

        <ForecastContextBar
          exportAction={
            <ExportForecast
              filters={
                filters
              }
            />
          }
        />


        {/* ==================================================
            FORECAST OVERVIEW
        ================================================== */}

        <Box
          sx={{
            width: "100%",
            minWidth: 0,
            mt: 0,
          }}
        >

          <ForecastOverview />

        </Box>

      </Stack>

    </Box>
  );
};


export default ForecastPage;