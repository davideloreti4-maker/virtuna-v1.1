"use client";

import { cn } from "@/lib/utils";

interface ComparisonMetricCardProps {
  label: string;
  valueA: string;
  valueB: string;
  rawA: number;
  rawB: number;
  handleA: string;
  handleB: string;
}

/**
 * Side-by-side metric card with winner highlighting.
 *
 * The side with the higher raw value gets accent color;
 * the loser stays default foreground. Equal values use default.
 */
export function ComparisonMetricCard({
  label,
  valueA,
  valueB,
  rawA,
  rawB,
  handleA,
  handleB,
}: ComparisonMetricCardProps) {
  const aWins = rawA > rawB;
  const bWins = rawB > rawA;

  return (
    <div className="border border-white/[0.06] rounded-xl p-4">
      <p className="text-xs text-foreground-muted mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        {/* Side A */}
        <div>
          <p
            className={cn(
              "text-lg font-semibold",
              aWins ? "text-accent" : "text-foreground"
            )}
          >
            {valueA}
          </p>
          <p className="text-xs text-foreground-muted truncate">@{handleA}</p>
        </div>
        {/* Side B */}
        <div className="text-right">
          <p
            className={cn(
              "text-lg font-semibold",
              bWins ? "text-accent" : "text-foreground"
            )}
          >
            {valueB}
          </p>
          <p className="text-xs text-foreground-muted truncate">@{handleB}</p>
        </div>
      </div>
    </div>
  );
}
