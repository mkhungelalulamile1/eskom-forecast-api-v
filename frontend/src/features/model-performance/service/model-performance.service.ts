import axios from "axios";

import {
  ModelMetricRecord,
  OotHistoryRecord,
} from "../types/model-performance.types";


/**
 * MODEL PERFORMANCE SERVICE — [DATA: DYNAMIC] two live endpoints, no mock data:
 *
 *   GET /api/forecast-metrics → metrics/model_metrics.parquet
 *     (rmse/mae/smape/r2/nrmse per horizon+target+entity_id; horizon values
 *      are "tactical"/"tactical_oot" in the current local file — NOTE: no
 *      "strategic" rows exist locally, so the Strategic Monthly view has
 *      no data until monthly models are trained/scored)
 *
 *   GET /api/oot-history → metrics/oot_history.parquet
 *     ({Input,Replenishment,Stockpile}_{actual,predicted} per entity/date,
 *      horizon "tactical" only in the current local file)
 *
 * Both read the Azure "metrics" container in prod, data/metrics/ locally.
 */
class ModelPerformanceService {
  private readonly baseUrl = "/api";


  /** [DATA: DYNAMIC] GET /api/forecast-metrics — per-station accuracy metrics. */
  async getMetrics(): Promise<
    ModelMetricRecord[]
  > {
    const response =
      await axios.get<
        ModelMetricRecord[]
      >(
        `${this.baseUrl}/forecast-metrics`
      );

    return response.data;
  }


  /** [DATA: DYNAMIC] GET /api/oot-history — actual-vs-predicted history. */
  async getOotHistory(): Promise<
    OotHistoryRecord[]
  > {
    const response =
      await axios.get<
        OotHistoryRecord[]
      >(
        `${this.baseUrl}/oot-history`
      );

    return response.data;
  }
}


const modelPerformanceService =
  new ModelPerformanceService();


export default modelPerformanceService;