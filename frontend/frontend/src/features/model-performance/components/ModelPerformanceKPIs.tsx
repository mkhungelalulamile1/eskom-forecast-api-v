import {
  Box,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  FunctionsRounded,
  StraightenRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  ModelMetricRecord,
} from "../types/model-performance.types";

import {
  useModelMetrics,
} from "../hooks/useModelPerformance";



import KpiStatCard from "../../../components/common/KpiStatCard";

interface ModelPerformanceKPIsProps {
  horizon?: string;
  entityId?: string;
}


const ModelPerformanceKPIs = ({
  horizon,
  entityId,
}: ModelPerformanceKPIsProps) => {

  const {
    data,
    isLoading,
    isError,
  } = useModelMetrics();


  /*
   * --------------------------------------------------
   * TYPE THE BACKEND RESPONSE
   * --------------------------------------------------
   */

  const metrics: ModelMetricRecord[] =
    Array.isArray(data)
      ? data
      : [];


  /*
   * --------------------------------------------------
   * FILTER BY HORIZON
   * --------------------------------------------------
   */

  const selectedMetrics: ModelMetricRecord[] =
    metrics.filter(
      (
        record: ModelMetricRecord
      ) => {

        if (
          entityId &&
          record.entity_id !== entityId
        ) {
          return false;
        }


        if (
          horizon === "daily" &&
          record.horizon !== "tactical"
        ) {
          return false;
        }


        if (
          horizon === "monthly" &&
          record.horizon !== "strategic"
        ) {
          return false;
        }


        return true;
      }
    );


  /*
   * --------------------------------------------------
   * FORMAT NUMBER
   * --------------------------------------------------
   */

  const formatNumber = (
    value:
      | number
      | null
      | undefined,
    decimals = 2
  ): string => {

    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(value)
    ) {
      return "—";
    }


    return new Intl.NumberFormat(
      "en-US",
      {
        minimumFractionDigits:
          decimals,

        maximumFractionDigits:
          decimals,
      }
    ).format(value);
  };


  /*
   * --------------------------------------------------
   * AVERAGE HELPER
   * --------------------------------------------------
   */

  const average = (
    values:
      Array<
        number |
        null |
        undefined
      >
  ): number | null => {

    const validValues =
      values.filter(
        (
          value
        ): value is number =>
          value !== null &&
          value !== undefined &&
          Number.isFinite(value)
      );


    if (
      validValues.length === 0
    ) {
      return null;
    }


    return (
      validValues.reduce(
        (
          total,
          value
        ) =>
          total + value,
        0
      ) /
      validValues.length
    );
  };


  /*
   * --------------------------------------------------
   * CALCULATE KPI VALUES
   * --------------------------------------------------
   */

  const averageRmse =
    average(
      selectedMetrics.map(
        (
          record: ModelMetricRecord
        ) =>
          record.rmse
      )
    );


  const averageMae =
    average(
      selectedMetrics.map(
        (
          record: ModelMetricRecord
        ) =>
          record.mae
      )
    );


  const averageNrmse =
    average(
      selectedMetrics.map(
        (
          record: ModelMetricRecord
        ) =>
          record.nrmse
      )
    );


  const averageR2 =
    average(
      selectedMetrics.map(
        (
          record: ModelMetricRecord
        ) =>
          record.r2
      )
    );


  const averageSmape =
    average(
      selectedMetrics.map(
        (
          record: ModelMetricRecord
        ) =>
          record.smape
      )
    );


  /*
   * --------------------------------------------------
   * PERFORMANCE INTERPRETATION
   * --------------------------------------------------
   *
   * NRMSE drives the qualitative badge on the NRMSE card.
   */

  const getNrmseStatus = () => {

    if (averageNrmse === null) {
      return {
        label: "No data",
        color: "#7C8BA6",
        icon: <ErrorOutlineRounded />,
      };
    }

    if (averageNrmse <= 25) {
      return {
        label: "Strong",
        color: "#1E9E6A",
        icon: <CheckCircleRounded />,
      };
    }

    if (averageNrmse <= 50) {
      return {
        label: "Review",
        color: "#E8A008",
        icon: <ErrorOutlineRounded />,
      };
    }

    return {
      label: "Attention",
      color: "#D64545",
      icon: <ErrorOutlineRounded />,
    };
  };


  const nrmseStatus = getNrmseStatus();


  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  if (isError) {
    return (
      <Box
        sx={{
          p: 4,
          bgcolor: "transparent",
          border: "1px solid",
          borderColor: (t) =>
            t.palette.mode === "dark"
              ? "rgba(255,255,255,0.55)"
              : "divider",
          borderRadius: "12px",
        }}
      >
        <Typography
          color="error"
          fontWeight={600}
        >
          Unable to load model performance
          metrics.
        </Typography>
      </Box>
    );
  }


  /*
   * --------------------------------------------------
   * UI
   * --------------------------------------------------
   *
   * Uses the SAME KpiStatCard as the Forecast page KPI row, so
   * the icon tile, spacing and value baseline line up exactly
   * between the two dashboards.
   */

  const loadingText = isLoading ? "—" : undefined;

  return (
    <Box
      className="eskom-stagger"
      sx={{
        display: "grid",

        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },

        gap: 2.5,

        width: "100%",
      }}
    >

        <KpiStatCard
          title="Average RMSE"
          subtitle="Root mean squared error"
          text={
            loadingText ??
            (averageRmse === null
              ? "—"
              : formatNumber(averageRmse))
          }
          color="#0054A6"
          icon={<StraightenRounded />}
        />


        <KpiStatCard
          title="Average MAE"
          subtitle="Mean absolute error"
          text={
            loadingText ??
            (averageMae === null
              ? "—"
              : formatNumber(averageMae))
          }
          color="#1890d7"
          icon={<FunctionsRounded />}
        />


        <KpiStatCard
          title="Average NRMSE"
          subtitle="Normalised model error"
          text={
            loadingText ??
            (averageNrmse === null
              ? "—"
              : `${formatNumber(averageNrmse)}%`)
          }
          color={nrmseStatus.color}
          icon={nrmseStatus.icon}
          statusLabel={
            isLoading
              ? undefined
              : nrmseStatus.label
          }
          statusColor={nrmseStatus.color}
        />


        <KpiStatCard
          title="Average R²"
          subtitle="Explained variance"
          text={
            loadingText ??
            (averageR2 === null
              ? "—"
              : formatNumber(averageR2, 3))
          }
          color="#1E9E6A"
          icon={<TrendingUpRounded />}
        />


      {/*
       * SMAPE is calculated from the same backend records and kept
       * here so it can be surfaced in a secondary KPI row later.
       */}
      <Box sx={{ display: "none" }}>
        {formatNumber(averageSmape)}
      </Box>

    </Box>
  );
};


export default ModelPerformanceKPIs;
