# Detailed Component-Level Data Source Investigation

**Date:** August 19, 2026  
**Purpose:** Trace every UI element (filter, card, chart, text, list) to its data source with code evidence

---

## Investigation Methodology

For each UI element, this document traces:
1. **What it displays** (the UI element)
2. **Where the data comes from** (API endpoint or hard-coded)
3. **Code evidence** (exact code showing the data flow)
4. **Status** (✅ Dynamic | ⚠️ Hard-coded | ❌ Mock Data)

---

## 1. FORECAST CONTEXT BAR (Filter Controls)

**Component:** `ForecastContextBar.tsx`  
**Location:** Sticky header at top of ForecastPage

### 1.1 HORIZON Filter

**UI Element:** Dropdown with "Tactical (Daily)" / "Strategic (Monthly)"

**Data Source:** ✅ **Dynamic State** (User selection stored in ForecastContext)

**Code Evidence:**
```typescript
// ForecastContext.tsx
const DEFAULT_HORIZON: ForecastHorizon = "daily";  // Initial state
const [horizon, setHorizonState] = useState<ForecastHorizon>(DEFAULT_HORIZON);

// ForecastContextBar.tsx
<Select value={horizon} onChange={handleHorizonChange}>
  <MenuItem value="daily">Tactical (Daily)</MenuItem>
  <MenuItem value="monthly">Strategic (Monthly)</MenuItem>
</Select>
```

**Options:**
- `"daily"` - Hard-coded label "Tactical (Daily)" ✅ (UI constant)
- `"monthly"` - Hard-coded label "Strategic (Monthly)" ✅ (UI constant)

**Status:** ✅ Dynamic selection, hard-coded labels (acceptable for UI)

---

### 1.2 METRIC Filter

**UI Element:** Dropdown with "Burn Predictions" / "Supply Predictions" / "Stockpile Predictions"

**Data Source:** ✅ **Dynamic State** (User selection stored in ForecastContext)

**Code Evidence:**
```typescript
// ForecastContext.tsx
const DEFAULT_METRIC: ForecastMetric = "burn";  // Initial state
const [metric, setMetricState] = useState<ForecastMetric>(DEFAULT_METRIC);

// ForecastContextBar.tsx
<Select value={metric} onChange={handleMetricChange}>
  <MenuItem value="burn">Burn Predictions</MenuItem>
  <MenuItem value="supply">Supply Predictions</MenuItem>
  <MenuItem value="stockpile">Stockpile Predictions</MenuItem>
</Select>
```

**Options:**
- `"burn"` → "Burn Predictions" ✅ (UI constant)
- `"supply"` → "Supply Predictions" ✅ (UI constant)
- `"stockpile"` → "Stockpile Predictions" ✅ (UI constant)

**Status:** ✅ Dynamic selection, hard-coded labels (acceptable for UI)

---

### 1.3 POWER STATION Filter

**UI Element:** Dropdown with power station names

**Data Source:** ✅ **FULLY DYNAMIC** from Backend API

**API Call:**
```
GET /api/entities
Returns: ForecastEntity[] = [{ id: string, label: string }, ...]
```

**Backend Implementation:**
```python
# main.py
@app.get("/api/entities")
def entities():
    """Returns power station entities extracted from scenario data."""
    config = Config()
    data = get_scenario_predictions_json(config)
    
    # Collect unique entity_id values from both horizons
    entity_ids = set()
    for horizon in ["daily", "monthly"]:
        if horizon in data and isinstance(data[horizon], list):
            for record in data[horizon]:
                if "entity_id" in record and record["entity_id"]:
                    entity_ids.add(record["entity_id"])
    
    entities_list = [
        {"id": entity_id, "label": entity_id}
        for entity_id in sorted(entity_ids)
    ]
    return JSONResponse(entities_list, status_code=200)
```

**Data Flow:**
```
Parquet Files (scenario_predictions.parquet)
    ↓
Backend extracts unique entity_id values
    ↓
GET /api/entities
    ↓
useForecastEntities() hook
    ↓
forecastEntities array
    ↓
ForecastContextBar dropdown
```

