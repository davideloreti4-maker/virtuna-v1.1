"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";

interface CompetitorSparklineProps {
  data: { value: number }[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Zero-chrome sparkline mini-chart for displaying follower trends.
 *
 * Renders a simple line chart at 80x32px with no axes, grid, or tooltip.
 * Returns null if fewer than 2 data points.
 */
export function CompetitorSparkline({
  data,
  color = "var(--color-accent)",
  width = 80,
  height = 32,
}: CompetitorSparklineProps) {
  if (data.length < 2) return null;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            dot={false}
            isAnimationActive={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
