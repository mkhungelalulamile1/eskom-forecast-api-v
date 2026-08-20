import { useState, useMemo } from "react";
import {
  CheckCircleRounded,
  ErrorRounded,
  ScheduleRounded,
} from "@mui/icons-material";


import {
  Avatar,
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";
import FilterBar, { FilterConfig } from "../../../components/common/FilterBar";
import ViewSwitcher, { ViewMode } from "../../../components/common/ViewSwitcher";


interface PipelineStep {

  name: string;

  description: string;

  duration: string;

  updated: string;

  status:
  | "Completed"
  | "Running"
  | "Failed";

}



const pipeline: PipelineStep[] = [

  {
    name: "Data Ingestion",
    description: "Retrieve weather, operational and forecast inputs",
    duration: "1.2 sec",
    updated: "10:30",
    status: "Completed",
  },


  {
    name: "Feature Processing",
    description: "Prepare model input features",
    duration: "3.5 sec",
    updated: "10:31",
    status: "Completed",
  },


  {
    name: "Model Execution",
    description: "Run forecasting inference engine",
    duration: "5.8 sec",
    updated: "10:32",
    status: "Completed",
  },


  {
    name: "Prediction Generation",
    description: "Generate forecast outputs",
    duration: "2.1 sec",
    updated: "10:32",
    status: "Running",
  },


  {
    name: "Storage Update",
    description: "Persist results for dashboard consumption",
    duration: "--",
    updated: "Waiting",
    status: "Running",
  },

];


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
];




const PipelineStatus = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Filter data based on search and filters
  const filteredPipeline = useMemo(() => {
    return pipeline.filter((step) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        step.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        step.description.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = !filters.status || step.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, filters]);


  return (

    <AppCard
      sx={{
        p: 4,
        overflow: "hidden !important",
      }}
    >


      <CardHeader
        title="Inference Pipeline Status"
        subtitle="Real-time execution state of the forecasting pipeline"
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
        searchPlaceholder="Search pipeline steps..."
        onSearchChange={setSearchTerm}
      />



      <Stack
        spacing={3}
        mt={2}
        sx={{ maxHeight: 600, overflowY: "auto", overflowX: "hidden" }}
      >


        {filteredPipeline.length === 0 ? (
          <Box py={6}>
            <Typography align="center" color="text.secondary">
              No pipeline steps match your filters.
            </Typography>
          </Box>
        ) : (
          filteredPipeline.map((step, index) => (


            <Box
              key={step.name}
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
                      step.status === "Completed"
                        ?
                        "#E8F5E9"
                        :
                        step.status === "Running"
                          ?
                          "#FFF8E1"
                          :
                          "#FDECEC",


                    color:
                      step.status === "Completed"
                        ?
                        "success.main"
                        :
                        step.status === "Running"
                          ?
                          "warning.main"
                          :
                          "error.main",

                  }}

                >


                  {
                    step.status === "Completed"
                      ?
                      <CheckCircleRounded />

                      :
                      step.status === "Running"
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

                    {step.name}

                  </Typography>



                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >

                    {step.description}

                  </Typography>


                </Box>





                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >

                    Duration

                  </Typography>


                  <Typography
                    fontWeight={600}
                  >

                    {step.duration}

                  </Typography>


                </Box>





                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >

                    Updated

                  </Typography>


                  <Typography
                    fontWeight={600}
                  >

                    {step.updated}

                  </Typography>


                </Box>



              </Stack>



              {
                index < filteredPipeline.length - 1 &&
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


    </AppCard>

  );

};


export default PipelineStatus;