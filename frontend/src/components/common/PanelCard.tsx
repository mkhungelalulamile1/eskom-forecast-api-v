import React from "react";
import {
  Box,
  Card,
  CardProps,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * =====================================================
 * PANEL CARD
 * =====================================================
 * NEW (added in redesign): the unified visual container for the
 * dashboard. Every redesigned panel uses this so the whole UI
 * shares one consistent, modern card language:
 *
 *  - a thin Eskom-blue accent bar along the top
 *  - an optional icon chip in the header
 *  - consistent radii, border and hover elevation
 *
 * Accepts `loading` to show a centred spinner overlay and
 * `height` to give charts a stable bounding box.
 */
export interface PanelCardProps extends Omit<CardProps, "title"> {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
  loading?: boolean;
  height?: number | string;
  children: React.ReactNode;
}

const PanelCard = ({
  title,
  subtitle,
  icon,
  accent,
  action,
  loading,
  height,
  children,
  sx,
  ...props
}: PanelCardProps) => {
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.primary.main;

  return (
    <Card
      elevation={0}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: "12px !important",
        border: "1px solid",
        borderColor: (t) =>
          t.palette.mode === "dark"
            ? "rgba(255,255,255,0.55)"
            : t.palette.divider,
        bgcolor: (t) =>
          t.palette.mode === "dark"
            ? "transparent"
            : t.palette.background.paper,
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.4)"
            : "0 10px 30px rgba(16,32,62,0.06)",
        overflow: "hidden !important",
        transition: "box-shadow .25s ease, transform .25s ease",
        height: height ?? "auto",
        "&:hover": {
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 16px 40px rgba(0,0,0,0.5)"
              : "0 16px 40px rgba(16,32,62,0.10)",
        },
        ...sx,
      }}
      {...props}
    >
      {/* Eskom accent bar */}
      <Box
        sx={{
          height: 5,
          width: "100%",
          flexShrink: 0,
          background: `linear-gradient(90deg, ${accentColor}, ${alpha(
            accentColor,
            0.35
          )})`,
        }}
      />

      {/* Header */}
      {(title || action) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{
            px: { xs: 2, sm: 2.5 },
            pt: 2.25,
            pb: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            {icon && (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: (t) =>
                    alpha(
                      accentColor,
                      t.palette.mode === "dark" ? 0.2 : 0.1
                    ),
                  color: accentColor,
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              {title && (
                <Typography variant="h6" fontWeight={800} color="text.primary" sx={{ lineHeight: 1.2 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>

          {action && (
            <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              {action}
            </Box>
          )}
        </Stack>
      )}

      {/* Body */}
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.25, flex: 1, minWidth: 0, maxWidth: "100%", position: "relative", overflow: "hidden" }}>
        {children}

        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(11,22,38,0.72)"
                  : "rgba(255,255,255,0.72)",
              backdropFilter: "blur(2px)",
              borderRadius: "10px",
              zIndex: 2,
            }}
          >
            <CircularProgress size={34} thickness={4} />
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default PanelCard;
