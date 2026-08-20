import { Box } from "@mui/material";

import {
  TimelineRounded,
  TrendingUpRounded,
  CalendarMonthRounded,
  Inventory2Rounded,
} from "@mui/icons-material";

import KpiStatCard from "../../../components/common/KpiStatCard";

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
 * FORECAST STATISTICS
 * =====================================================
 * The KPI row at the top of the Forecast page.
 *
 * It renders the shared `KpiStatCard` — the same component the
 * Model Performance KPIs use — so both pages have identical card
 * geometry: same padding, same 46px tinted icon tile in the top
 * right, same value baseline and the same sparkline slot.
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

  const metricLabel =
    metric === "burn"
      ? "coal burn"
      : metric === "supply"
        ? "coal supply"
        : "stockpile";

  const metricUnit =
    metric === "stockpile" ? "tonnes" : horizon === "daily" ? "t/day" : "tonnes";

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
      icon: <Inventory2Rounded />,
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

  /*
   * A CSS grid (not MUI <Grid container>) is used on purpose: the
   * MUI grid relies on negative margins, which made this row hang
   * ~20px past the rows underneath it. With CSS grid every row on
   * the page starts and ends on exactly the same edges.
   */
  return (
    <Box
      className="eskom-stagger"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        gap: 2.5,
        width: "100%",
      }}
    >
      {cards.map((card) => (
        <KpiStatCard
          key={card.title}
          title={card.title}
          value={card.value}
          unit={card.unit}
          subtitle={card.subtitle}
          color={card.color}
          icon={card.icon}
          spark={spark}
        />
      ))}

      {isError && (
        <Box sx={{ gridColumn: "1 / -1" }}>
          <KpiStatCard
            title="Forecast Statistics"
            text="—"
            subtitle="Unable to load forecast data"
            color="#D64545"
            icon={<TimelineRounded />}
          />
        </Box>
      )}
    </Box>
  );
};

export default ForecastStatistics;
