"use client";

import { motion } from "motion/react";
import type { MotionValue } from "motion/react";
import {
  CurrencyDollar,
  Wallet,
  ArrowCircleUp,
  CalendarBlank,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react";

import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCurrency, formatNumber } from "@/lib/affiliate-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EarningsStatCardsProps {
  stats: {
    totalEarned: number;
    pending: number;
    paidOut: number;
    thisMonth: number;
  };
}

// ---------------------------------------------------------------------------
// StatCard (internal -- not exported)
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  change: number;
  isCurrency?: boolean;
}

function StatCard({
  icon,
  label,
  value,
  change,
  isCurrency = true,
}: StatCardProps): React.JSX.Element {
  const display: MotionValue<string> = useCountUp({
    to: value,
    format: isCurrency ? formatCurrency : (v) => formatNumber(v),
  });

  const isPositive = change >= 0;

  return (
    <Card className="p-5">
      {/* Icon + label */}
      <div className="mb-3 flex items-center gap-2 text-foreground-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>

      {/* Animated value -- MUST use motion.span for MotionValue rendering */}
      <motion.span className="block text-2xl font-semibold text-foreground">
        {display}
      </motion.span>

      {/* Percentage change indicator */}
      <div
        className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${
          isPositive ? "text-success" : "text-error"
        }`}
      >
        {isPositive ? (
          <ArrowUp size={12} weight="bold" />
        ) : (
          <ArrowDown size={12} weight="bold" />
        )}
        <span>
          {isPositive ? "+" : ""}
          {change}%
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// EarningsStatCards Component
// ---------------------------------------------------------------------------

/**
 * EarningsStatCards -- 2x2 grid of animated stat cards for the Earnings tab.
 *
 * Displays Total Earned, Pending, Paid Out, and This Month with count-up
 * animation and green/red percentage change indicators.
 *
 * Percentage change values are hardcoded (mock data does not include them).
 * These will be derived from real API data when backend integration happens.
 *
 * @example
 * ```tsx
 * <EarningsStatCards
 *   stats={{
 *     totalEarned: 24750,
 *     pending: 3200,
 *     paidOut: 21550,
 *     thisMonth: 4820,
 *   }}
 * />
 * ```
 */
export function EarningsStatCards({
  stats,
}: EarningsStatCardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        icon={<CurrencyDollar size={18} weight="fill" />}
        label="Total Earned"
        value={stats.totalEarned}
        change={12.5}
      />
      <StatCard
        icon={<Wallet size={18} weight="fill" />}
        label="Pending"
        value={stats.pending}
        change={-3.2}
      />
      <StatCard
        icon={<ArrowCircleUp size={18} weight="fill" />}
        label="Paid Out"
        value={stats.paidOut}
        change={8.7}
      />
      <StatCard
        icon={<CalendarBlank size={18} weight="fill" />}
        label="This Month"
        value={stats.thisMonth}
        change={24.1}
      />
    </div>
  );
}
