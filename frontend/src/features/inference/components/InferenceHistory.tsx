// ⚠️ /inference page is routed but HIDDEN from the sidebar navigation.
// [DATA: DYNAMIC] fetches live inference history via axios (unlike the
// other /inference components on this page, which are mock).
import { useState, useMemo } from "react";
import {
  CheckCircleRounded,
  ErrorRounded,
  ScheduleRounded,
} from "@mui/icons-material";

import {
  Avatar,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";
import FilterBar, { FilterConfig } from "../../../components/common/FilterBar";
import ViewSwitcher, { ViewMode } from "../../../components/common/ViewSwitcher";

// Backend interface for inference runs from /api/inference-monitoring/summary
interface BackendInferenceRun {
  run_id: string;
  horizon: string;
  trigger: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: "running" | "success" | "failed" | "degraded";
  resource_failures: number;
  resource_warnings: number;
}

// Frontend interface for transformed inference runs displayed in UI
interface InferenceRun {
  id: string;
  horizon: string;
  trigger: string;
  duration: string;
  time: string;
  status: "Completed" | "Running" | "Failed";
}

// Fetches inference runs from /api/inference-monitoring/summary and transforms to frontend format
const fetchInferenceRuns = async (): Promise<InferenceRun[]> => {
  const response = await axios.get<{
    runs: BackendInferenceRun[];
  }>("/api/inference-monitoring/summary");

  // Transform backend data to frontend structure
  return response.data.runs.map((run) => {
    // Extract time from timestamp
    const time = run.started_at
      ? new Date(run.started_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      : "--";

    // Format duration
    const duration = run.duration_ms
      ? `${(run.duration_ms / 1000).toFixed(1)} sec`
      : "--";

    // Map backend status to frontend status
    let status: "Completed" | "Running" | "Failed";
    if (run.status === "success" || run.status === "degraded") {
      status = "Completed";
    } else if (run.status === "running") {
      status = "Running";
    } else {
      status = "Failed";
    }

    return {
      id: run.run_id,
      horizon: run.horizon === "daily" ? "Tactical Daily" : "Strategic Monthly",
      trigger: run.trigger,
      duration,
      time,
      status,
    };
  });
};

// React Query hook to fetch and cache inference runs with 60s refresh
const useInferenceRuns = () => {
  return useQuery<InferenceRun[]>({
    queryKey: ["inference-runs"],
    queryFn: fetchInferenceRuns,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });
};

// Filter configs for status and horizon (no station filter - backend doesn't provide entity_id)
const filterConfigs: FilterConfig[] = [
  {
    name: "status",
    label: "Status",
    options: [
      { label: "Completed", value: "Completed" },
      { label: "Running", value: "Running" },
      { label: "Failed", value: "Failed" },
    ],
  },
  {
    name: "horizon",
    label: "Horizon",
    options: [
      { label: "Tactical Daily", value: "Tactical Daily" },
      { label: "Strategic Monthly", value: "Strategic Monthly" },
    ],
  },
];

// Displays inference execution history from /api/inference-monitoring/summary
const InferenceHistory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Fetch real inference runs from backend
  const { data: history = [], isLoading, isError } = useInferenceRuns();

  // Filter data based on search and filters
  const filteredHistory = useMemo(() => {
    return history.filter((run: InferenceRun) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        run.horizon.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.id.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = !filters.status || run.status === filters.status;

      // Horizon filter
      const matchesHorizon = !filters.horizon || run.horizon === filters.horizon;

      return matchesSearch && matchesStatus && matchesHorizon;
    });
  }, [searchTerm, filters, history]);


  return (

    <AppCard
      sx={{
        p: 4,
        overflow: "hidden !important",
      }}
    >


      <CardHeader
        title="Inference Execution History"
        subtitle="Previous forecasting inference runs and execution outcomes"
        action={
          <ViewSwitcher
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: "list",
                label: "List",
                icon: <span>📝</span>,
                tooltip: "List View",
              },
            ]}
          />
        }
      />

      <FilterBar
        filters={filterConfigs}
        onFilterChange={setFilters}
        searchPlaceholder="Search by run ID, horizon, or trigger..."
        onSearchChange={setSearchTerm}
      />

      {isLoading && (
        <Box py={6}>
          <Typography align="center" color="text.secondary">
            Loading inference runs...
          </Typography>
        </Box>
      )}

      {isError && (
        <Box py={6}>
          <Typography align="center" color="error">
            Failed to load inference runs. Please try again.
          </Typography>
        </Box>
      )}

      {!isLoading && !isError && (
        <Stack
          spacing={3}
          mt={2}
          sx={{ maxHeight: 600, overflowY: "auto", overflowX: "hidden" }}
        >
          {filteredHistory.length === 0 ? (
            <Box py={6}>
              <Typography align="center" color="text.secondary">
                No inference runs match your filters.
              </Typography>
            </Box>
          ) : (
            filteredHistory.map((run: InferenceRun, index: number) => (


              <Box
                key={run.id}
              >


                <Stack

                  direction={{
                    xs: "column",
                    md: "row",
                  }}

                  spacing={3}

                  alignItems={{
                    md: "center",
                  }}

                >



                  <Avatar

                    sx={{

                      bgcolor:

                        run.status === "Completed"

                          ?

                          "#E8F5E9"

                          :

                          run.status === "Running"

                            ?

                            "#FFF8E1"

                            :

                            "#FDECEC",



                      color:

                        run.status === "Completed"

                          ?

                          "success.main"

                          :

                          run.status === "Running"

                            ?

                            "warning.main"

                            :

                            "error.main",

                    }}

                  >


                    {
                      run.status === "Completed"

                        ?

                        <CheckCircleRounded />

                        :

                        run.status === "Running"

                          ?

                          <ScheduleRounded />

                          :

                          <ErrorRounded />

                    }


                  </Avatar>





                  <Box
                    flex={1}
                  >


                    <Typography
                      fontWeight={700}
                    >

                      {run.id}

                    </Typography>



                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >

                      {run.horizon} • Trigger: {run.trigger}

                    </Typography>



                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >

                      Duration: {run.duration}

                    </Typography>


                  </Box>





                  <Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >

                      Executed

                    </Typography>


                    <Typography
                      fontWeight={600}
                    >

                      {run.time}

                    </Typography>


                  </Box>





                  <Chip

                    label={run.status}

                    size="small"

                    color={

                      run.status === "Completed"

                        ?

                        "success"

                        :

                        run.status === "Running"

                          ?

                          "warning"

                          :

                          "error"

                    }

                  />



                </Stack>



                {
                  index < filteredHistory.length - 1 &&
                  (
                    <Divider
                      sx={{
                        mt: 3,
                      }}
                    />
                  )
                }



              </Box>


            ))
          )
          }



        </Stack>
      )}


    </AppCard>

  );

};


export default InferenceHistory;