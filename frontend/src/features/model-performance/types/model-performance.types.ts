export type PerformanceHorizon =
  | "daily"
  | "monthly";

export type PerformanceTarget =
  | "Input"
  | "Replenishment"
  | "Stockpile";

export interface ModelMetricRecord {
  horizon: string;

  target: PerformanceTarget;

  entity_id: string;

  rmse: number | null;

  mae: number | null;

  smape: number | null;

  r2: number | null;

  nrmse: number | null;
}

export interface OotHistoryRecord {
  horizon: string;

  entity_id: string;

  event_date: string;

  Input_actual: number | null;

  Input_predicted: number | null;

  Replenishment_actual: number | null;

  Replenishment_predicted: number | null;

  Stockpile_actual: number | null;

  Stockpile_predicted: number | null;
}

export interface PerformanceFilters {
  horizon: PerformanceHorizon;

  entityId: string;

  target: PerformanceTarget;
}

export interface PerformanceSummary {
  modelQuality: number | null;

  mae: number | null;

  rmse: number | null;

  nrmse: number | null;

  r2: number | null;

  smape: number | null;
}

export interface PerformanceTrendPoint {
  date: string;

  actual: number;

  predicted: number;
}