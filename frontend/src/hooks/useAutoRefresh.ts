import { useEffect, useRef, useState } from "react";

/**
 * =====================================================
 * GLOBAL AUTO-REFRESH HOOK
 * =====================================================
 * NEW (added in redesign): centralises the dashboard's
 * background refresh behaviour.
 *
 *  - `enabled` toggles a silent interval that re-fetches every
 *    active React Query through the provided `refetchAll` fn
 *    and stamps a new `lastUpdated` time.
 *  - `refreshNow()` gives the header refresh button a single,
 *    manual re-fetch path that always works even when auto is off.
 *
 * The "Auto Refresh … Updated 3:01 PM" text row from the old UI is
 * intentionally gone — refresh is now surfaced through the header
 * refresh control + a live "updated" indicator only.
 */
export function useAutoRefresh(
  enabled: boolean,
  refetchAll: () => Promise<void> | void,
  intervalMs = 5 * 60 * 1000
) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refetchAllRef = useRef(refetchAll);
  refetchAllRef.current = refetchAll;

  const refreshNow = async () => {
    setIsRefreshing(true);
    try {
      await refetchAllRef.current();
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(async () => {
      try {
        await refetchAllRef.current();
        setLastUpdated(new Date());
      } catch {
        /* keep the dashboard resilient on transient failures */
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return { lastUpdated, isRefreshing, refreshNow };
}
