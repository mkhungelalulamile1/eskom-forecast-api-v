# What every number on the screen actually is

**Date:** 20 August 2026  
**Pages covered:** Forecast (`/forecast`) and Model Performance (`/model-performance`) — every filter, card, chart, badge, list, table, button and caption.  
**Audience:** planners, operators and engineers who need to know whether a number is real or demo.

This document answers one question for **every** thing you can see:

> Is this number coming from the live forecasting system, or is it hardcoded (fake / demo)?

---

## How to read this document

| Label on a row | What it means in plain English |
|---|---|
| **LIVE from backend** | The number is calculated from a real API call. It changes when the forecast files change. Not invented in the screen. |
| **HARDCODED (demo)** | A fake value sitting in the source code. It will never change until a developer edits it. |
| **MIXED (live + hardcoded)** | A live number is shown next to a fixed label, unit, colour or fallback that can mislead if you treat the whole thing as data. |
| **YOUR CHOICE** | You picked it (Horizon, Metric, Station, Scenario). It is not fetched. It *filters* the live data. |
| **LABEL ONLY** | Title, colour, icon, unit, or wording. Not a data value. Fine as long as the wording is honest. |

**Important nuance (applies to almost every LIVE row):**

The screens always call real APIs. Those APIs read forecast files. In **production** those files come from Azure Storage after a real SQL ingest. On a **developer laptop** with no Azure settings, the same APIs read local files under `data/`. Those local files may have been produced from `generate_mock_data.py` (synthetic Bronze) running through the **real** pipeline. So locally you can be looking at *mock input flowing through the real pipeline* — not hardcoded numbers in the React screens.

There is currently **no badge on the screen** that says “this is demo data” vs “this is production data”. That is listed under “What we need from engineers”.

---

## Why you saw “Unable to load station information”

You were told stations are dynamic. That was the *intent*. It was **not** working, and that is why the Stockpile card showed:

> Unable to load station information.

**What was going wrong (now fixed in this change):**

1. The Power Station dropdown asked the backend for `GET /api/entities`.
2. That route **did not exist**, so the browser got a 404.
3. The dropdown showed “No stations available”.
4. The app still defaulted to a leftover demo id `entity_1`, which is **not** a real station name (real names look like Arnot, Kendal, Medupi).
5. Every live card then filtered to a station that does not exist → zeros, “—”, empty charts.
6. The Stockpile Trajectory card also showed “Unable to load station information” because the station-list call failed.

Stations **were never hardcoded** on the live pages. The list is supposed to come from the forecast files themselves. The missing API made a live feature look broken.

**What this change does:**

- Backend now exposes **`GET /api/entities`**: unique power-station names taken from the gold forecast files. If a station is added or removed in the pipeline, it appears or disappears here automatically.
- If that call is empty or fails, the screen **falls back** to the same station names already sitting inside `GET /api/scenario-data` (the Station Fleet panel already did this).
- The leftover demo default `entity_1` is gone. The dropdown snaps to the first real station as soon as the list arrives.

After this change, “Unable to load station information” only appears if **both** station APIs fail (for example Azure Storage is empty / unreachable). That is a real outage, not a missing route.

---

## One-page summary

| Area | Verdict |
|---|---|
| Horizon / Metric / Scenario dropdowns | **YOUR CHOICE** — fixed option lists, not fetched |
| Power Station dropdown | **LIVE from backend** (`GET /api/entities`, fallback `GET /api/scenario-data`) |
| Average Forecast, Peak Forecast, Projected Volume, Forecast Horizon | **LIVE** from `GET /api/scenario-data` |
| Average Burn, Peak Burn, Horizon Trend, Periods | **LIVE** from the same call |
| Baseline Average, Scenario Average, Scenario Impact | **LIVE** from the same call |
| Stockpile chart, Days of Supply, insights cards | **LIVE** from the same call |
| Weather tiles / outlook / correlation | **LIVE** from `GET /api/weather-data` (+ scenario-data for correlation) |
| Model Performance RMSE / MAE / NRMSE / R² | **LIVE** from `GET /api/forecast-metrics` |
| OOT Actual vs Predicted, cumulative history | **LIVE** from `GET /api/oot-history` |
| Accuracy matrix rows (all stations) | **LIVE** from `GET /api/forecast-metrics` |
| “Forecast Generated” badge | **LABEL ONLY** — no timestamp behind it |
| “System Online” pill (header code) | **HARDCODED** green — not a health check |
| Login / auth | **HARDCODED** — login is simulated |
| Unused leftover components (old tables, fake model lists) | **HARDCODED** — not shown on the two pages |

