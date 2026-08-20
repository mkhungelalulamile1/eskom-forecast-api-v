import {
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


import AppCard from "../../../components/common/AppCard";
import CardHeader from "../../../components/common/CardHeader";


const data = [
  {
    month: "Jan",
    accuracy: 96.8,
  },
  {
    month: "Feb",
    accuracy: 97.4,
  },
  {
    month: "Mar",
    accuracy: 98.1,
  },
  {
    month: "Apr",
    accuracy: 98.6,
  },
  {
    month: "May",
    accuracy: 98.4,
  },
  {
    month: "Jun",
    accuracy: 98.8,
  },
];



const AccuracyTrend = () => {

  return (

    <AppCard
      sx={{
        p:4,
      }}
    >


      <CardHeader
        title="Model Accuracy Trend"
        subtitle="Historical model accuracy over evaluation periods"
        action={

          <Chip
            icon={
              <TrendingUpRounded />
            }
            label="Improving"
            color="success"
          />

        }
      />



      <Box
        sx={{
          height:400,
          mt:4,
        }}
      >

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <LineChart
            data={data}
            margin={{
              top:20,
              right:20,
              left:10,
              bottom:10,
            }}
          >


            <CartesianGrid
              strokeDasharray="4 4"
              opacity={0.3}
            />


            <XAxis
              dataKey="month"
            />


            <YAxis
              domain={[
                90,
                100,
              ]}
            />


            <Tooltip
              formatter={(value) =>
                `${value}%`
              }
            />


            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#1976d2"
              strokeWidth={3}
              dot={{
                r:4,
              }}
              activeDot={{
                r:7,
              }}
            />


          </LineChart>


        </ResponsiveContainer>


      </Box>



      <Stack
        direction={{
          xs:"column",
          md:"row",
        }}
        spacing={6}
        mt={4}
      >


        <Box>

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Current Accuracy
          </Typography>


          <Typography
            variant="h5"
            fontWeight={700}
          >
            98.8%
          </Typography>

        </Box>



        <Box>

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Previous Period
          </Typography>


          <Typography
            variant="h5"
            fontWeight={700}
          >
            98.4%
          </Typography>

        </Box>



        <Box>

          <Typography
            variant="overline"
            color="text.secondary"
          >
            Improvement
          </Typography>


          <Typography
            variant="h5"
            fontWeight={700}
            color="success.main"
          >
            +0.4%
          </Typography>

        </Box>


      </Stack>


    </AppCard>

  );
};


export default AccuracyTrend;