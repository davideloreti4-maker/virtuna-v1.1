"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCount } from "@/lib/competitors-utils";
import { ChartTooltip } from "@/components/competitors/charts/chart-tooltip";

interface ComparisonBarChartProps {
  data: { metric: string; valueA: number; valueB: number }[];
  handleA: string;
  handleB: string;
}

/**
 * Grouped bar chart comparing metrics side by side.
 *
 * Uses coral for competitor A and green for competitor B.
 * No stacking -- bars are grouped for direct visual comparison.
 */
export function ComparisonBarChart({
  data,
  handleA,
  handleB,
}: ComparisonBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] border border-white/[0.06] rounded-xl">
        <p className="text-sm text-foreground-muted">No data to compare</p>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-xl p-4">
      <p className="text-sm font-medium text-foreground mb-4">
        Metric Comparison
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="metric"
            stroke="var(--color-foreground-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--color-foreground-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCount(v)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => formatCount(v)} />}
          />
          <Bar
            dataKey="valueA"
            name={`@${handleA}`}
            fill="var(--color-accent)"
            isAnimationActive={false}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="valueB"
            name={`@${handleB}`}
            fill="#82ca9d"
            isAnimationActive={false}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          <span className="text-xs text-foreground-muted">@{handleA}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "#82ca9d" }}
          />
          <span className="text-xs text-foreground-muted">@{handleB}</span>
        </div>
      </div>
    </div>
  );
}