---

## Shared filters (top of BOTH pages)

These four filters sit in **Forecast Context** and apply to Forecast **and** Model Performance.

| What you see | Verdict | Where the data comes from | API / service | What we expose |
|---|---|---|---|---|
| Title “Forecast Context” / “Filters apply across the whole dashboard” | LABEL ONLY | Fixed text | none | none |
| **Horizon** — Tactical (Daily) / Strategic (Monthly) | YOUR CHOICE | Two fixed options. Daily uses the `daily` array; monthly uses `monthly`. | none for the options. Filters `GET /api/scenario-data` | User’s choice only |
| **Metric** — Burn / Supply / Stockpile Predictions | YOUR CHOICE | Three fixed options. Maps to columns `Input` / `Replenishment` / `Stockpile` in the forecast files. | none for the options | User’s choice only |
| **Power Station** | **LIVE from backend** | Unique station names in the gold forecast files. Not a hardcoded list. | **`GET /api/entities`** → `{id, label}[]`. Fallback: unique `entity_id` from **`GET /api/scenario-data`**. Service: `forecast.service.getEntities()` | Station id + display name |
| **Scenario** — Baseline / Hot & Dry / Hot & Wet / Cold & Dry / Cold & Wet | YOUR CHOICE | Five fixed labels, mapped 1:1 to backend ids `actual`, `weather_hot_dry`, `weather_hot_wet`, `weather_cold_dry`, `weather_cold_wet` (those ids **are** in the parquet). | none for the options. Filters `GET /api/scenario-data` | User’s choice only |
| **Export CSV** | LIVE | Writes the currently filtered forecast rows to a file | same `GET /api/scenario-data` records | Entity, Date, Step, Burn, Supply, Stockpile |
| **Reset** | LABEL ONLY | Puts Horizon/Metric/Scenario back to Daily / Burn / Baseline, and station back to the first live station | none | none |

**Naming watch-out:** the first scenario is labelled **Baseline** in this bar, but **Actual** in the Scenario Comparison card. In the files, `actual` means “the un-adjusted baseline forecast run”, **not** observed real burn. True observed actuals only appear on Model Performance (`/api/oot-history`).

---

## FORECAST PAGE — every element

### Header / page chrome

The Forecast page itself does not render the old “System Online” header; the layout is sidebar + this page. The header component still exists in code.

| What you see | Verdict | Source |
|---|---|---|
| Sidebar “Forecast” / “Model Performance” | LABEL ONLY | fixed nav |
| Page is titled via route config “Coal Forecasting” | LABEL ONLY | `DashboardLayout.pageTitles` |
| Light/dark toggle (if shown) | YOUR CHOICE | local preference |
| Login gate | **HARDCODED** | `ProtectedRoute` hardcodes `isAuthenticated = true`. Login form waits 800 ms and logs the password to the browser console. Backend has no `/auth/login`. |

### KPI row — Forecast Statistics

All four cards share **one** live source. The browser asks for `GET /api/scenario-data`, keeps only the rows for your Horizon + Station + Scenario, then does the maths itself. There is **no** separate “stats” API.

| Card | Verdict | How the number is made | API | Column |
|---|---|---|---|---|
| **Average Forecast** | LIVE | Mean of the selected metric | `GET /api/scenario-data` | `Input` (burn) / `Replenishment` (supply) / `Stockpile` |
| **Peak Forecast** | LIVE | Highest value in that same list | same | same |
| **Projected Volume** | LIVE | Sum of that same list (“forecast horizon total”) | same | same |
| **Forecast Horizon** | LIVE | Count of periods in that list (Days or Months) | same | row count |
| Sparkline under each value | LIVE | Same series | same | same |
| Titles, icons, colours, units (`t/day` vs `tonnes`) | LABEL ONLY | Fixed; unit switches with Horizon | none | none |