**Frontend Code:**
```typescript
// ForecastContextBar.tsx
const { data, isLoading: entitiesLoading } = useForecastEntities();
const forecastEntities = useMemo<ForecastEntity[]>(() => data ?? [], [data]);

<Select value={entityId} onChange={handleEntityChange}>
  {entitiesLoading && <MenuItem disabled>Loading stations…</MenuItem>}
  {!entitiesLoading && forecastEntities.length === 0 && (
    <MenuItem disabled>No stations available</MenuItem>
  )}
  {forecastEntities.map((entity: ForecastEntity) => (
    <MenuItem key={entity.id} value={entity.id}>
      {entity.label}
    </MenuItem>
  ))}
</Select>
```

**Default Value:**
```typescript
// ForecastContext.tsx
const DEFAULT_ENTITY_ID = "entity_1";  // ⚠️ Hard-coded fallback

// But ForecastContextBar auto-corrects to first available entity:
useEffect(() => {
  if (forecastEntities.length === 0) return;
  
  const exists = forecastEntities.some((entity) => entity.id === entityId);
  
  if (!exists) {
    setEntityId(forecastEntities[0].id);  // Auto-select first entity
  }
}, [forecastEntities, entityId, setEntityId]);
```

**Status:** ✅ **FULLY DYNAMIC** - Power stations extracted from data, no hard-coded station names

**⚠️ Minor Issue:** Default fallback `"entity_1"` is hard-coded, but gets overridden by first available entity

---

### 1.4 SCENARIO Filter

**UI Element:** Dropdown with "Baseline" / "Hot & Dry" / "Hot & Wet" / "Cold & Dry" / "Cold & Wet"

**Data Source:** ✅ **Dynamic State** (User selection)

**Code Evidence:**
```typescript
// ForecastContext.tsx
const DEFAULT_SCENARIO: ForecastScenario = "actual";
const [scenario, setScenarioState] = useState<ForecastScenario>(DEFAULT_SCENARIO);

// ForecastContextBar.tsx
<Select value={scenario} onChange={handleScenarioChange}>
  <MenuItem value="actual">Baseline</MenuItem>
  <MenuItem value="hotdry">Hot &amp; Dry</MenuItem>
  <MenuItem value="hotwet">Hot &amp; Wet</MenuItem>
  <MenuItem value="colddry">Cold &amp; Dry</MenuItem>
  <MenuItem value="coldwet">Cold &amp; Wet</MenuItem>
</Select>
```

**Scenario Mapping (Frontend → Backend):**
```typescript
// forecast.service.ts
private getBackendScenarioId(scenario: ForecastScenario): string {
  switch (scenario) {
    case "actual":    return "actual";
    case "hotdry":    return "weather_hot_dry";
    case "hotwet":    return "weather_hot_wet";
    case "colddry":   return "weather_cold_dry";
    case "coldwet":   return "weather_cold_wet";
    default:          return "actual";
  }
}
```

**Backend Data Source:**
```
data/gold/daily/scenario_predictions.parquet
data/gold/monthly/scenario_predictions.parquet

Scenarios in data:
- actual
- weather_hot_dry
- weather_hot_wet
- weather_cold_dry
- weather_cold_wet
```

**Status:** ✅ Dynamic selection, hard-coded labels (acceptable), scenarios match backend data

---

## 2. FORECAST STATISTICS (KPI Cards)

**Component:** `ForecastStatistics.tsx`  
**Display:** 4 KPI cards in a row

### 2.1 AVERAGE FORECAST Card

**UI Elements:**
- Title: "AVERAGE FORECAST"
- Value: Animated number (e.g., "12,450.25")
- Unit: Dynamic ("t/day", "tonnes", or "Months"/"Days")
- Subtitle: "Average predicted coal burn" (dynamic based on metric)
- Icon: TimelineRounded
- Color: #0054A6
- Sparkline: Mini chart showing trend

**Data Source:** ✅ **FULLY DYNAMIC** - Calculated from API data

**API Call Chain:**
```
GET /api/scenario-data
    ↓
useForecastStatistics(filters)
    ↓
forecastService.getStatistics(filters)
    ↓
Client-side calculation
```

