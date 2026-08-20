import React, {
  useEffect,
  useLayoutEffect,
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


  /*
   * Height of the bar in its expanded state.
   *
   * When the bar compacts it gets ~65px shorter, which used to pull
   * the whole page up under the cursor mid-scroll — the "flicker".
   * We measure the expanded height once and give the compact bar an
   * equal amount of extra bottom margin, so the document height and
   * every element below it stay exactly where they were.
   */
  const [
    expandedHeight,
    setExpandedHeight,
  ] = useState<number | null>(null);

  const [
    compactHeight,
    setCompactHeight,
  ] = useState<number | null>(null);


  useLayoutEffect(() => {

    const element =
      contextRef.current;

    if (!element) {
      return;
    }

    /*
     * Measured in a LAYOUT effect (before paint) so the compensating
     * margin below is applied in the same frame as the size change —
     * the user never sees an intermediate, uncompensated frame.
     */
    const height =
      element.getBoundingClientRect().height;

    if (isCompact) {
      setCompactHeight(
        (current) =>
          current === null
            ? height
            : current
      );
    } else {
      setExpandedHeight(
        (current) =>
          current === null
            ? height
            : current
      );
    }

  }, [
    isCompact,
  ]);


  /*
   * Extra bottom margin that keeps the bar's total footprint constant.
   */
  const heightCompensation =
    isCompact &&
    expandedHeight !== null &&
    compactHeight !== null
      ? Math.max(
          0,
          expandedHeight - compactHeight
        )
      : 0;


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


    /*
     * =================================================
     * FLICKER-FREE COMPACTION
     * =================================================
     *
     * Compacting the bar changes its height, which changes the
     * scroll height of the container, which can immediately push
     * the scroll position back across a single threshold — the
     * bar then expands, and the loop repeats as a visible flicker.
     *
     * Two guards:
     *
     * 1. HYSTERESIS — separate enter (>96px) and exit (<32px)
     *    thresholds, so a small layout shift can never flip the
     *    state straight back.
     *
     * 2. requestAnimationFrame — at most one state update per
     *    frame instead of one per scroll event.
     */

    let frame = 0;

    const COMPACT_ENTER = 96;
    const COMPACT_EXIT = 32;

    const measure = () => {

      frame = 0;

      const scrollTop =
        target === window
          ? window.scrollY
          : (
              target as HTMLElement
            ).scrollTop;

      setIsCompact(
        (compact) =>
          compact
            ? scrollTop > COMPACT_EXIT
            : scrollTop > COMPACT_ENTER
      );
    };


    const handleScroll = () => {

      if (frame) {
        return;
      }

      frame =
        window.requestAnimationFrame(
          measure
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

    measure();


    return () => {

      if (frame) {
        window.cancelAnimationFrame(
          frame
        );
      }

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

        /* Same 12px radius as every card; square while stuck. */
        borderRadius:
          isCompact
            ? 0
            : "12px",


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


        /*
         * Base spacing below the bar, PLUS the height the compact
         * state gave up. The bar's total footprint in the document
         * therefore never changes, so nothing below it moves when the
         * bar compacts mid-scroll.
         */
        marginBottom: `${24 + heightCompensation}px`,


        /*
         * =================================================
         * TRANSITIONS
         * =================================================
         */

        /*
         * IMPORTANT: never transition layout-affecting properties
         * here. Animating padding/margin re-flowed the page on every
         * frame of the animation, which is what read as scroll
         * flicker. Only paint-only properties are animated now.
         */
        transition:
          "border-radius 180ms ease, " +
          "box-shadow 180ms ease, " +
          "background-color 180ms ease",

        /*
         * Sticky elements that repaint on every scroll frame are the
         * classic source of scroll flicker in Chromium. Promoting the
         * bar to its own compositor layer keeps it stable.
         */
        willChange: "padding, margin",

        backfaceVisibility: "hidden",

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

              borderRadius: "10px",

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
            variant="contained"
            color="primary"
            disableElevation
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
              color: "primary.contrastText",
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


      }}
    >
      {label}
    </Typography>

    {children}

  </FormControl>
);


export default ForecastContextBar;