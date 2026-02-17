"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { EarningSource, MonthlyEarning } from "@/types/brand-deals";
import { useEarnings } from "@/hooks/queries";

import { EarningsBreakdownList } from "./earnings-breakdown-list";
import { EarningsChart } from "./earnings-chart";
import { EarningsPeriodSelector, type Period } from "./earnings-period-selector";
import { EarningsStatCards } from "./earnings-stat-cards";

// ---------------------------------------------------------------------------
// Period Filtering
// ---------------------------------------------------------------------------

interface EarningsData {
  totalEarned: number;
  pendingPayout: number;
  thisMonth: number;
  monthlyBreakdown: MonthlyEarning[];
  topSources: EarningSource[];
}

function filterEarningsByPeriod(summary: EarningsData, period: Period) {
  const breakdown = summary.monthlyBreakdown;

  const chartData =
    period === "7d"
      ? breakdown.slice(-1)
      : period === "30d"
        ? breakdown.slice(-2)
        : period === "90d"
          ? breakdown.slice(-3)
          : breakdown;

  const total = breakdown.reduce((s, d) => s + d.amount, 0);
  const periodTotal = chartData.reduce((s, d) => s + d.amount, 0);
  const ratio = total > 0 ? periodTotal / total : 1;

  const paidOut = summary.totalEarned - summary.pendingPayout;

  return {
    chartData,
    stats: {
      totalEarned: Math.round(summary.totalEarned * ratio),
      pending: Math.round(summary.pendingPayout * ratio),
      paidOut: Math.round(paidOut * ratio),
      thisMonth: summary.thisMonth,
    },
    sources: summary.topSources,
  };
}

// ---------------------------------------------------------------------------
// EarningsTab Component
// ---------------------------------------------------------------------------

export function EarningsTab(): React.JSX.Element {
  const { data, isLoading } = useEarnings();
  const [period, setPeriod] = useState<Period>("30d");

  const earningsData = useMemo((): EarningsData => {
    if (!data) {
      return {
        totalEarned: 0,
        pendingPayout: 0,
        thisMonth: 0,
        monthlyBreakdown: [],
        topSources: [],
      };
    }
    return {
      totalEarned: data.totalEarned,
      pendingPayout: data.pendingPayout,
      thisMonth: data.thisMonth,
      monthlyBreakdown: data.monthlyBreakdown,
      topSources: data.topSources,
    };
  }, [data]);

  const filtered = useMemo(
    () => filterEarningsByPeriod(earningsData, period),
    [earningsData, period],
  );

  if (isLoading) return <EarningsTabSkeleton />;

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