**Calculation Code:**
```typescript
// forecast.service.ts
async getStatistics(filters: ForecastFilters): Promise<ForecastStatistics> {
  const records = await this.getFilteredRecords(filters);
  
  if (records.length === 0) {
    return { average: 0, peak: 0, projectedVolume: 0, horizon: 0 };
  }
  
  const values = records.map((record) =>
    this.getMetricValue(record, filters.metric)
  );
  
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / values.length;  // ← AVERAGE CALCULATION
  
  return { average, peak: Math.max(...values), projectedVolume: total, horizon: records.length };
}

private getMetricValue(record: ForecastRecord, metric: string): number {
  switch (metric) {
    case "burn":      return Number(record.Input ?? 0);
    case "supply":    return Number(record.Replenishment ?? 0);
    case "stockpile": return Number(record.Stockpile ?? 0);
    default:          return Number(record.Input ?? 0);
  }
}
```

**Data Flow:**
```
data/gold/{horizon}/scenario_predictions.parquet
    ↓
Backend: GET /api/scenario-data
    ↓
Frontend: Filter by (horizon, entityId, scenario)
    ↓
Extract metric values (Input/Replenishment/Stockpile)
    ↓
Calculate: average = sum(values) / count(values)
    ↓
Display in card with animated number
```

**Dynamic Parts:**
- ✅ Value: Calculated from API data
- ✅ Unit: Changes based on horizon ("t/day" for daily, "tonnes" for monthly)
- ✅ Subtitle: Changes based on metric ("coal burn" / "coal supply" / "stockpile")
- ✅ Sparkline: Generated from same API data

**Hard-coded Parts:**
- Title: "Average Forecast" (UI constant) ✅
- Color: #0054A6 (theme constant) ✅
- Icon: TimelineRounded (UI constant) ✅

**Status:** ✅ **FULLY DYNAMIC DATA** with acceptable UI constants

---

### 2.2 PEAK FORECAST Card

**UI Elements:**
- Title: "PEAK FORECAST"
- Value: Animated number (e.g., "15,890")
- Unit: Dynamic ("t/day", "tonnes")
- Subtitle: "Highest projected coal burn" (dynamic)
- Icon: TrendingUpRounded
- Color: #E8A008
- Sparkline: Same as average card

**Data Source:** ✅ **FULLY DYNAMIC** - Calculated from API data

**Calculation Code:**
```typescript
// forecast.service.ts
const peak = Math.max(...values);  // ← PEAK CALCULATION
return { average, peak, projectedVolume: total, horizon: records.length };
```

**Data Flow:**
```
Same API data as Average Forecast
    ↓
Extract metric values
    ↓
Calculate: peak = max(values)
    ↓
Display in card
```

**Status:** ✅ **FULLY DYNAMIC DATA** with acceptable UI constants

---

### 2.3 PROJECTED VOLUME Card

**UI Elements:**
- Title: "PROJECTED VOLUME"
- Value: Animated number (e.g., "1,125,890")
- Unit: "tonnes" (always)
- Subtitle: "Forecast horizon total"
- Icon: WaterRounded
- Color: #1E9E6A
- Sparkline: Same as other cards

**Data Source:** ✅ **FULLY DYNAMIC** - Calculated from API data

**Calculation Code:**
```typescript
// forecast.service.ts
const total = values.reduce((sum, value) => sum + value, 0);
// ...
return { average, peak, projectedVolume: total, horizon: records.length };
```

**Data Flow:**
```
Same API data
    ↓
Extract metric values
    ↓
Calculate: total = sum(all values)
    ↓
Display in card
```

**Status:** ✅ **FULLY DYNAMIC DATA** with acceptable UI constants

---

### 2.4 FORECAST HORIZON Card

**UI Elements:**
- Title: "FORECAST HORIZON"
- Value: Animated number (e.g., "90" or "36")
- Unit: Dynamic ("Days" or "Months")
- Subtitle: "Current {entityId} planning period" (uses actual entity ID)
- Icon: CalendarMonthRounded
- Color: #1890d7
- Sparkline: Same as other cards

