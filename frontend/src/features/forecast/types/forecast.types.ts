/**
 * ==========================================================
 * FORECAST TYPES
 * ==========================================================
 */

/**
 * A single forecast record returned by the backend.
 *
 * This is used for:
 * - normal forecast data
 * - scenario data
 * - forecast tables
 * - forecast charts
 * - scenario comparison
 */
export interface ForecastRecord {
  entity_id: string;

  event_date: string;

  horizon_step: number;

  /**
   * Backend scenario identifier.
   *
   * Examples:
   * - actual
   * - weather_hot_dry
   * - weather_hot_wet
   * - weather_cold_dry
   * - weather_cold_wet
   */
  scenario_id?: string;

  /**
   * Input / coal burn.
   */
  Input?: number;

  /**
   * Replenishment / supply.
   */
  Replenishment?: number;

  /**
   * Stockpile level.
   */
  Stockpile?: number;

  /**
   * Allow additional backend fields without
   * forcing every backend field into the frontend type.
   */
  [key: string]: unknown;
}


/**
 * ==========================================================
 * SCENARIOS
 * ==========================================================
 */

/**
 * Frontend scenario identifiers.
 */
export type ForecastScenario =
  | "actual"
  | "hotdry"
  | "hotwet"
  | "colddry"
  | "coldwet";


/**
 * ==========================================================
 * HORIZON
 * ==========================================================
 */

export type ForecastHorizon =
  | "daily"
  | "monthly";


/**
 * ==========================================================
 * METRIC
 * ==========================================================
 */

export type ForecastMetric =
  | "burn"
  | "supply"
  | "stockpile";


/**
 * ==========================================================
 * FILTERS
 * ==========================================================
 */

export interface ForecastFilters {
  horizon: ForecastHorizon;

  entityId: string;

  scenario: ForecastScenario;

  metric: ForecastMetric;
}


/**
 * ==========================================================
 * ENTITY
 * ==========================================================
 */

export interface ForecastEntity {
  id: string;

  label: string;
}


/**
 * ==========================================================
 * NORMAL FORECAST API RESPONSE
 * ==========================================================
 */

export interface ForecastApiResponse {
  daily: ForecastRecord[];

  monthly: ForecastRecord[];

  [key: string]: unknown;
}


/**
 * ==========================================================
 * SCENARIO API RESPONSE
 * ==========================================================
 */

export interface ForecastScenarioApiResponse {
  daily: ForecastRecord[];

  monthly: ForecastRecord[];

  [key: string]: unknown;
}


/**
 * ==========================================================
 * STATISTICS
 * ==========================================================
 */

export interface ForecastStatistics {
  average: number;

  peak: number;

  projectedVolume: number;

  horizon: number;
}