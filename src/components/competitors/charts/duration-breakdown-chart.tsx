"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface DurationBreakdownData {
  label: string;
  count: number;
  percentage: number;
}

interface DurationBreakdownChartProps {
  data: DurationBreakdownData[];
}

/**
 * Horizontal bar chart for video duration distribution.
 *
 * Shows 4 duration buckets (< 15s, 15-60s, 1-3min, 3+min) as
 * horizontal bars with percentage labels.
 */
export function DurationBreakdownChart({ data }: DurationBreakdownChartProps) {
  const allZero = data.every((d) => d.count === 0);

  if (allZero) {
    return (
      <div className="flex items-center justify-center h-[200px] text-foreground-muted text-sm">
        No duration data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide tick={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={60}
          fontSize={12}
          stroke="var(--color-foreground-muted)"
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v} videos`} />}
          cursor={false}
        />
        <Bar
          dataKey="count"
          fill="var(--color-accent)"
          barSize={20}
          radius={[0, 6, 6, 0]}
          isAnimationActive={false}
          label={({ x, y, width, height, index }) => {
            const pct = data[index as number]?.percentage ?? 0;
            return (
              <text
                x={(x as number) + (width as number) + 6}
                y={(y as number) + (height as number) / 2}
                fill="var(--color-foreground-muted)"
                fontSize={11}
                dominantBaseline="central"
              >
                {pct}%
              </text>
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
