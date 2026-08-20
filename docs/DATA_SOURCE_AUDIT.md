# Data Source Audit — Forecast & Model Performance (element by element)

**Date:** 20 August 2026
**Scope:** EVERY card, KPI, filter, chart, line, badge, list, table and text block on the two routed pages — **Forecast** (`/forecast`) and **Model Performance** (`/model-performance`) — plus every service, hook, API call and backend storage location behind them.
**Layout (updated after the repo restructure on `main`):** the app now lives at the repo root — React SPA in `frontend/src/`, FastAPI backend in `main.py` + `src/`, shared docs in `docs/`, pipeline data in `data/`, and the previously-missing `training/` package is now committed. All annotations in this PR sit at those root paths. (History note: this audit was produced when the app lived at `frontend/frontend/`; the restructure moved it to the root without changing the React sources — the annotated files are byte-for-byte main's files plus comments.)
**This document supersedes** `COMPLETE_ELEMENT_BY_ELEMENT_INVESTIGATION.md`, `DETAILED_COMPONENT_DATA_INVESTIGATION.md` and `HARDCODED_VS_DYNAMIC_DATA_INVESTIGATION.md` (deleted — they contained incorrect claims, e.g. that `GET /api/entities` exists and the Power Station dropdown is "100% DYNAMIC ✅").

---

## 0. Legend used in code comments and in this doc

| Tag | Meaning |
|---|---|
| `[DATA: DYNAMIC]` | Live value from a backend API call (or math computed client-side from that API response). Not mocked. |
| `[DATA: MOCK]` | Hardcoded demo value sitting in the source file. |
| `[DATA: MOCK+DYNAMIC]` | API data mixed with hardcoded demo defaults/fallbacks that can mask or break the dynamic path. |
| `[DATA: DYNAMIC — ENDPOINT MISSING]` | Code correctly calls a backend endpoint **that does not exist yet** → the feature silently degrades. |
| `[DATA: STATIC-UI]` | Fixed label/colour/unit/threshold — a UI constant, not data. Acceptable if the label is truthful. |
| `[DATA: USER-STATE]` | Client-side selection state (no fetch). |

**One nuance that runs through everything:** every endpoint is *dynamic*, but the backend falls back to **local parquet files** when Azure Storage env vars are absent (`src/ui.py read_parquet` (repo root)). In dev those parquets are generated from `generate_mock_data.py` (synthetic Bronze) — so locally you can be looking at *mock data flowing through the real pipeline*. The values in `data/gold/*` in this repo are exactly that (e.g. daily `Input ≈ 12.7` for Arnot). With `AZURE_STORAGE_ACCOUNT_URL` + real SQL ingest configured, the same endpoints serve production data.

---

## 1. Architecture — the full data path

```
React SPA (frontend/src)
  services  → forecast.service.ts / weather.service.ts / model-performance.service.ts
  hooks     → useForecast.ts / useWeather.ts / useModelPerformance.ts (react-query, 5–10 min cache)
  context   → ForecastContext.tsx (horizon / metric / entityId / scenario)
      ↓ axios GET /api/*   (CRA dev proxy → 127.0.0.1:8000; nginx /api reverse proxy in AKS)
FastAPI (main.py at repo root)
  src/ui.py read functions
      ↓ Azure Blob (prod)  OR  local parquet (dev fallback)
      gold/{daily,monthly}/predictions.parquet · scenario_predictions.parquet
      metrics/model_metrics.parquet · model_metrics_by_step.parquet · oot_history.parquet
      weather/weather_cache_<Station>.parquet (Open-Meteo)
```

Filtering is **client-side**: `/api/scenario-data` and `/api/forecast-metrics` return *everything* and the components filter by `entity_id` / `scenario_id` / `horizon` in the browser. There are no server-side query parameters.

### 1.1 Backend endpoints that exist (verified in `main.py`)

| Endpoint | Reads | Response shape (verified against the parquet files) |
|---|---|---|
| `GET /api/forecast-data` | `gold/{daily,monthly}/predictions.parquet` | `{daily:[…], monthly:[…]}`, record: `entity_id, event_date, horizon_step, Input, Replenishment` (+ `Stockpile` derived as cumsum(Repl−Input) in `ui.py`) |
| `GET /api/scenario-data` | `gold/{daily,monthly}/scenario_predictions.parquet` | same + `scenario_id` (`actual, weather_hot_dry, weather_hot_wet, weather_cold_dry, weather_cold_wet`) + `label` |
| `GET /api/forecast-metrics` | `metrics/model_metrics.parquet` | list of `{horizon: tactical\|tactical_oot\|strategic, target: Input\|Replenishment\|Stockpile\|Residual, entity_id, rmse, mae, smape, r2, nrmse, weighting}` — **no `mape` field** |
| `GET /api/forecast-metrics-by-step` | `metrics/model_metrics_by_step.parquet` | same + per `horizon_step` — **not called by the SPA** |
| `GET /api/oot-history` | `metrics/oot_history.parquet` | list of `{entity_id, event_date, Input_actual, Input_predicted, Replenishment_actual, Replenishment_predicted, Stockpile_actual, Stockpile_predicted, horizon, weighting}` |
| `GET /api/weather-data?entity_id=&start_date=&end_date=` | Open-Meteo cache per station | list of `{date, temp_max_c, temp_min_c, rainfall_mm, cloud_cover_pct, humidity_pct, wind_speed_kmh, weather_code, weather_label, uv_index, sunshine_seconds}` |
| `GET /api/inference-monitoring`, `/api/inference-monitoring/summary` | in-memory event list (`monitoring.py`) | resets on process restart (page not in the sidebar) |
| `GET /api/db-operations`, `GET /api/initialize-progress` | in-memory dicts | used by the legacy `index.html` dashboard |
| `POST /api/ingest-bronze-data` | Azure SQL → Bronze | real data pull (needs SQL env vars + credentials) |
| `POST /api/run-forecast`, `/api/refresh-weather-cache`, `/api/initialize` | pipeline actions | used by legacy dashboard / monitoring page |
| `GET /healthz` | — | liveness |

### 1.2 Endpoints the SPA calls that DO NOT exist

| Call | Caller | Consequence |
|---|---|---|
| `GET /api/entities` | `forecast.service.getEntities()` → `useForecastEntities()` → Forecast Context Bar (Power Station dropdown), Weather Intelligence (station tabs), StockpileTrajectory (station lookup) | **404** → station dropdown shows “No stations available”, no station tabs, and the station selection stays stuck on the mock default `"entity_1"` → **every forecast KPI/chart renders empty on first load** (see Finding F1). |

---

## 2. FORECAST PAGE — every element

### 1.9 App shell — visible on BOTH routed pages (`DashboardLayout` + `DashboardHeader` + `DashboardSidebar`)

| Element | Verdict | Notes |
|---|---|---|
| Page title “Coal Forecasting” / “Model Performance” + subtitle strip | **STATIC-UI** | fixed per-route strings in `DashboardLayout.pageTitles` |
| **“System Online” green pill** (header, right) | **MOCK ⚠️** | hardcoded label + tone — it is **not** connected to `/healthz` or any check. Always green even if every API call fails. |
| “Updated HH:MM” readout | **USER-STATE** | client-side timestamp of the last react-query refetch — not a backend “forecast generated at” time (that doesn’t exist, see F6) |
| Auto-refresh toggle (5 min) / Refresh-now button | **USER-STATE** | refetches all react-query caches; no direct API of its own |
| Light/dark mode toggle | USER-STATE | local preference |
| Sidebar logo, “Coal Stockpile / Forecasting Platform” | STATIC-UI | asset + fixed text |
| Sidebar nav items “Forecast” / “Model Performance” (+ descriptions) | STATIC-UI | fixed list in `routes/navigation.ts` (Inference Monitoring entry commented out) |
| Sidebar Settings / Help & Support / Sign out | STATIC-UI (dead) | commented-out code block |
| Login gate | **MOCK ⚠️** | `ProtectedRoute` hardcodes `isAuthenticated = true` — `/login` is never enforced. `LoginForm` performs an 800 ms **simulated** login and `console.log`s the username **and password**; `auth.service.login()` POSTs `/auth/login`, an endpoint the backend doesn't have (and unused by the form). |

### 2.0 Forecast Context Bar (sticky, `components/layout/ForecastContextBar.tsx`)

| Element | Verdict | Source of truth |
|---|---|---|
| Title “Forecast Context” / “Filters apply across the whole dashboard” | STATIC-UI | fixed text |
| **Horizon** dropdown — “Tactical (Daily)”, “Strategic (Monthly)” | **STATIC-UI + USER-STATE** (correct) | fixed 2 options; selection decides `daily`/`monthly` array of `/api/scenario-data`. No API for the options (none needed). |
| **Metric** dropdown — “Burn / Supply / Stockpile Predictions” | **STATIC-UI + USER-STATE** (correct) | fixed 3 options; maps to parquet columns `Input` / `Replenishment` / `Stockpile`. |
| **Power Station** dropdown | **DYNAMIC — ENDPOINT MISSING** ⚠️ | options intended from `GET /api/entities` (route doesn't exist) → renders “No stations available”; nothing selectable. Station names DO exist in `/api/scenario-data` (18 stations: Arnot, Camden, Duvha, Grootvlei, Hendrina, Kendal, Komati, Kriel, Kriel OC, Kriel UG, Kusile, Kusile_Limestone, Lethabo, Majuba, Matimba, Matla, Medupi, Tutuka) — the backend just never exposes them as a list. |
| **Scenario** dropdown — Baseline / Hot & Dry / Hot & Wet / Cold & Dry / Cold & Wet | **STATIC-UI + USER-STATE** (correct) | fixed 5 options; translated 1:1 to backend `scenario_id`s (`actual`, `weather_hot_dry`, …) which are verified present in the parquet. Note the first option is labelled “Baseline” in the bar but “Actual” in the Scenario Comparison card — same `scenario_id` (`actual` = the un-adjusted baseline run, **not** observed actuals; observed values only exist in `/api/oot-history`). |
| **Export CSV** button | **DYNAMIC** | `ExportForecast` serialises the currently filtered `/api/scenario-data` records (Entity, Date, Step, Burn, Supply, Stockpile). Disabled when filter matches nothing. |
| **Reset** button | STATIC-UI | restores hardcoded defaults `daily/burn/actual` + first station (currently a no-op for station because the entity list is empty). |
| Compact/scroll behaviour | STATIC-UI | pure CSS state machine. |

**Default filter state (`contexts/ForecastContext.tsx`): `horizon=daily, metric=burn, scenario=actual, entityId="entity_1"` — `entity_1` is `[DATA: MOCK]`, a leftover that matches no real station, so on first page load (before a station is picked) every dynamic element below shows 0/empty.** Components affected: all of section 2.1–2.7 and the whole Model Performance page.

### 2.1 KPI row — Forecast Statistics (`ForecastStatistics.tsx`) → all four cards from ONE dynamic source

Service chain: `useForecastStatistics` + `useForecastChart` → `forecast.service.getStatistics()/getForecastChart()` → **`GET /api/scenario-data`** → filter `scenario_id` + `entity_id` (+ horizon array) → stats computed **client-side** (no dedicated stats endpoint).

| Card | Verdict | How the number is produced |
|---|---|---|
| **Average Forecast** (+ “Average predicted coal burn/supply/stockpile” subtitle) | **DYNAMIC** | mean of the selected metric column over the filtered records |
| **Peak Forecast** | **DYNAMIC** | `Math.max` of the same values |
| **Projected Volume** (“Forecast horizon total”) | **DYNAMIC** | sum of the same values |
| **Forecast Horizon** (“Current {station} planning period”, unit Days/Months) | **DYNAMIC** | `records.length` (count of periods in the response) |
| Card icons / colours / unit labels (`t/day` vs `tonnes`) | STATIC-UI | fixed constants; unit switches on horizon |
| Sparkline under each value | DYNAMIC | same records’ series for the selected metric |
| Loading / error / “—” states | DYNAMIC | react-query states; zero-values when the filter matches nothing (the `entity_1` trap) |

### 2.2 Forecast Trend Chart (`ForecastTrendChart.tsx`)

Source: `useForecastChart(filters)` → **`GET /api/scenario-data`** (`Input` = burn line, `Replenishment` = supply line). Chart-type toggle (line/area/bar) is USER-STATE.

| Element | Verdict | Notes |
|---|---|---|
| Title “{Tactical Daily / Strategic Monthly} Burn Forecast” | MOCK+DYNAMIC (label template + user state) | word “Burn” is fixed even when Metric = Supply/Stockpile (title no longer matches the metric — cosmetic bug) |
| Subtitle “Projected coal burn and supply across the selected forecast horizon.” | STATIC-UI | fixed sentence |
| Badge “{n} Days / Months” | **DYNAMIC** | `chartData.length` |
| Badge “Forecast Generated” | **STATIC-UI ⚠️** | fixed label; **no generation timestamp is fetched** — looks like data but isn’t. Need `generated_at` from backend (Finding F6). |
| **Average Burn** (KPI strip) | **DYNAMIC** | mean of `Input` |
| **Peak Burn** (KPI strip) | **DYNAMIC** | max of `Input` |
| **Horizon Trend** (KPI strip, % up/down) | **DYNAMIC** | % change first→last burn value |
| **Periods** (KPI strip) | **DYNAMIC** | record count |
| Chart lines “Burn” (blue) & “Supply” (green), area/bar variants | **DYNAMIC** | `Input` / `Replenishment` |
| Dashed reference line “Average …” | **DYNAMIC** | computed mean |
| Tooltip values + dates | DYNAMIC | from the series |
| Footer “Lowest Projected” | **DYNAMIC** | min burn |
| Footer “Avg Supply” | **DYNAMIC** | mean replenishment |
| Footer “Peak” + date | **DYNAMIC** | max burn + its date |
| “t/day” units in tooltip/footer | STATIC-UI ⚠️ | hardcoded even in monthly view where values are tonnes/month (cosmetic bug) |

### 2.3 Scenario Comparison (`ScenarioComparison.tsx`)

Source: ONE query → **`GET /api/scenario-data`**, split client-side: baseline = records with `scenario_id === "actual"`, scenario = records with the selected `scenario_id`; both filtered to station + horizon.

| Element | Verdict | Notes |
|---|---|---|
| Title “Scenario Comparison” | STATIC-UI | |
| Subtitle “Baseline vs {Selected Scenario}” | MOCK+DYNAMIC | scenario name from user state via fixed label map |
| “{n}” periods badge | **DYNAMIC** | joined-record count |
| Empty-state card “No forecast data available…” / narrative “Comparing baseline {metric} against {scenario} {metric}.” | STATIC-UI template + DYNAMIC values | |
| **Baseline Average** card | **DYNAMIC** | mean of the `actual` scenario records for the selected metric |
| **{Selected Scenario}** card (e.g. “Hot & Dry”) | **DYNAMIC** | mean of that scenario’s records |
| **Scenario Impact** card (± %) | **DYNAMIC** | (scenarioAvg − baselineAvg)/\|baselineAvg\|×100 |
| Chart “Baseline” dashed line + “{Scenario}” solid line | **DYNAMIC** | same two series |
| Tooltip “Baseline”/“{scenario}” + values | DYNAMIC | |
| Footer “Baseline Average” and “{Scenario} Average” | **DYNAMIC** | same averages |
| Scenario label/colour maps, card titles | STATIC-UI | fixed constants (labels match backend `label` column) |
| **“Actual” naming** ⚠️ | MOCK+DYNAMIC nuance | the `actual` scenario is the **un-adjusted baseline forecast**, not observed reality. True observed actuals are only in `/api/oot-history` (Model Performance). Worth renaming in UI to “Baseline” everywhere. |

### 2.4 Weather Intelligence (`WeatherIntelligence.tsx`)

Source: `useWeatherSummary` / `useWeatherOutlook` / `useWeatherSignals` → **`GET /api/weather-data?entity_id=…`** (backend: Open-Meteo per-station cache). View switch (Current / 7-Day / 30-Day) is USER-STATE; header text/colours STATIC-UI.

Enumerated per view — all values **DYNAMIC**:

| View | Elements (all `GET /api/weather-data`) |
|---|---|
| Current | station name in header; weather condition label + icon (from `weather_label`); temperature max/min; rainfall; cloud cover; humidity; wind speed; UV index; sunshine hours; observation date |
| 7-Day outlook | one card per forecast day: condition + icon, temp max/min, rainfall, wind |
| 30-Day signals | forecast-day count, average temperature, total rainfall, average wind, average UV, average humidity, rainy days, hot days |

| Also in this card | Verdict |
|---|---|
| Station tab strip / station-correction effect | **DYNAMIC — ENDPOINT MISSING** (uses `/api/entities`) — no tabs render |
| “Loading weather outlook…” / error / empty states | DYNAMIC (react-query states) |

### 2.5 Stockpile Trajectory (`StockpileTrajectory.tsx`)

Source: `useForecastChart` with `metric=stockpile` (same `/api/scenario-data`; `Stockpile` column) + a second query with `metric=burn` for the days-of-supply maths.

| Element | Verdict |
|---|---|
| Area chart of projected stockpile | **DYNAMIC** (`Stockpile` per date) |
| Title/subtitle + dynamic station label in the header | STATIC-UI template + DYNAMIC station name |
| Tonnes ⇄ Days-of-Supply toggle | USER-STATE; days = stockpile ÷ mean daily burn (**DYNAMIC**) |
| Alert chip “{n} projected periods below zero” | **DYNAMIC** count + STATIC-UI wording |
| “Days of Supply is calculated from…” info note | STATIC-UI |
| Min/Max markers, negative-period detection, “risk” chip wording | **DYNAMIC** values + STATIC-UI thresholds/wording |

### 2.6 Forecast Insights (`ForecastInsights.tsx`)

Source: same `/api/scenario-data` records via `useForecastChart`.

| Element | Verdict |
|---|---|
| **Peak Burn** card | **DYNAMIC** (max `Input`; unit label STATIC-UI) |
| **Peak vs Average** card (± %) | **DYNAMIC** |
| **Lowest Stockpile** card | **DYNAMIC** (min `Stockpile`) |
| **Stockpile Risk** card (count of negative periods + Low/Moderate/Elevated wording) | **DYNAMIC** count + STATIC-UI banding thresholds |
| Narrative paragraph (templated sentence with the station/horizon/numbers) | MOCK+DYNAMIC (template fixed, numbers dynamic) |
| Risk alert box | DYNAMIC trigger + STATIC-UI text |

### 2.7 Station Fleet Overview (`StationFleetOverview.tsx`) and Weather Correlation (`WeatherCorrelation.tsx`)

| Element | Verdict | Notes |
|---|---|---|
| “Station Fleet” panel — one row per station with avg Burn/Supply bar | **DYNAMIC (fully)** | rows grouped from `/api/scenario-data` `scenario_id="actual"`; **station names come from the data itself**, so this list works despite `/api/entities` missing. Click sets the global station filter. Ranking follows the selected metric (USER-STATE). |
| Weather Correlation table (Temperature/Rainfall/Wind/Humidity/UV/Sunshine vs Burn/Supply) | **DYNAMIC** | Pearson r computed client-side by joining `/api/scenario-data` and `/api/weather-data` on date. Each cell also shows a **Strong / Moderate / Weak** classification — dynamic r with STATIC-UI cut-offs. Variable labels STATIC-UI. |

### 2.8 Orphan forecast components (present in code, NOT rendered anywhere)

| File | Verdict |
|---|---|
| `ForecastFilterBar.tsx` | **MOCK** — hardcoded stations (Kendal, Matla, Tutuka, Lethabo) + fictional models (ARIMA/LSTM/XGBoost); unused; its old misleading “dynamic” comment has been corrected. |
| `ForecastTable.tsx`, `ForecastHistory.tsx` | **MOCK** — hardcoded demo arrays (own WARNING comments retained). |
| `ForecastChart.tsx`, `ForecastComparison.tsx`, `ForecastResults.tsx`, `ScenarioTrendChart.tsx`, `WeatherOutlook.tsx`, `WeatherSignals.tsx` | Unused; code paths are DYNAMIC but dead. |
| `WeatherSummary.tsx` (feature) + `components/dashboard/*` + `pages/dashboard/DashboardPage.tsx` | Only reachable from the **unrouted** Dashboard page; their data hooks are DYNAMIC. |

---

## 3. MODEL PERFORMANCE PAGE — every element

### 3.0 Page chrome (`ModelPerformancePage.tsx`)

| Element | Verdict |
|---|---|
| Forecast Context Bar (same 4 filters) | see §2.0 — station dropdown broken today |
| “Evaluation View” header + description | STATIC-UI |
| “Tactical Daily / Strategic Monthly” toggle | **USER-STATE** — writes the shared context horizon; drives every child’s horizon filter (`daily→"tactical"`, `monthly→"strategic"`) |

### 3.1 KPI cards (`ModelPerformanceKPIs.tsx`)

Source: `useModelMetrics()` → **`GET /api/forecast-metrics`**; client-side mean over records filtered by `entity_id` + horizon.

| Element | Verdict | Notes |
|---|---|---|
| **Average RMSE** (“Root mean squared error”) | **DYNAMIC** | mean of `rmse` |
| **Average MAE** (“Mean absolute error”) | **DYNAMIC** | mean of `mae` |
| **Average NRMSE** (“Normalised model error”, %) | **DYNAMIC** | mean of `nrmse` |
| NRMSE status chip **Strong / Review / Attention / No data** | DYNAMIC value + **STATIC-UI thresholds** (≤25 / ≤50) | thresholds are policy, not data |
| **Average R²** (“Explained variance”, 3 dp) | **DYNAMIC** | mean of `r2` |
| Hidden SMAPE block | DYNAMIC | computed but not displayed (kept for a future secondary row) |
| Loading skeletons / “Unable to load model performance metrics.” / “—” fallbacks | DYNAMIC | react-query states |

⚠️ **Filter caveats (both are filter-state issues, not data issues):**
1. With the mock default station `entity_1` (or “all”), **no record matches** → all four cards show “—”/“No data” although the API call succeeded.
2. The committed `model_metrics.parquet` only contains `horizon = tactical / tactical_oot` — **no `strategic` rows** — so the Strategic Monthly toggle also empties every card until monthly models are trained/scored (Finding F4).

### 3.2 OOT Performance Chart (`OotPerformanceChart.tsx`)

Source: `useOotHistory()` → **`GET /api/oot-history`**, filtered client-side by `entity_id` + horizon + metric (`Input`/`Replenishment`/`Stockpile`).

| Element | Verdict |
|---|---|
| Title/subtitle “Actual versus predicted … out-of-time sample” | STATIC-UI template |
| **Actual** line | **DYNAMIC** — `{metric}_actual` |
| **Predicted** line | **DYNAMIC** — `{metric}_predicted` |
| Tooltip (“Actual”/“Predicted” + date) | DYNAMIC |
| Legend colours, axis formats | STATIC-UI |
| Loading / error / “There are no OOT records …” empty state | DYNAMIC (and it IS what you get today for monthly — local file has `horizon="tactical"` only, Jan–Jun 2025) |

### 3.3 Cumulative Burn History (`CumulativeBurnHistory.tsx`)

Source: same **`GET /api/oot-history`**; running sums computed client-side per date for the selected metric; title/subtitle swap Burn/Supply/Stockpile (STATIC-UI labels).

| Element | Verdict |
|---|---|
| Title “{Burn/Supply/Stockpile} History — Actual vs Predicted” + subtitle | STATIC-UI template switching on the shared metric filter |
| Cumulative **Actual** line | **DYNAMIC** (cumsum of `{metric}_actual`) |
| Cumulative **Predicted** line | **DYNAMIC** (cumsum of `{metric}_predicted`) |
| Tooltip “Actual”/“Predicted” + values | DYNAMIC |
| Legend colours / axis formats | STATIC-UI |
| Empty/loading states | DYNAMIC |

### 3.4 Model Accuracy Matrix (`ModelAccuracyMatrix.tsx`)

Source: same **`GET /api/forecast-metrics`**, filtered by horizon + the three model targets; rows = one per `entity_id` found in the data (**stations themselves are DYNAMIC**).

| Element | Verdict |
|---|---|
| Station rows (18 in current data) | **DYNAMIC** |
| Columns Burn / Supply / Stockpile → `Input` / `Replenishment` / `Stockpile` | STATIC-UI header + DYNAMIC `nrmse` values per cell |
| Status chips (good/warning/poor) | DYNAMIC value + STATIC-UI thresholds |
| Legend “Good ≤ 25% / Review 25–50% / Attention > 50%” | STATIC-UI (same threshold constants) |
| “No data / error / loading” states | DYNAMIC |

Note: the `entityId` prop is accepted but unused — the matrix always shows the whole fleet (works even while the station dropdown is broken, as long as the horizon has data).

### 3.5 Unused Model-Performance components (mock, not rendered)

| File | Verdict |
|---|---|
| `AccuracyTrend.tsx` | **MOCK** — hardcoded Jan–Jun 96.8–98.8% series + “Improving” chip |
| `ModelComparison.tsx` | **MOCK** — fictional v2.2–v2.4 model list (“98.6%”, “85 t”…) |
| `ErrorAnalysis.tsx` | **MOCK** — hardcoded Week 1/2… errors |
| `ModelPerformanceStatistics.tsx` | **MOCK** — hardcoded “98.6% / +1.2%” stat cards |
| `PerformanceHistory.tsx` | **MOCK** — hardcoded history (has its own warning) |
| `PowerStationsPage.tsx` | **EMPTY placeholder** — static heading only |

None of these are imported by the routed page; all now carry explicit `[DATA: MOCK]` header comments.

### 3.6 Other routed-but-hidden screens (reachable by URL, not in the sidebar)

**`/login`** — see §1.9: simulated login, mock gate.

**`/inference`** — mostly MOCK:

| Component | Verdict |
|---|---|
| `ApiMetrics.tsx` | **MOCK** — hardcoded “12,540”, “99.2%”, … |
| `InferenceStatistics.tsx` | **MOCK** — hardcoded “Healthy”, “Running”, … |
| `PipelineStatus.tsx` | **MOCK** — hardcoded `pipeline` steps array |
| `ResourceLogs.tsx` | **MOCK** — hardcoded `logs` array |
| `ErrorMonitor.tsx` | **MOCK** — hardcoded `errors` array |
| `InferenceHistory.tsx` | **DYNAMIC** — live axios fetch |

**`/inference-monitoring`** — all DYNAMIC: every component is fed by `useInferenceMonitoring()` → `GET /api/inference-monitoring` + `GET /api/inference-monitoring/summary` (health chip, summary counters, latest run, latency chart, recent errors, resource health/activity, run list). Backend keeps these in an **in-memory list that resets on process restart**. `RunForecastButton` POSTs the real **`/api/run-forecast`** action.

**Unrouted dashboard** (`DashboardPage`/`DashboardContent` — dead screen): its panels (`ForecastSummary`, `ForecastTrend`, `RecentForecasts`, `WeatherSummary`, `StationStatus`, `DashboardKPIs`) fetch live data from `/api/scenario-data`, `/api/weather-data` and `/api/inference-monitoring/summary` — dynamic, but unreachable.

The legacy self-contained dashboard (`frontend/index.html`, the one the current Dockerfile actually ships) calls `/api/forecast-data`, `/api/scenario-data`, `/api/forecast-metrics`, `/api/oot-history`, `/api/weather-data`, `/api/initialize[-progress]` — all dynamic.

---

## 4. What is hardcoded vs dynamic — the short list

**Hardcoded MOCK (real findings, all in dead/unrouted code except F1/F2):**
- `DEFAULT_ENTITY_ID = "entity_1"` in `ForecastContext.tsx` — live bug (F1)
- `ForecastFilterBar.tsx` stations Kendal/Matla/Tutuka/Lethabo + ARIMA/LSTM/XGBoost — unused
- `AccuracyTrend`, `ModelComparison`, `ErrorAnalysis`, `ModelPerformanceStatistics`, `PerformanceHistory`, `ForecastTable`, `ForecastHistory` demo arrays — unused
- “Forecast Generated” badge text (no timestamp behind it) — rendered (F6)

**Correct and fully dynamic (once a valid station + horizon with data are selected):**
Average/Peak Forecast, Projected Volume, Forecast Horizon, Average/Peak Burn, Horizon Trend, Periods, Lowest Projected, Avg Supply, trend chart lines, Baseline Average, Scenario Average, Scenario Impact, scenario chart lines, stockpile trajectory + days of supply, all insight cards, station fleet rows, weather intelligence values, weather correlations, Export CSV, MP KPIs (RMSE/MAE/NRMSE/R²), OOT Actual/Predicted, cumulative actual/predicted, accuracy matrix rows/cells.

**Fixed UI constants (acceptable):** dropdown option labels, card titles/subtitles, colours, icons, units, NRMSE thresholds and risk banding, chart legends.

---

## 5. Findings (ranked)

| # | Finding | Impact |
|---|---|---|
| **F1** | `GET /api/entities` does not exist, and `DEFAULT_ENTITY_ID="entity_1"` matches no real station. | Power Station dropdown permanently shows “No stations available”; on first load every dynamic element on BOTH pages renders empty/zero/“—” until… actually there is currently **no way to select a station at all from the dropdown** (Station Fleet rows are the only working station switcher). Highest-priority fix. |
| **F2** | ~~Backend cannot boot from a fresh clone~~ **RESOLVED by the restructure on `main`:** the `training/` package (training.py, weather.py, scenario_definitions.py, additional_features.py) is now committed at the repo root. | Was: ImportError on fresh clone. |
| **F3** | Local metrics/oot parquets contain **no `strategic` rows** (`horizon` values: `tactical`, `tactical_oot`). | Model Performance “Strategic Monthly” view is empty for KPIs, OOT chart, cumulative chart and matrix — until monthly models are trained/scored into the metrics store. |
| **F4** | `/api/forecast-metrics` docstrings advertised MAPE; the data (and SPA) use SMAPE. | Docstring fixed in this pass; make sure no consumer expects `mape`. |
| **F5** | Scenario id `actual` = the baseline (un-adjusted) run; UI labels flip between “Baseline” and “Actual”. | Misleading naming; recommend standardising on “Baseline” in the Forecast page. |
| **F6** | “Forecast Generated” badge is static text; no `generated_at`/run metadata is exposed by the backend. | Users can’t tell how stale a forecast is. |
| **F7** | Trend-chart footer/tooltip units hardcoded `t/day` even in monthly (tonnes) view; trend-chart title says “Burn Forecast” regardless of selected metric. | Cosmetic. |
| **F8** | `/api/forecast-metrics-by-step` exists but nothing in the SPA calls it; `/api/entities` needed but missing; `/api/scenario-data` ships the full 8k+ row payload and filtering happens in the browser. | Fine at current scale; note for future server-side filtering. |
| **F9** | ~~Outer `frontend/` copy is stale/broken~~ **RESOLVED by the restructure on `main`:** the duplicate tree is gone; there is now a single app at the repo root (`frontend/` = SPA only, Python in `src/` + `main.py`). | Was: two diverging copies. |
| **F10** | `console.log` of filter debug output left in `forecast.service.ts`. | Noise in production console. |
| **F11** | Header “System Online” pill is a hardcoded green label — not wired to `/healthz` or any check. | Users see “System Online” even when every API call is failing. |
| **F12** | Auth is entirely mock: `ProtectedRoute` hardcodes `isAuthenticated = true`; `LoginForm` simulates login (800 ms) and `console.log`s username **and password**; `auth.service` POSTs `/auth/login` which the backend doesn't expose (and the form doesn't even call it). | No protection; credential logging is a security smell. |
| **F13** | Hidden `/inference` page is mostly mock (`ApiMetrics`, `InferenceStatistics`, `PipelineStatus`, `ResourceLogs`, `ErrorMonitor`); only `InferenceHistory` is live. | If this page is ever surfaced, five of six panels show fake data. |
| **F14** | “Updated HH:MM” in the header is the browser-side time of the last react-query refetch. | Can mislead users into thinking forecasts refreshed from source. |

---

## 6. What we need from engineers (action list)

**Backend (blocking correctness):**
1. **Add `GET /api/entities`** returning `[{id, label}]` derived from `gold/*/scenario_predictions.parquet` `entity_id`s (both horizons, deduped, sorted) — the SPA is already wired for exactly this shape. *Alternative:* SPA derives stations from `/api/scenario-data` itself (pattern already proven in `StationFleetOverview`).
2. ~~Commit the `training/` package~~ **Done** — it now lives at `training/` on `main`.
3. **Train/score monthly (strategic) models** so `model_metrics.parquet` and `oot_history.parquet` contain `horizon="strategic"` rows, or confirm monthly evaluation is out of scope and the UI should hide the Strategic toggle on Model Performance.
4. **Expose forecast run metadata** (`generated_at`, run id) — ideally a small `GET /api/forecast-meta` or a field inside `/api/scenario-data` — to make the “Forecast Generated” badge real.

**Frontend (quick wins, no backend needed):**
5. Replace `DEFAULT_ENTITY_ID = "entity_1"` with the first station from the data (or `"all"` + add an “All Stations” option — the service-side aggregation for `all` already exists but is currently unreachable from the UI).
6. Standardise the `actual` scenario label as “Baseline” across the context bar and Scenario Comparison.
7. Fix monthly units (`tonnes` not `t/day`) and the metric-aware trend-chart title.
8. Remove the `console.log` in `forecast.service.ts`; delete or clearly fence the orphan/mock components listed in §2.8/§3.5 (and the mock `/inference` panels in §3.6).
9. ~~Decide the fate of the outer `frontend/` copy~~ **Done** — removed by the restructure; single tree now.
10. Wire the “System Online” pill to `GET /healthz` (it exists and is cheap) and make “Updated HH:MM” show the backend’s data/forecast timestamp once F6-item 4 lands — or relabel it “Last page refresh”.
11. Either implement real auth (backend `/api/auth/login` + token in the existing axios interceptor + `ProtectedRoute` reading the Zustand store) or delete the login screen, the dead `/auth/login` service and the credential `console.log`.

---

## 7. Docs folder vs code — verification

| Doc claim | Code reality | Verdict |
|---|---|---|
| `README.md` / `ARCHITECTURE.md`: app is a single FastAPI entry point; dashboard served at `/` from `frontend/index.html`; `/api/*` reverse-proxied by nginx in AKS. | `main.py` mounts `StaticFiles(directory="frontend")` last; `nginx.conf` has `location /api/` proxy_pass + runtime resolver hook. | ✔ matches |
| `ARCHITECTURE.md`: dev runs a single Deployment per workload because the daily ingest+forecast job runs **in-process (APScheduler)**, not a CronJob. | `main.py` creates a `BackgroundScheduler` (`_scheduled_ingest_and_forecast`). | ✔ matches |
| `README.md`: without Azure env vars the app falls back to local disk and **generates mock Bronze data** on first use. | `src/app.py fetch_data_from_bronze_storage()` → `generate_mock_data.generate_mock_data()` fallback. This is the source of the “real pipeline, mock input” nuance in §0. | ✔ matches |
| `README.md`: `/api/forecast-data` etc. “require real Azure Storage … expect a 500 until env vars are set” — and `RUNBOOK.md` records that the dev AKS storage containers were created **empty**, so `/api/forecast-data` fails with `BlobNotFound`. | `ui.read_parquet()` prefers the Azure blob and raises rather than falling back when the blob is missing. So in dev-AKS the SPA’s data calls can legitimately 500 with **no data at all** — an environment state, not a frontend bug. | ✔ matches — worth knowing when validating the SPA against dev |
| `RUNBOOK.md`/pipelines: the frontend pipeline builds `frontend/Dockerfile`, which ships only the self-contained `index.html`. | The React SPA in `frontend/src` is **not built or deployed by any pipeline yet** — it is the in-development replacement. | ✔ matches (and explains the two-dashboard situation) |
| No repo doc mentions a station-list endpoint. | `/api/entities` doesn’t exist — the previous investigation docs’ claim that it does was wrong (fixed by this audit). | ✔ consistent |

**Data/platform:**
12. Confirm which environments point at real Azure SQL/Storage (`AZURE_STORAGE_ACCOUNT_URL`, `SQL_SERVER_HOSTNAME`, `SQL_DATABASE_NAME`) so the parquet fallback (mock Bronze) isn’t silently serving dev data in demos — consider a `data_source: "azure" | "local-mock"` field in API responses so the UI can badge mock data honestly.
