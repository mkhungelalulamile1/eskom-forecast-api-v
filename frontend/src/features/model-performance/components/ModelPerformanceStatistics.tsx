import {
  AssessmentRounded,
  ErrorOutlineRounded,
  VerifiedRounded,
} from "@mui/icons-material";

import {
  Grid,
} from "@mui/material";

import StatCard from "../../../components/common/StatCard";


const ModelPerformanceStatistics = () => {

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
          title="Model Accuracy"
          value="98.6%"
          subtitle="Overall prediction accuracy"
          trend="+1.2%"
          color="success"
          icon={
            <VerifiedRounded />
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
          title="Mean Absolute Error"
          value="85"
          subtitle="Average prediction error"
          trend="-12%"
          color="primary"
          icon={
            <ErrorOutlineRounded />
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
          title="RMSE"
          value="120"
          subtitle="Large error sensitivity"
          trend="-8%"
          color="warning"
          icon={
            <AssessmentRounded />
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
          title="Model Confidence"
          value="96.8%"
          subtitle="Prediction confidence score"
          trend="Stable"
          color="info"
          icon={
            <VerifiedRounded />
          }
        />

      </Grid>


    </Grid>

  );
};


export default ModelPerformanceStatistics;