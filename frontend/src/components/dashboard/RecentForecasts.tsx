import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Stack,
  Typography,
} from "@mui/material";

import AppCard from "../common/AppCard";
import CardHeader from "../common/CardHeader";

import DataTable, {
  Column,
} from "../common/DataTable";

import FilterBar, {
  FilterConfig,
} from "../common/FilterBar";

import {
  ForecastRecord,
} from "../../features/forecast/types/forecast.types";

import forecastService from "../../features/forecast/service/forecast.service";

import {
  useForecastContext,
} from "../../contexts/ForecastContext";


/**
 * ==========================================================
 * TABLE COLUMNS
 * ==========================================================
 */

const columns: Column<ForecastRecord>[] = [
  {
    field: "entity_id",

    headerName:
      "Power Station",

    render: (row) => (
      <Typography
        variant="body2"
        fontWeight={700}
      >
        {row.entity_id}
      </Typography>
    ),
  },


  {
    field: "event_date",

    headerName:
      "Forecast Date",

    render: (row) => (
      <Typography
        variant="body2"
      >
        {row.event_date}
      </Typography>
    ),
  },


  {
    field: "Input",

    headerName:
      "Burn",

    align:
      "right",

    render: (row) => (
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          whiteSpace:
            "nowrap",
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {Number(
          row.Input ?? 0
        ).toLocaleString()}
      </Typography>
    ),
  },


  {
    field:
      "Replenishment",

    headerName:
      "Replenishment",

    align:
      "right",

    render: (row) => (
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          whiteSpace:
            "nowrap",
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {Number(
          row.Replenishment ?? 0
        ).toLocaleString()}
      </Typography>
    ),
  },


  {
    field:
      "Stockpile",

    headerName:
      "Stockpile",

    align:
      "right",

    render: (row) => (
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          whiteSpace:
            "nowrap",
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {Number(
          row.Stockpile ?? 0
        ).toLocaleString()}
      </Typography>
    ),
  },


  {
    field:
      "scenario_id",

    headerName:
      "Scenario",

    render: (row) => (
      <Typography
        variant="body2"
      >
        {row.scenario_id ??
          "—"}
      </Typography>
    ),
  },
];


/**
 * ==========================================================
 * FILTERS
 * ==========================================================
 */

const filterConfigs:
  FilterConfig[] = [
    {
      name:
        "scenario",

      label:
        "Scenario",

      options: [
        {
          label:
            "Actual",

          value:
            "actual",
        },

        {
          label:
            "Hot & Dry",

          value:
            "weather_hot_dry",
        },

        {
          label:
            "Hot & Wet",

          value:
            "weather_hot_wet",
        },

        {
          label:
            "Cold & Dry",

          value:
            "weather_cold_dry",
        },

        {
          label:
            "Cold & Wet",

          value:
            "weather_cold_wet",
        },
      ],
    },
  ];


/**
 * ==========================================================
 * COMPONENT
 * ==========================================================
 */

const RecentForecasts =
  () => {

    const {
      horizon,
      entityId,
    } =
      useForecastContext();


    const [
      records,
      setRecords,
    ] =
      useState<
        ForecastRecord[]
      >([]);


    const [
      searchTerm,
      setSearchTerm,
    ] =
      useState("");


    const [
      filters,
      setFilters,
    ] =
      useState<
        Record<
          string,
          string
        >
      >({});


    const [
      loading,
      setLoading,
    ] =
      useState(true);


    /**
     * ======================================================
     * LOAD BACKEND DATA
     * ======================================================
     */

    useEffect(() => {

      let mounted =
        true;


      const loadData =
        async () => {

          try {

            setLoading(
              true
            );


            const data =
              await forecastService.getForecastResults(
                {
                  horizon,
                  entityId,
                  scenario:
                    "actual",
                  metric:
                    "burn",
                }
              );


            if (
              mounted
            ) {
              setRecords(
                data
              );
            }

          } catch (
            error
          ) {

            console.error(
              "[RecentForecasts] Failed to load records:",
              error
            );


            if (
              mounted
            ) {
              setRecords(
                []
              );
            }

          } finally {

            if (
              mounted
            ) {
              setLoading(
                false
              );
            }
          }
        };


      loadData();


      return () => {
        mounted =
          false;
      };

    }, [
      horizon,
      entityId,
    ]);


    /**
     * ======================================================
     * FILTER
     * ======================================================
     */

    const filteredData =
      useMemo(
        () => {

          return records.filter(
            (
              record
            ) => {

              const search =
                searchTerm
                  .toLowerCase()
                  .trim();


              const matchesSearch =
                !search ||
                record.entity_id
                  .toLowerCase()
                  .includes(
                    search
                  ) ||
                record.event_date
                  .toLowerCase()
                  .includes(
                    search
                  );


              const matchesScenario =
                !filters.scenario ||
                record.scenario_id ===
                  filters.scenario;


              return (
                matchesSearch &&
                matchesScenario
              );
            }
          );

        },
        [
          records,
          searchTerm,
          filters,
        ]
      );


    /**
     * ======================================================
     * RENDER
     * ======================================================
     */

    return (
      <AppCard
        sx={{
          overflow:
            "hidden !important",
        }}
      >

        <CardHeader
          title=
            "Recent Forecasts"

          subtitle=
            "Forecast records from the backend"
        />


        <FilterBar
          filters={
            filterConfigs
          }

          onFilterChange={
            setFilters
          }

          searchPlaceholder=
            "Search by station or date..."

          onSearchChange={
            setSearchTerm
          }
        />


        {loading ? (

          <Stack
            alignItems="center"
            py={5}
          >

            <Typography
              color=
                "text.secondary"
            >
              Loading forecast records...
            </Typography>

          </Stack>

        ) : (

          <DataTable<ForecastRecord>
            columns={
              columns
            }

            rows={
              filteredData
            }

            emptyMessage=
              "No forecasts match your filters."
          />

        )}

      </AppCard>
    );
  };


export default RecentForecasts;