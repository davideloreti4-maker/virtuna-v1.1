"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <Tabs value={activePeriod} onValueChange={(v) => onPeriodChange(v as Period)}>
      <TabsList>
        {PERIODS.map((p) => (
          <TabsTrigger key={p.value} value={p.value} size="sm">
            {p.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
