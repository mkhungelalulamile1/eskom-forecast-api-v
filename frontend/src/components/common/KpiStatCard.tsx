import React from "react";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AnimatedNumber from "./AnimatedNumber";
import MetricSparkline from "./MetricSparkline";

/**
 * =====================================================
 * KPI STAT CARD
 * =====================================================
 *
 * ONE card component for every KPI row in the dashboard
 * (Forecast statistics AND model-performance metrics), so the two
 * pages line up pixel for pixel:
 *
 *  - identical padding, min-height and internal rhythm
 *  - the label/description block on the left
 *  - a 46px tinted icon tile pinned to the top-right corner
 *  - the value baseline sits at the same height on every card
 *  - an optional sparkline / status chip in the same slot
 *
 * The surface is never filled white: it uses the theme paper colour
 * in light mode and a transparent fill with a light hairline border
 * in dark mode, so values stay readable.
 */
export interface KpiStatCardProps {
  /** Small uppercase label, e.g. "AVERAGE RMSE". */
  title: string;

  /** One-line explanation under the title. */
  subtitle?: string;

  /** Numeric value — animated. Use `text` for pre-formatted values. */
  value?: number | null;

  /** Pre-formatted value (wins over `value`). */
  text?: string | null;

  /** Unit rendered next to the value. */
  unit?: string;

  /** Accent colour used for the icon tile and sparkline. */
  color: string;

  icon: React.ReactNode;

  /** Optional sparkline series. */
  spark?: number[];

  /** Optional status pill under the value. */
  statusLabel?: string;
  statusColor?: string;

  /** Decimals for the animated number. */
  decimals?: number;
}

const KpiStatCard = ({
  title,
  subtitle,
  value,
  text,
  unit,
  color,
  icon,
  spark,
  statusLabel,
  statusColor,
  decimals,
}: KpiStatCardProps) => {
  const hasValue =
    text != null || (value != null && Number.isFinite(value));

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 172,
        display: "flex",
        flexDirection: "column",

        p: 2.25,

        borderRadius: "12px",
        overflow: "hidden",

        bgcolor: (t) =>
          t.palette.mode === "dark" ? "transparent" : t.palette.background.paper,

        border: "1px solid",
        borderColor: (t) =>
          t.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : "#E4EAF3",

        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 10px 30px rgba(0,0,0,0.28)"
            : "0 10px 30px rgba(16,32,62,0.05)",

        transition: "transform .22s ease, box-shadow .22s ease",

        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 18px 44px rgba(0,0,0,0.38)"
              : "0 18px 44px rgba(16,32,62,0.10)",
        },
      }}
    >
      {/* HEADER — icon tile on the LEFT, label block beside it.
          Identical on the Forecast KPIs and the Model Performance
          KPIs so the two rows line up exactly. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            bgcolor: (t) =>
              alpha(color, t.palette.mode === "dark" ? 0.2 : 0.1),
            color,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0, pt: 0.25 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "text.secondary",
              lineHeight: 1.4,
            }}
          >
            {title}
          </Typography>

          {subtitle && (
            <Typography
              sx={{
                mt: 0.25,
                fontSize: 12,
                color: "text.secondary",
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>

      {/* VALUE — always pinned to the bottom of the card */}
      <Box sx={{ mt: "auto", pt: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
          {text != null ? (
            <Typography
              sx={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              {text}
            </Typography>
          ) : value != null && Number.isFinite(value) ? (
            <Typography
              component="span"
              sx={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              <AnimatedNumber
                value={value as number}
                decimals={
                  decimals ?? (Math.abs(value as number) >= 100 ? 0 : 2)
                }
              />
            </Typography>
          ) : (
            <Typography
              sx={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              —
            </Typography>
          )}

          {unit && hasValue && (
            <Typography
              sx={{ color: "text.secondary", fontWeight: 600, fontSize: 13 }}
            >
              {unit}
            </Typography>
          )}
        </Box>

        {/* Status pill and sparkline share one slot so every card in a
            row keeps the same height. */}
        {statusLabel ? (
          <Box
            sx={{
              mt: 1.5,
              /* same height as the sparkline slot, so every value in a
                 KPI row sits on exactly the same baseline */
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              px: 1.25,
              alignSelf: "flex-start",
              borderRadius: "999px",
              bgcolor: "transparent",
              border: "1px solid",
              borderColor: statusColor ?? color,
              color: statusColor ?? color,
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {statusLabel}
          </Box>
        ) : spark && spark.length > 0 ? (
          <Box sx={{ mt: 1.5 }}>
            <MetricSparkline data={spark} color={color} width={120} height={36} />
          </Box>
        ) : (
          <Box sx={{ mt: 1.5, height: 36 }} />
        )}
      </Box>
    </Box>
  );
};

export default KpiStatCard;
