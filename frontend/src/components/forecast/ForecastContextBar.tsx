/**
 * =====================================================
 * FORECAST CONTEXT BAR (FORECAST-FOLDER RE-EXPORT)
 * =====================================================
 * Redesigned to remove the duplicated, static context bar that
 * previously lived here. The single source of truth now lives at
 * `components/layout/ForecastContextBar.tsx`; this shim simply
 * re-exports it so the Inference page keeps a stable import path.
 */
export { default } from "../layout/ForecastContextBar";
