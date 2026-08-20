# Hard-Coded vs Dynamic Data Investigation Report

**Date:** August 19, 2026  
**Project:** Eskom Coal Forecast API v2  
**Purpose:** Document what data is hard-coded vs dynamically fetched from backend services

---

## Executive Summary

The Eskom Forecast application is **well-architected** with proper separation between frontend and backend. Most active components fetch data dynamically from backend APIs. Hard-coded values are limited to:
- **Unused/deprecated components** containing mock data
- **UI presentation elements** (colors, labels, status messages in headers)
- **Default configuration values** (initial context state)

### Key Finding: Power Stations are NOT Hard-Coded ✅

Power stations (entities) are **dynamically fetched** from the backend via `/api/entities`, which extracts them from actual forecast data. The system automatically reflects any stations present in the data without code changes.

---

## Backend API Endpoints

The application exposes the following REST API endpoints:

### Core Forecast Data APIs

| Endpoint | Method | Purpose | Data Source |
|----------|--------|---------|-------------|
| `/api/forecast-data` | GET | Returns prediction data for both daily and monthly horizons | `data/gold/daily/predictions.parquet` & `data/gold/monthly/predictions.parquet` |
| `/api/scenario-data` | GET | Returns what-if scenario predictions (actual, hot/dry, hot/wet, cold/dry, cold/wet) | `data/gold/daily/scenario_predictions.parquet` & `data/gold/monthly/scenario_predictions.parquet` |
| `/api/entities` | GET | **Returns power station list extracted from scenario data** | Dynamically extracted from scenario predictions |
| `/api/weather-data` | GET | Returns weather time series (temp, rainfall, cloud, humidity, wind, UV, sunshine) | `data/weather/weather_cache_{entity_id}.parquet` |

### Model Performance APIs

| Endpoint | Method | Purpose | Data Source |
|----------|--------|---------|-------------|
| `/api/forecast-metrics` | GET | Per-entity, per-dimension accuracy metrics (RMSE/MAE/MAPE/SMAPE) | `data/metrics/model_metrics.parquet` |
| `/api/forecast-metrics-by-step` | GET | Per-entity, per-horizon-step accuracy metrics (RMSE/MAE/SMAPE/R2/NRMSE) | `data/metrics/model_metrics_by_step.parquet` |
| `/api/oot-history` | GET | Out-of-time actual vs predicted history for stockpile trajectory | `data/metrics/oot_history.parquet` |

### Monitoring & Operations APIs

| Endpoint | Method | Purpose | Data Source |
|----------|--------|---------|-------------|
| `/api/inference-monitoring` | GET | Raw monitoring events stream | In-memory event log |
| `/api/inference-monitoring/summary` | GET | Dashboard-ready operational health summary | Derived from monitoring events |
| `/api/db-operations` | GET | Database operations log (queries, status, timing) | In-memory operations log |
| `/healthz` | GET | Health check endpoint | Application status |

