import axios from "axios";

import {
  ModelMetricRecord,
  OotHistoryRecord,
} from "../types/model-performance.types";


class ModelPerformanceService {
  private readonly baseUrl = "/api";


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