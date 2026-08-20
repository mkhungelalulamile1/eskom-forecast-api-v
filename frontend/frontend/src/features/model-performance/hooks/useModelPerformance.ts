import {
  useQuery,
} from "@tanstack/react-query";

import modelPerformanceService from "../service/model-performance.service";


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