### Pipeline Control APIs

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/initialize` | POST | Runs full pipeline: Bronze ingestion → Weather refresh → Model training → Model deployment → Daily/Monthly forecast | Accepts `weighting` parameter: "weighted" or "unweighted" |
| `/api/initialize-progress` | GET | Returns pipeline progress (running, percent, step) | Real-time progress tracking |
| `/api/run-forecast` | POST | Executes forecast for specific horizon | Accepts `horizon`: "daily" or "monthly" |
| `/api/ingest-bronze-data` | POST | Manually triggers Bronze ingestion from SQL database | Independent of forecast execution |
| `/api/refresh-weather-cache` | POST | Refreshes weather cache for all known power stations | Fetches from Open-Meteo API |

---

## Frontend Data Architecture

### Dynamic Data Flow (✅ Properly Connected)

The following components fetch data dynamically from backend APIs:

#### 1. **Power Stations / Entities** 
**Status:** ✅ **Fully Dynamic**

```typescript
// Hook: useForecastEntities()
// API: GET /api/entities
// Returns: ForecastEntity[] = { id: string, label: string }[]
```

**How it works:**
1. Backend reads scenario predictions parquet files
2. Extracts unique `entity_id` values from both daily and monthly horizons
3. Returns sorted list of entities
4. Frontend components use this list for:
   - Entity selector dropdown (ForecastContextBar)
   - Station fleet overview
   - Weather intelligence station selector
   - All forecast filtering

**Components using dynamic entities:**
- `ForecastContextBar.tsx` - Main entity selector
- `StationFleetOverview.tsx` - Fleet visualization
- `WeatherIntelligence.tsx` - Weather by station
- `ForecastInsights.tsx` - Station-specific insights

#### 2. **Forecast Chart Data**
**Status:** ✅ **Fully Dynamic**

```typescript
// Hook: useForecastChart(filters)
// API: GET /api/forecast-data or /api/scenario-data
// Returns: ForecastRecord[]
```

**Components:**
- `ForecastChart.tsx`
- `ForecastTrendChart.tsx`
- `ScenarioComparison.tsx`
- `StockpileTrajectory.tsx`

**Data includes:**
- `entity_id` - Power station identifier
- `event_date` - Forecast date
- `horizon_step` - Days/months ahead
- `scenario_id` - Scenario identifier (actual, weather_hot_dry, etc.)
- `Input` - Coal burn prediction
- `Replenishment` - Supply prediction
- `Stockpile` - Stockpile level

#### 3. **Forecast Statistics**
**Status:** ✅ **Fully Dynamic**

```typescript
// Hook: useForecastStatistics(filters)
// Derived from: GET /api/scenario-data
// Returns: { average, peak, projectedVolume, horizon }
```

**Component:** `ForecastStatistics.tsx`

**Calculations (client-side from backend data):**
- Average forecast across horizon
- Peak forecast value
- Total projected volume
- Horizon length (days/months)

#### 4. **Weather Data**
**Status:** ✅ **Fully Dynamic**

```typescript
// Hooks:
// - useWeatherData(entityId, startDate, endDate)
// - useWeatherSummary(entityId)
// - useWeatherOutlook(entityId, days)
// - useWeatherSignals(entityId, days)
// API: GET /api/weather-data?entity_id={id}&start_date={date}&end_date={date}
```

**Components:**
- `WeatherIntelligence.tsx`
- `WeatherSummary.tsx`
- `WeatherOutlook.tsx`
- `WeatherSignals.tsx`
- `WeatherCorrelation.tsx`

**Data includes:**
- Temperature (min/max)
- Rainfall (mm)
- Cloud cover (%)
- Humidity (%)
- Wind speed (km/h)
- UV index
- Sunshine duration (hours)

#### 5. **Scenario Comparison Data**
**Status:** ✅ **Fully Dynamic**

```typescript
// Hook: useForecastScenarioData()
// API: GET /api/scenario-data
// Returns: { daily: ForecastRecord[], monthly: ForecastRecord[] }
```

**Scenarios available:**
- `actual` - Baseline (actual weather)
- `weather_hot_dry` - Hot & Dry scenario
- `weather_hot_wet` - Hot & Wet scenario
- `weather_cold_dry` - Cold & Dry scenario
- `weather_cold_wet` - Cold & Wet scenario

---

## Hard-Coded Values

### 1. **Unused/Deprecated Components** ⚠️

These components contain mock data but are **NOT imported or used** anywhere:

#### `ForecastTable.tsx`
```typescript
// Status: UNUSED - Not imported anywhere
// Contains: 3 mock forecast records
const rows: ForecastResult[] = [
  {
    id: 1,
    date: "06 Aug 2026",
    prediction: 12540,
    actual: 12480,
    variance: 60,
    accuracy: 98.6,
    status: "Completed",
  },
  // ... 2 more records
];

// Hard-coded context string:
"Arnot • Burn Prediction • Tactical (90 Days) • Actual Baseline"
```

**Action Required:** Delete this component or connect to real API

#### `ForecastHistory.tsx`
```typescript
// Status: UNUSED - Not imported anywhere
// Contains: 4 mock forecast runs
const history: ForecastRun[] = [
  {
    id: 4812,
    station: "Kendal",      // ⚠️ Hard-coded station
    scenario: "Actual Baseline",
    metric: "Burn Prediction",
    horizon: "Tactical - 90 Days",
    accuracy: "98.6%",
    time: "09:42",
    status: "Completed",
  },
  // ... 3 more records with stations: Matimba, Medupi, Tutuka
];
```

**Action Required:** Delete or connect to `/api/inference-monitoring/summary`

#### `ForecastFilterBar.tsx`
```typescript
// Status: UNUSED - Not imported anywhere
// Contains: Hard-coded station dropdown options
<MenuItem value="Kendal">Kendal</MenuItem>
<MenuItem value="Matla">Matla</MenuItem>
<MenuItem value="Tutuka">Tutuka</MenuItem>
<MenuItem value="Lethabo">Lethabo</MenuItem>

