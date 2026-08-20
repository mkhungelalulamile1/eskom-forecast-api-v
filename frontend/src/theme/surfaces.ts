import { Theme } from "@mui/material/styles";

/**
 * =====================================================
 * SURFACE TOKENS
 * =====================================================
 *
 * The dashboard used to hard-code light surfaces (`#FFFFFF`,
 * `#F4F6F9`, `#EEF4FF`, …) inside component `sx` props. In dark mode
 * those tiles rendered as solid white blocks with near-white text on
 * top, which made the values impossible to read.
 *
 * These helpers replace the hard-coded values with theme-aware ones:
 *
 *  - fills are TRANSPARENT in dark mode (never white)
 *  - the tile is defined by a light/white hairline border instead
 *  - text falls back to the muted dark-mode ink (#A7B4CC)
 *
 * Every helper is a `(theme) => value` function so it can be dropped
 * straight into a `sx` property, e.g.
 *
 *     sx={{ bgcolor: "transparent", border: softBorder, color: softText }}
 */

/**
 * A style value that may be a plain CSS string or a theme callback.
 * MUI's `sx` resolves both, so tokens can be stored in data arrays.
 */
export type SurfaceValue = string | ((t: Theme) => string);

/** Muted body ink used on transparent tiles in dark mode. */
export const SOFT_TEXT_DARK = "#A7B4CC";

/** Strong ink for headings/values. */
export const strongText = (t: Theme): string =>
  t.palette.mode === "dark" ? "#E7EDF7" : "#172B4D";

/** Muted ink for labels, captions and secondary values. */
export const softText = (t: Theme): string =>
  t.palette.mode === "dark" ? SOFT_TEXT_DARK : "#536176";

/** Border colour for transparent tiles — white-ish in dark mode. */
export const softBorderColor = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : "#E2E7EF";

/** Full `border` shorthand for transparent tiles. */
export const softBorder = (t: Theme): string =>
  `1px solid ${softBorderColor(t)}`;

/** Subtler hairline, for internal dividers/rows inside a card. */
export const hairlineColor = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(255,255,255,0.16)" : "#EEF2F7";

/** Full `border` shorthand for internal hairlines. */
export const hairline = (t: Theme): string =>
  `1px solid ${hairlineColor(t)}`;

/**
 * Neutral tile fill. Transparent in dark mode (with a border supplying
 * the shape), very light grey in light mode.
 */
export const neutralFill = (t: Theme): string =>
  t.palette.mode === "dark" ? "transparent" : "#F7F9FC";

/** Slightly raised neutral fill (table heads, hovered rows). */
export const raisedFill = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "#F4F6F9";

/* -----------------------------------------------------
 * Page-level cards
 * --------------------------------------------------- */

/**
 * Fill for a top-level dashboard card.
 *
 * Dark mode uses a transparent fill so no panel reads as a solid
 * white/grey block; the card is described by its border instead.
 */
export const cardFill = (t: Theme): string =>
  t.palette.mode === "dark" ? "transparent" : t.palette.background.paper;

/** Border colour for a top-level dashboard card. */
export const cardBorderColor = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(255,255,255,0.55)" : t.palette.divider;

/* -----------------------------------------------------
 * Semantic tints — keep the hue, drop the white.
 * --------------------------------------------------- */

export const infoTint = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(79,181,234,0.16)" : "#EEF4FF";

export const successTint = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(52,196,139,0.16)" : "#ECFDF3";

export const warningTint = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(245,188,44,0.16)" : "#FFF8ED";

export const errorTint = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(235,107,107,0.16)" : "#FDECEC";

/* -----------------------------------------------------
 * Semantic ink — readable on both themes.
 * --------------------------------------------------- */

export const infoInk = (t: Theme): string =>
  t.palette.mode === "dark" ? "#6FC5F0" : "#1264FF";

export const successInk = (t: Theme): string =>
  t.palette.mode === "dark" ? "#5AD9A6" : "#2E7D32";

export const warningInk = (t: Theme): string =>
  t.palette.mode === "dark" ? "#FFD25E" : "#C45F00";

export const errorInk = (t: Theme): string =>
  t.palette.mode === "dark" ? "#FF8F8F" : "#D32F2F";

/** Chart grid/axis ink so labels stay legible on dark backgrounds. */
export const axisInk = (t: Theme): string =>
  t.palette.mode === "dark" ? SOFT_TEXT_DARK : "#68758A";

export const gridInk = (t: Theme): string =>
  t.palette.mode === "dark" ? "rgba(255,255,255,0.14)" : "#E4EAF3";
