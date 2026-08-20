import { Box } from "@mui/material";

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
 *
 *  3. Weather Intelligence
 *
 *  4. Stockpile trajectory + insights
 *
 *  5. Station fleet + weather correlation
 *
 * LAYOUT NOTE
 * -----------
 * Every row is a plain CSS grid rather than a MUI `<Grid container>`.
 * The MUI grid implements gutters with negative margins plus a
 * `calc(100% + gutter)` width; combined with the `width: 100%`
 * overrides this file used to set, the rows below the KPI ticker
 * ended ~20px short of it. With CSS grid, all rows — including
 * Scenario Comparison — start and finish on exactly the same edges
 * as the Forecast Horizon KPI card above them.
 */

const ROW_GAP = 2.5;

const ForecastOverview = () => {
  const { horizon, metric, entityId, scenario } = useForecastContext();

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
        display: "flex",
        flexDirection: "column",
        gap: ROW_GAP,
      }}
    >
      {/* ==================================================
          1 · KPI TICKER
      ================================================== */}

      <ForecastStatistics />

      {/* ==================================================
          2 · FORECAST TREND + SCENARIO COMPARISON
      ================================================== */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
          gap: ROW_GAP,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <ForecastTrendChart filters={filters} />
        </Box>

        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <ScenarioComparison filters={filters} />
        </Box>
      </Box>

      {/* ==================================================
          3 · WEATHER INTELLIGENCE
      ================================================== */}

      <Box className="eskom-fade-up" sx={{ width: "100%", minWidth: 0 }}>
        <WeatherIntelligence entityId={entityId} />
      </Box>

      {/* ==================================================
          4 · STOCKPILE TRAJECTORY + INSIGHTS
      ================================================== */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "7fr 5fr",
          },
          gap: ROW_GAP,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <StockpileTrajectory filters={filters} />
        </Box>

        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <ForecastInsights filters={filters} />
        </Box>
      </Box>

      {/* ==================================================
          5 · STATION FLEET + WEATHER CORRELATION
      ================================================== */}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "4fr 8fr",
          },
          gap: ROW_GAP,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <StationFleetOverview />
        </Box>

        <Box className="eskom-fade-up" sx={{ minWidth: 0, display: "flex", "& > *": { width: "100%", minWidth: 0 } }}>
          <WeatherCorrelation filters={filters} />
        </Box>
      </Box>
    </Box>
  );
};

export default ForecastOverview;
