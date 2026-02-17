"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCount } from "@/lib/competitors-utils";
import { ChartTooltip } from "@/components/competitors/charts/chart-tooltip";

interface FollowerGrowthChartProps {
  data: { date: string; followers: number }[];
}

/**
 * AreaChart with coral gradient fill for follower time-series.
 *
 * Displays "Not enough data yet" when fewer than 2 data points.
 * Uses CSS custom properties for dark theme integration.
 */
export function FollowerGrowthChart({ data }: FollowerGrowthChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-foreground-muted">Not enough data yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-accent)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-accent)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
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
        <Area
          type="monotone"
          dataKey="followers"
          stroke="var(--color-accent)"
          fill="url(#followerGradient)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
