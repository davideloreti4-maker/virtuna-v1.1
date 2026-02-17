"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  formatCount,
  computeGrowthVelocity,
  computeEngagementRate,
} from "@/lib/competitors-utils";
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
  snapshots: { follower_count: number; snapshot_date: string }[];
  videos: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    posted_at: string | null;
  }[];
}

interface CompetitorCardProps {
  data: CompetitorCardData;
}

/**
 * Competitor card displaying key stats, sparkline trend, and growth velocity.
 *
 * Composes Card, Avatar, Badge, CompetitorSparkline, and GrowthDelta components.
 * Handles missing data gracefully with "--" fallbacks.
 */
export function CompetitorCard({ data }: CompetitorCardProps) {
  const velocity = computeGrowthVelocity(data.snapshots);
  const engagementRate = computeEngagementRate(data.videos);
  const sparklineData = data.snapshots.map((s) => ({
    value: s.follower_count,
  }));

  const fallbackInitials = data.tiktok_handle.slice(0, 2).toUpperCase();

  return (
    <Link href={`/competitors/${data.tiktok_handle}`}>
      <Card className="cursor-pointer">
        <CardContent className="p-4">
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
            </div>
          </div>

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
        </CardContent>
      </Card>
    </Link>
  );
}
