import { useState } from "react";

import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import FilterAltRoundedIcon from "@mui/icons-material/FilterAltRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";

import { useForecastEntities } from "../hooks/useForecast";
import { ForecastEntity } from "../types/forecast.types";

/**
 * The station list is NEVER hard-coded: it is derived from the
 * entities the backend returns (`/api/scenario-data`), the same
 * source the global Forecast Context bar uses.
 */
const ForecastFilterBar = () => {
  const [station, setStation] = useState("");
  const [model, setModel] = useState("");

  const { data: entities, isLoading } = useForecastEntities();

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: "10px",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
      >
        <TextField
          select
          fullWidth
          label="Power Station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
        >
          <MenuItem value="">All Stations</MenuItem>

          {isLoading && (
            <MenuItem disabled value="__loading">
              Loading stations…
            </MenuItem>
          )}

          {(entities ?? []).map((entity: ForecastEntity) => (
            <MenuItem key={entity.id} value={entity.id}>
              {entity.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Forecast Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          <MenuItem value="">All Models</MenuItem>
          <MenuItem value="ARIMA">ARIMA</MenuItem>
          <MenuItem value="LSTM">LSTM</MenuItem>
          <MenuItem value="XGBoost">XGBoost</MenuItem>
        </TextField>

        <Button
          variant="contained"
          startIcon={<FilterAltRoundedIcon />}
        >
          Apply
        </Button>

        <Button
          variant="outlined"
          startIcon={<RestartAltRoundedIcon />}
        >
          Reset
        </Button>
      </Stack>
    </Box>
  );
};

export default ForecastFilterBar;