import axios from "axios";

import {
  ForecastApiResponse,
  ForecastEntity,
  ForecastFilters,
  ForecastRecord,
  ForecastScenario,
  ForecastScenarioApiResponse,
  ForecastStatistics,
} from "../types/forecast.types";

/**
 * FORECAST SERVICE — all data is fetched live from the FastAPI backend.
 *
 * [DATA: DYNAMIC] Every method here calls a real backend endpoint:
 *
 *   GET /api/forecast-data   → gold/{daily,monthly}/predictions.parquet
 *                              (Azure Blob "gold" container, or local
 *                              data/gold/ fallback when Azure env vars
 *                              are unset — local files may be mock-
 *                              generated, see backend generate_mock_data.py)
 *
 *   GET /api/scenario-data   → gold/{daily,monthly}/scenario_predictions.parquet
 *                              (same Azure/local fallback; includes the
 *                              scenario_id column: actual, weather_hot_dry,
 *                              weather_hot_wet, weather_cold_dry, weather_cold_wet)
 *
 *   GET /api/entities        → unique entity_id list from those gold files
 *                              ([{id, label}, ...]). If that call fails or
 *                              returns empty, getEntities() derives the same
 *                              list from /api/scenario-data so the Power
 *                              Station dropdown still fills.
 *
 * No mock/hardcoded station names or forecast records are returned here.
 * If every API call fails, react-query surfaces the error and the UI
 * shows its error state.
 */
class ForecastService {
  private readonly baseUrl = "/api";

  /** [DATA: DYNAMIC] GET /api/forecast-data — baseline burn/supply predictions. */
  async getForecastData(): Promise<ForecastApiResponse> {
    const response =
      await axios.get<ForecastApiResponse>(
        `${this.baseUrl}/forecast-data`
      );

    return response.data;
  }

  /** [DATA: DYNAMIC] GET /api/scenario-data — all 5 scenarios incl. baseline "actual". */
  async getScenarioData(): Promise<ForecastScenarioApiResponse> {
    const response =
      await axios.get<ForecastScenarioApiResponse>(
        `${this.baseUrl}/scenario-data`
      );

    return response.data;
  }

  /**
   * [DATA: DYNAMIC] Power-station list for the dropdown.
   *
   * Primary: GET /api/entities → [{id, label}, ...] from gold parquet.
   * Fallback: unique entity_id values from GET /api/scenario-data
   * (same source StationFleetOverview already uses). Both paths are live
   * backend data — neither is a hardcoded station list.
   */
  async getEntities(): Promise<ForecastEntity[]> {
    try {
      const response =
        await axios.get<ForecastEntity[]>(
          `${this.baseUrl}/entities`
        );

      if (
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        return response.data;
      }
    } catch {
      // Dedicated endpoint missing or failed — derive from scenario payload.
    }

    return this.entitiesFromScenarioData();
  }

