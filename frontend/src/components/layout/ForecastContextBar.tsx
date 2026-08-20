import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
} from "@mui/material";

import {
  KeyboardArrowDownRounded,
  FilterAltRounded,
  RestartAltRounded,
} from "@mui/icons-material";

import {
  useForecastContext,
} from "../../contexts/ForecastContext";

import {
  useForecastEntities,
} from "../../features/forecast/hooks/useForecast";

import {
  ForecastEntity,
} from "../../features/forecast/types/forecast.types";


/**
 * =====================================================
 * PROPS
 * =====================================================
 */

interface ForecastContextBarProps {
  exportAction?: React.ReactNode;
}


/**
 * =====================================================
 * FORECAST CONTEXT BAR
 * =====================================================
 *
 * Global dashboard controls:
 *
 * - Horizon
 * - Metric
 * - Power Station
 * - Scenario
 *
 * Behaviour:
 *
 * 1. Normal / expanded at the top.
 * 2. Sticks to the very top while scrolling.
 * 3. Compresses when the user scrolls down.
 * 4. Export CSV lives inside the context bar.
 * 5. Reset remains available in both states.
 */

const ForecastContextBar = ({
  exportAction,
}: ForecastContextBarProps) => {

  const {
    horizon,
    metric,
    entityId,
    scenario,

    setHorizon,
    setMetric,
    setEntityId,
    setScenario,
  } = useForecastContext();


  const {
    data,
    isLoading:
      entitiesLoading,
  } = useForecastEntities();


  const forecastEntities =
    useMemo<ForecastEntity[]>(
      () => data ?? [],
      [data]
    );


  /**
   * =====================================================
   * COMPACT / SCROLL STATE
   * =====================================================
   */

  const contextRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    isCompact,
    setIsCompact,
  ] = useState(false);


  useEffect(() => {

    const element =
      contextRef.current;

    if (!element) {
      return;
    }


    /**
     * Find the actual scrolling container.
     *
     * This supports both:
     *
     * - window scrolling
     * - DashboardLayout main scrolling
     */

    let scrollParent:
      HTMLElement | null =
      element.parentElement;


    while (
      scrollParent &&
      scrollParent !== document.body
    ) {

      const styles =
        window.getComputedStyle(
          scrollParent
        );

      const overflowY =
        styles.overflowY;


      if (
        overflowY === "auto" ||
        overflowY === "scroll"
      ) {
        break;
      }


      scrollParent =
        scrollParent.parentElement;
    }


    const target:
      Window | HTMLElement =
      scrollParent ??
      window;


    const handleScroll =
      () => {

        const scrollTop =
          target === window
            ? window.scrollY
            : (
                target as HTMLElement
              ).scrollTop;


        /*
         * Compact after the user has
         * moved down approximately 40px.
         */

        setIsCompact(
          scrollTop > 40
        );
      };


    target.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );


    /*
     * Set the initial state.
     */

    handleScroll();


    return () => {

      target.removeEventListener(
        "scroll",
        handleScroll
      );

    };

  }, []);


  /**
   * =====================================================
   * KEEP ENTITY SELECTION VALID
   * =====================================================
   */

  useEffect(() => {

    if (
      forecastEntities.length === 0
    ) {
      return;
    }


    const exists =
      forecastEntities.some(
        (entity) =>
          entity.id === entityId
      );


    if (!exists) {

      setEntityId(
        forecastEntities[0].id
      );

    }

  }, [
    forecastEntities,
    entityId,
    setEntityId,
  ]);


  /**
   * =====================================================
   * HANDLERS
   * =====================================================
   */

  const handleHorizonChange = (
    event:
      SelectChangeEvent<string>
  ) => {

    setHorizon(
      event.target.value as
        typeof horizon
    );

  };


  const handleMetricChange = (
    event:
      SelectChangeEvent<string>
  ) => {

    setMetric(
      event.target.value as
        typeof metric
    );

  };


  const handleEntityChange = (
    event:
      SelectChangeEvent<string>
  ) => {

    setEntityId(
      event.target.value
    );

  };


  const handleScenarioChange = (
    event:
      SelectChangeEvent<string>
  ) => {

    setScenario(
      event.target.value as
        typeof scenario
    );

  };


  /**
   * =====================================================
   * RESET
   * =====================================================
   */

  const handleReset = () => {

    setHorizon("daily");

    setMetric("burn");

    setScenario("actual");


    if (
      forecastEntities.length > 0
    ) {

      setEntityId(
        forecastEntities[0].id
      );

    }

  };


  /**
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <Box
      ref={contextRef}
      sx={{
        /*
         * =================================================
         * STICKY POSITION
         * =================================================
         *
         * Header has been removed.
         *
         * Therefore this MUST be 0.
         */

        position: "sticky",

        top: 0,

        zIndex: 1100,


        /*
         * =================================================
         * BACKGROUND
         * =================================================
         */

        bgcolor:
          "background.paper",

        border:
          "1px solid",

        borderColor:
          "divider",


        /*
         * When compact, remove the large
         * rounded floating-card appearance.
         */

        borderRadius:
          isCompact
            ? 0
            : 3,


        boxShadow:
          isCompact
            ? "0 5px 20px rgba(16,32,62,0.14)"
            : "0 10px 30px rgba(16,32,62,0.05)",


        /*
         * =================================================
         * SPACING
         * =================================================
         */

        px: {
          xs: 2,
          sm: 3,
        },

        py:
          isCompact
            ? 1
            : 2.5,


        mb:
          isCompact
            ? 2
            : 3,


        /*
         * =================================================
         * TRANSITIONS
         * =================================================
         */

        transition:
          "padding 220ms ease, " +
          "margin-bottom 220ms ease, " +
          "border-radius 220ms ease, " +
          "box-shadow 220ms ease",

        isolation:
          "isolate",
      }}
    >

      {/* ==================================================
          TOP ROW
      ================================================== */}

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          mb:
            isCompact
              ? 1
              : 2,

          minWidth: 0,

          transition:
            "margin-bottom 220ms ease",
        }}
      >

        {/* =================================================
            TITLE
        ================================================= */}

        <Stack
          direction="row"
          spacing={
            isCompact
              ? 1
              : 1.25
          }
          alignItems="center"
          sx={{
            minWidth: 0,
          }}
        >

          <Box
            sx={{
              width:
                isCompact
                  ? 32
                  : 38,

              height:
                isCompact
                  ? 32
                  : 38,

              borderRadius: 2,

              display: "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              bgcolor:
                "rgba(0,84,166,0.1)",

              color:
                "primary.main",

              flexShrink: 0,

              transition:
                "width 220ms ease, " +
                "height 220ms ease",
            }}
          >

            <FilterAltRounded
              fontSize={
                isCompact
                  ? "small"
                  : "medium"
              }
            />

          </Box>


          <Box
            sx={{
              minWidth: 0,
            }}
          >

            <Typography
              variant={
                isCompact
                  ? "body1"
                  : "subtitle1"
              }
              fontWeight={800}
              color="text.primary"
              sx={{
                whiteSpace:
                  "nowrap",
              }}
            >
              Forecast Context
            </Typography>


            {!isCompact && (
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Filters apply across the whole dashboard
              </Typography>
            )}

          </Box>

        </Stack>


        {/* =================================================
            ACTIONS
        ================================================= */}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flexShrink: 0,
          }}
        >

          {/* EXPORT CSV */}

          {exportAction}


          {/* RESET */}

          <Button
            variant="outlined"
            size={
              isCompact
                ? "small"
                : "medium"
            }
            startIcon={
              <RestartAltRounded />
            }
            onClick={
              handleReset
            }
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Reset
          </Button>

        </Stack>

      </Stack>


      {/* ==================================================
          FILTERS
      ================================================== */}

      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs:
              "1fr",

            sm:
              "repeat(2, minmax(0, 1fr))",

            lg:
              "repeat(4, minmax(0, 1fr))",
          },

          gap:
            isCompact
              ? 1
              : 2,

          minWidth: 0,

          transition:
            "gap 220ms ease",
        }}
      >

        {/* =================================================
            HORIZON
        ================================================= */}

        <Field
          label="Horizon"
          compact={isCompact}
        >

          <Select
            value={horizon}
            onChange={
              handleHorizonChange
            }
            fullWidth
            size={
              isCompact
                ? "small"
                : "medium"
            }
            IconComponent={
              KeyboardArrowDownRounded
            }
          >

            <MenuItem value="daily">
              Tactical (Daily)
            </MenuItem>

            <MenuItem value="monthly">
              Strategic (Monthly)
            </MenuItem>

          </Select>

        </Field>


        {/* =================================================
            METRIC
        ================================================= */}

        <Field
          label="Metric"
          compact={isCompact}
        >

          <Select
            value={metric}
            onChange={
              handleMetricChange
            }
            fullWidth
            size={
              isCompact
                ? "small"
                : "medium"
            }
            IconComponent={
              KeyboardArrowDownRounded
            }
          >

            <MenuItem value="burn">
              Burn Predictions
            </MenuItem>

            <MenuItem value="supply">
              Supply Predictions
            </MenuItem>

            <MenuItem value="stockpile">
              Stockpile Predictions
            </MenuItem>

          </Select>

        </Field>


        {/* =================================================
            POWER STATION
        ================================================= */}

        <Field
          label="Power Station"
          compact={isCompact}
        >

          <Select
            value={entityId}
            onChange={
              handleEntityChange
            }
            fullWidth
            size={
              isCompact
                ? "small"
                : "medium"
            }
            IconComponent={
              KeyboardArrowDownRounded
            }
          >

            {entitiesLoading && (
              <MenuItem disabled>
                Loading stations…
              </MenuItem>
            )}


            {!entitiesLoading &&
              forecastEntities.length === 0 && (
                <MenuItem disabled>
                  No stations available
                </MenuItem>
              )}


            {forecastEntities.map(
              (
                entity: ForecastEntity
              ) => (

                <MenuItem
                  key={entity.id}
                  value={entity.id}
                >
                  {entity.label}
                </MenuItem>

              )
            )}

          </Select>

        </Field>


        {/* =================================================
            SCENARIO
        ================================================= */}

        <Field
          label="Scenario"
          compact={isCompact}
        >

          <Select
            value={scenario}
            onChange={
              handleScenarioChange
            }
            fullWidth
            size={
              isCompact
                ? "small"
                : "medium"
            }
            IconComponent={
              KeyboardArrowDownRounded
            }
          >

            <MenuItem value="actual">
              Baseline
            </MenuItem>

            <MenuItem value="hotdry">
              Hot &amp; Dry
            </MenuItem>

            <MenuItem value="hotwet">
              Hot &amp; Wet
            </MenuItem>

            <MenuItem value="colddry">
              Cold &amp; Dry
            </MenuItem>

            <MenuItem value="coldwet">
              Cold &amp; Wet
            </MenuItem>

          </Select>

        </Field>

      </Box>

    </Box>
  );
};


/**
 * =====================================================
 * FIELD
 * =====================================================
 */

interface FieldProps {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}


const Field = ({
  label,
  children,
  compact = false,
}: FieldProps) => (

  <FormControl
    fullWidth
  >

    <Typography
      variant="caption"
      sx={{
        mb:
          compact
            ? 0.35
            : 0.75,

        ml: 0.25,

        fontWeight: 700,

        color:
          "text.secondary",

        lineHeight:
          compact
            ? 1
            : 1.2,

        transition:
          "margin-bottom 220ms ease",
      }}
    >
      {label}
    </Typography>

    {children}

  </FormControl>
);


export default ForecastContextBar;