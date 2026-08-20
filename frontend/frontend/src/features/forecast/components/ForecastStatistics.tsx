import { Box, Grid, Typography } from "@mui/material";

import {
  TimelineRounded,
  TrendingUpRounded,
  CalendarMonthRounded,
  WaterRounded,
} from "@mui/icons-material";

import { alpha } from "@mui/material/styles";

import AnimatedNumber from "../../../components/common/AnimatedNumber";
import MetricSparkline from "../../../components/common/MetricSparkline";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastChart,
  useForecastStatistics,
} from "../hooks/useForecast";

import { useForecastContext } from "../../../contexts/ForecastContext";

/**
 * =====================================================
 * FORECAST STATISTICS (REDESIGNED)
 * =====================================================
 * Redesigned KPI row: each card now uses the new PanelCard-like
 * visual language, includes an animated count-up and a tiny
 * sparkline of the metric trend over the horizon.
 */
const ForecastStatistics = () => {
  const { horizon, metric, entityId, scenario } = useForecastContext();

  const filters: ForecastFilters = { horizon, metric, entityId, scenario };

  const { data, isError } = useForecastStatistics(filters);
  const { data: chartData } = useForecastChart(filters);

  const records: ForecastRecord[] = chartData ?? [];
  const spark = records
    .map((r) =>
      metric === "stockpile"
        ? Number(r.Stockpile ?? 0)
        : metric === "supply"
          ? Number(r.Replenishment ?? 0)
          : Number(r.Input ?? 0)
    )
    .filter((v) => Number.isFinite(v));

  const fmt = (v: number): string =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v).replace(/,/g, " ");

  const metricLabel = metric === "burn" ? "coal burn" : metric === "supply" ? "coal supply" : "stockpile";
  const metricUnit = metric === "stockpile" ? "tonnes" : horizon === "daily" ? "t/day" : "tonnes";
  const horizonUnit = horizon === "daily" ? "Days" : "Months";

  const cards = [
    {
      title: "Average Forecast",
      value: data ? data.average : null,
      unit: metricUnit,
      subtitle: `Average predicted ${metricLabel}`,
      color: "#0054A6",
      icon: <TimelineRounded />,
    },
    {
      title: "Peak Forecast",
      value: data ? data.peak : null,
      unit: metricUnit,
      subtitle: `Highest projected ${metricLabel}`,
      color: "#E8A008",
      icon: <TrendingUpRounded />,
    },
    {
      title: "Projected Volume",
      value: data ? data.projectedVolume : null,
      unit: "tonnes",
      subtitle: "Forecast horizon total",
      color: "#1E9E6A",
      icon: <WaterRounded />,
    },
    {
      title: "Forecast Horizon",
      value: data ? data.horizon : null,
      unit: horizonUnit,
      subtitle: `Current ${entityId} planning period`,
      color: "#1890d7",
      icon: <CalendarMonthRounded />,
    },
  ];

  return (
    <Grid container spacing={2.5} className="eskom-stagger">
      {cards.map((card) => (
        <Grid item xs={12} sm={6} lg={3} key={card.title}>
          <StatCard
            title={card.title}
            value={card.value}
            unit={card.unit}
            subtitle={card.subtitle}
            color={card.color}
            icon={card.icon}
            spark={spark}
            format={fmt}
          />
        </Grid>
      ))}

      {isError && (
        <Grid item xs={12}>
          <StatCard
            title="Forecast Statistics"
            value={null}
            unit=""
            subtitle="Unable to load forecast data"
            color="#D64545"
            icon={<TimelineRounded />}
            spark={[]}
            format={fmt}
          />
        </Grid>
      )}
    </Grid>
  );
};

/**
 * Redesigned KPI stat card with animated number + sparkline.
 */
interface StatCardProps {
  title: string;
  value: number | null;
  unit: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
  spark: number[];
  format: (v: number) => string;
}

const StatCard = ({ title, value, unit, subtitle, color, icon, spark, format }: StatCardProps) => {
  return (
    <Grid
      container
      sx={{
        bgcolor: "background.paper",
        border: "1px solid #E4EAF3",
        borderRadius: 12,
        p: 2.25,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(16,32,62,0.05)",
        transition: "transform .22s ease, box-shadow .22s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 18px 44px rgba(16,32,62,0.10)",
        },
      }}
    >
      {/* accent glow */}
      <Box
        sx={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 110,
          height: 110,
          borderRadius: "50%",
          bgcolor: alpha(color, 0.08),
        }}
      />

      <Grid item xs={12} sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography
            sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", letterSpacing: 1.2, textTransform: "uppercase" }}
          >
            {title}
          </Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary", fontSize: 12 }}>
            {subtitle}
          </Typography>
        </Box>

        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(color, 0.1),
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Grid>

      <Grid item xs={12} sx={{ mt: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
          {value !== null && (
            <AnimatedNumber
              value={value}
              decimals={Math.abs(value) >= 100 ? 0 : 2}
            />
          )}
          {value === null && (
            <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: "text.primary" }}>—</Typography>
          )}
          {unit && (
            <Typography sx={{ color: "text.secondary", fontWeight: 600, fontSize: 13 }}>{unit}</Typography>
          )}
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <MetricSparkline data={spark} color={color} width={120} height={36} />
        </Box>
      </Grid>
    </Grid>
  );
};

export default ForecastStatistics;