If the filter matches nothing, the cards show **0**. That is live-but-empty, not mock.

### Forecast Trend chart (Burn + Supply)

Same API, same filter.

| What you see | Verdict | How it is made |
|---|---|---|
| Title “Tactical Daily / Strategic Monthly **Burn** Forecast” | MIXED | Horizon word is your choice; the word “Burn” is fixed even if Metric = Supply/Stockpile |
| Subtitle about projected burn and supply | LABEL ONLY | fixed sentence |
| Badge “{n} Days / Months” | LIVE | number of points |
| Badge **“Forecast Generated”** | **LABEL ONLY** | Looks like a timestamp. There is **no** `generated_at` from the backend. |
| Line / Area / Bar toggle | YOUR CHOICE | view only |
| **Average Burn** | LIVE | mean of `Input` |
| **Peak Burn** | LIVE | max of `Input` |
| **Horizon Trend** | LIVE | % change from first to last burn value |
| **Periods** | LIVE | count of points |
| Blue **Burn** line / green **Supply** line | LIVE | `Input` / `Replenishment` |
| Dashed “Average …” reference line | LIVE | mean burn |
| Footer **Lowest Projected** | LIVE | min burn |
| Footer **Avg Supply** | LIVE | mean `Replenishment` |
| Footer **Peak** + date | LIVE | max burn and its date |
| Tooltip / footer unit `t/day` | MIXED | hardcoded `t/day` even in monthly view (should be tonnes) |

### Scenario Comparison

One call: `GET /api/scenario-data`. Split in the browser: **Baseline** = rows with `scenario_id = actual`; **Scenario** = rows with the weather scenario you picked.

| What you see | Verdict | How it is made |
|---|---|---|
| Title “Scenario Comparison” | LABEL ONLY | fixed |
| Subtitle “Baseline vs {Hot & Dry / …}” | MIXED | name from your Scenario choice via a fixed label map |
| Periods badge | LIVE | joined-record count |
| **Baseline Average** | LIVE | mean of baseline rows for the selected metric |
| **{Selected Scenario}** card (e.g. Hot & Dry) | LIVE | mean of that scenario’s rows |
| **Scenario Impact** (± %) | LIVE | (scenario − baseline) / |baseline| × 100 |
| Dashed Baseline line + solid Scenario line | LIVE | same two series |
| Footer Baseline Average / Scenario Average | LIVE | same averages |
| Colours / titles | LABEL ONLY | fixed maps |

### Weather Intelligence

| What you see | Verdict | API |
|---|---|---|
| Header “Conditions and outlook for **{station}**” | LIVE station name + LABEL title | station from context |
| Current / 7 Days / 30 Days buttons | YOUR CHOICE | none |
| Current: condition, high/low, rainfall, cloud, humidity, wind, UV, sunshine, date | **LIVE** | `GET /api/weather-data?entity_id=…` (Open-Meteo cache on the server) |
| 7-day cards: condition, temps, rain, wind | **LIVE** | same |
| 30-day signals: avg temp, total rain, avg wind, avg UV, forecast days, rainy days, hot days, avg humidity | **LIVE** | same, averaged in the browser |
| “No current weather data is available for this entity” | LIVE empty/error state | same |

Weather is **not** mocked in this card. If Open-Meteo / the cache is down, you get the empty/error wording — not fake weather.

### Stockpile Trajectory

| What you see | Verdict | How it is made |
|---|---|---|
| Title / helper text | LABEL ONLY | fixed |
| Station name under the title | LIVE | from the station list |
| **Unable to load station information.** | LIVE error | only if **both** station APIs fail (this was the 404 you saw; that 404 is fixed) |
| Area chart of projected stockpile | LIVE | `Stockpile` column of `GET /api/scenario-data` |
| Tonnes ⇄ Days of Supply toggle | YOUR CHOICE | Days = stockpile ÷ mean daily burn (`Input`) from the same API |
| “{n} projected periods below zero” chip | LIVE count + LABEL wording | count of negative points |
| Lowest / Highest projected | LIVE | min / max of the series |
| Stockpile risk “{n} below zero” | LIVE | same count |

### Forecast Insights

