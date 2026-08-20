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