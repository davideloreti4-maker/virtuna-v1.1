"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import {
  formatCount,
  computeGrowthVelocity,
  computeEngagementRate,
} from "@/lib/competitors-utils";
import { RemoveCompetitorButton } from "@/components/competitors/remove-competitor-button";
import { StaleIndicator } from "@/components/competitors/stale-indicator";
import { CompetitorSparkline } from "@/components/competitors/competitor-sparkline";
import { GrowthDelta } from "@/components/competitors/growth-delta";

export interface CompetitorCardData {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  heart_count: number | null;
  video_count: number | null;
  last_scraped_at: string | null;
  scrape_status: string | null;
  snapshots: { follower_count: number; snapshot_date: string }[];
  videos: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    posted_at: string | null;
  }[];
  /** Top rehosted video covers (durable) for the card's thumbnail strip; empty until scraped. */
  covers: string[];
}

interface CompetitorCardProps {
  data: CompetitorCardData;
}

/**
 * Competitor card displaying key stats, sparkline trend, and growth velocity.
 *
 * Hybrid-elevation matte tile (2026-07-05): shares the sibling FeedCard shell so the
 * Competitors grid sits flush beside the Feed grid — a resting floor that lifts on hover
 * (.elev-lift), 6% hairline that brightens to 12% on hover, matte elevated surface. No
 * glass / glow / coral (near-zero accent). Handles missing data with "--" fallbacks.
 */
export function CompetitorCard({ data }: CompetitorCardProps) {
  const velocity = computeGrowthVelocity(data.snapshots);
  const engagementRate = computeEngagementRate(data.videos);
  const sparklineData = data.snapshots.map((s) => ({
    value: s.follower_count,
  }));

  const fallbackInitials = data.tiktok_handle.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/competitors/${data.tiktok_handle}`}
      className="elev-lift group relative block overflow-hidden rounded-xl border border-white/[0.06] bg-background-elevated p-4 hover:border-white/[0.12]"
    >
      {/* Remove button (visible on hover) */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <RemoveCompetitorButton competitorId={data.id} handle={data.tiktok_handle} />
      </div>

      {/* Top row: Avatar + Handle */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar
          src={data.avatar_url ?? undefined}
          alt={data.tiktok_handle}
          fallback={fallbackInitials}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            @{data.tiktok_handle}
          </p>
          {data.display_name && (
            <p className="text-xs text-foreground-muted truncate">
              {data.display_name}
            </p>
          )}
          <StaleIndicator lastScrapedAt={data.last_scraped_at} />
          {data.scrape_status === "failed" && (
            <span className="text-[10px] text-error font-medium">Scrape failed</span>
          )}
        </div>
      </div>

      {/* Top-videos cover strip — real thumbnails so the tab shows videos, not just stats.
          Durable rehosted covers; hidden entirely until the competitor is scraped with covers. */}
      {data.covers.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {data.covers.map((cover, i) => (
            <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-[linear-gradient(165deg,#312f2b,#181715)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- rehosted cover, external bucket */}
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Stats grid: 3 columns */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <p className="text-xs text-foreground-muted">Followers</p>
          <p className="text-sm font-medium text-foreground">
            {formatCount(data.follower_count)}
          </p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted">Total Likes</p>
          <p className="text-sm font-medium text-foreground">
            {formatCount(data.heart_count)}
          </p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted">Videos</p>
          <p className="text-sm font-medium text-foreground">
            {formatCount(data.video_count)}
          </p>
        </div>
      </div>

      {/* Bottom row: Growth delta + Sparkline + Engagement rate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {velocity && (
            <GrowthDelta
              percentage={velocity.percentage}
              direction={velocity.direction}
            />
          )}
          <div>
            <p className="text-xs text-foreground-muted">Eng. Rate</p>
            <p className="text-sm font-medium text-foreground">
              {engagementRate !== null ? `${engagementRate}%` : "--"}
            </p>
          </div>
        </div>
        <CompetitorSparkline data={sparklineData} />
      </div>
    </Link>
  );
}
