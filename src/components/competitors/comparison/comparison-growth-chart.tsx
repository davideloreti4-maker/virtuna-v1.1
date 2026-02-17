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

interface ComparisonGrowthChartProps {
  seriesA: { date: string; followers: number }[];
  seriesB: { date: string; followers: number }[];
  handleA: string;
  handleB: string;
}

/**
 * Dual-line area chart overlaying two follower growth trends.
 *
 * Merges both time series by date into a unified data array.
 * Uses coral gradient for A and green gradient for B.
 */
export function ComparisonGrowthChart({
  seriesA,
  seriesB,
  handleA,
  handleB,
}: ComparisonGrowthChartProps) {
  // Check minimum data
  if (seriesA.length < 2 && seriesB.length < 2) {
    return (
      <div className="flex items-center justify-center h-[300px] border border-white/[0.06] rounded-xl">
        <p className="text-sm text-foreground-muted">Not enough data</p>
      </div>
    );
  }

  // Merge both series by date
  const dateMap = new Map<
    string,
    { followersA: number | null; followersB: number | null }
  >();

  for (const point of seriesA) {
    dateMap.set(point.date, { followersA: point.followers, followersB: null });
  }

  for (const point of seriesB) {
    const existing = dateMap.get(point.date);
    if (existing) {
      existing.followersB = point.followers;
    } else {
      dateMap.set(point.date, { followersA: null, followersB: point.followers });
    }
  }

  // Sort by date ascending
  const mergedData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      followersA: values.followersA,
      followersB: values.followersB,
    }));

  return (
    <div className="border border-white/[0.06] rounded-xl p-4">
      <p className="text-sm font-medium text-foreground mb-4">
        Growth Comparison
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={mergedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="compGradA" x1="0" y1="0" x2="0" y2="1">
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
            <linearGradient id="compGradB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
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
            dataKey="followersA"
            name={`@${handleA}`}
            stroke="var(--color-accent)"
            fill="url(#compGradA)"
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls={true}
          />
          <Area
            type="monotone"
            dataKey="followersB"
            name={`@${handleB}`}
            stroke="#82ca9d"
            fill="url(#compGradB)"
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls={true}
          />
        </AreaChart>
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
