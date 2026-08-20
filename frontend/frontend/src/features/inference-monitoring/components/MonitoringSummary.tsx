import React from "react";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  EventNoteRounded,
  WarningRounded,
  TimelineRounded,
  SpeedRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringSummary,
} from "../service/inference-monitoring.service";

interface MonitoringSummaryProps {
  summary: InferenceMonitoringSummary;
}

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color:
    | "success"
    | "warning"
    | "error"
    | "primary"
    | "default";
}) => {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              fontWeight={600}
            >
              {title}
            </Typography>

            <Typography
              variant="h4"
              fontWeight={700}
              sx={{
                mt: 1,
                lineHeight: 1.1,
              }}
            >
              {value}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 0.75,
              }}
            >
              {subtitle}
            </Typography>
          </Box>

          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "action.hover",
              color:
                color === "default"
                  ? "text.secondary"
                  : `${color}.main`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const MonitoringSummary = ({
  summary,
}: MonitoringSummaryProps) => {
  const {
    total_events,
    total_runs,
    successful_runs,
    failed_runs,
    resource_failures,
    resource_warnings,
    latest_run,
  } = summary.summary;

  const successRate =
    total_runs > 0
      ? Math.round(
          (successful_runs /
            total_runs) *
            100,
        )
      : 0;

  const healthLabel = (() => {
    switch (summary.health) {
      case "healthy":
        return "Healthy";

      case "degraded":
        return "Degraded";

      case "failed":
        return "Failed";

      default:
        return "Unknown";
    }
  })();

  const healthColor =
    summary.health === "healthy"
      ? "success"
      : summary.health ===
          "degraded"
        ? "warning"
        : summary.health ===
            "failed"
          ? "error"
          : "default";

  return (
    <Box sx={{ mb: 3 }}>
      {/* Overall status */}
      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            justifyContent="space-between"
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            spacing={2}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
            >
              {summary.health ===
                "healthy" && (
                <CheckCircleRounded
                  color="success"
                />
              )}

              {summary.health ===
                "degraded" && (
                <WarningRounded
                  color="warning"
                />
              )}

              {summary.health ===
                "failed" && (
                <ErrorRounded
                  color="error"
                />
              )}

              {summary.health ===
                "unknown" && (
                <TimelineRounded
                  color="disabled"
                />
              )}

              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  CURRENT INFERENCE HEALTH
                </Typography>

                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{ mt: 0.25 }}
                >
                  {healthLabel}
                </Typography>
              </Box>
            </Stack>

            <Chip
              label={healthLabel}
              color={healthColor}
              variant="outlined"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <Grid
        container
        spacing={2}
      >
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Inference Runs"
            value={total_runs}
            subtitle="Recorded executions"
            icon={
              <EventNoteRounded />
            }
            color="primary"
          />
        </Grid>

        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Successful"
            value={successful_runs}
            subtitle={`${successRate}% success rate`}
            icon={
              <CheckCircleRounded />
            }
            color="success"
          />
        </Grid>

        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Failed"
            value={failed_runs}
            subtitle="Inference failures"
            icon={
              <ErrorRounded />
            }
            color="error"
          />
        </Grid>

        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Resource Failures"
            value={resource_failures}
            subtitle="External interactions"
            icon={
              <ErrorRounded />
            }
            color={
              resource_failures > 0
                ? "error"
                : "default"
            }
          />
        </Grid>

        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Warnings"
            value={resource_warnings}
            subtitle="Resource warnings"
            icon={
              <WarningRounded />
            }
            color={
              resource_warnings > 0
                ? "warning"
                : "default"
            }
          />
        </Grid>

        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          lg={2}
        >
          <MetricCard
            title="Events"
            value={total_events}
            subtitle="Monitoring events"
            icon={<SpeedRounded />}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* Latest run */}
      {latest_run && (
        <Card
          sx={{
            mt: 2,
            borderRadius: 3,
          }}
        >
          <CardContent>
            <Stack
              direction={{
                xs: "column",
                md: "row",
              }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                >
                  LATEST COMPLETED INFERENCE
                </Typography>

                <Typography
                  variant="body1"
                  fontWeight={700}
                  sx={{ mt: 0.5 }}
                >
                  {latest_run.horizon
                    ? `${latest_run.horizon} forecast`
                    : "Inference run"}
                </Typography>
              </Box>

              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
              >
                {latest_run.status && (
                  <Chip
                    size="small"
                    label={latest_run.status.toUpperCase()}
                    color={
                      latest_run.status ===
                      "success"
                        ? "success"
                        : latest_run.status ===
                            "failed"
                          ? "error"
                          : "default"
                    }
                    variant="outlined"
                  />
                )}

                {latest_run.trigger && (
                  <Chip
                    size="small"
                    label={`Trigger: ${latest_run.trigger}`}
                    variant="outlined"
                  />
                )}

                {latest_run.duration_ms !=
                  null && (
                  <Chip
                    size="small"
                    label={`${Math.round(
                      latest_run.duration_ms /
                        1000,
                    )}s`}
                    variant="outlined"
                  />
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default MonitoringSummary;