**Data Source:** ✅ **FULLY DYNAMIC** - Count of records from API

**Calculation Code:**
```typescript
// forecast.service.ts
return { average, peak, projectedVolume: total, horizon: records.length };
```

**Frontend Display Code:**
```typescript
// ForecastStatistics.tsx
const horizonUnit = horizon === "daily" ? "Days" : "Months";
const cards = [
  // ...
  {
    title: "Forecast Horizon",
    value: data ? data.horizon : null,  // ← Number of records
    unit: horizonUnit,  // ← "Days" or "Months"
    subtitle: `Current ${entityId} planning period`,  // ← Uses actual entityId
    color: "#1890d7",
    icon: <CalendarMonthRounded />,
  },
];
```

**Data Flow:**
```
Filtered API records
    ↓
Count: horizon = records.length
    ↓
Display count with dynamic unit
```

**Status:** ✅ **FULLY DYNAMIC DATA** - Even subtitle uses actual entityId from context

---

### 2.5 Sparkline Charts (All Cards)

**Data Source:** ✅ **FULLY DYNAMIC** from API

**Code Evidence:**
```typescript
// ForecastStatistics.tsx
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

// Passed to each StatCard
<StatCard
  // ...
  spark={spark}  // ← Array of values from API
/>
```

**API Call:**
```
GET /api/scenario-data → useForecastChart(filters) → Extract metric values → sparkline
```

**Status:** ✅ **FULLY DYNAMIC**

---

## 3. FORECAST TREND CHART

**Component:** `ForecastTrendChart.tsx`

**UI Elements:**
- Chart Title: "Forecast Trend" or "Scenario Trend"
- X-axis: Dates from API
- Y-axis: Values (burn/supply/stockpile)
- Lines: 
  - Burn line (if metric = burn or multi-metric)
  - Supply line (if metric = supply or multi-metric)
- Legend labels
- Tooltip values

**Data Source:** ✅ **FULLY DYNAMIC** from API

**API Call:**
```
GET /api/scenario-data
    ↓
useForecastChart(filters)
    ↓
forecastService.getForecastChart(filters)
```

**Code Evidence:**
```typescript
// ForecastTrendChart.tsx
const { data, isLoading, isError } = useForecastChart(effectiveFilters);

const records: ForecastRecord[] = data ?? [];

const chartData = records
  .map((record) => ({
    date: record.event_date,  // ← From API
    burn: Number(record.Input ?? 0),  // ← From API
    supply: Number(record.Replenishment ?? 0),  // ← From API
    stockpile: Number(record.Stockpile ?? 0),  // ← From API
  }))
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

**Data Fields:**
- `event_date` - From parquet file ✅
- `Input` - Burn prediction from model ✅
- `Replenishment` - Supply prediction from model ✅
- `Stockpile` - Stockpile level from model ✅

**Status:** ✅ **100% DYNAMIC DATA**

---

## 4. SCENARIO COMPARISON CHART

**Component:** `ScenarioComparison.tsx`

**UI Elements:**
- Chart showing Baseline vs Selected Scenario
- Two lines:
  - Baseline (Actual scenario)
  - Selected scenario (Hot & Dry, etc.)
- Legend with scenario names
- Date axis
- Value axis

**Data Source:** ✅ **FULLY DYNAMIC** from API

**API Call:**
```
GET /api/scenario-data (fetches ALL scenarios at once)
```

**Code Evidence:**
```typescript
// ScenarioComparison.tsx
const { data, isLoading } = useQuery<ForecastScenarioApiResponse>({
  queryKey: ["scenario-comparison", horizon, entityId, scenario],
  queryFn: async () => {
    const response = await forecastService.getScenarioData();
    // ...filter by horizon and entityId
    return response;
  },
});

// Filters for baseline (actual)
const baselineRecords = records.filter(
  (record) => record.scenario_id === "actual" && record.entity_id === entityId
);

