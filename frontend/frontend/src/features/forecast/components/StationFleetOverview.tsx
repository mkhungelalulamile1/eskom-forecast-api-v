import { useMemo } from "react";

import {
  Box,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { alpha } from "@mui/material/styles";

import {
  CheckCircleRounded,
  FactoryRounded,
} from "@mui/icons-material";

import PanelCard from "../../../components/common/PanelCard";
import { formatCompact } from "../../../utils/format";

import { useForecastScenarioData } from "../hooks/useForecast";
import { useForecastContext } from "../../../contexts/ForecastContext";

/**
 * =====================================================
 * STATION FLEET OVERVIEW
 * =====================================================
 * A single, at-a-glance comparison of every power station's latest
 * average Burn and Supply.
 *
 * The list is the dashboard's power-station picker: every row is a
 * real button that sets the global station filter, and the selected
 * station is highlighted — tinted row, accent rail, bold label and a
 * check icon — so it is obvious which station the rest of the
 * dashboard is showing.
 */
const StationFleetOverview = () => {
  const { entityId, setEntityId, horizon, metric } = useForecastContext();
  const { data } = useForecastScenarioData();

  const fleet = useMemo(() => {
    const horizonKey = horizon === "monthly" ? "monthly" : "daily";
    const records = data?.[horizonKey] ?? [];
    const map = new Map<string, { burn: number[]; supply: number[] }>();

    for (const r of records) {
      if (!r.entity_id) continue;
      if (r.scenario_id !== "actual") continue; // baseline only
      const entry = map.get(r.entity_id) ?? { burn: [], supply: [] };
      entry.burn.push(Number(r.Input ?? 0));
      entry.supply.push(Number(r.Replenishment ?? 0));
      map.set(r.entity_id, entry);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const rows = Array.from(map.entries()).map(([id, { burn, supply }]) => ({
      id,
      burn: avg(burn),
      supply: avg(supply),
    }));

    // rank by the currently selected metric
    rows.sort((a, b) => (metric === "supply" ? b.supply - a.supply : b.burn - a.burn));
    return rows;
  }, [data, horizon, metric]);

  const maxValue = useMemo(
    () => Math.max(1, ...fleet.map((r) => (metric === "supply" ? r.supply : r.burn))),
    [fleet, metric]
  );

  return (
    <PanelCard
      title="Station Fleet"
      subtitle={`Select a power station · ${
        horizon === "monthly" ? "monthly" : "daily"
      } baseline average`}
      icon={<FactoryRounded />}
      height="100%"
    >
      {fleet.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          No fleet data available.
        </Typography>
      )}

      <Stack spacing={1}>
        {fleet.map((row) => {
          const val = metric === "supply" ? row.supply : row.burn;
          const pct = (val / maxValue) * 100;
          const active = row.id === entityId;

          return (
            <Tooltip
              key={row.id}
              title={`${row.id} — Burn ${formatCompact(row.burn)} | Supply ${formatCompact(row.supply)}`}
              placement="right"
            >
              <Box
                component="button"
                type="button"
                onClick={() => setEntityId(row.id)}
                aria-pressed={active}
                sx={{
                  /* reset the native button */
                  appearance: "none",
                  font: "inherit",
                  textAlign: "left",
                  width: "100%",
                  display: "block",

                  cursor: "pointer",
                  borderRadius: "10px",
                  px: 1.25,
                  py: 1,

                  position: "relative",

                  bgcolor: active
                    ? (t) =>
                        alpha(
                          t.palette.primary.main,
                          t.palette.mode === "dark" ? 0.22 : 0.09
                        )
                    : "transparent",

                  border: "1px solid",
                  borderColor: active
                    ? (t) =>
                        alpha(
                          t.palette.primary.main,
                          t.palette.mode === "dark" ? 0.75 : 0.45
                        )
                    : "transparent",

                  transition:
                    "background .16s ease, border-color .16s ease",

                  /* selection rail */
                  "&::before": active
                    ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: "12px",
                        bgcolor: "primary.main",
                      }
                    : undefined,

                  "&:hover": {
                    bgcolor: (t) =>
                      alpha(
                        t.palette.primary.main,
                        t.palette.mode === "dark" ? 0.14 : 0.06
                      ),
                  },

                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 0.5, gap: 1 }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
                    {active && (
                      <CheckCircleRounded
                        sx={{ fontSize: 14, color: "primary.main", flexShrink: 0 }}
                      />
                    )}

                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        fontWeight: active ? 800 : 600,
                        color: active ? "primary.main" : "text.secondary",
                      }}
                    >
                      {row.id}
                    </Typography>
                  </Stack>

                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: active ? "text.primary" : "text.secondary",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCompact(val)} {horizon === "daily" ? "t/d" : "t"}
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, pct)}
                  color={metric === "supply" ? "secondary" : "primary"}
                  sx={{
                    height: 6,
                    borderRadius: "12px",
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.14)"
                        : "#EDF1F8",
                  }}
                />
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </PanelCard>
  );
};

export default StationFleetOverview;
