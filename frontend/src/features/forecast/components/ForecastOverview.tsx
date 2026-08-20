import { Box, Grid } from "@mui/material";

import WeatherIntelligence from "./WeatherIntelligence";
import ForecastStatistics from "./ForecastStatistics";
import ForecastTrendChart from "./ForecastTrendChart";
import ScenarioComparison from "./ScenarioComparison";
import StockpileTrajectory from "./StockpileTrajectory";
import ForecastInsights from "./ForecastInsights";
import WeatherCorrelation from "./WeatherCorrelation";
import StationFleetOverview from "./StationFleetOverview";

import { useForecastContext } from "../../../contexts/ForecastContext";
import { ForecastFilters } from "../types/forecast.types";

/**
 * =====================================================
 * FORECAST OVERVIEW
 * =====================================================
 *
 * Dashboard layout:
 *
 *  1. KPI ticker row
 *
 *  2. Forecast Trend + Scenario Comparison
 *     - ForecastTrendChart
 *       Burn + Supply
 *
 *     - ScenarioComparison
 *       Baseline + Selected Scenario
 *
 *  3. Weather Intelligence
 *
 *  4. Stockpile trajectory + insights
 *
 *  5. Station fleet + weather correlation
 *
 * The ForecastTrendChart and ScenarioComparison are kept
 * side-by-side on desktop and stack on smaller screens.
 */
const ForecastOverview = () => {
  const {
    horizon,
    metric,
    entityId,
    scenario,
  } = useForecastContext();

  const filters: ForecastFilters = {
    horizon,
    metric,
    entityId,
    scenario,
  };

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
      }}
    >

      {/* ==================================================
          1 · KPI TICKER
      ================================================== */}

      <Box
        sx={{
          mb: 3,
          width: "100%",
          minWidth: 0,
        }}
      >
        <ForecastStatistics />
      </Box>


      {/* ==================================================
          2 · FORECAST TREND + SCENARIO COMPARISON
      ==================================================
      
      ForecastTrendChart:
        - Burn
        - Supply

      ScenarioComparison:
        - Baseline
        - Selected weather scenario
      ================================================== */}

      <Grid
        container
        spacing={2.5}
        sx={{
          mb: 2.5,
          width: "100%",
          alignItems: "stretch",
        }}
      >

        {/* -----------------------------------------------
            FORECAST TREND
            Burn + Supply
        ------------------------------------------------ */}

        <Grid
          item
          xs={12}
          lg={6}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              width: "100%",
              minWidth: 0,
              display: "flex",

              "& > *": {
                width: "100%",
                minWidth: 0,
              },
            }}
          >
            <ForecastTrendChart
              filters={filters}
            />
          </Box>
        </Grid>


        {/* -----------------------------------------------
            SCENARIO COMPARISON
            Baseline + Selected Scenario
        ------------------------------------------------ */}

        <Grid
          item
          xs={12}
          lg={6}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              width: "100%",
              minWidth: 0,
              display: "flex",

              "& > *": {
                width: "100%",
                minWidth: 0,
              },
            }}
          >
            <ScenarioComparison
              filters={filters}
            />
          </Box>
        </Grid>

      </Grid>


      {/* ==================================================
          3 · WEATHER INTELLIGENCE
      ================================================== */}

      <Box
        sx={{
          mb: 2.5,
          width: "100%",
          minWidth: 0,
        }}
      >
        <Box
          className="eskom-fade-up"
          sx={{
            width: "100%",
            minWidth: 0,
          }}
        >
          <WeatherIntelligence
            entityId={entityId}
          />
        </Box>
      </Box>


      {/* ==================================================
          4 · STOCKPILE TRAJECTORY + INSIGHTS
      ================================================== */}

      <Grid
        container
        spacing={2.5}
        sx={{
          mb: 2.5,
          width: "100%",
          alignItems: "stretch",
        }}
      >

        {/* Stockpile */}

        <Grid
          item
          xs={12}
          xl={7}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              flex: 1,
              width: "100%",
              minWidth: 0,
            }}
          >
            <StockpileTrajectory
              filters={filters}
            />
          </Box>
        </Grid>


        {/* Insights */}

        <Grid
          item
          xs={12}
          xl={5}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              flex: 1,
              width: "100%",
              minWidth: 0,
            }}
          >
            <ForecastInsights
              filters={filters}
            />
          </Box>
        </Grid>

      </Grid>


      {/* ==================================================
          5 · STATION FLEET + WEATHER CORRELATION
      ================================================== */}

      <Grid
        container
        spacing={2.5}
        sx={{
          width: "100%",
          alignItems: "stretch",
        }}
      >

        {/* Station Fleet */}

        <Grid
          item
          xs={12}
          lg={4}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              flex: 1,
              width: "100%",
              minWidth: 0,
            }}
          >
            <StationFleetOverview />
          </Box>
        </Grid>


        {/* Weather Correlation */}

        <Grid
          item
          xs={12}
          lg={8}
          sx={{
            display: "flex",
            minWidth: 0,
          }}
        >
          <Box
            className="eskom-fade-up"
            sx={{
              flex: 1,
              width: "100%",
              minWidth: 0,
            }}
          >
            <WeatherCorrelation
              filters={filters}
            />
          </Box>
        </Grid>

      </Grid>

    </Box>
  );
};

export default ForecastOverview;