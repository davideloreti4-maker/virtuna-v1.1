"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/affiliate-utils";
import type { MonthlyEarning } from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

/**
 * Solid opaque dark tooltip -- NO glassmorphism, NO backdrop-filter.
 * Matches Raycast dialog/card pattern: solid bg, inset shadow highlight.
 */
function EarningsTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>): React.JSX.Element | null {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border border-white/[0.06] px-3 py-2"
      style={{
        background: "#222326",
        boxShadow:
          "rgba(255,255,255,0.1) 0 1px 0 0 inset, 0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart Component
// ---------------------------------------------------------------------------

export interface EarningsChartProps {
  data: MonthlyEarning[];
}

export function EarningsChart({ data }: EarningsChartProps): React.JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <defs>
          <linearGradient
            id="earnings-area-gradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="5%" stopColor="#FF7F50" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#FF7F50" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke="rgba(255, 255, 255, 0.04)"
        />

        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
          tickLine={false}
        />

        <YAxis
          tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}K`}
          width={50}
        />

        <Tooltip content={EarningsTooltip} cursor={false} />

        <Area
          type="monotone"
          dataKey="amount"
          stroke="#FF7F50"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#earnings-area-gradient)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
