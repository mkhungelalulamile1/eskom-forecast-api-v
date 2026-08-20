import React from "react";
import { Box } from "@mui/material";

/**
 * =====================================================
 * METRIC SPARKLINE
 * =====================================================
 * NEW (added in redesign): a lightweight dependency-free
 * SVG sparkline used inside KPI stat cards to show the
 * mini trend of a metric over the horizon.
 */
interface MetricSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

const MetricSparkline = ({
  data,
  color = "#0054A6",
  width = 120,
  height = 40,
  fill = true,
}: MetricSparklineProps) => {
  if (!data || data.length < 2) {
    return <Box sx={{ height, width }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${points[0][0]},${height} ${line} ${points[points.length - 1][0]},${height}`;

  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#${gradientId})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default MetricSparkline;
