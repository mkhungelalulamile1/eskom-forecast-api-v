import {
  ApiRounded,
  DatasetRounded,
  MemoryRounded,
  ScheduleRounded,
} from "@mui/icons-material";

import {
  Grid,
} from "@mui/material";


import StatCard from "../../../components/common/StatCard";


const InferenceStatistics = () => {


  return (

    <Grid
      container
      spacing={3}
    >


      <Grid
        item
        xs={12}
        sm={6}
        xl={3}
      >

        <StatCard

          title="API Health"

          value="Healthy"

          subtitle="All services responding"

          trend="Operational"

          color="success"

          icon={
            <ApiRounded />
          }

        />

      </Grid>




      <Grid
        item
        xs={12}
        sm={6}
        xl={3}
      >

        <StatCard

          title="Data Pipeline"

          value="Running"

          subtitle="Latest ingestion completed"

          trend="Active"

          color="info"

          icon={
            <DatasetRounded />
          }

        />

      </Grid>




      <Grid
        item
        xs={12}
        sm={6}
        xl={3}
      >

        <StatCard

          title="Model Service"

          value="Available"

          subtitle="Inference engine ready"

          trend="Online"

          color="primary"

          icon={
            <MemoryRounded />
          }

        />

      </Grid>




      <Grid
        item
        xs={12}
        sm={6}
        xl={3}
      >

        <StatCard

          title="Last Inference"

          value="10 min"

          subtitle="Last successful execution"

          trend="Completed"

          color="success"

          icon={
            <ScheduleRounded />
          }

        />

      </Grid>



    </Grid>

  );

};


export default InferenceStatistics;