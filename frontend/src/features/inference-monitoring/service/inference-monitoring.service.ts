import axios from "axios";

export interface InferenceMonitoringEvent {
  timestamp: string;
  event_id: string;
  run_id: string | null;
  event_type: string;
  status: string;
  resource: string | null;
  operation: string | null;
  message: string | null;
  horizon: string | null;
  trigger: string | null;
  entity_id: string | null;
  duration_ms: number | null;
  retry: number | null;
  metadata: Record<string, unknown>;
}

export interface InferenceMonitoringResource {
  resource: string;
  events: number;
  failures: number;
  warnings: number;
  successes: number;
  last_status: string | null;
  last_message: string | null;
  last_timestamp: string | null;
}

export interface InferenceMonitoringRun {
  run_id: string;
  horizon: string | null;
  trigger: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  resource_failures: number;
  resource_warnings: number;
}

export interface InferenceMonitoringSummary {
  health: "healthy" | "degraded" | "failed" | "unknown";
  summary: {
    total_events: number;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    degraded_runs: number;
    resource_failures: number;
    resource_warnings: number;
    latest_run: InferenceMonitoringEvent | null;
  };
  resources: InferenceMonitoringResource[];
  runs: InferenceMonitoringRun[];
  recent_events: InferenceMonitoringEvent[];
}

export interface InferenceMonitoringResponse {
  events: InferenceMonitoringEvent[];
}

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "";

export const inferenceMonitoringService = {
  async getSummary(): Promise<InferenceMonitoringSummary> {
    const response = await axios.get<InferenceMonitoringSummary>(
      `${API_BASE_URL}/api/inference-monitoring/summary`,
    );

    return response.data;
  },

  async getEvents(): Promise<InferenceMonitoringResponse> {
    const response = await axios.get<InferenceMonitoringResponse>(
      `${API_BASE_URL}/api/inference-monitoring`,
    );

    return response.data;
  },
};