// Hard-coded model options:
<MenuItem value="ARIMA">ARIMA</MenuItem>
<MenuItem value="LSTM">LSTM</MenuItem>
<MenuItem value="XGBoost">XGBoost</MenuItem>
```

**Action Required:** Delete or use `useForecastEntities()` hook

### 2. **UI Presentation Elements** (Active Components)

These are acceptable hard-coded values for UI styling/labels:

#### `ForecastHeader.tsx`
```typescript
// Status: ACTIVE - Used in ForecastPage
// Hard-coded status indicators:
<Chip color="success" label="Forecast Engine Online" />
<Chip label="Last Run • Today 09:42" />  // ⚠️ Should be dynamic
<Chip label="96.8% Accuracy" />          // ⚠️ Should be dynamic
```

**Recommendation:** Connect to `/api/inference-monitoring/summary` for real status

#### `ForecastStatistics.tsx`
```typescript
// Status: ACTIVE - Data is dynamic, but styling/labels are hard-coded
const cards = [
  {
    title: "Average Forecast",      // UI label
    color: "#0054A6",               // Theme color
    icon: <TimelineRounded />,
  },
  {
    title: "Peak Forecast",
    color: "#E8A008",
    icon: <TrendingUpRounded />,
  },
  {
    title: "Projected Volume",
    color: "#1E9E6A",
    icon: <WaterRounded />,
  },
  {
    title: "Forecast Horizon",
    color: "#1890d7",
    icon: <CalendarMonthRounded />,
  },
];
```

**Status:** ✅ Acceptable - These are presentation constants

#### `ScenarioComparison.tsx`
```typescript
// Scenario labels and colors (mapping constants)
const scenarioLabels: Record<string, string> = {
  actual: "Actual",
  weather_hot_dry: "Hot & Dry",
  weather_hot_wet: "Hot & Wet",
  weather_cold_dry: "Cold & Dry",
  weather_cold_wet: "Cold & Wet",
};

const scenarioColors: Record<string, string> = {
  actual: "#F57C00",
  weather_hot_dry: "#D32F2F",
  weather_hot_wet: "#9C27B0",
  weather_cold_dry: "#455A64",
  weather_cold_wet: "#2E7D32",
};
```

**Status:** ✅ Acceptable - Theme/presentation constants

### 3. **Default Configuration Values**

#### `ForecastContext.tsx`
```typescript
// Default initial state values
const DEFAULT_HORIZON: ForecastHorizon = "daily";
const DEFAULT_METRIC: ForecastMetric = "burn";
const DEFAULT_ENTITY_ID = "entity_1";  // ⚠️ Hard-coded default
const DEFAULT_SCENARIO: ForecastScenario = "actual";
```

**Recommendation:** Could fetch first entity from `/api/entities` instead of hard-coding `"entity_1"`

---

## Data Type Definitions

### Frontend TypeScript Types

```typescript
// Forecast Record (matches backend parquet schema)
interface ForecastRecord {
  entity_id: string;           // Power station ID
  event_date: string;          // ISO date string
  horizon_step: number;        // Days/months ahead
  scenario_id?: string;        // Scenario identifier
  Input?: number;              // Coal burn (tonnes/day or tonnes)
  Replenishment?: number;      // Supply (tonnes/day or tonnes)
  Stockpile?: number;          // Stockpile level (tonnes)
}

// Entity (power station)
interface ForecastEntity {
  id: string;      // entity_id from backend
  label: string;   // Display name (same as id)
}

// Forecast Filters
interface ForecastFilters {
  horizon: "daily" | "monthly";
  entityId: string;
  scenario: "actual" | "hotdry" | "hotwet" | "colddry" | "coldwet";
  metric: "burn" | "supply" | "stockpile";
}