// Filters for selected scenario
const scenarioRecords = records.filter(
  (record) => record.scenario_id === backendScenarioId && record.entity_id === entityId
);
```

**Scenario Labels:**
```typescript
const scenarioLabels: Record<string, string> = {
  actual: "Actual",
  weather_hot_dry: "Hot & Dry",
  weather_hot_wet: "Hot & Wet",
  weather_cold_dry: "Cold & Dry",
  weather_cold_wet: "Cold & Wet",
};
```

**Status:** ✅ **FULLY DYNAMIC DATA**, hard-coded scenario labels (acceptable UI constants)

---

## 5. WEATHER INTELLIGENCE

**Component:** `WeatherIntelligence.tsx`

### 5.1 Current Weather Summary

**UI Elements:**
- Temperature: "24°C"
- Condition: "Partly Cloudy"
- Feels like: "22°C"
- Humidity: "65%"
- Wind: "12 km/h"
- UV Index: "5"
- Rainfall: "0 mm"

**Data Source:** ✅ **FULLY DYNAMIC** from Weather API

**API Call:**
```
GET /api/weather-data?entity_id={id}
    ↓
useWeatherSummary(entityId)
    ↓
weatherService.getWeatherSummary(entityId)
```

**Backend Chain:**
```python
# main.py
@app.get("/api/weather-data")
def weather_data(entity_id: Optional[str] = Query(default=None), ...):
    data = get_weather_json(entity_id=entity_id, ...)
    return JSONResponse(data, status_code=200)

# ui.py
def get_weather_json(entity_id: Optional[str] = None, ...):
    # Reads from: data/weather/weather_cache_{entity_id}.parquet
    # Data fetched from Open-Meteo API
```

**Data Flow:**
```
Open-Meteo API (external weather service)
    ↓
Cached in: data/weather/weather_cache_{entity_id}.parquet
    ↓
Backend: GET /api/weather-data
    ↓
Frontend: useWeatherSummary(entityId)
    ↓
Display current conditions
```

**Status:** ✅ **FULLY DYNAMIC** - Real weather data per station

---

### 5.2 Weather Outlook (7-day forecast)

**UI Elements:**
- 7 day cards showing:
  - Date
  - Day name
  - Weather icon
  - High/Low temperatures
  - Rainfall probability
  - Wind speed

**Data Source:** ✅ **FULLY DYNAMIC** from Weather API

**API Call:**
```
GET /api/weather-data?entity_id={id}
    ↓
useWeatherOutlook(entityId, days=7)
    ↓
weatherService.getWeatherOutlook(entityId, 7)
```

**Status:** ✅ **FULLY DYNAMIC** - Real 7-day forecast per station

---

### 5.3 Weather Signals (Alerts)

**UI Elements:**
- Alert cards showing weather risks:
  - "High Temperature Alert"
  - "Heavy Rainfall Expected"
  - "Strong Winds Forecast"
  - etc.

**Data Source:** ✅ **FULLY DYNAMIC** - Calculated from weather forecast

**API Call:**
```
GET /api/weather-data?entity_id={id}
    ↓
useWeatherSignals(entityId, days=7)
    ↓
Client-side analysis of forecast data
```

**Status:** ✅ **FULLY DYNAMIC**

---

## 6. STOCKPILE TRAJECTORY CHART

**Component:** `StockpileTrajectory.tsx`

**UI Elements:**
- Area chart showing stockpile levels over time
- Date axis (X)
- Stockpile level axis (Y)
- Reference lines for thresholds
- Unit toggle: "tons" vs "days of supply"

**Data Source:** ✅ **FULLY DYNAMIC** from API

**API Call:**
```
GET /api/scenario-data
    ↓
useForecastChart(filters)
    ↓
Extract Stockpile field
```

**Code Evidence:**
```typescript
// StockpileTrajectory.tsx
const { data, isLoading } = useForecastChart(filters);
const records: ForecastRecord[] = data ?? [];

const chartData = records
  .map((record) => ({
    date: record.event_date,
    stockpile: Number(record.Stockpile ?? 0),  // ← From API
  }))
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

**Status:** ✅ **FULLY DYNAMIC DATA**

---

## 7. FORECAST INSIGHTS (Alert Cards)

**Component:** `ForecastInsights.tsx`

