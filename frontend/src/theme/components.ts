import { Components, Theme } from "@mui/material/styles";

import { ThemeMode } from "./palette";

/**
 * =====================================================
 * GLOBAL MUI COMPONENT STYLING
 * =====================================================
 * Theme-aware defaults. `getComponents(mode)` returns border/text
 * tones tuned for light or dark so every MUI control follows the
 * active theme consistently.
 */
const BORDER = { light: "#CBD6E5", dark: "#2A3E60" } as const;
const HEAD_BG = { light: "#F6F9FD", dark: "#16243C" } as const;
const CELL_BORDER = { light: "#F0F4FA", dark: "#1B2A45" } as const;

export const getComponents = (
  mode: ThemeMode
): Components<Omit<Theme, "components">> => {
  const border = BORDER[mode];
  const headBg = HEAD_BG[mode];
  const cellBorder = CELL_BORDER[mode];

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mode === "dark" ? "#0B1626" : "#F1F5FB",
          color: mode === "dark" ? "#E7EDF7" : "#10203E",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        "*": { boxSizing: "border-box" },
        "#root": { minHeight: "100vh" },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: "none",
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          /*
           * Dark mode cards are transparent with a light hairline
           * border instead of a filled panel, so no card renders as
           * a solid block that swallows the values inside it.
           */
          backgroundColor: mode === "dark" ? "transparent" : "#FFFFFF",
          borderRadius: 12,
          border: `1px solid ${
            mode === "dark" ? "rgba(255,255,255,0.55)" : "#E4EAF3"
          }`,
          boxShadow: mode === "dark"
            ? "0 8px 24px rgba(0,0,0,0.35)"
            : "0 8px 24px rgba(16,32,62,0.05)",
          overflow: "hidden",
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, padding: "9px 18px", fontWeight: 700, minHeight: 42 },
        contained: {
          boxShadow: "0 6px 16px rgba(0,84,166,0.22)",
          "&:hover": { boxShadow: "0 8px 20px rgba(0,84,166,0.28)" },
        },
        outlined: { borderWidth: 1.5, "&:hover": { borderWidth: 1.5 } },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          "& fieldset": { borderColor: border },
          "&:hover fieldset": { borderColor: "#1890d7" },
          "&.Mui-focused fieldset": { borderWidth: 2, borderColor: "#0054A6" },
        },
      },
    },

    MuiTextField: {
      defaultProps: { size: "small", variant: "outlined", fullWidth: true },
    },

    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 12 } },
    },

    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: headBg } },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: mode === "dark" ? "#B4C0D4" : "#3B4A60",
          borderBottom: `1px solid ${mode === "dark" ? "#22334F" : "#E4EAF3"}`,
          fontSize: "0.78rem",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        },
        root: {
          paddingTop: 14,
          paddingBottom: 14,
          borderBottom: `1px solid ${cellBorder}`,
          fontSize: "0.875rem",
        },
      },
    },

    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: 8,
          border: "none",
          background: "transparent",
        },
        grouped: {
          border: `1px solid ${border} !important`,
          borderRadius: "10px !important",
          marginLeft: "0 !important",
        },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
          textTransform: "none",
          color: mode === "dark" ? "#A7B4CC" : "#3B4A60",
          backgroundColor: "transparent",
          "&:hover": {
            backgroundColor:
              mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,84,166,0.06)",
          },
          "&.Mui-selected": {
            backgroundColor:
              mode === "dark" ? "rgba(24,144,215,0.24)" : "#E8F2FC",
            color: mode === "dark" ? "#E7EDF7" : "#0054A6",
            borderColor: mode === "dark" ? "rgba(79,181,234,0.7)" : "#0054A6",
            "&:hover": {
              backgroundColor:
                mode === "dark" ? "rgba(24,144,215,0.32)" : "#DCEBFB",
            },
          },
          "&.Mui-disabled": {
            color: mode === "dark" ? "#A7B4CC" : "#5B6B84",
            borderColor: border,
          },
          "&.Mui-selected.Mui-disabled": {
            color: mode === "dark" ? "#E7EDF7" : "#0054A6",
            backgroundColor:
              mode === "dark" ? "rgba(24,144,215,0.24)" : "#E8F2FC",
          },
        },
      },
    },

    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
    MuiAvatar: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDivider: {
      styleOverrides: { root: { borderColor: mode === "dark" ? "#22334F" : "#E4EAF3" } },
    },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: "0.8rem" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
    MuiDrawer: { styleOverrides: { paper: { border: "none" } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          "&.Mui-selected": {
            backgroundColor: mode === "dark" ? "rgba(24,144,215,0.22)" : "#E8F2FC",
            "&:hover": { backgroundColor: mode === "dark" ? "rgba(24,144,215,0.22)" : "#E8F2FC" },
          },
        },
      },
    },
  };
};

const components = getComponents("light");
export default components;
