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

/**
 * =====================================================
 * FORECAST FILTER BAR - DEPRECATED/UNUSED
 * =====================================================
 * 
 * [DATA: MOCK] WARNING: hardcoded power-station names and model names —
 * NOT imported anywhere in the app (dead code).
 * 
 * [DATA: MOCK] HARDCODED STATIONS: Kendal, Matla, Tutuka, Lethabo
 * [DATA: MOCK] HARDCODED MODELS: ARIMA, LSTM, XGBoost (pipeline is XGBoost-only)
 * 
 * If this component is ever reactivated, it MUST be updated to:
 * 1. Use useForecastEntities() hook to fetch stations dynamically
 * 2. Connect to the /api/entities endpoint
 * 3. Remove the hardcoded MenuItem values
 * 
 */
const ForecastFilterBar = () => {
  const [station, setStation] = useState("");
  const [model, setModel] = useState("");

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
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
          <MenuItem value="Kendal">Kendal</MenuItem>
          <MenuItem value="Matla">Matla</MenuItem>
          <MenuItem value="Tutuka">Tutuka</MenuItem>
          <MenuItem value="Lethabo">Lethabo</MenuItem>
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