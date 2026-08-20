/**
 * =====================================================
 * FORMATTING UTILITIES
 * =====================================================
 * NEW (added in redesign): shared number/date formatters so
 * every redesigned panel renders figures consistently.
 */

/** Format a number with up to `fractionDigits` decimals, spaces as thousands sep. */
export const formatNumber = (
  value: number | null | undefined,
  fractionDigits = 2
): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  })
    .format(Number(value))
    .replace(/,/g, " ");
};

/** Compact format for axis labels / big values (12.7 → "12.7", 12800 → "12.8k"). */
export const formatCompact = (
  value: number | null | undefined,
  fractionDigits = 1
): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(fractionDigits)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(fractionDigits)}k`;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
  }).format(n);
};

/** Format an ISO date (YYYY-MM-DD) to a friendly short date. */
export const formatDate = (
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
): string => {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", opts);
};

/** Format a full timestamp to a local time (e.g. "3:05 PM"). */
export const formatTime = (date: Date | string | null | undefined): string => {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/** Human-friendly relative time ("just now", "5m ago"). */
export const formatRelative = (
  date: Date | string | null | undefined
): string => {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};