| Card / text | Verdict | How it is made |
|---|---|---|
| **Peak Burn** | LIVE | max `Input` |
| **Peak vs Average** (± %) | LIVE | (peak − average) / |average| × 100 |
| **Lowest Stockpile** | LIVE | min `Stockpile` |
| **Stockpile Risk** (count of negative periods) | LIVE count + LABEL banding | count of `Stockpile < 0` |
| Narrative paragraph | MIXED | fixed sentence with live numbers filled in |
| Green/orange operational alert box | MIXED | live trigger, fixed wording |

### Station Fleet

| What you see | Verdict | Source |
|---|---|---|
| One row per station with a Burn/Supply bar | **LIVE** | grouped from `GET /api/scenario-data` where `scenario_id = actual`. Station names come from the data itself. Clicking a row sets the global station. |

### Weather & Forecast Correlation

| What you see | Verdict | Source |
|---|---|---|
| Table: Temperature / Rainfall / Cloud / Humidity / Wind / UV / Sunshine vs Burn and Supply | **LIVE** | Pearson r in the browser, joining `GET /api/scenario-data` and `GET /api/weather-data` on date |
| Strong / Moderate / Weak under each cell | MIXED | live r, fixed cut-offs (0.7 / 0.4 / 0.2) |
| “{n} matched days” chip | LIVE | how many dates overlapped |

### Forecast components that exist in code but are **not on the page**

| File | Verdict | Note |
|---|---|---|
| `ForecastFilterBar.tsx` | **HARDCODED** | Kendal/Matla/Tutuka/Lethabo + ARIMA/LSTM/XGBoost. Unused. |
| `ForecastTable.tsx`, `ForecastHistory.tsx` | **HARDCODED** | demo arrays. Unused. |
| `ForecastChart.tsx`, `ForecastComparison.tsx`, `ForecastResults.tsx`, `ScenarioTrendChart.tsx`, `WeatherOutlook.tsx`, `WeatherSignals.tsx` | LIVE code paths but **dead** (not rendered) | |
| Unrouted Dashboard widgets | LIVE hooks, **not in the sidebar** | |

---

## MODEL PERFORMANCE PAGE — every element

Same Forecast Context bar as above (Horizon, Metric, Power Station, Scenario). Scenario does **not** change these charts — Model Performance is scored against the baseline run, not the weather what-ifs.

| What you see | Verdict | Source |
|---|---|---|
| “Evaluation View” title + description | LABEL ONLY | fixed |
| Tactical Daily / Strategic Monthly toggle | YOUR CHOICE (read-only copy of Horizon) | writes `daily → tactical`, `monthly → strategic` into every child |

### KPI cards

Source: **`GET /api/forecast-metrics`** (`metrics/model_metrics.parquet`). The browser averages the rows for the selected station + horizon.

| Card | Verdict | Field | Notes |
|---|---|---|---|
| **Average RMSE** | LIVE | mean of `rmse` | Root mean squared error |
| **Average MAE** | LIVE | mean of `mae` | Mean absolute error |
| **Average NRMSE** | LIVE | mean of `nrmse` | Shown as % |
| NRMSE chip Strong / Review / Attention / No data | MIXED | live value, **fixed** thresholds ≤25 / ≤50 | policy, not data |
| **Average R²** | LIVE | mean of `r2` | 3 decimal places |
| Hidden SMAPE | LIVE but not shown | `smape` | kept for a future row |
| “Unable to load model performance metrics.” | LIVE error | API failed | |
| “—” / “No data” | LIVE empty | filter matched no rows | |

**Horizon catch:** the committed local metrics file only has `horizon = tactical` / `tactical_oot`. There are **no `strategic` rows**. Switching Model Performance to Strategic Monthly therefore empties every card until monthly models are trained and scored. That is missing data, not mock data.

### OOT Performance chart (Actual vs Predicted)

Source: **`GET /api/oot-history`**.

| What you see | Verdict | Field |
|---|---|---|
| Title “{Input/Replenishment/Stockpile} History” | LABEL template + YOUR metric | |
| **Actual** line | LIVE | `{metric}_actual` — this **is** observed history |
| **Predicted** line | LIVE | `{metric}_predicted` |
| “{n} points” badge | LIVE | row count |
| “There are no OOT records …” | LIVE empty | local file is tactical only, so monthly is empty |

