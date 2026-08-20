import { useState, useMemo } from "react";
import {
  CheckCircleRounded,
  ErrorRounded,
  WarningRounded,
} from "@mui/icons-material";


import {
  Avatar,
  Chip,
  Paper,
  Stack,
  Typography,
  Box,
} from "@mui/material";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";
import FilterBar, { FilterConfig } from "../../../components/common/FilterBar";
import ViewSwitcher, { ViewMode } from "../../../components/common/ViewSwitcher";



interface ResourceLog {

  time: string;

  resource: string;

  action: string;

  duration: string;

  status:
  | "Success"
  | "Warning"
  | "Failed";

}



const logs: ResourceLog[] = [

  {
    time: "10:32:15",
    resource: "Azure Storage",
    action: "Read forecast prediction files",
    duration: "320ms",
    status: "Success",
  },


  {
    time: "10:32:18",
    resource: "Weather Service",
    action: "Retrieve latest weather inputs",
    duration: "540ms",
    status: "Success",
  },


  {
    time: "10:32:25",
    resource: "Model Engine",
    action: "Execute daily inference model",
    duration: "4.8s",
    status: "Success",
  },


  {
    time: "10:33:02",
    resource: "Forecast API",
    action: "Return prediction response",
    duration: "210ms",
    status: "Warning",
  },


  {
    time: "10:34:10",
    resource: "Database",
    action: "Store inference results",
    duration: "--",
    status: "Failed",
  },

];


const filterConfigs: FilterConfig[] = [
  {
    name: "status",
    label: "Status",
    options: [
      { label: "Success", value: "Success" },
      { label: "Warning", value: "Warning" },
      { label: "Failed", value: "Failed" },
    ],
  },
  {
    name: "resource",
    label: "Resource",
    options: [
      { label: "Azure Storage", value: "Azure Storage" },
      { label: "Weather Service", value: "Weather Service" },
      { label: "Model Engine", value: "Model Engine" },
      { label: "Forecast API", value: "Forecast API" },
      { label: "Database", value: "Database" },
    ],
  },
];




const ResourceLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Filter data based on search and filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = !filters.status || log.status === filters.status;

      // Resource filter
      const matchesResource = !filters.resource || log.resource === filters.resource;

      return matchesSearch && matchesStatus && matchesResource;
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
        title="Resource Interaction Logs"
        subtitle="Monitoring communication between inference services and external resources"
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
        searchPlaceholder="Search by resource or action..."
        onSearchChange={setSearchTerm}
      />



      <Stack
        spacing={2}
        mt={2}
        sx={{ maxHeight: 600, overflowY: "auto", overflowX: "hidden" }}
      >


        {filteredLogs.length === 0 ? (
          <Box py={6}>
            <Typography align="center" color="text.secondary">
              No logs match your filters.
            </Typography>
          </Box>
        ) : (
          filteredLogs.map((log) => (


            <Paper

              key={`${log.time}-${log.resource}`}

              elevation={0}

              sx={{

                p: 2.5,

                border: "1px solid",

                borderColor: "divider",

                borderRadius: 3,

              }}

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

                      log.status === "Success"

                        ?

                        "#E8F5E9"

                        :

                        log.status === "Warning"

                          ?

                          "#FFF8E1"

                          :

                          "#FDECEC",



                    color:

                      log.status === "Success"

                        ?

                        "success.main"

                        :

                        log.status === "Warning"

                          ?

                          "warning.main"

                          :

                          "error.main",

                  }}

                >


                  {
                    log.status === "Success"

                      ?

                      <CheckCircleRounded />

                      :

                      log.status === "Warning"

                        ?

                        <WarningRounded />

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

                    {log.resource}

                  </Typography>



                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >

                    {log.action}

                  </Typography>


                </Box>





                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >

                    Time

                  </Typography>


                  <Typography
                    fontWeight={600}
                  >

                    {log.time}

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

                    {log.duration}

                  </Typography>


                </Box>





                <Chip

                  label={log.status}

                  size="small"

                  color={

                    log.status === "Success"

                      ?

                      "success"

                      :

                      log.status === "Warning"

                        ?

                        "warning"

                        :

                        "error"

                  }

                />



              </Stack>


            </Paper>


          ))
        )
        }


      </Stack>


    </AppCard>

  );

};


export default ResourceLogs;