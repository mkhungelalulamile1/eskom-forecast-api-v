import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * =====================================================
 * STATUS PILL
 * =====================================================
 * NEW (added in redesign): a small labelled status badge with
 * a pulsing "live" dot, used for the header system-status and
 * card health indicators.
 */
export type PillTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  dot?: boolean;
}

const TONE_COLORS: Record<PillTone, string> = {
  success: "#1E9E6A",
  warning: "#E8A008",
  error: "#D64545",
  info: "#1890d7",
  neutral: "#6C7B93",
};

const StatusPill = ({ label, tone = "info", dot = true }: StatusPillProps) => {
  const color = TONE_COLORS[tone];

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.4,
        py: 0.6,
        borderRadius: "999px",
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.25)}`,
      }}
    >
      {dot && (
        <Box sx={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              bgcolor: color,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              bgcolor: color,
              animation: "eskomPing 1.8s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        </Box>
      )}
      <Typography
        variant="caption"
        sx={{ fontWeight: 800, color, letterSpacing: "0.02em", lineHeight: 1 }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export default StatusPill;
