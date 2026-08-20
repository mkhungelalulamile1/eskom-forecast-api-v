import { useMemo } from "react";

import {
  Box,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { FactoryRounded } from "@mui/icons-material";

import PanelCard from "../../../components/common/PanelCard";
import { formatCompact } from "../../../utils/format";

import { useForecastScenarioData } from "../hooks/useForecast";
import { useForecastContext } from "../../../contexts/ForecastContext";

/**
 * =====================================================
 * STATION FLEET OVERVIEW  (NEW FEATURE)
 * =====================================================
 * Added in the redesign: a single, at-a-glance comparison of
 * every power station's latest average Burn and Supply. Rows are
 * clickable and update the global station filter, making the whole
 * fleet navigable straight from the dashboard.
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
      subtitle={`All power stations · ${horizon === "monthly" ? "monthly" : "daily"} baseline average`}
      icon={<FactoryRounded />}
      height="100%"
    >
      {fleet.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          No fleet data available.
        </Typography>
      )}

      <Stack spacing={1.75}>
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
                onClick={() => setEntityId(row.id)}
                sx={{
                  cursor: "pointer",
                  borderRadius: 2,
                  p: 0.5,
                  transition: "background .15s ease",
                  "&:hover": { bgcolor: "rgba(0,84,166,0.06)" },
                }}
              >
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: active ? 800 : 600, color: active ? "primary.main" : "text.secondary" }}
                  >
                    {row.id}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    {formatCompact(val)} {horizon === "daily" ? "t/d" : "t"}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, pct)}
                  color={metric === "supply" ? "secondary" : "primary"}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: active ? "rgba(24,144,215,0.18)" : "#EDF1F8",
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