**UI Elements:**
- Alert cards showing:
  - "Critical stockpile levels detected at 3 stations"
  - "Supply shortage risk in next 14 days"
  - "Peak demand expected on [date]"
  - etc.

**Data Source:** ✅ **FULLY DYNAMIC** - Calculated from forecast data

**API Call:**
```
GET /api/scenario-data
    ↓
useForecastScenarioData()
    ↓
Client-side analysis to generate insights
```

**Code Evidence:**
```typescript
// ForecastInsights.tsx
const { data } = useForecastScenarioData();

// Analyzes data to find:
// - Stations with low stockpile
// - Supply/demand mismatches
// - Peak forecast dates
// - Anomalies

// Dynamically generates insight cards
```

**Status:** ✅ **FULLY DYNAMIC** - Insights generated from real data

---

## 8. STATION FLEET OVERVIEW

**Component:** `StationFleetOverview.tsx`

**UI Elements:**
- List of all power stations
- Horizontal bars showing burn/supply levels
- Clickable to filter by station

**Data Source:** ✅ **FULLY DYNAMIC** from API

**API Call:**
```
GET /api/entities → useForecastEntities()
GET /api/scenario-data → useForecastScenarioData()
```

**Code Evidence:**
```typescript
// StationFleetOverview.tsx
const { entityId, setEntityId } = useForecastContext();
const { data } = useForecastScenarioData();

// Extracts all stations from data
// Calculates totals per station
// Renders list with bars
// onClick={() => setEntityId(row.id)} to filter
```

**Status:** ✅ **FULLY DYNAMIC** - No hard-coded station names

---

## 9. WEATHER CORRELATION CHART

**Component:** `WeatherCorrelation.tsx`

**UI Elements:**
- Dual-axis chart
- Line 1: Burn/Supply forecast
- Line 2: Temperature or other weather metric
- Shows correlation between weather and coal metrics

**Data Source:** ✅ **FULLY DYNAMIC** from two APIs

**API Calls:**
```
GET /api/scenario-data (for forecast)
GET /api/weather-data (for weather)
```

**Status:** ✅ **FULLY DYNAMIC** - Combines two real data sources

---

## 10. EXPORT FUNCTIONALITY

**Component:** `ExportForecast.tsx`

**UI Element:** Export CSV button

**Data Source:** ✅ **FULLY DYNAMIC** - Exports current filtered data

**Code Evidence:**
```typescript
// ExportForecast.tsx
const handleExport = async () => {
  const records = await forecastService.getFilteredRecords(filters);
  
  // Convert to CSV
  const csv = convertToCSV(records);
  
  // Download with dynamic filename
  link.download = `eskom-forecast-${filters.entityId}-${filters.horizon}-${filters.scenario}.csv`;
};
```

**Status:** ✅ **FULLY DYNAMIC** - Exports actual data

---

## SUMMARY TABLE: ALL UI ELEMENTS