// Statistics (client-side aggregation)
interface ForecastStatistics {
  average: number;
  peak: number;
  projectedVolume: number;
  horizon: number;
}
```

---

## Backend Data Sources

### Parquet Files (Gold Layer)

| File Path | Content | Frontend API |
|-----------|---------|--------------|
| `data/gold/daily/predictions.parquet` | Daily forecast predictions | `/api/forecast-data` |
| `data/gold/monthly/predictions.parquet` | Monthly forecast predictions | `/api/forecast-data` |
| `data/gold/daily/scenario_predictions.parquet` | Daily scenario predictions | `/api/scenario-data`, `/api/entities` |
| `data/gold/monthly/scenario_predictions.parquet` | Monthly scenario predictions | `/api/scenario-data`, `/api/entities` |
| `data/metrics/model_metrics.parquet` | Model accuracy metrics | `/api/forecast-metrics` |
| `data/metrics/model_metrics_by_step.parquet` | Per-horizon-step metrics | `/api/forecast-metrics-by-step` |
| `data/metrics/oot_history.parquet` | Out-of-time history | `/api/oot-history` |
| `data/weather/weather_cache_{entity_id}.parquet` | Weather time series per station | `/api/weather-data` |

### Bronze Layer (SQL Source)

| File Path | Source | Trigger |
|-----------|--------|---------|
| `data/bronze/daily/input_data.parquet` | SQL database | Scheduled (02:00 UTC) or `/api/ingest-bronze-data` |
| `data/bronze/monthly/input_data.parquet` | SQL database | Scheduled (02:00 UTC) or `/api/ingest-bronze-data` |

---

## Scenario Mapping

The application uses different scenario identifiers between frontend and backend:

### Frontend → Backend Mapping

```typescript
// ForecastScenario (frontend) → scenario_id (backend)
"actual"    → "actual"
"hotdry"    → "weather_hot_dry"
"hotwet"    → "weather_hot_wet"
"colddry"   → "weather_cold_dry"
"coldwet"   → "weather_cold_wet"
```

This mapping is handled automatically by `forecastService.getBackendScenarioId()`

---

## Recommendations

### High Priority

1. **Remove Unused Components** 🔥
   - Delete `ForecastTable.tsx` or connect to real API
   - Delete `ForecastHistory.tsx` or use `/api/inference-monitoring/summary`
   - Delete `ForecastFilterBar.tsx` (redundant with ForecastContextBar)

2. **Connect ForecastHeader to Real Data** 🔥
   - Replace hard-coded "Last Run • Today 09:42" with `/api/inference-monitoring/summary`
   - Replace hard-coded "96.8% Accuracy" with actual metrics from `/api/forecast-metrics`
   - Replace static "Forecast Engine Online" with real health status

3. **Dynamic Default Entity** ⚠️
   - Instead of `DEFAULT_ENTITY_ID = "entity_1"`, fetch first entity from `/api/entities`
   - Provides better UX if entity_1 doesn't exist

### Medium Priority

4. **Add Entity Display Names** 💡
   - Currently entity labels are same as IDs (e.g., "entity_1")
   - Consider mapping to friendly names (e.g., "Kendal Power Station")
   - Could be handled in backend or via configuration file

5. **Document Scenario Definitions** 📝
   - Document what each weather scenario represents
   - Add tooltip descriptions in UI

### Low Priority

6. **Consolidate Scenario Mappings** 🔧
   - Scenario label/color mappings appear in multiple components
   - Consider centralizing in a shared constants file

---

## Conclusion

### ✅ What's Working Well

1. **Power stations are fully dynamic** - No hard-coded station names in active components
2. **Forecast data is fully dynamic** - All charts/tables fetch from backend APIs
3. **Weather data is fully dynamic** - Real-time weather integration per station
4. **Proper API architecture** - Clean separation between frontend and backend
5. **Type safety** - Well-defined TypeScript interfaces matching backend schema

### ⚠️ What Needs Attention

1. **Remove 3 unused components** with mock data (ForecastTable, ForecastHistory, ForecastFilterBar)
2. **Connect ForecastHeader** to real monitoring/metrics APIs
3. **Fix default entity** to be dynamic instead of hard-coded "entity_1"

### 🎯 Overall Assessment

The application is **well-architected** with minimal hard-coding issues. The unused components with mock data appear to be development artifacts that were never deleted. The active components properly fetch data from backend services.

**Grade: A-** (would be A+ after removing unused components and connecting ForecastHeader)
