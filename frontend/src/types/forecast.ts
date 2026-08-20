export type ForecastStatus =
  | "completed"
  | "running"
  | "failed";

export interface Forecast {
  id: number;
  powerStation: string;
  forecastDate: string;
  demand: number;
  generation: number;
  accuracy: number;
  status: ForecastStatus;
}