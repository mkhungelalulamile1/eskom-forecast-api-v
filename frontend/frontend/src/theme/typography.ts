/**
 * =====================================================
 * TYPOGRAPHY
 * =====================================================
 * Redesigned to match Eskom's public site type system
 * (Roboto for body + Roboto Slab for display headings).
 * Inter remains the primary font for crisp UI text.
 */
const typography = {
  fontFamily: [
    "Inter",
    "Roboto",
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    '"Helvetica Neue"',
    "Arial",
    "sans-serif",
  ].join(","),

  h1: {
    fontSize: "2.5rem",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
  },

  h2: {
    fontSize: "2.1rem",
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },

  h3: {
    fontSize: "1.7rem",
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
  },

  h4: {
    fontSize: "1.45rem",
    fontWeight: 800,
    lineHeight: 1.3,
  },

  h5: {
    fontSize: "1.25rem",
    fontWeight: 700,
    lineHeight: 1.35,
  },

  h6: {
    fontSize: "1.05rem",
    fontWeight: 700,
    lineHeight: 1.4,
  },

  subtitle1: {
    fontSize: "1rem",
    fontWeight: 600,
  },

  subtitle2: {
    fontSize: "0.875rem",
    fontWeight: 600,
  },

  body1: {
    fontSize: "1rem",
    lineHeight: 1.65,
  },

  body2: {
    fontSize: "0.875rem",
    lineHeight: 1.6,
  },

  button: {
    textTransform: "none" as const,
    fontWeight: 700,
    fontSize: "0.9rem",
  },

  caption: {
    fontSize: "0.75rem",
  },

  overline: {
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
  },
};

export default typography;
