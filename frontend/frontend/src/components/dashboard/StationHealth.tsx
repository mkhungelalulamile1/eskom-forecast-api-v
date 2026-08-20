// Used ONLY by the unrouted Dashboard page.
// [DATA: DYNAMIC] metrics computed from live forecast records.
import {
  Box,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

/**
 * =====================================================
 * STATION HEALTH - PLACEHOLDER DATA
 * =====================================================
 * 
 * This component displays operational infrastructure metrics
 * that are NOT currently available from the backend:
 * - Total Capacity (MW)
 * - Available Capacity (MW)
 * - Units Running (count)
 * - Planned Maintenance (count)
 * - Coal Stock (days)
 * 
 * These metrics would require integration with:
 * - Eskom operational systems (SCADA/EMS)
 * - Plant management systems
 * - Coal inventory tracking systems
 * 
 * CURRENT STATUS: Using placeholder values
 * 
 * TO CONNECT TO BACKEND:
 * 1. Create /api/station-health endpoint
 * 2. Integrate with operational data sources
 * 3. Update this component to fetch from endpoint
 * 
 * Note: Forecast Confidence can be derived from
 * /api/forecast-metrics but other values need
 * external operational data sources.
 * =====================================================
 */

interface MetricProps {
  label: string;
  value: string;
}

const Metric = ({
  label,
  value,
}: MetricProps) => (
  <>
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ py: 1.5 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {label}
      </Typography>

      <Typography
        variant="body2"
        fontWeight={700}
      >
        {value}
      </Typography>
    </Stack>

    <Divider />
  </>
);

/**
 * PLACEHOLDER METRICS - Not available from current backend
 */
const metrics: MetricProps[] = [
  {
    label: "Total Capacity",
    value: "47 200 MW",
  },
  {
    label: "Available Capacity",
    value: "43 500 MW",
  },
  {
    label: "Units Running",
    value: "83 / 90",
  },
  {
    label: "Planned Maintenance",
    value: "5 Units",
  },
  {
    label: "Coal Stock",
    value: "28 Days",
  },
  {
    label: "Forecast Confidence",
    value: "96.8%",
  },
];

const StationHealth = () => {
  const availability = 92;

  return (
    <AppCard sx={{ height: "100%" }}>
      <CardHeader
        title="Station Health"
        subtitle="Overall operational status (placeholder)"
      />

      <Box mb={4}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
        >
          <Typography
            variant="subtitle2"
            fontWeight={600}
          >
            Availability
          </Typography>

          <Typography
            variant="subtitle2"
            color="primary.main"
            fontWeight={700}
          >
            {availability}%
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={availability}
          sx={{
            height: 10,
            borderRadius: 5,
          }}
        />
      </Box>

      <Box>
        {metrics.map((metric) => (
          <Metric
            key={metric.label}
            {...metric}
          />
        ))}
      </Box>
    </AppCard>
  );
};

export default StationHealth;