  /**
   * [DATA: DYNAMIC] Unique stations taken from /api/scenario-data
   * (daily + monthly). Used when GET /api/entities is empty or unreachable.
   */
  private async entitiesFromScenarioData(): Promise<ForecastEntity[]> {
    const scenarioData =
      await this.getScenarioData();

    const ids = new Set<string>();

    for (const record of [
      ...(scenarioData.daily ?? []),
      ...(scenarioData.monthly ?? []),
    ]) {
      if (record.entity_id) {
        ids.add(String(record.entity_id));
      }
    }

    return Array.from(ids)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id, label: id }));
  }

  /**
   * [DATA: STATIC-UI] Frontend scenario id → backend scenario_id mapping.
   * Pure constant translation, no data. Backend ids come from
   * training/scenario_definitions.py SCENARIO_DEFINITIONS.
   */
  private getBackendScenarioId(
    scenario: ForecastScenario
  ): string {
    switch (scenario) {
      case "actual":
        return "actual";

      case "hotdry":
        return "weather_hot_dry";

      case "hotwet":
        return "weather_hot_wet";

      case "colddry":
        return "weather_cold_dry";

      case "coldwet":
        return "weather_cold_wet";

      default:
        return "actual";
    }
  }

  /**
   * [DATA: DYNAMIC] Chart records = /api/scenario-data filtered by the
   * user's horizon/scenario/station selection (filtering happens
   * client-side; there is no server-side query parameter).
   */
  async getForecastChart(
    filters: ForecastFilters
  ): Promise<ForecastRecord[]> {
    return this.getFilteredRecords(
      filters
    );
  }

  /** [DATA: DYNAMIC] Same filtered records as the chart (used by export/tables). */
  async getForecastResults(
    filters: ForecastFilters
  ): Promise<ForecastRecord[]> {
    return this.getFilteredRecords(
      filters
    );
  }

  /**
   * [DATA: DYNAMIC] KPI numbers (Average/Peak Forecast, Projected Volume,
   * Forecast Horizon) are computed client-side from the same
   * /api/scenario-data records — no separate stats endpoint. All zeros
   * when the filter matches nothing (e.g. before a station has been selected).
   */
  async getStatistics(
    filters: ForecastFilters
  ): Promise<ForecastStatistics> {
    const records =
      await this.getFilteredRecords(
        filters
      );


    if (records.length === 0) {
      return {
        average: 0,
        peak: 0,
        projectedVolume: 0,
        horizon: 0,
      };
    }

    // [DATA: DYNAMIC] metric → parquet column: burn=Input, supply=Replenishment, stockpile=Stockpile
    const values = records.map(
      (record) =>
        this.getMetricValue(
          record,
          filters.metric
        )
    );


    const total =
      values.reduce(
        (
          sum,
          value
        ) =>
          sum + value,
        0
      );


    const average =
      total / values.length;


    const peak =
      Math.max(...values);


    return {
      average,
      peak,
      projectedVolume: total,
      horizon: records.length,
    };
  }

  /**
   * [DATA: DYNAMIC] Client-side filtering of /api/scenario-data by
   * horizon (daily/monthly array), scenario_id and entity_id.
   */
  private async getFilteredRecords(
    filters: ForecastFilters
  ): Promise<ForecastRecord[]> {

    const scenarioData =
      await this.getScenarioData();


    const records =
      filters.horizon === "monthly"
        ? scenarioData.monthly
        : scenarioData.daily;


    const backendScenarioId =
      this.getBackendScenarioId(
        filters.scenario
      );


    const filteredRecords =
      records.filter(
        (record) =>
          record.scenario_id ===
          backendScenarioId &&
          (
            filters.entityId === "all" ||
            record.entity_id ===
            filters.entityId
          )
      );


    /**
     * [DATA: DYNAMIC] "All Stations" support: sums Input/Replenishment/
     * Stockpile across stations per date. NOTE: the context bar currently
     * has no "All Stations" option, so this path is unreachable from the UI.
     */
    if (
      filters.entityId === "all"
    ) {
      return this.aggregateAllStations(
        filteredRecords
      );
    }

    return filteredRecords;
  }

  /**
   * [DATA: DYNAMIC] Aggregates the already-fetched scenario records for
   * the "all" station selection (pure client-side math on backend data).
   */
  private aggregateAllStations(
    records: ForecastRecord[]
  ): ForecastRecord[] {

    const byDate =
      new Map<
        string,
        ForecastRecord
      >();


    for (
      const record of records
    ) {

      const key =
        record.event_date;


      const existing =
        byDate.get(key);


      if (!existing) {

        byDate.set(
          key,
          {
            entity_id:
              "All Stations",

            event_date:
              record.event_date,

            horizon_step:
              record.horizon_step,

            scenario_id:
              record.scenario_id,

            Input:
              Number(
                record.Input ?? 0
              ),

            Replenishment:
              Number(
                record.Replenishment ?? 0
              ),

            Stockpile:
              Number(
                record.Stockpile ?? 0
              ),
          }
        );

        continue;
      }

      existing.Input =
        Number(
          existing.Input ?? 0
        ) +
        Number(
          record.Input ?? 0
        );


      existing.Replenishment =
        Number(
          existing.Replenishment ?? 0
        ) +
        Number(
          record.Replenishment ?? 0
        );


      existing.Stockpile =
        Number(
          existing.Stockpile ?? 0
        ) +
        Number(
          record.Stockpile ?? 0
        );
    }

    return Array.from(
      byDate.values()
    );
  }

  /**
   * [DATA: STATIC-UI] Metric → parquet column mapping (constant).
   * burn → Input, supply → Replenishment, stockpile → Stockpile.
   */
  private getMetricValue(
    record: ForecastRecord,
    metric: ForecastFilters["metric"]
  ): number {

    switch (
      metric
    ) {

      case "burn":
        return Number(
          record.Input ?? 0
        );


      case "supply":
        return Number(
          record.Replenishment ?? 0
        );


      case "stockpile":
        return Number(
          record.Stockpile ?? 0
        );


      default:
        return Number(
          record.Input ?? 0
        );
    }
  }
}


const forecastService =
  new ForecastService();


export default forecastService;
