import {
  Button,
} from "@mui/material";

import {
  FileDownloadRounded,
} from "@mui/icons-material";

import {
  ForecastFilters,
  ForecastRecord,
} from "../types/forecast.types";

import {
  useForecastChart,
} from "../hooks/useForecast";


/**
 * =====================================================
 * EXPORT FORECAST
 * =====================================================
 *
 * Exports the currently selected forecast:
 *
 * - Horizon
 * - Power station
 * - Scenario
 *
 * Includes:
 *
 * - Entity
 * - Date
 * - Step
 * - Burn
 * - Supply
 * - Stockpile
 */

interface ExportForecastProps {
  filters: ForecastFilters;
}


const ExportForecast = ({
  filters,
}: ExportForecastProps) => {

  const {
    data,
    isLoading,
  } = useForecastChart(
    filters
  );


  const records:
    ForecastRecord[] =
      data ?? [];


  /**
   * =====================================================
   * CSV ESCAPE
   * =====================================================
   */

  const escapeCsvValue = (
    value: unknown
  ): string => {

    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }


    const stringValue =
      String(value);


    /*
     * Wrap values containing:
     *
     * - commas
     * - quotes
     * - new lines
     */

    if (
      /[",\n\r]/.test(
        stringValue
      )
    ) {

      return `"${stringValue.replace(
        /"/g,
        '""'
      )}"`;

    }


    return stringValue;
  };


  /**
   * =====================================================
   * EXPORT
   * =====================================================
   */

  const handleExport = () => {

    if (
      records.length === 0
    ) {
      return;
    }


    const header = [
      "Entity",
      "Date",
      "Step",
      "Burn",
      "Supply",
      "Stockpile",
    ];


    const rows =
      records.map(
        (
          record: ForecastRecord
        ) => [

          escapeCsvValue(
            record.entity_id
          ),

          escapeCsvValue(
            record.event_date
          ),

          escapeCsvValue(
            record.horizon_step
          ),

          escapeCsvValue(
            record.Input !== undefined &&
            record.Input !== null
              ? record.Input.toFixed(3)
              : ""
          ),

          escapeCsvValue(
            record.Replenishment !== undefined &&
            record.Replenishment !== null
              ? record.Replenishment.toFixed(3)
              : ""
          ),

          escapeCsvValue(
            record.Stockpile !== undefined &&
            record.Stockpile !== null
              ? record.Stockpile.toFixed(3)
              : ""
          ),

        ].join(",")
      );


    const csv = [
      header.join(","),
      ...rows,
    ].join("\n");


    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href = url;


    link.download =
      `eskom-forecast-${filters.entityId}-${filters.horizon}-${filters.scenario}.csv`;


    document.body.appendChild(
      link
    );


    link.click();


    document.body.removeChild(
      link
    );


    URL.revokeObjectURL(
      url
    );
  };


  /**
   * =====================================================
   * BUTTON
   * =====================================================
   */

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={
        <FileDownloadRounded />
      }
      onClick={
        handleExport
      }
      disabled={
        isLoading ||
        records.length === 0
      }
      sx={{
        flexShrink: 0,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      Export CSV
    </Button>
  );
};


export default ExportForecast;