import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  ForecastHorizon,
  ForecastMetric,
  ForecastScenario,
} from "../features/forecast/types/forecast.types";

interface ForecastContextValue {
  horizon: ForecastHorizon;
  metric: ForecastMetric;
  entityId: string;
  scenario: ForecastScenario;

  autoRefresh: boolean;
  lastUpdated: Date;

  setHorizon: (
    value: ForecastHorizon
  ) => void;

  setMetric: (
    value: ForecastMetric
  ) => void;

  setEntityId: (
    value: string
  ) => void;

  setScenario: (
    value: ForecastScenario
  ) => void;

  setAutoRefresh: (
    value: boolean
  ) => void;

  refresh: () => void;

  reset: () => void;
}

/**
 * FORECAST CONTEXT — global filter state for both routed pages
 * (Forecast + Model Performance).
 *
 * [DATA: USER-STATE] horizon/metric/entityId/scenario are client-side
 * selections, not fetched data. They drive which backend records the
 * services filter for.
 *
 * [DATA: MOCK] DEFAULT_ENTITY_ID = "entity_1" is a leftover mock id —
 * no real parquet entity is called "entity_1" (real ids are "Arnot",
 * "Kendal", ...). Until /api/entities exists (or this default is fixed),
 * the app boots with a station selection that matches NO records, so
 * every KPI/chart renders empty/zero on first load.
 *
 * [DATA: STATIC-UI] the remaining defaults (daily/burn/actual) are
 * acceptable UI defaults that do exist in the backend data.
 */
const ForecastContext =
  createContext<
    ForecastContextValue | undefined
  >(undefined);

interface ForecastProviderProps {
  children: ReactNode;
}

const DEFAULT_HORIZON: ForecastHorizon =
  "daily";

const DEFAULT_METRIC: ForecastMetric =
  "burn";

// [DATA: MOCK] leftover demo id — does not match any real entity_id in
// gold/scenario_predictions.parquet. First-load data is empty until the
// user picks a real station (or this is fixed / served by /api/entities).
const DEFAULT_ENTITY_ID =
  "entity_1";

const DEFAULT_SCENARIO: ForecastScenario =
  "actual";

export const ForecastProvider = ({
  children,
}: ForecastProviderProps) => {
  const [horizon, setHorizonState] =
    useState<ForecastHorizon>(
      DEFAULT_HORIZON
    );

  const [metric, setMetricState] =
    useState<ForecastMetric>(
      DEFAULT_METRIC
    );

  const [entityId, setEntityIdState] =
    useState<string>(
      DEFAULT_ENTITY_ID
    );

  const [scenario, setScenarioState] =
    useState<ForecastScenario>(
      DEFAULT_SCENARIO
    );

  const [autoRefresh, setAutoRefresh] =
    useState<boolean>(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date>(new Date());

  const setHorizon = useCallback(
    (value: ForecastHorizon) => {
      setHorizonState(value);
    },
    []
  );

  const setMetric = useCallback(
    (value: ForecastMetric) => {
      setMetricState(value);
    },
    []
  );

  const setEntityId = useCallback(
    (value: string) => {
      setEntityIdState(value);
    },
    []
  );

  const setScenario = useCallback(
    (value: ForecastScenario) => {
      setScenarioState(value);
    },
    []
  );

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  const reset = useCallback(() => {
    setHorizonState(
      DEFAULT_HORIZON
    );

    setMetricState(
      DEFAULT_METRIC
    );

    setEntityIdState(
      DEFAULT_ENTITY_ID
    );

    setScenarioState(
      DEFAULT_SCENARIO
    );

    setAutoRefresh(false);

    setLastUpdated(new Date());
  }, []);

  const value = useMemo(
    () => ({
      horizon,
      metric,
      entityId,
      scenario,

      autoRefresh,
      lastUpdated,

      setHorizon,
      setMetric,
      setEntityId,
      setScenario,

      setAutoRefresh,

      refresh,
      reset,
    }),
    [
      horizon,
      metric,
      entityId,
      scenario,
      autoRefresh,
      lastUpdated,
      setHorizon,
      setMetric,
      setEntityId,
      setScenario,
      refresh,
      reset,
    ]
  );

  return (
    <ForecastContext.Provider
      value={value}
    >
      {children}
    </ForecastContext.Provider>
  );
};

export const useForecastContext =
  (): ForecastContextValue => {
    const context =
      useContext(
        ForecastContext
      );

    if (!context) {
      throw new Error(
        "useForecastContext must be used inside ForecastProvider"
      );
    }

    return context;
  };