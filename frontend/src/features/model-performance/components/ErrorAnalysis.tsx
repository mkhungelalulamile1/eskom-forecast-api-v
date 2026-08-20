import {
  WarningAmberRounded,
  TrendingDownRounded,
  AssessmentRounded,
} from "@mui/icons-material";


import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";


import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";



const errorData = [
  {
    period: "Week 1",
    error: 80,
  },
  {
    period: "Week 2",
    error: 120,
  },
  {
    period: "Week 3",
    error: 65,
  },
  {
    period: "Week 4",
    error: 210,
  },
  {
    period: "Week 5",
    error: 95,
  },
];



const ErrorAnalysis = () => {

  return (

    <AppCard
      sx={{
        p:4,
      }}
    >


      <CardHeader
        title="Forecast Error Analysis"
        subtitle="Analysis of prediction errors and model deviation"
        action={

          <Chip
            icon={
              <TrendingDownRounded />
            }
            label="Low Error"
            color="success"
          />

        }
      />



      <Stack
        direction={{
          xs:"column",
          md:"row",
        }}
        spacing={3}
        sx={{
          mt:4,
        }}
      >


        <Box
          sx={{
            flex:1,
            p:3,
            borderRadius:3,
            bgcolor:"background.default",
          }}
        >

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Average Error
          </Typography>


          <Typography
            variant="h4"
            fontWeight={700}
          >
            85 t
          </Typography>


        </Box>



        <Box
          sx={{
            flex:1,
            p:3,
            borderRadius:3,
            bgcolor:"background.default",
          }}
        >

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Maximum Error
          </Typography>


          <Typography
            variant="h4"
            fontWeight={700}
          >
            210 t
          </Typography>


        </Box>



        <Box
          sx={{
            flex:1,
            p:3,
            borderRadius:3,
            bgcolor:"background.default",
          }}
        >

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Error Status
          </Typography>


          <Typography
            variant="h5"
            fontWeight={700}
            color="success.main"
          >
            Stable
          </Typography>


        </Box>


      </Stack>




      <Box
        sx={{
          mt:5,
          height:350,
        }}
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <BarChart
            data={errorData}
          >

            <CartesianGrid
              strokeDasharray="4 4"
              opacity={0.3}
            />


            <XAxis
              dataKey="period"
            />


            <YAxis
              label={{
                value:"Error (tonnes)",
                angle:-90,
                position:"insideLeft",
              }}
            />


            <Tooltip />


            <Bar
              dataKey="error"
              fill="#ED6C02"
              radius={[
                6,
                6,
                0,
                0,
              ]}
            />

          </BarChart>

        </ResponsiveContainer>


      </Box>



      <Stack
        direction="row"
        spacing={2}
        mt={3}
        alignItems="center"
      >

        <WarningAmberRounded
          color="warning"
        />

        <Typography
          color="text.secondary"
        >
          Highest deviation detected during Week 4.
          Investigation may be required.
        </Typography>

      </Stack>


    </AppCard>

  );

};


export default ErrorAnalysis;