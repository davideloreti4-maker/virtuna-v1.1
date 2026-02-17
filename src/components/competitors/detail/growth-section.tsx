"use client";

import { formatCount } from "@/lib/competitors-utils";
import { FollowerGrowthChart } from "@/components/competitors/charts/follower-growth-chart";
import { GrowthDelta } from "@/components/competitors/growth-delta";

interface GrowthSectionProps {
  chartData: { date: string; followers: number }[];
  averageViews: number | null;
  growthVelocity: {
    percentage: number;
    direction: "up" | "down" | "flat";
  } | null;
}

/**
 * Growth analytics section with follower chart and stat cards.
 *
 * Displays follower growth over time (AreaChart) alongside
 * average views per video and weekly growth rate stats.
 */
export function GrowthSection({
  chartData,
  averageViews,
  growthVelocity,
}: GrowthSectionProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-4">Growth</h2>
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Follower growth chart */}
        <div className="border border-white/[0.06] rounded-xl p-4">
          <FollowerGrowthChart data={chartData} />
        </div>

        {/* Right: Stat cards */}
        <div className="flex flex-col gap-4">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-foreground-muted">Avg Views/Video</p>
            <p className="text-xl font-semibold text-foreground">
              {averageViews !== null ? formatCount(averageViews) : "--"}
            </p>
          </div>
          <div className="border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-foreground-muted">Weekly Growth</p>
            <div className="mt-1">
              {growthVelocity ? (
                <GrowthDelta
                  percentage={growthVelocity.percentage}
                  direction={growthVelocity.direction}
                />
              ) : (
                <p className="text-xl font-semibold text-foreground">--</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
