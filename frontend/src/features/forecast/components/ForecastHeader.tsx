import {
  AutorenewRounded,
  DownloadRounded,
  PlayArrowRounded,
  ScheduleRounded,
} from "@mui/icons-material";

import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

const ForecastHeader = () => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Stack
        direction={{
          xs: "column",
          lg: "row",
        }}
        justifyContent="space-between"
        spacing={4}
      >
        {/* Left */}

        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            Forecast
          </Typography>

          <Typography
            sx={{
              mt: 1,
              color: "text.secondary",
              fontSize: 16,
              maxWidth: 650,
            }}
          >
            Generate, analyse and compare tactical
            and strategic coal burn forecasts across
            Eskom power stations.
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            mt={3}
            flexWrap="wrap"
          >
            <Chip
              color="success"
              label="Forecast Engine Online"
            />

            <Chip
              icon={<ScheduleRounded />}
              label="Last Run • Today 09:42"
              variant="outlined"
            />

            <Chip
              label="96.8% Accuracy"
              color="primary"
              variant="outlined"
            />
          </Stack>
        </Box>

        {/* Right */}

        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
        >
          <Button
            variant="outlined"
            startIcon={<DownloadRounded />}
            sx={{
              borderRadius: 3,
              height: 46,
              px: 3,
            }}
          >
            Export
          </Button>

          <Button
            variant="outlined"
            startIcon={<AutorenewRounded />}
            sx={{
              borderRadius: 3,
              height: 46,
              px: 3,
            }}
          >
            Refresh
          </Button>

          <Button
            variant="contained"
            startIcon={<PlayArrowRounded />}
            sx={{
              borderRadius: 3,
              height: 46,
              px: 4,
              boxShadow: "none",

              "&:hover": {
                boxShadow: "none",
              },
            }}
          >
            Run Forecast
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ForecastHeader;