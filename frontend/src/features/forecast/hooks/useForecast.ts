import {
  useQuery,
} from "@tanstack/react-query";

import {
  ForecastEntity,
  ForecastFilters,
  ForecastRecord,
  ForecastStatistics,
} from "../types/forecast.types";

import forecastService from "../service/forecast.service";

/**
 * FORECAST HOOKS — [DATA: DYNAMIC] every hook wraps a live service call
 * (see forecast.service.ts for the exact endpoints and their parquet
 * sources). None of these hooks return mock data; failures propagate to
 * the components' loading/error states.
 */

/** [DATA: DYNAMIC] Filtered /api/scenario-data records for charts/KPIs. */


export const useForecastChart = (
  filters?: ForecastFilters
) => {
  return useQuery<ForecastRecord[]>({
    queryKey: [
      "forecast-chart",
      filters,
    ],

    queryFn: () =>
      forecastService.getForecastChart(
        filters as ForecastFilters
      ),

    enabled:
      Boolean(filters?.entityId),
  });
};




/** [DATA: DYNAMIC] Same records as the chart hook (tables/export consumers). */
export const useForecastResults = (
  filters?: ForecastFilters
) => {
  return useQuery<ForecastRecord[]>({
    queryKey: [
      "forecast-results",
      filters,
    ],

    queryFn: () =>
      forecastService.getForecastResults(
        filters as ForecastFilters
      ),

    enabled:
      Boolean(filters?.entityId),
  });
};




/** [DATA: DYNAMIC] Average/Peak/Projected Volume/Horizon (client-side stats). */
export const useForecastStatistics = (
  filters?: ForecastFilters
) => {
  return useQuery<ForecastStatistics>({
    queryKey: [
      "forecast-statistics",
      filters,
    ],

    queryFn: () =>
      forecastService.getStatistics(
        filters as ForecastFilters
      ),

    enabled:
      Boolean(filters?.entityId),
  });
};


/**
 * [DATA: DYNAMIC] Station list from GET /api/entities, with a live
 * fallback to unique entity_ids in GET /api/scenario-data. Cached 10 min.
 * Once this resolves, ForecastContextBar snaps entityId to the first station.
 */

export const useForecastEntities = () => {
  return useQuery<ForecastEntity[]>({
    queryKey: [
      "forecast-entities",
    ],

    queryFn: () =>
      forecastService.getEntities(),

    staleTime:
      10 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};


/**
 * [DATA: DYNAMIC] GET /api/scenario-data — full payload with scenario_id
 * values: actual, weather_hot_dry, weather_hot_wet, weather_cold_dry,
 * weather_cold_wet. Cached 5 min.
 */

export const useForecastScenarioData = () => {
  return useQuery({
    queryKey: [
      "forecast-scenario-data",
    ],

    queryFn: () =>
      forecastService.getScenarioData(),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};