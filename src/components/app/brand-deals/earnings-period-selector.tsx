"use client";

import { motion } from "motion/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Period = "7d" | "30d" | "90d" | "all";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All Time" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EarningsPeriodSelectorProps {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}

export function EarningsPeriodSelector({
  activePeriod,
  onPeriodChange,
}: EarningsPeriodSelectorProps): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated/50 p-1">
      {PERIODS.map((period) => {
        const isActive = activePeriod === period.value;

        return (
          <button
            key={period.value}
            type="button"
            onClick={() => onPeriodChange(period.value)}
            className="relative rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isActive && (
              <motion.div
                layoutId="earnings-period-pill"
                className="absolute inset-0 z-0 rounded-full border border-white/10 bg-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span
              className={`relative z-10 ${
                isActive
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground-secondary"
              }`}
            >
              {period.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
