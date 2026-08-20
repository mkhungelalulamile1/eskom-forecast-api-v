import React from "react";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  WarningRounded,
  CloudRounded,
  StorageRounded,
  MemoryRounded,
  PublicRounded,
} from "@mui/icons-material";

import {
  InferenceMonitoringResource,
} from "../service/inference-monitoring.service";

interface ResourceHealthProps {
  resources: InferenceMonitoringResource[];
}

type ResourceStatus =
  | "healthy"
  | "warning"
  | "failed"
  | "unknown";

const getResourceStatus = (
  resource: InferenceMonitoringResource,
): ResourceStatus => {
  if (resource.failures > 0) {
    return "failed";
  }

  if (resource.warnings > 0) {
    return "warning";
  }

  if (resource.successes > 0) {
    return "healthy";
  }

  return "unknown";
};

const getStatusLabel = (
  status: ResourceStatus,
): string => {
  switch (status) {
    case "healthy":
      return "Healthy";

    case "warning":
      return "Warning";

    case "failed":
      return "Failed";

    default:
      return "No activity";
  }
};

const getResourceIcon = (
  resourceName: string,
) => {
  const name =
    resourceName.toLowerCase();

  if (
    name.includes("azure") ||
    name.includes("cloud") ||
    name.includes("storage")
  ) {
    return <CloudRounded />;
  }

  if (
    name.includes("database") ||
    name.includes("bronze") ||
    name.includes("data")
  ) {
    return <StorageRounded />;
  }

  if (
    name.includes("weather") ||
    name.includes("api")
  ) {
    return <PublicRounded />;
  }

  if (
    name.includes("model") ||
    name.includes("inference") ||
    name.includes("engine")
  ) {
    return <MemoryRounded />;
  }

  return <StorageRounded />;
};

const StatusIcon = ({
  status,
}: {
  status: ResourceStatus;
}) => {
  switch (status) {
    case "healthy":
      return (
        <CheckCircleRounded
          color="success"
          fontSize="small"
        />
      );

    case "warning":
      return (
        <WarningRounded
          color="warning"
          fontSize="small"
        />
      );

    case "failed":
      return (
        <ErrorRounded
          color="error"
          fontSize="small"
        />
      );

    default:
      return (
        <StorageRounded
          color="disabled"
          fontSize="small"
        />
      );
  }
};