### Cumulative Burn / Supply / Stockpile History

Same `GET /api/oot-history`. The browser running-sums the same actual/predicted columns.

| What you see | Verdict |
|---|---|
| Title “{Burn/Supply/Stockpile} History — Actual vs Predicted” | LABEL template |
| Cumulative **Actual** line | LIVE (cumsum of `{metric}_actual`) |
| Cumulative **Predicted** line | LIVE (cumsum of `{metric}_predicted`) |

### Model Accuracy by Power Station (matrix)

Source: same **`GET /api/forecast-metrics`**. Always shows the **whole fleet** (the selected station is only highlighted).

| What you see | Verdict |
|---|---|
| Station rows | LIVE `entity_id`s |
| Burn / Supply / Stockpile column groups | LABEL headers mapping to `Input` / `Replenishment` / `Stockpile` |
| RMSE, MAE, SMAPE %, NRMSE % (R² instead of SMAPE for Stockpile) | LIVE fields on each cell |
| Green / amber / red dots | MIXED — live NRMSE, fixed ≤25 / ≤50 cut-offs |
| Legend “Good ≤ 25% / Review 25–50% / Attention > 50%” | LABEL ONLY |
| “How to read this table” note | LABEL ONLY |

### Model Performance components that are **not on the page** (all HARDCODED)

| File | What’s fake |
|---|---|
| `AccuracyTrend.tsx` | Jan–Jun 96.8–98.8% series + “Improving” |
| `ModelComparison.tsx` | fictional v2.2–v2.4 (“98.6%”, “85 t”) |
| `ErrorAnalysis.tsx` | Week 1/2… errors |
| `ModelPerformanceStatistics.tsx` | “98.6% / +1.2%” |
| `PerformanceHistory.tsx` | hardcoded history |
| `PowerStationsPage.tsx` | empty placeholder heading |

None of these are imported by the routed Model Performance page.

---

## APIs the two pages actually call

| API | Used by | Reads (prod → Azure blob; dev → local file) | Shape |
|---|---|---|---|
| `GET /api/entities` | Power Station dropdown, stockpile station label, weather station correction | gold `entity_id`s | `[{id, label}, ...]` |
| `GET /api/scenario-data` | Almost every Forecast card; station fallback | `gold/{daily,monthly}/scenario_predictions.parquet` | `{daily:[…], monthly:[…]}` with `entity_id, event_date, horizon_step, scenario_id, Input, Replenishment, Stockpile, label` |
| `GET /api/weather-data?entity_id=` | Weather Intelligence, Weather Correlation | Open-Meteo cache `data/weather/weather_cache_<Station>.parquet` | daily weather rows |
| `GET /api/forecast-metrics` | MP KPIs, accuracy matrix | `metrics/model_metrics.parquet` | `horizon, target, entity_id, rmse, mae, smape, r2, nrmse` — **no `mape` field** |
| `GET /api/oot-history` | OOT chart, cumulative history | `metrics/oot_history.parquet` | `{Input,Replenishment,Stockpile}_{actual,predicted}` per station/date |

**Exist but the SPA does not call them:** `GET /api/forecast-data`, `GET /api/forecast-metrics-by-step`.

**Filtering is in the browser.** Those GETs return the full file. Horizon / station / scenario are not query parameters.

---

## What is hardcoded vs live — short list

**Hardcoded on a live page (or in the shell):**

- “Forecast Generated” badge (no timestamp)
- Auth (`isAuthenticated = true`; simulated login; password `console.log`)
- “System Online” pill in `DashboardHeader` (not wired to `/healthz`; that header is not currently mounted on the two pages)
- Scenario/Horizon/Metric **option lists** (acceptable — they match backend ids)
- NRMSE / correlation / stockpile-risk **thresholds and colours**
- Monthly chart units still saying `t/day` in the trend card
- Trend-chart title always saying “Burn Forecast”

**Hardcoded but not shown** (dead files): old filter bar stations, fake ARIMA/LSTM models, fake accuracy-trend series, fake inference panels.