| Component | Element | Data Source | Status |
|-----------|---------|-------------|--------|
| **Forecast Context Bar** |
| | Horizon dropdown | User state | ✅ Dynamic |
| | Horizon options | Hard-coded labels | ✅ UI constant |
| | Metric dropdown | User state | ✅ Dynamic |
| | Metric options | Hard-coded labels | ✅ UI constant |
| | Power Station dropdown | **GET /api/entities** | ✅ **Fully Dynamic** |
| | Station default | "entity_1" fallback | ⚠️ Hard-coded fallback |
| | Scenario dropdown | User state | ✅ Dynamic |
| | Scenario options | Hard-coded labels | ✅ UI constant |
| **Forecast Statistics** |
| | Average Forecast value | Calculated from GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Average Forecast unit | Dynamic (t/day or tonnes) | ✅ Dynamic |
| | Average Forecast subtitle | Dynamic (changes with metric) | ✅ Dynamic |
| | Peak Forecast value | Calculated from GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Projected Volume value | Calculated from GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Forecast Horizon value | Count from GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Forecast Horizon unit | Dynamic (Days or Months) | ✅ Dynamic |
| | Forecast Horizon subtitle | Uses actual entityId | ✅ Dynamic |
| | All sparklines | GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Card titles | Hard-coded | ✅ UI constant |
| | Card colors | Hard-coded | ✅ Theme constant |
| **Forecast Trend Chart** |
| | Chart data points | GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Date axis | From API (event_date) | ✅ Dynamic |
| | Burn line | From API (Input field) | ✅ Dynamic |
| | Supply line | From API (Replenishment field) | ✅ Dynamic |
| | Stockpile line | From API (Stockpile field) | ✅ Dynamic |
| **Scenario Comparison** |
| | Baseline line | GET /api/scenario-data (actual) | ✅ **Fully Dynamic** |
| | Scenario line | GET /api/scenario-data (selected) | ✅ **Fully Dynamic** |
| | Scenario labels | Hard-coded mapping | ✅ UI constant |
| **Weather Intelligence** |
| | Current temperature | GET /api/weather-data | ✅ **Fully Dynamic** |
| | Weather condition | GET /api/weather-data | ✅ **Fully Dynamic** |
| | All weather metrics | GET /api/weather-data | ✅ **Fully Dynamic** |
| | 7-day forecast | GET /api/weather-data | ✅ **Fully Dynamic** |
| | Weather alerts | Calculated from weather data | ✅ Dynamic |
| **Stockpile Trajectory** |
| | Chart data | GET /api/scenario-data (Stockpile) | ✅ **Fully Dynamic** |
| | Date axis | From API | ✅ Dynamic |
| | Stockpile values | From API | ✅ Dynamic |
| **Forecast Insights** |
| | Alert cards | Calculated from GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Station mentions | From dynamic analysis | ✅ Dynamic |
| **Station Fleet Overview** |
| | Station list | GET /api/entities | ✅ **Fully Dynamic** |
| | Station values | GET /api/scenario-data | ✅ **Fully Dynamic** |
| **Weather Correlation** |
| | Forecast line | GET /api/scenario-data | ✅ **Fully Dynamic** |
| | Weather line | GET /api/weather-data | ✅ **Fully Dynamic** |
| **Export** |
| | CSV data | Current filtered data from API | ✅ **Fully Dynamic** |
| | Filename | Dynamic (includes filters) | ✅ Dynamic |

---

## UNUSED COMPONENTS WITH MOCK DATA ❌

### ForecastTable.tsx (NOT USED)

**Status:** ❌ **CONTAINS MOCK DATA** - Component is not imported anywhere

**Mock Data:**
```typescript
const rows: ForecastResult[] = [
  {
    id: 1,
    date: "06 Aug 2026",
    prediction: 12540,  // ❌ Hard-coded
    actual: 12480,      // ❌ Hard-coded
    variance: 60,       // ❌ Hard-coded
    accuracy: 98.6,     // ❌ Hard-coded
    status: "Completed",
  },
  // ... 2 more hard-coded records
];

// Hard-coded context string:
"Arnot • Burn Prediction • Tactical (90 Days) • Actual Baseline"
```

**Recommendation:** ❌ **DELETE THIS FILE** - Not used, contains mock data

---

### ForecastHistory.tsx (NOT USED)

**Status:** ❌ **CONTAINS MOCK DATA** - Component is not imported anywhere

**Mock Data:**
```typescript
const history: ForecastRun[] = [
  {
    id: 4812,
    station: "Kendal",        // ❌ Hard-coded station name
    scenario: "Actual Baseline",
    metric: "Burn Prediction",
    horizon: "Tactical - 90 Days",
    accuracy: "98.6%",        // ❌ Hard-coded accuracy
    time: "09:42",            // ❌ Hard-coded time
    status: "Completed",
  },
  // ... 3 more with stations: Matimba, Medupi, Tutuka
];
```

**Recommendation:** ❌ **DELETE THIS FILE** or connect to `/api/inference-monitoring/summary`

---

### ForecastFilterBar.tsx (NOT USED)

**Status:** ❌ **CONTAINS HARD-CODED STATIONS** - Component is not imported anywhere

**Hard-coded Data:**
```typescript
<MenuItem value="Kendal">Kendal</MenuItem>      // ❌
<MenuItem value="Matla">Matla</MenuItem>        // ❌
<MenuItem value="Tutuka">Tutuka</MenuItem>      // ❌
<MenuItem value="Lethabo">Lethabo</MenuItem>    // ❌
```

