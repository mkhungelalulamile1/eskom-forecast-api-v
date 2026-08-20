import {
  useQuery,
} from "@tanstack/react-query";

import modelPerformanceService from "../service/model-performance.service";

/**
 * [DATA: DYNAMIC] react-query wrappers over the model-performance service.
 * Cache: 5 min staleTime, no refetch on window focus. If the endpoints
 * fail, react-query exposes isError and the components render their
 * error/empty states — nothing mock is substituted.
 */

/** [DATA: DYNAMIC] GET /api/forecast-metrics (cached 5 min). */
export const useModelMetrics = () => {
  return useQuery({
    queryKey: [
      "model-performance",
      "metrics",
    ],

    queryFn: () =>
      modelPerformanceService.getMetrics(),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};


/** [DATA: DYNAMIC] GET /api/oot-history (cached 5 min). */
export const useOotHistory = () => {
  return useQuery({
    queryKey: [
      "model-performance",
      "oot-history",
    ],

    queryFn: () =>
      modelPerformanceService.getOotHistory(),

    staleTime:
      5 * 60 * 1000,

    refetchOnWindowFocus:
      false,
  });
};