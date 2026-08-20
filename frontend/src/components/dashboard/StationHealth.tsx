import {
  Box,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

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
        subtitle="Overall operational status"
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
            borderRadius: "12px",
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