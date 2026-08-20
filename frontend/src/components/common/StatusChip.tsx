import React from "react";
import {
  Chip,
  ChipProps,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorRounded,
  HourglassTopRounded,
  WarningAmberRounded,
  CloudDoneRounded,
  CloudOffRounded,
} from "@mui/icons-material";

export type Status =
  | "healthy"
  | "warning"
  | "critical"
  | "running"
  | "completed"
  | "failed"
  | "pending"
  | "online"
  | "offline";

interface StatusChipProps {
  status: Status | string;
}

const config: Record<
  Status,
  {
    label: string;
    color: ChipProps["color"];
    icon: React.ReactElement;
  }
> = {
  healthy: {
    label: "Healthy",
    color: "success",
    icon: <CheckCircleRounded />,
  },

  warning: {
    label: "Warning",
    color: "warning",
    icon: <WarningAmberRounded />,
  },

  critical: {
    label: "Critical",
    color: "error",
    icon: <ErrorRounded />,
  },

  running: {
    label: "Running",
    color: "info",
    icon: <HourglassTopRounded />,
  },

  completed: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleRounded />,
  },

  failed: {
    label: "Failed",
    color: "error",
    icon: <ErrorRounded />,
  },

  pending: {
    label: "Pending",
    color: "warning",
    icon: <HourglassTopRounded />,
  },

  online: {
    label: "Online",
    color: "success",
    icon: <CloudDoneRounded />,
  },

  offline: {
    label: "Offline",
    color: "default",
    icon: <CloudOffRounded />,
  },
};

const StatusChip = ({
  status,
}: StatusChipProps) => {
  const key = status.toLowerCase() as Status;

  const item = config[key] ?? {
    label: status,
    color: "default" as ChipProps["color"],
    icon: <WarningAmberRounded />,
  };

  return (
    <Chip
      icon={item.icon}
      label={item.label}
      color={item.color}
      size="small"
      variant="filled"
      sx={{
        fontWeight: 600,
        minWidth: 100,
      }}
    />
  );
};

export default StatusChip;