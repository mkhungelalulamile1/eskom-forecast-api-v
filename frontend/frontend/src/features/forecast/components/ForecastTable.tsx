import {
  DownloadRounded,
  VisibilityRounded,
} from "@mui/icons-material";

import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import DataTable, {
  Column,
} from "../../../components/common/DataTable";


interface ForecastResult {
  id: number;
  date: string;
  prediction: number;
  actual: number;
  variance: number;
  accuracy: number;
  status:
    | "Completed"
    | "Running"
    | "Failed";
}



const rows: ForecastResult[] = [
  {
    id: 1,
    date: "06 Aug 2026",
    prediction: 12540,
    actual: 12480,
    variance: 60,
    accuracy: 98.6,
    status: "Completed",
  },

  {
    id: 2,
    date: "07 Aug 2026",
    prediction: 12620,
    actual: 12540,
    variance: 80,
    accuracy: 98.1,
    status: "Completed",
  },

  {
    id: 3,
    date: "08 Aug 2026",
    prediction: 12480,
    actual: 12420,
    variance: 60,
    accuracy: 98.9,
    status: "Running",
  },
];



const ForecastTable = () => {


  const columns: Column<ForecastResult>[] = [

    {
      field: "date",
      headerName: "Forecast Date",
    },


    {
      field: "prediction",
      headerName: "Prediction",

      render: (row: ForecastResult) =>
        `${row.prediction.toLocaleString()} t/day`,
    },


    {
      field: "actual",
      headerName: "Actual",

      render: (row: ForecastResult) =>
        `${row.actual.toLocaleString()} t/day`,
    },


    {
      field: "variance",
      headerName: "Variance",

      render: (row: ForecastResult) => (

        <Typography
          fontWeight={700}
          color={
            row.variance <= 100
              ? "success.main"
              : "warning.main"
          }
        >
          {row.variance} t
        </Typography>

      ),
    },


    {
      field: "accuracy",
      headerName: "Accuracy",

      render: (row: ForecastResult) => (

        <Chip
          label={`${row.accuracy}%`}
          size="small"
          color={
            row.accuracy >= 98
              ? "success"
              : "warning"
          }
          sx={{
            fontWeight:600,
          }}
        />

      ),
    },


    {
      field: "status",
      headerName: "Status",

      render: (row: ForecastResult) => (

        <Chip
          label={row.status}
          size="small"
          color={
            row.status === "Completed"
              ? "success"
              : row.status === "Running"
              ? "warning"
              : "error"
          }
          sx={{
            fontWeight:600,
          }}
        />

      ),
    },


    {
      field: "id",
      headerName: "",
      align: "center",

      render: () => (

        <IconButton
          color="primary"
          onClick={() => {
            console.log(
              "Open forecast details"
            );
          }}
        >
          <VisibilityRounded />
        </IconButton>

      ),
    },

  ];



  return (

    <Paper
      elevation={0}
      sx={{
        p:4,
        borderRadius: "12px",
        border:"1px solid",
        borderColor:"divider",
      }}
    >


      <Stack
        direction={{
          xs:"column",
          md:"row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs:"flex-start",
          md:"center",
        }}
        spacing={2}
        mb={3}
      >


        <Box>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            Forecast Results
          </Typography>


          <Typography
            color="text.secondary"
          >
            Detailed forecast predictions for the selected context.
          </Typography>


          <Typography
            variant="body2"
            sx={{
              mt:1,
              fontWeight:600,
              color:"primary.main",
            }}
          >
            Arnot • Burn Prediction • Tactical (90 Days) • Actual Baseline
          </Typography>


        </Box>



        <Button
          variant="contained"
          startIcon={
            <DownloadRounded />
          }
        >
          Export
        </Button>


      </Stack>



      <DataTable<ForecastResult>
        rows={rows}
        columns={columns}
      />


    </Paper>

  );
};


export default ForecastTable;