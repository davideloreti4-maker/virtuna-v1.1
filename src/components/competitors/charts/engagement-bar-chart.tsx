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
import { ChartTooltip } from "@/components/competitors/charts/chart-tooltip";

interface EngagementBarChartProps {
  data: {
    caption: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number | null;
  }[];
}

/**
 * BarChart for per-video engagement breakdown (likes, comments, shares).
 *
 * Displays "No video data available" when data is empty.
 * Uses stacked bars with coral accent at varying opacities.
 */
export function EngagementBarChart({ data }: EngagementBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-foreground-muted">
          No video data available
        </p>
      </div>
    );
  }

  return (
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
          dataKey="caption"
          fontSize={11}
          stroke="var(--color-foreground-muted)"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) =>
            v.length > 15 ? v.slice(0, 15) + "..." : v
          }
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="var(--color-foreground-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          dataKey="likes"
          stackId="engagement"
          fill="var(--color-accent)"
          isAnimationActive={false}
        />
        <Bar
          dataKey="comments"
          stackId="engagement"
          fill="var(--color-accent)"
          fillOpacity={0.6}
          isAnimationActive={false}
        />
        <Bar
          dataKey="shares"
          stackId="engagement"
          fill="var(--color-accent)"
          fillOpacity={0.3}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
