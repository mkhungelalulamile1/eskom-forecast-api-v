import { useQuery } from "@tanstack/react-query";
import {
  inferenceMonitoringService,
} from "../service/inference-monitoring.service";

export const useInferenceMonitoring = () => {
  const summaryQuery = useQuery({
    queryKey: ["inference-monitoring", "summary"],
    queryFn: inferenceMonitoringService.getSummary,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["inference-monitoring", "events"],
    queryFn: inferenceMonitoringService.getEvents,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return {
    summary: summaryQuery.data,
    events: eventsQuery.data?.events ?? [],

    isLoading:
      summaryQuery.isLoading ||
      eventsQuery.isLoading,

    isError:
      summaryQuery.isError ||
      eventsQuery.isError,

    error:
      summaryQuery.error ||
      eventsQuery.error,

    refetch: async () => {
      await Promise.all([
        summaryQuery.refetch(),
        eventsQuery.refetch(),
      ]);
    },
  };
};