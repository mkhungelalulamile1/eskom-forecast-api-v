import {
  CheckCircleRounded,
  ModelTrainingRounded,
} from "@mui/icons-material";


import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";



interface ModelVersion {
  version: string;
  accuracy: string;
  mae: string;
  rmse: string;
  status: "Production" | "Testing";
}



const models: ModelVersion[] = [

  {
    version: "Burn Forecast Model v2.4",
    accuracy: "98.6%",
    mae: "85 t",
    rmse: "120 t",
    status: "Production",
  },

  {
    version: "Burn Forecast Model v2.3",
    accuracy: "97.9%",
    mae: "110 t",
    rmse: "160 t",
    status: "Testing",
  },

  {
    version: "Burn Forecast Model v2.2",
    accuracy: "96.8%",
    mae: "150 t",
    rmse: "220 t",
    status: "Testing",
  },

];



const ModelComparison = () => {

  return (

    <AppCard
      sx={{
        p:4,
      }}
    >


      <CardHeader
        title="Model Comparison"
        subtitle="Compare performance across different model versions"
      />



      <Stack
        spacing={3}
        mt={4}
      >

        {
          models.map((model) => (

            <Paper
              key={model.version}
              elevation={0}
              sx={{
                p:3,
                borderRadius:3,
                border:"1px solid",
                borderColor:"divider",
              }}
            >


              <Stack
                direction={{
                  xs:"column",
                  md:"row",
                }}
                spacing={3}
                alignItems={{
                  md:"center",
                }}
              >


                <Box
                  sx={{
                    flex:1,
                  }}
                >

                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >

                    <ModelTrainingRounded
                      color="primary"
                    />


                    <Typography
                      fontWeight={700}
                    >
                      {model.version}
                    </Typography>

                  </Stack>


                </Box>



                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Accuracy
                  </Typography>


                  <Typography
                    fontWeight={700}
                  >
                    {model.accuracy}
                  </Typography>

                </Box>




                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    MAE
                  </Typography>


                  <Typography
                    fontWeight={700}
                  >
                    {model.mae}
                  </Typography>

                </Box>




                <Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    RMSE
                  </Typography>


                  <Typography
                    fontWeight={700}
                  >
                    {model.rmse}
                  </Typography>

                </Box>



                <Chip
                  icon={
                    model.status === "Production"
                    ? <CheckCircleRounded />
                    : undefined
                  }
                  label={model.status}
                  color={
                    model.status === "Production"
                    ? "success"
                    : "warning"
                  }
                  size="small"
                />


              </Stack>


            </Paper>

          ))
        }


      </Stack>


    </AppCard>

  );

};


export default ModelComparison;