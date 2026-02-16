"use client";

import { Avatar } from "@/components/ui/avatar";
import { type CompetitorCardData } from "@/components/competitors/competitor-card";
import { formatCount, computeGrowthVelocity, computeEngagementRate } from "@/lib/competitors-utils";
import { CompetitorSparkline } from "@/components/competitors/competitor-sparkline";
import { GrowthDelta } from "@/components/competitors/growth-delta";

interface CompetitorTableProps {
  competitors: CompetitorCardData[];
}

/**
 * Table/leaderboard view of tracked competitors.
 *
 * Displays competitor data in a tabular format with columns for
 * Creator, Followers, Likes, Videos, Engagement Rate, Growth, and Trend sparkline.
 * Styled with Raycast dark theme conventions.
 */
export function CompetitorTable({ competitors }: CompetitorTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
              Creator
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Followers
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Likes
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Videos
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Eng. Rate
            </th>
            <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
              Growth
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((c) => {
            const velocity = computeGrowthVelocity(c.snapshots);
            const engagementRate = computeEngagementRate(c.videos);
            const sparklineData = c.snapshots.map((s) => ({
              value: s.follower_count,
            }));
            const fallbackInitials = c.tiktok_handle.slice(0, 2).toUpperCase();

            return (
              <tr
                key={c.id}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] cursor-pointer"
              >
                {/* Creator */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={c.avatar_url ?? undefined}
                      alt={c.tiktok_handle}
                      fallback={fallbackInitials}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        @{c.tiktok_handle}
                      </p>
                      {c.display_name && (
                        <p className="text-xs text-foreground-muted truncate">
                          {c.display_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Followers */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(c.follower_count)}
                </td>

                {/* Likes */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(c.heart_count)}
                </td>

                {/* Videos */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(c.video_count)}
                </td>

                {/* Eng. Rate */}
                <td className="py-3 px-4 text-right text-foreground">
                  {engagementRate !== null ? `${engagementRate}%` : "--"}
                </td>

                {/* Growth */}
                <td className="py-3 px-4">
                  {velocity ? (
                    <GrowthDelta
                      percentage={velocity.percentage}
                      direction={velocity.direction}
                    />
                  ) : (
                    <span className="text-foreground-muted">--</span>
                  )}
                </td>

                {/* Trend */}
                <td className="py-3 px-4 text-right">
                  {sparklineData.length >= 2 ? (
                    <div className="flex justify-end">
                      <CompetitorSparkline
                        data={sparklineData}
                        width={64}
                        height={24}
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
