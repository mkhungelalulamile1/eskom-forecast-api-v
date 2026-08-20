import React, { useMemo } from "react";

import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  AccessTimeRounded,
  TrendingDownRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringRun,
} from "../service/inference-monitoring.service";

interface LatencyChartProps {
  runs: InferenceMonitoringRun[];
}

interface LatencyPoint {
  run: InferenceMonitoringRun;
  durationMs: number;
  label: string;
}

const formatDuration = (
  durationMs: number,
): string => {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  const seconds = durationMs / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(
    seconds % 60,
  );

  return `${minutes}m ${remainingSeconds}s`;
};

const formatDate = (
  value: string | null,
): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  );
};

const LatencyChart = ({
  runs,
}: LatencyChartProps) => {
  const latencyPoints = useMemo<LatencyPoint[]>(
    () =>
      runs
        .filter(
          (
            run: InferenceMonitoringRun,
          ) =>
            run.duration_ms != null &&
            run.duration_ms >= 0,
        )
        .slice(0, 20)
        .reverse()
        .map(
          (
            run: InferenceMonitoringRun,
          ) => ({
            run,
            durationMs:
              run.duration_ms as number,
            label: formatDate(
              run.completed_at ||
                run.started_at,
            ),
          }),
        ),
    [runs],
  );

  const statistics = useMemo(() => {
    if (latencyPoints.length === 0) {
      return {
        average: null,
        fastest: null,
        slowest: null,
        latest: null,
      };
    }

    const values = latencyPoints.map(
      (point) => point.durationMs,
    );

    const total = values.reduce(
      (sum, value) => sum + value,
      0,
    );

    return {
      average: total / values.length,
      fastest: Math.min(...values),
      slowest: Math.max(...values),
      latest:
        latencyPoints[
          latencyPoints.length - 1
        ].durationMs,
    };
  }, [latencyPoints]);

  const chartMax = useMemo(() => {
    if (latencyPoints.length === 0) {
      return 1;
    }

    const maximum = Math.max(
      ...latencyPoints.map(
        (point) => point.durationMs,
      ),
    );

    return maximum > 0 ? maximum : 1;
  }, [latencyPoints]);

  const trend = useMemo(() => {
    if (latencyPoints.length < 2) {
      return "stable";
    }

    const previous =
      latencyPoints[
        latencyPoints.length - 2
      ].durationMs;

    const latest =
      latencyPoints[
        latencyPoints.length - 1
      ].durationMs;

    if (latest > previous * 1.1) {
      return "up";
    }

    if (latest < previous * 0.9) {
      return "down";
    }

    return "stable";
  }, [latencyPoints]);

  return (
    <Card
      sx={{
        borderRadius: "12px",
        height: "100%",
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
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography
              variant="h6"
              fontWeight={700}
            >
              Inference Latency
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Execution duration from recent
              completed inference runs.
            </Typography>
          </Box>

          {trend === "up" && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
            >
              <TrendingUpRounded
                color="error"
                fontSize="small"
              />

              <Typography
                variant="caption"
                color="error"
                fontWeight={600}
              >
                Increasing
              </Typography>
            </Stack>
          )}

          {trend === "down" && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
            >
              <TrendingDownRounded
                color="success"
                fontSize="small"
              />

              <Typography
                variant="caption"
                color="success.main"
                fontWeight={600}
              >
                Improving
              </Typography>
            </Stack>
          )}
        </Stack>

        <Divider />

        {latencyPoints.length > 0 ? (
          <>
            {/* Statistics */}
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ py: 2 }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: 120,
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "action.hover",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Latest
                </Typography>

                <Typography
                  fontWeight={700}
                  sx={{ mt: 0.25 }}
                >
                  {statistics.latest != null
                    ? formatDuration(
                        statistics.latest,
                      )
                    : "—"}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 120,
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "action.hover",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Average
                </Typography>

                <Typography
                  fontWeight={700}
                  sx={{ mt: 0.25 }}
                >
                  {statistics.average != null
                    ? formatDuration(
                        statistics.average,
                      )
                    : "—"}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 120,
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "action.hover",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Fastest
                </Typography>

                <Typography
                  fontWeight={700}
                  sx={{ mt: 0.25 }}
                >
                  {statistics.fastest != null
                    ? formatDuration(
                        statistics.fastest,
                      )
                    : "—"}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  minWidth: 120,
                  p: 1.5,
                  borderRadius: "10px",
                  bgcolor: "action.hover",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Slowest
                </Typography>

                <Typography
                  fontWeight={700}
                  sx={{ mt: 0.25 }}
                >
                  {statistics.slowest != null
                    ? formatDuration(
                        statistics.slowest,
                      )
                    : "—"}
                </Typography>
              </Box>
            </Stack>

            {/* Lightweight latency visualization */}
            <Box sx={{ pt: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-end"
                sx={{
                  height: 180,
                  px: 0.5,
                  pb: 1,
                }}
              >
                {latencyPoints.map(
                  (
                    point: LatencyPoint,
                    index: number,
                  ) => {
                    const height =
                      Math.max(
                        8,
                        (point.durationMs /
                          chartMax) *
                          145,
                      );

                    const runLabel =
                      point.run.horizon
                        ? point.run.horizon
                        : "run";

                    return (
                      <Box
                        key={`${point.run.run_id}-${index}`}
                        sx={{
                          flex: 1,
                          minWidth: 8,
                          maxWidth: 42,
                          height: 145,
                          display: "flex",
                          alignItems:
                            "flex-end",
                          justifyContent:
                            "center",
                        }}
                      >
                        <Box
                          title={`${runLabel}: ${formatDuration(
                            point.durationMs,
                          )}`}
                          sx={{
                            width: "70%",
                            minWidth: 6,
                            height,
                            borderRadius:
                              "6px 6px 2px 2px",
                            bgcolor:
                              point.run.status ===
                              "failed"
                                ? "error.main"
                                : "primary.main",
                            opacity:
                              point.run.status ===
                              "failed"
                                ? 0.8
                                : 0.75,
                            transition:
                              "height 0.2s ease",
                            "&:hover": {
                              opacity: 1,
                            },
                          }}
                        />
                      </Box>
                    );
                  },
                )}
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                sx={{
                  px: 0.5,
                }}
              >
                {latencyPoints.map(
                  (
                    point: LatencyPoint,
                    index: number,
                  ) => (
                    <Typography
                      key={`${point.run.run_id}-label-${index}`}
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        flex: 1,
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {point.label}
                    </Typography>
                  ),
                )}
              </Stack>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 2 }}
            >
              <AccessTimeRounded
                fontSize="small"
                color="disabled"
              />

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Showing the latest{" "}
                {latencyPoints.length}{" "}
                completed run
                {latencyPoints.length ===
                1
                  ? ""
                  : "s"}.
              </Typography>
            </Stack>
          </>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
            }}
          >
            <AccessTimeRounded
              color="disabled"
              sx={{
                fontSize: 40,
                mb: 1,
              }}
            />

            <Typography
              fontWeight={600}
            >
              No latency data yet
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Latency will appear after an
              inference run completes.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default LatencyChart;