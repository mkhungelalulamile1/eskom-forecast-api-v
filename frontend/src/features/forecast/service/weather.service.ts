import axios from "axios";

import {
  WeatherRecord,
  WeatherSummaryData,
  WeatherOutlookDay,
  WeatherSignalsData,
} from "../types/weather.types";


/**
 * WEATHER SERVICE — [DATA: DYNAMIC] everything here is derived from one
 * live backend endpoint:
 *
 *   GET /api/weather-data?entity_id=...&start_date=...&end_date=...
 *     → ui.get_weather_json() → weather.get_weather_timeseries()
 *     → per-station Open-Meteo cache (data/weather/weather_cache_<Station>.parquet)
 *       or a live Open-Meteo fetch on cache miss.
 *
 * Summary/Outlook/Signals below are all client-side aggregations of that
 * one dynamic response — no mock weather data anywhere in this service.
 */
class WeatherService {

  private readonly baseUrl = "/api";


  /**
   * [DATA: DYNAMIC] GET /api/weather-data — raw daily weather records
   * (temp, rainfall, wind, UV, humidity, sunshine, weather_code/label).
   * Without start/end dates the backend returns its default dashboard
   * window (90 days back + 16 days forecast).
   */
  async getWeatherData(
    entityId: string,
    startDate?: string,
    endDate?: string
  ): Promise<WeatherRecord[]> {

    const response =
      await axios.get<
        WeatherRecord[]
      >(
        `${this.baseUrl}/weather-data`,
        {
          params: {
            entity_id:
              entityId,

            ...(startDate
              ? {
                  start_date:
                    startDate,
                }
              : {}),

            ...(endDate
              ? {
                  end_date:
                    endDate,
                }
              : {}),
          },
        }
      );

    return Array.isArray(
      response.data
    )
      ? response.data
      : [];
  }


  /** [DATA: DYNAMIC] Chronological sort of the API records (no data change). */

  private sortRecords(
    records: WeatherRecord[]
  ): WeatherRecord[] {

    return [
      ...records,
    ].sort(
      (
        a,
        b
      ) =>
        new Date(
          a.date
        ).getTime() -
        new Date(
          b.date
        ).getTime()
    );
  }


  /**
   * [DATA: DYNAMIC] Latest-record snapshot ("current weather" tile) —
   * computed client-side from the last row of GET /api/weather-data.
   */

  async getWeatherSummary(
    entityId: string
  ): Promise<
    WeatherSummaryData | null
  > {

    const records =
      await this.getWeatherData(
        entityId
      );

    if (
      !records ||
      records.length === 0
    ) {
      return null;
    }

    const sorted =
      this.sortRecords(
        records
      );

    const latest =
      sorted[
        sorted.length - 1
      ];

    return this.mapRecordToSummary(
      entityId,
      latest
    );
  }


  /**
   * [DATA: DYNAMIC] First `days` records of the same API response
   * (forecast outlook strip). No mock values.
   */

  async getWeatherOutlook(
    entityId: string,
    days: number
  ): Promise<
    WeatherOutlookDay[]
  > {

    const records =
      await this.getWeatherData(
        entityId
      );

    if (
      !records ||
      records.length === 0
    ) {
      return [];
    }

    const sorted =
      this.sortRecords(
        records
      );

    return sorted
      .slice(
        0,
        days
      )
      .map(
        (
          record
        ) =>
          this.mapRecordToOutlook(
            record
          )
      );
  }


  /**
   * [DATA: DYNAMIC] Averages/totals (temp, rainfall, wind, UV, humidity,
   * rainy/hot days) derived client-side from the outlook records.
   */