const formatDateTime = (
  value: string | null,
): string => {
  if (!value) {
    return "No activity recorded";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
};

const ResourceHealth = ({
  resources,
}: ResourceHealthProps) => {
  const sortedResources =
    [...resources].sort(
      (a, b) => {
        const statusPriority: Record<
          ResourceStatus,
          number
        > = {
          failed: 0,
          warning: 1,
          healthy: 2,
          unknown: 3,
        };

        const statusA =
          getResourceStatus(a);

        const statusB =
          getResourceStatus(b);

        if (
          statusPriority[statusA] !==
          statusPriority[statusB]
        ) {
          return (
            statusPriority[statusA] -
            statusPriority[statusB]
          );
        }

        return (
          b.events -
          a.events
        );
      },
    );

  const totalResources =
    resources.length;

  const healthyResources =
    resources.filter(
      (resource) =>
        getResourceStatus(
          resource,
        ) === "healthy",
    ).length;

  const warningResources =
    resources.filter(
      (resource) =>
        getResourceStatus(
          resource,
        ) === "warning",
    ).length;

  const failedResources =
    resources.filter(
      (resource) =>
        getResourceStatus(
          resource,
        ) === "failed",
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
              Resource Health
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Health of resources
              interacted with during
              inference.
            </Typography>
          </Box>

          <Chip
            size="small"
            label={`${totalResources} resource${
              totalResources === 1
                ? ""
                : "s"
            }`}
            variant="outlined"
          />
        </Stack>

        {/* Summary */}

        {totalResources > 0 && (
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 2 }}
          >
            <Chip
              size="small"
              icon={
                <CheckCircleRounded />
              }
              label={`${healthyResources} healthy`}
              color={
                healthyResources > 0
                  ? "success"
                  : "default"
              }
              variant="outlined"
            />

            <Chip
              size="small"
              icon={
                <WarningRounded />
              }
              label={`${warningResources} warning${
                warningResources === 1
                  ? ""
                  : "s"
              }`}
              color={
                warningResources > 0
                  ? "warning"
                  : "default"
              }
              variant="outlined"
            />

            <Chip
              size="small"
              icon={
                <ErrorRounded />
              }
              label={`${failedResources} failed`}
              color={
                failedResources > 0
                  ? "error"
                  : "default"
              }
              variant="outlined"
            />
          </Stack>
        )}

        <Divider />

        {/* Resources */}

        <Stack spacing={0}>

          {sortedResources.map(
            (
              resource,
              index,
            ) => {
              const status =
                getResourceStatus(
                  resource,
                );

              return (
                <Box
                  key={
                    resource.resource
                  }
                  sx={{
                    py: 2,
                    borderBottom:
                      index <
                      sortedResources.length -
                        1
                        ? 1
                        : 0,
                    borderColor:
                      "divider",
                  }}
                >

                  <Stack
                    direction={{
                      xs: "column",
                      sm: "row",
                    }}
                    spacing={2}
                    justifyContent="space-between"
                  >

                    {/* Resource identity */}

                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          bgcolor:
                            "action.hover",
                          flexShrink: 0,
                        }}
                      >
                        {getResourceIcon(
                          resource.resource,
                        )}
                      </Box>

                      <Box>

                        <Typography
                          fontWeight={700}
                        >
                          {
                            resource.resource
                          }
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          sx={{
                            mt: 0.25,
                          }}
                        >
                          <StatusIcon
                            status={status}
                          />

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {getStatusLabel(
                              status,
                            )}
                          </Typography>
                        </Stack>

                      </Box>
                    </Stack>

                    {/* Counters */}

                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >

                      <Chip
                        size="small"
                        label={`${resource.events} events`}
                        variant="outlined"
                      />

                      {resource.successes >
                        0 && (
                        <Chip
                          size="small"
                          label={`${resource.successes} success`}
                          color="success"
                          variant="outlined"
                        />
                      )}

                      {resource.warnings >
                        0 && (
                        <Chip
                          size="small"
                          label={`${resource.warnings} warning${
                            resource.warnings ===
                            1
                              ? ""
                              : "s"
                          }`}
                          color="warning"
                          variant="outlined"
                        />
                      )}

                      {resource.failures >
                        0 && (
                        <Chip
                          size="small"
                          label={`${resource.failures} failure${
                            resource.failures ===
                            1
                              ? ""
                              : "s"
                          }`}
                          color="error"
                          variant="outlined"
                        />
                      )}

                    </Stack>

                  </Stack>

                  {/* Last interaction */}

                  <Box
                    sx={{
                      mt: 1.5,
                      ml: {
                        xs: 0,
                        sm: 6.75,
                      },
                    }}
                  >

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Last interaction
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.25,
                      }}
                    >
                      {
                        resource.last_message ||
                        "No message recorded"
                      }
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mt: 0.25,
                      }}
                    >
                      {formatDateTime(
                        resource.last_timestamp,
                      )}
                    </Typography>

                  </Box>

                </Box>
              );
            },
          )}

          {/* Empty state */}

          {sortedResources.length ===
            0 && (
            <Box
              sx={{
                py: 6,
                textAlign: "center",
              }}
            >

              <StorageRounded
                color="disabled"
                sx={{
                  fontSize: 40,
                  mb: 1,
                }}
              />

              <Typography
                fontWeight={600}
              >
                No resource activity yet
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Resource interactions
                will appear here when
                inference runs.
              </Typography>

            </Box>
          )}

        </Stack>

      </CardContent>
    </Card>
  );
};

export default ResourceHealth;