import React from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  ErrorRounded,
  WarningRounded,
  AccessTimeRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringEvent,
} from "../service/inference-monitoring.service";

interface RecentErrorsProps {
  events: InferenceMonitoringEvent[];
}

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

const RecentErrors = ({
  events,
}: RecentErrorsProps) => {
  const issues = events
    .filter(
      (
        event: InferenceMonitoringEvent,
      ) =>
        event.status === "failed" ||
        event.status === "warning",
    )
    .slice(0, 20);

  const failures = issues.filter(
    (event) =>
      event.status === "failed",
  ).length;

  const warnings = issues.filter(
    (event) =>
      event.status === "warning",
  ).length;

  return (
    <Card
      sx={{
        borderRadius: "12px",
        height: "100%",
      }}
    >
      <CardContent>
        {/* Header */}
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
              Recent Errors & Warnings
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Operational issues detected during
              inference and resource interactions.
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
          >
            {failures > 0 && (
              <Chip
                size="small"
                icon={<ErrorRounded />}
                label={`${failures} failed`}
                color="error"
                variant="outlined"
              />
            )}

            {warnings > 0 && (
              <Chip
                size="small"
                icon={<WarningRounded />}
                label={`${warnings} warning${
                  warnings === 1
                    ? ""
                    : "s"
                }`}
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>

        <Divider />

        {issues.length > 0 ? (
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {issues.map(
              (
                event: InferenceMonitoringEvent,
              ) => {
                const failed =
                  event.status ===
                  "failed";

                return (
                  <Alert
                    key={event.event_id}
                    severity={
                      failed
                        ? "error"
                        : "warning"
                    }
                    icon={
                      failed ? (
                        <ErrorRounded />
                      ) : (
                        <WarningRounded />
                      )
                    }
                    sx={{
                      alignItems:
                        "flex-start",
                      borderRadius: "10px",
                    }}
                  >
                    <Stack spacing={0.75}>
                      {/* Resource / event */}
                      <Stack
                        direction={{
                          xs: "column",
                          sm: "row",
                        }}
                        spacing={{
                          xs: 0.5,
                          sm: 1,
                        }}
                        alignItems={{
                          xs: "flex-start",
                          sm: "center",
                        }}
                      >
                        <Typography
                          fontWeight={700}
                        >
                          {event.resource ||
                            event.event_type}
                        </Typography>

                        {event.operation && (
                          <Chip
                            size="small"
                            label={
                              event.operation
                            }
                            variant="outlined"
                          />
                        )}
                      </Stack>

                      {/* Message */}
                      <Typography
                        variant="body2"
                      >
                        {event.message ||
                          "No error message recorded."}
                      </Typography>

                      {/* Metadata */}
                      <Stack
                        direction="row"
                        spacing={1.5}
                        flexWrap="wrap"
                        useFlexGap
                        alignItems="center"
                      >
                        {event.horizon && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            Horizon:{" "}
                            {event.horizon}
                          </Typography>
                        )}

                        {event.retry !=
                          null &&
                          event.retry >
                            0 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Retry:{" "}
                              {
                                event.retry
                              }
                            </Typography>
                          )}

                        {event.run_id && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontFamily:
                                "monospace",
                            }}
                          >
                            Run:{" "}
                            {event.run_id}
                          </Typography>
                        )}
                      </Stack>

                      {/* Timestamp */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                      >
                        <AccessTimeRounded
                          sx={{
                            fontSize: 14,
                          }}
                          color="disabled"
                        />

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {formatDateTime(
                            event.timestamp,
                          )}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Alert>
                );
              },
            )}
          </Stack>
        ) : (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor:
                  "success.lighter",
                mx: "auto",
                mb: 1.5,
              }}
            >
              <Typography
                sx={{
                  color:
                    "success.main",
                  fontWeight: 800,
                  fontSize: 22,
                }}
              >
                ✓
              </Typography>
            </Box>

            <Typography
              fontWeight={600}
            >
              No recent issues
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              No warnings or failures have been
              recorded in the current monitoring
              window.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentErrors;