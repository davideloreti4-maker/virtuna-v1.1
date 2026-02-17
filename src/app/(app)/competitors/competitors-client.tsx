"use client";

import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCompetitorDialog } from "@/components/competitors/add-competitor-dialog";
import {
  CompetitorCard,
  type CompetitorCardData,
} from "@/components/competitors/competitor-card";
import { CompetitorTable } from "@/components/competitors/competitor-table";
import { CompetitorEmptyState } from "@/components/competitors/competitor-empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompetitorsStore } from "@/stores/competitors-store";

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
      posted_at: string | null;
    }[]
  >;
}

/**
 * Client component rendering the competitor dashboard.
 *
 * Flattens the nested Supabase join response into CompetitorCardData objects
 * and renders either a responsive card grid or table/leaderboard view based
 * on the view mode stored in Zustand (persisted to localStorage).
 *
 * Shows CompetitorEmptyState when no competitors are tracked.
 */
export function CompetitorsClient({
  competitors,
  snapshotMap,
  videosMap,
}: CompetitorsClientProps) {
  const { viewMode, setViewMode } = useCompetitorsStore();

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
        last_scraped_at: profile.last_scraped_at,
        scrape_status: profile.scrape_status,
        snapshots: snapshotMap[profile.id] ?? [],
        videos: videosMap[profile.id] ?? [],
      };
    });

  return (
    <div className="space-y-6">
      {/* Page header with view toggle and compare link */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-foreground">Competitors</h1>
        <div className="flex items-center gap-3">
          <AddCompetitorDialog
            trigger={
              <Button variant="primary" size="sm">
                <Plus size={14} className="mr-1.5" />
                Add Competitor
              </Button>
            }
          />
          {cards.length >= 2 && (
            <Link
              href="/competitors/compare"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground border border-white/[0.06] hover:bg-white/[0.02] rounded-lg transition-colors"
            >
              <ArrowLeftRight size={14} />
              Compare
            </Link>
          )}
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "grid" | "table")}
          >
            <TabsList>
              <TabsTrigger value="grid" size="sm">
                Grid
              </TabsTrigger>
              <TabsTrigger value="table" size="sm">
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content: empty state, card grid, or table */}
      {cards.length === 0 ? (
        <CompetitorEmptyState />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <CompetitorCard key={card.id} data={card} />
          ))}
        </div>
      ) : (
        <CompetitorTable competitors={cards} />
      )}
    </div>
  );
}
