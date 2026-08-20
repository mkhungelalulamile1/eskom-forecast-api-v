import {
  CheckCircleRounded,
  ErrorRounded,
  ScheduleRounded,
} from "@mui/icons-material";

import {

/**
 * DEMO DATA — this component is not mounted by any route. The rows
 * below are placeholder examples, NOT the real power-station list
 * (that always comes from the backend via useForecastEntities).
 */
  Avatar,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

interface ForecastRun {
  id: number;
  station: string;
  scenario: string;
  metric: string;
  horizon: string;
  accuracy: string;
  time: string;
  status: "Completed" | "Running" | "Failed";
}

const history: ForecastRun[] = [
  {
    id: 4812,
    station: "Kendal",
    scenario: "Actual Baseline",
    metric: "Burn Prediction",
    horizon: "Tactical - 90 Days",
    accuracy: "98.6%",
    time: "09:42",
    status: "Completed",
  },
  {
    id: 4811,
    station: "Matimba",
    scenario: "Hot & Dry",
    metric: "Burn Prediction",
    horizon: "Tactical - 90 Days",
    accuracy: "97.8%",
    time: "08:10",
    status: "Completed",
  },
  {
    id: 4810,
    station: "Medupi",
    scenario: "Cold & Wet",
    metric: "Supply Prediction",
    horizon: "Strategic - 36 Months",
    accuracy: "--",
    time: "07:21",
    status: "Running",
  },
  {
    id: 4809,
    station: "Tutuka",
    scenario: "Actual Baseline",
    metric: "Stockpile",
    horizon: "Tactical - 90 Days",
    accuracy: "--",
    time: "06:58",
    status: "Failed",
  },
];


const ForecastHistory = () => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
      }}
    >

      <Typography
        variant="h5"
        fontWeight={700}
        sx={{
          mb: 1,
        }}
      >
        Forecast Activity
      </Typography>


      <Typography
        color="text.secondary"
        sx={{
          mb: 4,
        }}
      >
        Recent forecast executions and model run status.
      </Typography>



      {/* Table Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns:
            "60px 1.5fr 1.5fr 1fr 120px 120px",
          px: 2,
          mb: 2,
        }}
      >

        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          STATUS
        </Typography>


        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          FORECAST RUN
        </Typography>


        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          POWER STATION
        </Typography>


        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          ACCURACY
        </Typography>


        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          EXECUTED
        </Typography>


        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
        >
          RESULT
        </Typography>

      </Box>




      <Stack spacing={2}>

        {history.map((item, index) => (

          <Box key={item.id}>


            <Box
              sx={{
                display:"grid",
                gridTemplateColumns:
                  "60px 1.5fr 1.5fr 1fr 120px 120px",
                alignItems:"center",
                px:2,
                py:2,
              }}
            >


              {/* Status Icon */}

              <Avatar
                sx={{
                  width:42,
                  height:42,

                  bgcolor:
                    item.status === "Completed"
                      ? "#E8F5E9"
                      : item.status === "Running"
                      ? "#FFF8E1"
                      : "#FDECEC",

                  color:
                    item.status === "Completed"
                      ? "#2E7D32"
                      : item.status === "Running"
                      ? "#F9A825"
                      : "#D32F2F",
                }}
              >

                {
                  item.status === "Completed"
                    ? <CheckCircleRounded />
                    : item.status === "Running"
                    ? <ScheduleRounded />
                    : <ErrorRounded />
                }

              </Avatar>




              {/* Forecast Run */}

              <Box>

                <Typography
                  fontWeight={700}
                >
                  Forecast #{item.id}
                </Typography>


                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {item.metric}
                </Typography>


                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  {item.horizon}
                </Typography>

              </Box>





              {/* Station */}

              <Box>

                <Typography
                  fontWeight={600}
                >
                  {item.station}
                </Typography>


                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Scenario: {item.scenario}
                </Typography>

              </Box>





              {/* Accuracy */}

              <Typography
                fontWeight={700}
              >
                {item.accuracy}
              </Typography>





              {/* Time */}

              <Typography
                color="text.secondary"
              >
                {item.time}
              </Typography>





              {/* Status */}

              <Chip
                label={item.status}
                size="small"
                color={
                  item.status === "Completed"
                    ? "success"
                    : item.status === "Running"
                    ? "warning"
                    : "error"
                }
                sx={{
                  width:"fit-content",
                  fontWeight:600,
                }}
              />

            </Box>



            {
              index < history.length - 1 && (
                <Divider />
              )
            }


          </Box>

        ))}

      </Stack>


    </Paper>
  );
};


export default ForecastHistory;