"use client";

import {
  CompetitorCard,
  type CompetitorCardData,
} from "@/components/competitors/competitor-card";

/**
 * Shape of the nested Supabase response from
 * user_competitors joined with competitor_profiles.
 */
interface CompetitorRow {
  id: string;
  competitor_id: string;
  added_at: string | null;
  competitor_profiles: {
    id: string;
    tiktok_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    follower_count: number | null;
    following_count: number | null;
    heart_count: number | null;
    video_count: number | null;
    last_scraped_at: string | null;
    scrape_status: string | null;
  } | null;
}

interface CompetitorsClientProps {
  competitors: CompetitorRow[];
  snapshotMap: Record<
    string,
    { follower_count: number; snapshot_date: string }[]
  >;
  videosMap: Record<
    string,
    {
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
    }[]
  >;
}

/**
 * Client component rendering the competitor card grid.
 *
 * Flattens the nested Supabase join response into CompetitorCardData objects
 * and renders a responsive grid (1/2/3 columns).
 */
export function CompetitorsClient({
  competitors,
  snapshotMap,
  videosMap,
}: CompetitorsClientProps) {
  // Flatten nested Supabase response into card data
  const cards: CompetitorCardData[] = competitors
    .filter((row) => row.competitor_profiles !== null)
    .map((row) => {
      const profile = row.competitor_profiles!;
      return {
        id: profile.id,
        tiktok_handle: profile.tiktok_handle,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        follower_count: profile.follower_count,
        heart_count: profile.heart_count,
        video_count: profile.video_count,
        snapshots: snapshotMap[profile.id] ?? [],
        videos: videosMap[profile.id] ?? [],
      };
    });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-foreground">Competitors</h1>
        {/* View toggle placeholder -- added in Plan 02 */}
      </div>

      {/* Card grid or empty state */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-foreground-muted text-sm">
            No competitors yet. Add your first competitor to start tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <CompetitorCard key={card.id} data={card} />
          ))}
        </div>
      )}
    </div>
  );
}
