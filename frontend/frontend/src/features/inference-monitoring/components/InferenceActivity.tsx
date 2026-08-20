import React from "react";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  HourglassTopRounded,
  PlayCircleRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringRun,
} from "../service/inference-monitoring.service";

interface InferenceActivityProps {
  runs: InferenceMonitoringRun[];
}

const formatDuration = (
  durationMs: number | null,
): string => {
  if (durationMs == null) {
    return "—";
  }

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

const formatDateTime = (
  value: string | null,
): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const getStatusChip = (
  status: string,
) => {
  switch (status) {
    case "success":
      return (
        <Chip
          size="small"
          icon={<CheckCircleRounded />}
          label="SUCCESS"
          color="success"
          variant="outlined"
        />
      );

    case "failed":
      return (
        <Chip
          size="small"
          icon={<ErrorRounded />}
          label="FAILED"
          color="error"
          variant="outlined"
        />
      );

    case "running":
      return (
        <Chip
          size="small"
          icon={<HourglassTopRounded />}
          label="RUNNING"
          color="warning"
          variant="outlined"
        />
      );

    default:
      return (
        <Chip
          size="small"
          label={status.toUpperCase()}
          variant="outlined"
        />
      );
  }
};

const InferenceActivity = ({
  runs,
}: InferenceActivityProps) => {
  return (
    <Card
      sx={{
        borderRadius: "12px",
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
              Inference Activity
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Recent inference executions and their
              operational status.
            </Typography>
          </Box>

          <Chip
            size="small"
            icon={<PlayCircleRounded />}
            label={`${runs.length} recorded run${
              runs.length === 1 ? "" : "s"
            }`}
            variant="outlined"
          />
        </Stack>

        <Divider />

        {runs.length > 0 ? (
          <TableContainer>
            <Table
              size="small"
              sx={{
                minWidth: 760,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      RUN
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      HORIZON
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      TRIGGER
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      STATUS
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      DURATION
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      RESOURCE ISSUES
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      STARTED
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {runs.map(
                  (
                    run: InferenceMonitoringRun,
                  ) => {
                    const resourceIssues =
                      run.resource_failures +
                      run.resource_warnings;

                    return (
                      <TableRow
                        key={run.run_id}
                        hover
                      >
                        {/* Run ID */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                              fontFamily:
                                "monospace",
                              fontSize:
                                "0.78rem",
                            }}
                          >
                            {run.run_id}
                          </Typography>
                        </TableCell>

                        {/* Horizon */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              textTransform:
                                "capitalize",
                            }}
                          >
                            {run.horizon ||
                              "—"}
                          </Typography>
                        </TableCell>

                        {/* Trigger */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              textTransform:
                                "capitalize",
                            }}
                          >
                            {run.trigger ||
                              "—"}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {getStatusChip(
                            run.status,
                          )}
                        </TableCell>

                        {/* Duration */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                          >
                            {formatDuration(
                              run.duration_ms,
                            )}
                          </Typography>
                        </TableCell>

                        {/* Resource issues */}
                        <TableCell>
                          {resourceIssues ===
                          0 ? (
                            <Chip
                              size="small"
                              label="None"
                              color="success"
                              variant="outlined"
                            />
                          ) : (
                            <Stack
                              direction="row"
                              spacing={0.5}
                            >
                              {run.resource_failures >
                                0 && (
                                <Chip
                                  size="small"
                                  label={`${run.resource_failures} failed`}
                                  color="error"
                                  variant="outlined"
                                />
                              )}

                              {run.resource_warnings >
                                0 && (
                                <Chip
                                  size="small"
                                  label={`${run.resource_warnings} warning${
                                    run.resource_warnings ===
                                    1
                                      ? ""
                                      : "s"
                                  }`}
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          )}
                        </TableCell>

                        {/* Started */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            {formatDateTime(
                              run.started_at,
                            )}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
            }}
          >
            <PlayCircleRounded
              color="disabled"
              sx={{
                fontSize: 40,
                mb: 1,
              }}
            />

            <Typography
              fontWeight={600}
            >
              No inference runs recorded
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Run history will appear here after
              the inference pipeline executes.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default InferenceActivity;