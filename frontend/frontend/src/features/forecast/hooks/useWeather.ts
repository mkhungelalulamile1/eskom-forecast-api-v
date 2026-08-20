import {
  useQuery,
} from "@tanstack/react-query";

import weatherService from "../service/weather.service";

import {
  WeatherRecord,
  WeatherSummaryData,
  WeatherOutlookDay,
  WeatherSignalsData,
} from "../types/weather.types";


/**
 * =====================================================
 * RAW WEATHER DATA
 * =====================================================
 *
 * Gets weather data for the selected entity.
 *
 * startDate / endDate are optional.
 *
 * They are especially important for analytical
 * components such as WeatherCorrelation because
 * weather must cover the exact same dates as the
 * forecast data.
 */
export const useWeatherData = (
  entityId: string,
  startDate?: string,
  endDate?: string
) => {
  return useQuery<
    WeatherRecord[]
  >({
    queryKey: [
      "weather-data",
      entityId,
      startDate,
      endDate,
    ],

    queryFn: () =>
      weatherService.getWeatherData(
        entityId,
        startDate,
        endDate
      ),

    /**
     * Do not request weather until we know
     * the entity and the requested date range.
     *
     * This prevents the correlation component
     * from initially loading the default weather
     * window and then trying to match it against
     * a completely different forecast period.
     */
    enabled:
      Boolean(
        entityId &&
        startDate &&
        endDate
      ),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};


/**
 * =====================================================
 * WEATHER SUMMARY
 * =====================================================
 */

export const useWeatherSummary = (
  entityId: string
) => {
  return useQuery<
    WeatherSummaryData | null
  >({
    queryKey: [
      "weather-summary",
      entityId,
    ],

    queryFn: () =>
      weatherService.getWeatherSummary(
        entityId
      ),

    enabled:
      Boolean(entityId),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};


/**
 * =====================================================
 * WEATHER OUTLOOK
 * =====================================================
 */

export const useWeatherOutlook = (
  entityId: string,
  days: number
) => {
  return useQuery<
    WeatherOutlookDay[]
  >({
    queryKey: [
      "weather-outlook",
      entityId,
      days,
    ],

    queryFn: () =>
      weatherService.getWeatherOutlook(
        entityId,
        days
      ),

    enabled:
      Boolean(entityId),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};


/**
 * =====================================================
 * WEATHER SIGNALS
 * =====================================================
 */

export const useWeatherSignals = (
  entityId: string,
  days: number
) => {
  return useQuery<
    WeatherSignalsData
  >({
    queryKey: [
      "weather-signals",
      entityId,
      days,
    ],

    queryFn: () =>
      weatherService.getWeatherSignals(
        entityId,
        days
      ),

    enabled:
      Boolean(entityId),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};