import {
  AccessTimeRounded,
  ApiRounded,
  CheckCircleRounded,
  ErrorRounded,
} from "@mui/icons-material";


import {
  Grid,
} from "@mui/material";


import StatCard from "../../../components/common/StatCard";



const ApiMetrics = () => {


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

          title="API Requests"

          value="12,540"

          subtitle="Requests processed today"

          trend="+8.4%"

          color="primary"

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

          title="Success Rate"

          value="99.2%"

          subtitle="Successful API responses"

          trend="Stable"

          color="success"

          icon={
            <CheckCircleRounded />
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

          title="Response Time"

          value="320ms"

          subtitle="Average API latency"

          trend="-15ms"

          color="info"

          icon={
            <AccessTimeRounded />
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

          title="Failed Requests"

          value="25"

          subtitle="Errors detected today"

          trend="-4"

          color="error"

          icon={
            <ErrorRounded />
          }

        />

      </Grid>



    </Grid>

  );

};


export default ApiMetrics;