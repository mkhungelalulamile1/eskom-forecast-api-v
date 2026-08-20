// DashboardPage is NOT routed (no entry in routes/navigation) — dead screen.
// [DATA: DYNAMIC] its panels fetch /api/scenario-data + /api/weather-data +
// /api/inference-monitoring/summary via their own hooks (ForecastSummary,
// ForecastTrend, RecentForecasts, WeatherSummary, StationStatus, DashboardKPIs).
import Grid from "@mui/material/Grid";

import DashboardKPIs from "./DashboardKPIs";
import ForecastTrend from "./ForecastTrend";
import RecentForecasts from "./RecentForecasts";
import StationHealth from "./StationHealth";
import WeatherSummary from "./WeatherSummary";

const DashboardContent = () => {
  return (
    <Grid
      container
      spacing={{
        xs: 2,
        md: 3,
      }}
    >
      {/* KPI Cards */}
      <Grid item xs={12}>
        <DashboardKPIs />
      </Grid>

      {/* Charts & Operational Overview */}
      <Grid item xs={12} lg={8}>
        <ForecastTrend />
      </Grid>

      <Grid item xs={12} lg={4}>
          <StationHealth />
      </Grid>

      {/* Forecast History & Weather */}
      <Grid item xs={12} lg={8}>
        <RecentForecasts />
      </Grid>

      <Grid item xs={12} lg={4}>
        <WeatherSummary />
      </Grid>
    </Grid>
  );
};

export default DashboardContent;