**Recommendation:** ❌ **DELETE THIS FILE** - Redundant with ForecastContextBar

---

## MINOR ISSUES IN ACTIVE COMPONENTS ⚠️

### ForecastHeader.tsx (USED but has hard-coded status)

**Status:** ⚠️ **CONTAINS HARD-CODED STATUS INDICATORS**

**Hard-coded Elements:**
```typescript
<Chip color="success" label="Forecast Engine Online" />  // ⚠️ Should be dynamic
<Chip label="Last Run • Today 09:42" />                  // ⚠️ Should be dynamic
<Chip label="96.8% Accuracy" />                          // ⚠️ Should be dynamic
```

**Recommendation:** ⚠️ Connect to `/api/inference-monitoring/summary` for real status

---

## DATA SOURCE MAPPING

### Backend API Endpoints → Data Sources

| Endpoint | Data Source (Parquet Files) | What Frontend Uses It For |
|----------|----------------------------|---------------------------|
| `/api/scenario-data` | `data/gold/daily/scenario_predictions.parquet`<br>`data/gold/monthly/scenario_predictions.parquet` | - Forecast charts<br>- Statistics KPIs<br>- Scenario comparison<br>- Stockpile trajectory<br>- Fleet overview<br>- Insights |
| `/api/entities` | Extracted from scenario_predictions.parquet | - Power Station dropdown<br>- Station fleet list<br>- Station labels everywhere |
| `/api/weather-data` | `data/weather/weather_cache_{entity_id}.parquet` | - Weather intelligence<br>- Weather summary<br>- 7-day forecast<br>- Weather correlation<br>- Weather signals |
| `/api/forecast-metrics` | `data/metrics/model_metrics.parquet` | - Model performance page<br>- Accuracy displays |
| `/api/forecast-metrics-by-step` | `data/metrics/model_metrics_by_step.parquet` | - Per-step accuracy charts |
| `/api/oot-history` | `data/metrics/oot_history.parquet` | - Historical accuracy<br>- OOT performance |

---

## FINAL VERDICT

### ✅ FULLY DYNAMIC (No Mock Data)

**Active Components:**
1. **ForecastContextBar** - All dropdowns pull from API or user state
2. **ForecastStatistics** - All 4 KPI cards calculated from API
3. **ForecastTrendChart** - 100% API data
4. **ScenarioComparison** - 100% API data  
5. **WeatherIntelligence** - Real weather API data
6. **StockpileTrajectory** - API data
7. **ForecastInsights** - Generated from API data
8. **StationFleetOverview** - Dynamic station list from API
9. **WeatherCorrelation** - Two API sources combined
10. **ExportForecast** - Exports real filtered data

**Key Achievement:** ✅ **POWER STATIONS ARE FULLY DYNAMIC** - Zero hard-coded station names in active code

---

### ❌ MOCK DATA (Unused Components - Should Delete)

1. **ForecastTable.tsx** - 3 fake forecast records
2. **ForecastHistory.tsx** - 4 fake runs with hard-coded stations
3. **ForecastFilterBar.tsx** - Hard-coded station dropdown

---

### ⚠️ MINOR IMPROVEMENTS NEEDED

1. **ForecastHeader.tsx** - Connect status chips to monitoring API
2. **DEFAULT_ENTITY_ID** - Use dynamic first entity instead of "entity_1"

---

## CODE QUALITY GRADE

**Overall: A-**

**Strengths:**
- ✅ No hard-coded power stations in active components
- ✅ All charts and KPIs pull from backend APIs
- ✅ Proper React hooks architecture
- ✅ Type-safe TypeScript interfaces
- ✅ Clean separation of concerns
- ✅ Backend generates entities from data (not config)

**Weaknesses:**
- ❌ 3 unused components with mock data (development artifacts)
- ⚠️ 1 active component with hard-coded status (ForecastHeader)
- ⚠️ 1 hard-coded default fallback (entity_1)

**After cleanup: Would be A+**
