"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { EarningsSummary } from "@/types/brand-deals";
import { MOCK_EARNINGS_SUMMARY } from "@/lib/mock-brand-deals";

import { EarningsBreakdownList } from "./earnings-breakdown-list";
import { EarningsChart } from "./earnings-chart";
import { EarningsPeriodSelector, type Period } from "./earnings-period-selector";
import { EarningsStatCards } from "./earnings-stat-cards";

// ---------------------------------------------------------------------------
// Period Filtering
// ---------------------------------------------------------------------------

/**
 * Derives period-filtered chart data and proportionally scaled stat values
 * from the full earnings summary.
 *
 * For mock data with 6 monthly entries:
 * - "7d"  → last 1 month
 * - "30d" → last 2 months
 * - "90d" → last 3 months
 * - "all" → all 6 months
 */
function filterEarningsByPeriod(summary: EarningsSummary, period: Period) {
  const breakdown = summary.monthlyBreakdown;

  const chartData =
    period === "7d"
      ? breakdown.slice(-1)
      : period === "30d"
        ? breakdown.slice(-2)
        : period === "90d"
          ? breakdown.slice(-3)
          : breakdown;

  // Scale stat values proportionally for shorter periods
  const total = breakdown.reduce((s, d) => s + d.amount, 0);
  const periodTotal = chartData.reduce((s, d) => s + d.amount, 0);
  const ratio = total > 0 ? periodTotal / total : 1;

  return {
    chartData,
    stats: {
      totalEarned: Math.round(summary.totalEarned * ratio),
      pending: Math.round(summary.pendingPayout * ratio),
      paidOut: Math.round(summary.paidOut * ratio),
      thisMonth: summary.thisMonth, // always current month
    },
    sources: summary.topSources, // same sources for all periods (mock simplification)
  };
}

// ---------------------------------------------------------------------------
// EarningsTab Component
// ---------------------------------------------------------------------------

/**
 * EarningsTab -- Container component for the Earnings tab.
 *
 * Manages period state (default 30D) and derives filtered data from
 * mock fixtures. Renders EarningsStatCards, EarningsPeriodSelector,
 * EarningsChart, and EarningsBreakdownList as a cohesive section.
 *
 * Period changes trigger a 200ms fade out/in transition on the chart
 * via AnimatePresence.
 *
 * @example
 * ```tsx
 * <EarningsTab />
 * ```
 */
export function EarningsTab(): React.JSX.Element {
  const [period, setPeriod] = useState<Period>("30d");
  const filtered = useMemo(
    () => filterEarningsByPeriod(MOCK_EARNINGS_SUMMARY, period),
    [period],
  );

  return (
    <div className="space-y-6">
      <EarningsStatCards stats={filtered.stats} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Earnings Over Time
          </h3>
          <EarningsPeriodSelector
            activePeriod={period}
            onPeriodChange={setPeriod}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EarningsChart data={filtered.chartData} />
          </motion.div>
        </AnimatePresence>
      </div>

      <EarningsBreakdownList sources={filtered.sources} />
    </div>
  );
}
