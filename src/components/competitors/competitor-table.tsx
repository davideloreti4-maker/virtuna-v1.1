"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { type CompetitorCardData } from "@/components/competitors/competitor-card";
import {
  formatCount,
  computeGrowthVelocity,
  computeEngagementRate,
  computePostingCadence,
} from "@/lib/competitors-utils";
import { StaleIndicator } from "@/components/competitors/stale-indicator";
import { CompetitorSparkline } from "@/components/competitors/competitor-sparkline";
import { GrowthDelta } from "@/components/competitors/growth-delta";

type SortKey = "followers" | "likes" | "videos" | "engagement" | "growth" | "cadence";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

const keyMap: Record<SortKey, string> = {
  followers: "_followers",
  likes: "_likes",
  videos: "_videos",
  engagement: "_engagement",
  growth: "_growth",
  cadence: "_cadence",
};

interface CompetitorTableProps {
  competitors: CompetitorCardData[];
}

/**
 * Sortable leaderboard table of tracked competitors.
 *
 * Displays competitor data in a tabular format with clickable column headers
 * for sorting by Followers, Likes, Videos, Engagement Rate, Growth, and Cadence.
 * Default sort: followers descending. Derived metrics pre-computed once via useMemo.
 */
export function CompetitorTable({ competitors }: CompetitorTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ key: "followers", dir: "desc" });

  // Pre-compute derived metrics once (independent of sort state)
  const enrichedCompetitors = useMemo(
    () =>
      competitors.map((c) => ({
        ...c,
        _followers: c.follower_count ?? 0,
        _likes: c.heart_count ?? 0,
        _videos: c.video_count ?? 0,
        _engagement: computeEngagementRate(c.videos) ?? 0,
        _growth: computeGrowthVelocity(c.snapshots)?.percentage ?? 0,
        _cadence: computePostingCadence(c.videos)?.postsPerWeek ?? 0,
      })),
    [competitors]
  );

  // Sort enriched array based on current sort state
  const sortedCompetitors = useMemo(() => {
    const field = keyMap[sort.key];
    return [...enrichedCompetitors].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[field] as number;
      const valB = (b as Record<string, unknown>)[field] as number;
      return sort.dir === "asc" ? valA - valB : valB - valA;
    });
  }, [enrichedCompetitors, sort]);

  function handleSort(sortKey: SortKey) {
    setSort((prev) =>
      prev.key === sortKey
        ? { key: sortKey, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key: sortKey, dir: "desc" }
    );
  }

  function SortableHeader({
    label,
    sortKey,
    align = "right",
  }: {
    label: string;
    sortKey: SortKey;
    align?: "left" | "right";
  }) {
    const isActive = sort.key === sortKey;
    return (
      <th
        className={`py-3 px-4 font-medium text-foreground-muted text-xs cursor-pointer select-none transition-colors hover:text-foreground ${
          align === "left" ? "text-left" : "text-right"
        }`}
        onClick={() => handleSort(sortKey)}
      >
        <span
          className={`inline-flex items-center gap-1 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          {label}
          {isActive ? (
            sort.dir === "desc" ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronUp size={12} />
            )
          ) : (
            <ArrowUpDown size={12} className="opacity-40" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="relative">
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
              Creator
            </th>
            <SortableHeader label="Followers" sortKey="followers" />
            <SortableHeader label="Likes" sortKey="likes" />
            <SortableHeader label="Videos" sortKey="videos" />
            <SortableHeader label="Eng. Rate" sortKey="engagement" />
            <SortableHeader label="Growth" sortKey="growth" align="left" />
            <SortableHeader label="Cadence" sortKey="cadence" />
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Trend
            </th>
            <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCompetitors.map((s) => {
            const velocity = computeGrowthVelocity(s.snapshots);
            const sparklineData = s.snapshots.map((snap) => ({
              value: snap.follower_count,
            }));
            const fallbackInitials = s.tiktok_handle
              .slice(0, 2)
              .toUpperCase();

            return (
              <tr
                key={s.id}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] cursor-pointer"
                onClick={() => router.push(`/competitors/${s.tiktok_handle}`)}
              >
                {/* Creator */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={s.avatar_url ?? undefined}
                      alt={s.tiktok_handle}
                      fallback={fallbackInitials}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        @{s.tiktok_handle}
                      </p>
                      {s.display_name && (
                        <p className="text-xs text-foreground-muted truncate">
                          {s.display_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Followers */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(s.follower_count)}
                </td>

                {/* Likes */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(s.heart_count)}
                </td>

                {/* Videos */}
                <td className="py-3 px-4 text-right text-foreground">
                  {formatCount(s.video_count)}
                </td>

                {/* Eng. Rate */}
                <td className="py-3 px-4 text-right text-foreground">
                  {s._engagement > 0 ? `${s._engagement}%` : "--"}
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

                {/* Cadence */}
                <td className="py-3 px-4 text-right text-foreground">
                  {s._cadence > 0 ? `${s._cadence}/wk` : "--"}
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

                {/* Status */}
                <td className="py-3 px-4 text-right">
                  {s.scrape_status === "failed" ? (
                    <span className="text-[10px] text-red-400 font-medium">Failed</span>
                  ) : (
                    <StaleIndicator lastScrapedAt={s.last_scraped_at} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {/* Mobile scroll hint */}
    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--color-background)] to-transparent pointer-events-none md:hidden" />
    </div>
  );
}
