import {
  Box,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";

import {
  ShowChartRounded,
  InsightsRounded,
  BarChartRounded,
  LayersRounded,
} from "@mui/icons-material";

import { useForecastEntities } from "../../features/forecast/hooks/useForecast";
import { ForecastEntity } from "../../features/forecast/types/forecast.types";

export type ChartType = "line" | "area" | "bar";

/**
 * =====================================================
 * CARD STATION FILTER  (NEW — per-card filter)
 * =====================================================
 * A small station selector for a single card. Defaults to
 * "All Stations" so each card shows the full fleet until the
 * user picks a specific power station. Renders right-aligned
 * at the far end of a card header.
 */
interface CardStationFilterProps {
  value: string;
  onChange: (value: string) => void;
  size?: "small" | "medium";
}

export const CardStationFilter = ({
  value,
  onChange,
  size = "small",
}: CardStationFilterProps) => {
  const { data } = useForecastEntities();
  const entities: ForecastEntity[] = data ?? [];

  const handle = (e: SelectChangeEvent<string>) => onChange(e.target.value);

  return (
    <Select
      value={value}
      onChange={handle}
      size={size}
      IconComponent={LayersRounded}
      sx={{
        minWidth: 150,
        "& .MuiSelect-select": { fontWeight: 700, fontSize: "0.8rem" },
      }}
    >
      <MenuItem value="all">All Stations</MenuItem>
      {entities.map((e) => (
        <MenuItem key={e.id} value={e.id}>
          {e.label}
        </MenuItem>
      ))}
    </Select>
  );
};

/**
 * =====================================================
 * CHART TYPE TOGGLE  (NEW — line view types)
 * =====================================================
 * Lets users switch a chart between Line, Area and Bar views.
 * Defaults to the chart's preferred type.
 */
interface ChartTypeToggleProps {
  value: ChartType;
  onChange: (value: ChartType) => void;
}

export const ChartTypeToggle = ({ value, onChange }: ChartTypeToggleProps) => {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, next) => next && onChange(next as ChartType)}
      size="small"
    >
      <Tooltip title="Line view">
        <ToggleButton value="line">
          <ShowChartRounded fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Area view">
        <ToggleButton value="area">
          <InsightsRounded fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Bar view">
        <ToggleButton value="bar">
          <BarChartRounded fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
};

/**
 * =====================================================
 * CARD TOOLBAR  (NEW)
 * =====================================================
 * Groups the per-card station filter + line-type toggle at the
 * far right of a card header, aligned and wrapped cleanly.
 */
interface CardToolbarProps {
  station: string;
  onStationChange: (value: string) => void;
  chartType: ChartType;
  onChartTypeChange: (value: ChartType) => void;
}

export const CardToolbar = ({
  station,
  onStationChange,
  chartType,
  onChartTypeChange,
}: CardToolbarProps) => {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
    >
      <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
      <CardStationFilter value={station} onChange={onStationChange} />
    </Stack>
  );
};

/**
 * A spacer used to keep card toolbars right-aligned and separated
 * from a title without eating into small screens.
 */
export const ToolbarSpacer = () => <Box sx={{ flexGrow: 1 }} />;
