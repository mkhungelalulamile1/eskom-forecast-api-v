import { PaletteOptions } from "@mui/material/styles";

/**
 * =====================================================
 * ESKOM BRAND PALETTE (LIGHT + DARK)
 * =====================================================
 * Aligned with Eskom's corporate identity (eskom.co.za):
 * deep navy `#003896` + bright sky `#1890d7`.
 *
 * `getPalette(mode)` returns a light or dark variant so the whole
 * dashboard can switch themes from the header toggle.
 */
export type ThemeMode = "light" | "dark";

const LIGHT: PaletteOptions = {
  mode: "light",

  primary: {
    main: "#0054A6",
    light: "#1890d7",
    dark: "#003896",
    contrastText: "#FFFFFF",
  },

  secondary: {
    main: "#1890d7",
    light: "#4FB5EA",
    dark: "#0E6396",
    contrastText: "#FFFFFF",
  },

  success: {
    main: "#1E9E6A",
    light: "#34C48B",
    dark: "#14764F",
    contrastText: "#FFFFFF",
  },

  warning: {
    main: "#E8A008",
    light: "#F5BC2C",
    dark: "#B87A05",
    contrastText: "#3A2B00",
  },

  error: {
    main: "#D64545",
    light: "#EB6B6B",
    dark: "#A62E2E",
    contrastText: "#FFFFFF",
  },

  info: {
    main: "#1890d7",
    light: "#4FB5EA",
    dark: "#0E6396",
    contrastText: "#FFFFFF",
  },

  background: {
    default: "#F1F5FB",
    paper: "#FFFFFF",
  },

  text: {
    primary: "#10203E",
    secondary: "#5B6B84",
    disabled: "#9AA8BE",
  },

  divider: "#E4EAF3",

  grey: {
    50: "#F8FAFD",
    100: "#F1F5FB",
    200: "#E4EAF3",
    300: "#CBD6E5",
    400: "#9AA8BE",
    500: "#6C7B93",
    600: "#4E5E76",
    700: "#3B4A60",
    800: "#24314A",
    900: "#10203E",
  },
};

const DARK: PaletteOptions = {
  mode: "dark",

  primary: {
    main: "#4FB5EA",
    light: "#6FC5F0",
    dark: "#1890d7",
    contrastText: "#08152C",
  },

  secondary: {
    main: "#1890d7",
    light: "#4FB5EA",
    dark: "#0E6396",
    contrastText: "#FFFFFF",
  },

  success: {
    main: "#34C48B",
    light: "#5AD9A6",
    dark: "#1E9E6A",
    contrastText: "#06241A",
  },

  warning: {
    main: "#F5BC2C",
    light: "#FFD25E",
    dark: "#E8A008",
    contrastText: "#241B00",
  },

  error: {
    main: "#EB6B6B",
    light: "#FF8F8F",
    dark: "#D64545",
    contrastText: "#2A0E0E",
  },

  info: {
    main: "#4FB5EA",
    light: "#6FC5F0",
    dark: "#1890d7",
    contrastText: "#08152C",
  },

  background: {
    default: "#0B1626",
    paper: "#121F36",
  },

  text: {
    primary: "#E7EDF7",
    secondary: "#A7B4CC",
    disabled: "#5B6B84",
  },

  divider: "#22334F",

  grey: {
    50: "#17233A",
    100: "#1B2A45",
    200: "#22334F",
    300: "#33466B",
    400: "#4E5E76",
    500: "#7C8BA6",
    600: "#9AA8BE",
    700: "#B4C0D4",
    800: "#CBD6E5",
    900: "#E7EDF7",
  },
};

export const getPalette = (mode: ThemeMode): PaletteOptions =>
  mode === "dark" ? DARK : LIGHT;

const palette = getPalette("light");
export default palette;