**Fully live once a real station + a horizon that has data are selected:**  
Average/Peak Forecast, Projected Volume, Forecast Horizon, Average/Peak Burn, Horizon Trend, Periods, Lowest Projected, Avg Supply, both chart lines, Baseline Average, Scenario Average, Scenario Impact, stockpile path, insights, fleet rows, weather values, correlations, Export CSV, RMSE/MAE/NRMSE/R², OOT Actual/Predicted, cumulative actual/predicted, accuracy matrix.

---

## What we still need from engineers

1. **Confirm Azure vs local in each environment.** If `AZURE_STORAGE_ACCOUNT_URL` is unset, or the gold/metrics containers are empty, the UI is either empty or serving laptop files. Please add a `data_source: "azure" | "local-mock"` field (or a small `GET /api/forecast-meta`) so the screen can badge “Demo data” honestly.
2. **Train/score monthly (strategic) models** into `model_metrics.parquet` and `oot_history.parquet` with `horizon = strategic`, **or** hide the Strategic toggle on Model Performance. Today that view is empty by design of the files, not the screens.
3. **Expose forecast run time** (`generated_at`, run id) so “Forecast Generated” becomes a real stamp. Until then, rename the badge or remove it.
4. **Standardise “Baseline” vs “Actual”.** File id `actual` = un-adjusted forecast. Observed actuals = OOT only. Pick one word and use it everywhere.
5. **Fix monthly units** on the trend chart (`tonnes`, not `t/day`) and make the title follow the Metric filter.
6. **Wire or delete auth.** Either a real `/api/auth/login` or remove the fake login screen and the password `console.log`.
7. **Wire “System Online” to `GET /healthz`** if that header is brought back, or delete the hardcoded green pill.
8. **Optional later:** server-side filter query params (`?entity_id=&horizon=`) so the browser does not download the full 8k+ row scenario payload. Fine at current scale.
9. **Delete or fence dead mock components** listed above so nobody re-enables them by accident.

---

## Docs folder vs the code (spot check)

| Claim in repo docs | Code reality | Match? |
|---|---|---|
| README: app entry is `main.py`; `/` serves `frontend/index.html`; `/api/*` in AKS is reverse-proxied | `main.py` mounts `StaticFiles(directory="frontend")`; `nginx.conf` proxies `/api/` | yes |
| README: without Azure env vars, local disk + mock Bronze on first use | `src/app.py` → `generate_mock_data.py` | yes |
| README previously said forecast GETs “require Azure and 500 otherwise” | `ui.read_parquet()` **does** fall back to local files when `APP_MODE=development` | README updated in this change to mention `/api/entities` and the local fallback |
| ARCHITECTURE: daily ingest+forecast is in-process APScheduler, not a CronJob | `BackgroundScheduler` in `main.py` | yes |
| RUNBOOK: dev AKS gold containers can be empty → SPA 500s | Azure-mode `read_parquet` raises if the blob is missing (no silent empty) | yes — environment, not a frontend bug |
| No older doc described `/api/entities` | Route is **new** in this change | now consistent |

---

## Finding log (ranked)

| # | Finding | Status |
|---|---|---|
| **F1** | `GET /api/entities` missing + default `entity_1` → “Unable to load station information” / empty KPIs | **FIXED** this change (route + scenario-data fallback + empty default that snaps to first live station) |
| **F3** | Local metrics/OOT have no `strategic` rows | Open — empty Strategic Monthly on Model Performance |
| **F5** | `actual` scenario labelled Baseline in one place and Actual in another | Open — wording |
| **F6** | “Forecast Generated” is static text | Open — needs `generated_at` |
| **F7** | Trend chart units `t/day` in monthly; title always “Burn” | Open — cosmetic |
| **F8** | `/api/forecast-metrics-by-step` unused; full payload filtered in the browser | Note |
| **F10** | `console.log` of filters in `forecast.service.ts` | **FIXED** (removed) |
| **F11** | “System Online” hardcoded | Open (and currently not mounted on these two pages) |
| **F12** | Auth is mock; password logged | Open |
| **F13** | Hidden `/inference` page is mostly mock | Open if that page is ever shown |
| **F14** | “Updated HH:MM” is last browser refresh, not forecast time | Open |

F2 (missing `training/` package) and F9 (duplicate frontend tree) were already resolved on `main` by the repo restructure.
