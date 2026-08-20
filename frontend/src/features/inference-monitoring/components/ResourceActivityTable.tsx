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
  Tooltip,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  InfoRounded,
  RefreshRounded,
  WarningRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringEvent,
} from "../service/inference-monitoring.service";

interface ResourceActivityTableProps {
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

const getStatusColor = (
  status: string,
): "success" | "warning" | "error" | "default" => {
  switch (status) {
    case "success":
      return "success";

    case "warning":
      return "warning";

    case "failed":
      return "error";

    default:
      return "default";
  }
};

const getStatusIcon = (
  status: string,
) => {
  switch (status) {
    case "success":
      return (
        <CheckCircleRounded
          fontSize="small"
          color="success"
        />
      );

    case "warning":
      return (
        <WarningRounded
          fontSize="small"
          color="warning"
        />
      );

    case "failed":
      return (
        <ErrorRounded
          fontSize="small"
          color="error"
        />
      );

    default:
      return (
        <InfoRounded
          fontSize="small"
          color="disabled"
        />
      );
  }
};

const ResourceActivityTable = ({
  events,
}: ResourceActivityTableProps) => {
  /*
   * We intentionally only display resource activity here.
   *
   * INFERENCE_STARTED / INFERENCE_COMPLETED events belong to
   * the inference run view, not the resource interaction view.
   */
  const resourceEvents = events
    .filter(
      (
        event: InferenceMonitoringEvent,
      ) =>
        event.event_type ===
        "RESOURCE_ACTIVITY",
    )
    .slice(0, 100);

  return (
    <Card
      sx={{
        borderRadius: "12px",
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
              Resource Activity
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Individual resource interactions
              captured during inference.
            </Typography>
          </Box>

          <Chip
            size="small"
            icon={<RefreshRounded />}
            label={`${resourceEvents.length} interaction${
              resourceEvents.length === 1
                ? ""
                : "s"
            }`}
            variant="outlined"
          />
        </Stack>

        <Divider />

        {resourceEvents.length > 0 ? (
          <TableContainer>
            <Table
              size="small"
              sx={{
                minWidth: 900,
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
                      TIME
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      RESOURCE
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      color="text.secondary"
                    >
                      OPERATION
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
                      RETRY
                    </Typography>
                  </TableCell>

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
                      MESSAGE
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {resourceEvents.map(
                  (
                    event: InferenceMonitoringEvent,
                  ) => {
                    const status =
                      event.status || "info";

                    return (
                      <TableRow
                        key={event.event_id}
                        hover
                      >
                        {/* Timestamp */}
                        <TableCell
                          sx={{
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            {formatDateTime(
                              event.timestamp,
                            )}
                          </Typography>
                        </TableCell>

                        {/* Resource */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                          >
                            {event.resource ||
                              "Unknown resource"}
                          </Typography>
                        </TableCell>

                        {/* Operation */}
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily:
                                "monospace",
                              fontSize:
                                "0.8rem",
                            }}
                          >
                            {event.operation ||
                              "—"}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            {getStatusIcon(
                              status,
                            )}

                            <Chip
                              size="small"
                              label={status.toUpperCase()}
                              color={getStatusColor(
                                status,
                              )}
                              variant="outlined"
                            />
                          </Stack>
                        </TableCell>

                        {/* Retry */}
                        <TableCell>
                          {event.retry !=
                            null &&
                          event.retry > 0 ? (
                            <Chip
                              size="small"
                              label={`Retry ${event.retry}`}
                              color="warning"
                              variant="outlined"
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>

                        {/* Run */}
                        <TableCell>
                          {event.run_id ? (
                            <Tooltip
                              title={
                                event.run_id
                              }
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  maxWidth: 150,
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                  fontFamily:
                                    "monospace",
                                  fontSize:
                                    "0.75rem",
                                }}
                              >
                                {event.run_id}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>

                        {/* Message */}
                        <TableCell
                          sx={{
                            maxWidth: 360,
                          }}
                        >
                          <Tooltip
                            title={
                              event.message ||
                              ""
                            }
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                overflow:
                                  "hidden",
                                textOverflow:
                                  "ellipsis",
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {event.message ||
                                "No message"}
                            </Typography>
                          </Tooltip>
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
            <InfoRounded
              color="disabled"
              sx={{
                fontSize: 40,
                mb: 1,
              }}
            />

            <Typography
              fontWeight={600}
            >
              No resource activity recorded
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Resource interactions will appear
              here as the inference pipeline accesses
              external and client-side resources.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourceActivityTable;