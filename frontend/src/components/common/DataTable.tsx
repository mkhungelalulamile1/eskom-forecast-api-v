import React from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export interface Column<T> {
  field: keyof T;
  headerName: string;
  width?: number;
  align?: "left" | "center" | "right";
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey?: (row: T) => React.Key;
    emptyMessage?: string;
}

export default function DataTable<T extends object>({
  columns,
  rows,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        borderRadius: 0,
        boxShadow: "none",
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={String(column.field)}
                align={column.align ?? "left"}
                width={column.width}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                >
                  {column.headerName}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Box py={6}>
                  <Typography
                    align="center"
                    color="text.secondary"
                  >
                    {emptyMessage}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow
                hover
                key={rowIndex}
              >
                {columns.map((column) => (
                  <TableCell
                    key={String(column.field)}
                    align={column.align ?? "left"}
                  >
                    {column.render
                      ? column.render(row)
                      : String(
                          row[column.field] ?? ""
                        )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}