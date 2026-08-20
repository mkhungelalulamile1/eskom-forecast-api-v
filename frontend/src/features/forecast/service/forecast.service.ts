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


class ForecastService {
  private readonly baseUrl = "/api";


  /**
   * =====================================================
   * FORECAST DATA
   * =====================================================
   */

  /**
   * Get normal/baseline forecast data.
   *
   * GET /api/forecast-data
   */
  async getForecastData(): Promise<ForecastApiResponse> {
    const response =
      await axios.get<ForecastApiResponse>(
        `${this.baseUrl}/forecast-data`
      );

    return response.data;
  }


  /**
   * =====================================================
   * SCENARIO DATA
   * =====================================================
   */

  /**
   * Get all scenario forecast data.
   *
   * GET /api/scenario-data
   */
  async getScenarioData(): Promise<ForecastScenarioApiResponse> {
    const response =
      await axios.get<ForecastScenarioApiResponse>(
        `${this.baseUrl}/scenario-data`
      );

    return response.data;
  }


  /**
   * =====================================================
   * ENTITIES
   * =====================================================
   */

  /**
   * Get all forecast entities from the backend.
   * 
   * CONNECTED TO: /api/entities
   * 
   * This method fetches the definitive list of power
   * stations/entities from the backend, ensuring the
   * frontend never uses hardcoded station names.
   * 
   * The backend extracts these from the actual scenario
   * prediction data, so the list automatically reflects
   * what's really available in the system.
   * 
   * Purpose: Eliminate hardcoded power station lists
   */
  async getEntities(): Promise<ForecastEntity[]> {
    const response =
      await axios.get<ForecastEntity[]>(
        `${this.baseUrl}/entities`
      );

    return response.data;
  }


  /**
   * =====================================================
   * SCENARIO MAPPING
   * =====================================================
   */

  /**
   * Convert frontend scenario IDs
   * to backend scenario IDs.
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
   * =====================================================
   * CHART DATA
   * =====================================================
   */

  async getForecastChart(
    filters: ForecastFilters
  ): Promise<ForecastRecord[]> {
    return this.getFilteredRecords(
      filters
    );
  }


  /**
   * =====================================================
   * FORECAST RESULTS
   * =====================================================
   */

  async getForecastResults(
    filters: ForecastFilters
  ): Promise<ForecastRecord[]> {
    return this.getFilteredRecords(
      filters
    );
  }


  /**
   * =====================================================
   * STATISTICS
   * =====================================================
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
   * =====================================================
   * FILTERING
   * =====================================================
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
     * All Stations
     *
     * Aggregate all stations by
     * forecast date.
     */
    if (
      filters.entityId === "all"
    ) {
      return this.aggregateAllStations(
        filteredRecords
      );
    }


    console.log(
      "[ForecastService] Filtering forecast:",
      {
        horizon:
          filters.horizon,

        entityId:
          filters.entityId,

        scenario:
          filters.scenario,

        backendScenarioId,

        totalRecords:
          records.length,

        filteredRecords:
          filteredRecords.length,
      }
    );


    return filteredRecords;
  }


  /**
   * =====================================================
   * ALL-STATIONS AGGREGATION
   * =====================================================
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
   * =====================================================
   * METRIC MAPPING
   * =====================================================
   */

  private getMetricValue(
    record: ForecastRecord,
    metric: ForecastFilters["metric"]
  ): number {

    switch (metric) {

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