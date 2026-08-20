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
 * =====================================================
 * FORECAST CHART
 * =====================================================
 */

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


/**
 * =====================================================
 * FORECAST RESULTS
 * =====================================================
 */

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


/**
 * =====================================================
 * FORECAST STATISTICS
 * =====================================================
 */

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
 * =====================================================
 * FORECAST ENTITIES
 * =====================================================
 *
 * Gets the available power stations/entities
 * directly from the backend.
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
 * =====================================================
 * SCENARIO FORECAST DATA
 * =====================================================
 *
 * Gets all scenario forecast data from:
 *
 * GET /api/scenario-data
 *
 * The backend provides:
 *
 * actual
 * weather_hot_dry
 * weather_hot_wet
 * weather_cold_dry
 * weather_cold_wet
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