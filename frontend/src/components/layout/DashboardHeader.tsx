import { useState } from "react";

import {
  AutorenewRounded,
  RefreshRounded,
  CloudQueueRounded,
  LightModeRounded,
  DarkModeRounded,
} from "@mui/icons-material";

import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { useQueryClient } from "@tanstack/react-query";

import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useThemeMode } from "../../theme/ThemeModeContext";
import { formatTime } from "../../utils/format";
import StatusPill from "../common/StatusPill";

/**
 * DASHBOARD HEADER — renders above BOTH routed pages.
 *
 * Element-by-element data sources:
 *  - Page title + subtitle      [DATA: STATIC-UI] fixed strings per route
 *                               (see pageTitles in DashboardLayout).
 *  - "System Online" pill       [DATA: MOCK ⚠️] ALWAYS green — it is a
 *                              hardcoded label, NOT a /healthz check. Do
 *                              not read it as real API connectivity.
 *  - "Updated HH:MM" readout    [DATA: USER-STATE] client-side timestamp
 *                              of the last react-query refetch — not a
 *                              backend "forecast generated at" time.
 *  - Auto-refresh toggle        [DATA: USER-STATE] refetches all queries
 *                              every 5 min while on.
 *  - Refresh-now button         [DATA: USER-STATE] queryClient.refetchQueries.
 *  - Light/dark mode toggle     [DATA: USER-STATE] local theme preference.
 */
interface DashboardHeaderProps {
  title: string;
  subtitle: string;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes background refresh

const DashboardHeader = ({ title, subtitle }: DashboardHeaderProps) => {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { mode, toggleMode } = useThemeMode();

  const refetchAll = async () => {
    await queryClient.refetchQueries();
  };

  const { lastUpdated, isRefreshing, refreshNow } = useAutoRefresh(
    autoRefresh,
    refetchAll,
    AUTO_REFRESH_MS
  );

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(11,22,38,0.82)" : "rgba(255,255,255,0.75)"),
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 1100,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ maxWidth: 1600, mx: "auto", width: "100%" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" fontWeight={800} color="text.primary" sx={{ lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            {subtitle}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0, flexWrap: "wrap" }}>
          {/* Light / dark mode toggle (NEW) */}
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              onClick={toggleMode}
              sx={{ border: 1, borderColor: "divider", borderRadius: 2, color: "text.secondary" }}
            >
              {mode === "dark" ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>

          <StatusPill label="System Online" tone="success" />

          <Tooltip title="Last refreshed">
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary" }}>
              <CloudQueueRounded sx={{ fontSize: 18 }} />
              <Typography variant="caption" fontWeight={600}>
                Updated {formatTime(lastUpdated)}
              </Typography>
            </Stack>
          </Tooltip>

          <Tooltip title={autoRefresh ? "Auto-refresh on (every 5 min)" : "Auto-refresh off"}>
            <IconButton
              onClick={() => setAutoRefresh((v) => !v)}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: autoRefresh ? "rgba(24,144,215,0.12)" : "transparent",
                color: autoRefresh ? "primary.main" : "text.secondary",
              }}
            >
              <AutorenewRounded
                sx={{
                  animation: autoRefresh ? "eskomSpin 4s linear infinite" : undefined,
                }}
              />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh now">
            <span>
              <IconButton
                onClick={() => void refreshNow()}
                disabled={isRefreshing}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  color: "primary.main",
                }}
              >
                <RefreshRounded
                  className={isRefreshing ? "eskom-spin" : undefined}
                />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};

export default DashboardHeader;
