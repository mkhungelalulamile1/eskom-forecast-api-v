export interface WeatherRecord {
  entity_id?: string;

  date: string;

  weather_label?: string | null;

  temp_max_c?: number | null;
  temp_min_c?: number | null;

  rainfall_mm?: number | null;

  cloud_cover_pct?: number | null;

  humidity_pct?: number | null;

  wind_speed_kmh?: number | null;

  uv_index?: number | null;

  sunshine_seconds?: number | null;
}

export interface WeatherSummaryData {
  entityId: string;

  date: string;

  condition: string;

  tempMax: number | null;
  tempMin: number | null;

  rainfall: number | null;

  cloudCover: number | null;

  humidity: number | null;

  windSpeed: number | null;

  uvIndex: number | null;

  sunshine: number | null;
}

export interface WeatherOutlookDay {
  date: string;

  condition: string;

  tempMax: number | null;
  tempMin: number | null;

  rainfall: number | null;

  cloudCover: number | null;

  humidity: number | null;

  windSpeed: number | null;

  uvIndex: number | null;

  sunshine: number | null;
}

export interface WeatherSignalsData {
  forecastDays: number;

  averageTemperature: number | null;

  totalRainfall: number | null;

  averageWindSpeed: number | null;

  averageUvIndex: number | null;

  averageHumidity: number | null;

  rainyDays: number;

  hotDays: number;
}