  async getWeatherSignals(
    entityId: string,
    days: number
  ): Promise<
    WeatherSignalsData
  > {

    const outlook =
      await this.getWeatherOutlook(
        entityId,
        days
      );

    if (
      outlook.length === 0
    ) {
      return {
        forecastDays: 0,

        averageTemperature:
          null,

        totalRainfall:
          null,

        averageWindSpeed:
          null,

        averageUvIndex:
          null,

        averageHumidity:
          null,

        rainyDays: 0,

        hotDays: 0,
      };
    }


    const temperatures =
      outlook
        .filter(
          (
            record
          ) =>
            record.tempMax !==
            null
        )
        .map(
          (
            record
          ) =>
            record.tempMax as number
        );


    const rainfall =
      outlook
        .filter(
          (
            record
          ) =>
            record.rainfall !==
            null
        )
        .map(
          (
            record
          ) =>
            record.rainfall as number
        );


    const wind =
      outlook
        .filter(
          (
            record
          ) =>
            record.windSpeed !==
            null
        )
        .map(
          (
            record
          ) =>
            record.windSpeed as number
        );


    const uv =
      outlook
        .filter(
          (
            record
          ) =>
            record.uvIndex !==
            null
        )
        .map(
          (
            record
          ) =>
            record.uvIndex as number
        );


    const humidity =
      outlook
        .filter(
          (
            record
          ) =>
            record.humidity !==
            null
        )
        .map(
          (
            record
          ) =>
            record.humidity as number
        );


    const average = (
      values: number[]
    ): number | null => {

      if (
        values.length === 0
      ) {
        return null;
      }

      return (
        values.reduce(
          (
            total: number,
            value: number
          ) =>
            total + value,
          0
        ) /
        values.length
      );
    };


    const total = (
      values: number[]
    ): number | null => {

      if (
        values.length === 0
      ) {
        return null;
      }

      return values.reduce(
        (
          sum: number,
          value: number
        ) =>
          sum + value,
        0
      );
    };


    return {

      forecastDays:
        outlook.length,

      averageTemperature:
        average(
          temperatures
        ),

      totalRainfall:
        total(
          rainfall
        ),

      averageWindSpeed:
        average(
          wind
        ),

      averageUvIndex:
        average(
          uv
        ),

      averageHumidity:
        average(
          humidity
        ),

      rainyDays:
        outlook.filter(
          (
            record
          ) =>
            (
              record.rainfall ??
              0
            ) > 0.1
        ).length,

      hotDays:
        outlook.filter(
          (
            record
          ) =>
            (
              record.tempMax ??
              0
            ) >= 25
        ).length,
    };
  }


  /**
   * =====================================================
   * MAP SUMMARY
   * =====================================================
   */

  private mapRecordToSummary(
    entityId: string,
    record: WeatherRecord
  ): WeatherSummaryData {

    return {

      entityId,

      date:
        record.date,

      condition:
        record.weather_label ??
        "Unknown",

      tempMax:
        this.toNumber(
          record.temp_max_c
        ),

      tempMin:
        this.toNumber(
          record.temp_min_c
        ),

      rainfall:
        this.toNumber(
          record.rainfall_mm
        ),

      cloudCover:
        this.toNumber(
          record.cloud_cover_pct
        ),

      humidity:
        this.toNumber(
          record.humidity_pct
        ),

      windSpeed:
        this.toNumber(
          record.wind_speed_kmh
        ),

      uvIndex:
        this.toNumber(
          record.uv_index
        ),

      sunshine:
        this.toHours(
          record.sunshine_seconds
        ),
    };
  }


  /**
   * =====================================================
   * MAP OUTLOOK
   * =====================================================
   */

  private mapRecordToOutlook(
    record: WeatherRecord
  ): WeatherOutlookDay {

    return {

      date:
        record.date,

      condition:
        record.weather_label ??
        "Unknown",

      tempMax:
        this.toNumber(
          record.temp_max_c
        ),

      tempMin:
        this.toNumber(
          record.temp_min_c
        ),

      rainfall:
        this.toNumber(
          record.rainfall_mm
        ),

      cloudCover:
        this.toNumber(
          record.cloud_cover_pct
        ),

      humidity:
        this.toNumber(
          record.humidity_pct
        ),

      windSpeed:
        this.toNumber(
          record.wind_speed_kmh
        ),

      uvIndex:
        this.toNumber(
          record.uv_index
        ),

      sunshine:
        this.toHours(
          record.sunshine_seconds
        ),
    };
  }


  /**
   * =====================================================
   * NUMBER CONVERSION
   * =====================================================
   */

  private toNumber(
    value:
      | number
      | null
      | undefined
  ): number | null {

    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : null;
  }


  /**
   * =====================================================
   * SECONDS → HOURS
   * =====================================================
   */

  private toHours(
    value:
      | number
      | null
      | undefined
  ): number | null {

    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const seconds =
      Number(value);

    if (
      !Number.isFinite(
        seconds
      )
    ) {
      return null;
    }

    return (
      seconds / 3600
    );
  }
}


const weatherService =
  new WeatherService();


export default weatherService;