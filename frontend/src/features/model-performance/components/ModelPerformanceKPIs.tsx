import {
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import {
  CheckCircleRounded,
  ErrorOutlineRounded,
  TrendingDownRounded,
  TrendingUpRounded,
} from "@mui/icons-material";

import {
  ModelMetricRecord,
} from "../types/model-performance.types";

import {
  useModelMetrics,
} from "../hooks/useModelPerformance";


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
   */

  const getNrmseStatus = () => {

    if (
      averageNrmse === null
    ) {
      return {
        label: "No data",
        color: "#68758A",
        background: "#F4F6F9",
        icon:
          <ErrorOutlineRounded />,
      };
    }


    if (
      averageNrmse <= 25
    ) {
      return {
        label: "Strong",
        color: "#15803D",
        background: "#ECFDF3",
        icon:
          <CheckCircleRounded />,
      };
    }


    if (
      averageNrmse <= 50
    ) {
      return {
        label: "Review",
        color: "#B45309",
        background: "#FFF7E8",
        icon:
          <ErrorOutlineRounded />,
      };
    }


    return {
      label: "Attention",
      color: "#DC2626",
      background: "#FFF1F2",
      icon:
        <ErrorOutlineRounded />,
    };
  };


  const nrmseStatus =
    getNrmseStatus();


  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2.5,
        }}
      >
        {[
          "RMSE",
          "MAE",
          "NRMSE",
          "R²",
        ].map(
          (
            label
          ) => (
            <KpiCard
              key={label}
              label={label}
              description="Loading model performance..."
              value="—"
              icon={
                <ErrorOutlineRounded />
              }
              iconColor="#68758A"
              iconBackground="#F4F6F9"
            />
          )
        )}
      </Box>
    );
  }


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
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 12,
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
   */

  return (
    <Box
      sx={{
        display: "grid",

        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },

        gap: 2.5,
      }}
    >

      <KpiCard
        label="Average RMSE"
        description="Root mean squared error"
        value={formatNumber(
          averageRmse
        )}
        icon={
          <TrendingDownRounded />
        }
        iconColor="#1264FF"
        iconBackground="#EEF4FF"
      />


      <KpiCard
        label="Average MAE"
        description="Mean absolute error"
        value={formatNumber(
          averageMae
        )}
        icon={
          <TrendingDownRounded />
        }
        iconColor="#1683D8"
        iconBackground="#F0F7FF"
      />


      <KpiCard
        label="Average NRMSE"
        description="Normalised model error"
        value={
          averageNrmse !== null
            ? `${formatNumber(
                averageNrmse
              )}%`
            : "—"
        }
        icon={
          nrmseStatus.icon
        }
        iconColor={
          nrmseStatus.color
        }
        iconBackground={
          nrmseStatus.background
        }
        statusLabel={
          nrmseStatus.label
        }
        statusColor={
          nrmseStatus.color
        }
        statusBackground={
          nrmseStatus.background
        }
      />


      <KpiCard
        label="Average R²"
        description="Explained variance"
        value={
          averageR2 !== null
            ? formatNumber(
                averageR2,
                3
              )
            : "—"
        }
        icon={
          <TrendingUpRounded />
        }
        iconColor="#16A34A"
        iconBackground="#ECFDF3"
      />


      {/* 
       * Keep these available if you want
       * to expose them later in a secondary
       * KPI row.
       *
       * They are calculated from REAL backend
       * records, not mock data.
       */}

      <Box
        sx={{
          display: "none",
        }}
      >
        {formatNumber(
          averageSmape
        )}
      </Box>

    </Box>
  );
};


/*
 * ======================================================
 * KPI CARD
 * ======================================================
 */

interface KpiCardProps {
  label: string;
  description: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBackground: string;

  statusLabel?: string;
  statusColor?: string;
  statusBackground?: string;
}


const KpiCard = ({
  label,
  description,
  value,
  icon,
  iconColor,
  iconBackground,
  statusLabel,
  statusColor,
  statusBackground,
}: KpiCardProps) => {

  return (
    <Box
      sx={{
        bgcolor: "background.paper",

        border: "1px solid",
          borderColor: "divider",

        borderRadius: 12,

        p: {
          xs: 2.5,
          md: 3,
        },

        minWidth: 0,

        boxShadow:
          "0 8px 24px rgba(23,43,77,0.04)",
      }}
    >

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >

        <Box
          sx={{
            minWidth: 0,
          }}
        >

          <Typography
            variant="caption"
            fontWeight={800}
            letterSpacing={1}
            color="#68758A"
          >
            {label}
          </Typography>


          <Typography
            variant="body2"
            color="text.secondary"
            mt={0.75}
          >
            {description}
          </Typography>

        </Box>


        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,

            bgcolor:
              iconBackground,

            color:
              iconColor,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

      </Stack>


      <Typography
        variant="h4"
        fontWeight={800}
        color="text.primary"
        mt={3}
      >
        {value}
      </Typography>


      {statusLabel && (
        <Chip
          label={statusLabel}
          size="small"
          sx={{
            mt: 1.5,

            bgcolor:
              statusBackground,

            color:
              statusColor,

            fontWeight: 700,
          }}
        />
      )}

    </Box>
  );
};


export default ModelPerformanceKPIs;