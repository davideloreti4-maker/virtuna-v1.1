/**
 * creator-read.ts — the server read of a followed creator's page (`/competitors/<handle>`).
 *
 * Who the caller follows is the Watchlist's read (`getWatchlistData`) and nothing else: the page is
 * found among its rows, by the profile handle a row carries. So a page exists exactly for the Watchlist
 * rows that carry a profile; a creator the caller does not follow, or follows only by a tracked handle
 * with no profile behind it, has none ("not on your watchlist"). A Watchlist read that could not tell
 * whom the caller follows is the page's failure, never that answer.
 *
 * ⚠️ The profile row is read on the SERVICE client, for the reason `watchlist-reads.ts` gives:
 * `competitor_profiles` RLS exposes only profiles linked through `user_competitors`, and a creator
 * added through the channel ingest has a profile with no such link. The read is by the id of a row the
 * Watchlist's read already returned for this caller, so the service client only enriches a creator the
 * caller follows. The videos and the audiences are read on the caller's own RLS-scoped client.
 *
 * A failed profile, videos or audiences read throws; a thrown read is the page's failure too (`CreatorRead`).
 */

import { listAudiences } from "@/lib/audience/audience-repo";
import { creatorPageOf, type CreatorProfileRow, type CreatorRead, type CreatorVideoRow } from "@/lib/discover-next/creator";
import { creatorHandleOf } from "@/lib/discover-next/discover-view";
import { createServiceClient } from "@/lib/supabase/service";
import type { createClient } from "@/lib/supabase/server";

import { getWatchlistData } from "./watchlist-reads";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const PROFILE_COLUMNS =
  "id, tiktok_handle, display_name, bio, avatar_url, follower_count, heart_count, video_count, last_scraped_at, scrape_status";
const VIDEO_FIELDS =
  "platform_video_id, video_url, description, views, likes, comments, posted_at, outlier_multiplier, baseline_label";
/** The ingest keeps these three in `metadata` (`lib/channels/ingest.ts`); `->>` hands them on as text. */
const VIDEO_METADATA =
  "cover_url:metadata->>cover_url, ingested_at:metadata->>ingested_at, baseline_views:metadata->>baseline_views";
// One literal type, so supabase-js types the rows from the columns (a misspelt column fails the build).
export const VIDEO_COLUMNS = `${VIDEO_FIELDS}, ${VIDEO_METADATA}` as const;

export async function getCreatorPage(supabase: ServerClient, rawHandle: string, now: Date): Promise<CreatorRead> {
  const handle = creatorHandleOf(rawHandle);
  if (!handle) return { state: "gone" };
  const watchlist = await getWatchlistData(supabase);
  // Whom the caller follows could not be told: the page's failure, never "not on your watchlist".
  if (watchlist.incomplete) return { state: "failed" };
  const source = watchlist.sources.find((s) => s.profileHandle !== null && creatorHandleOf(s.profileHandle) === handle);
  if (!source) return { state: "gone" };

  // A row with a profile is keyed by the profile's id (`watchlist-reads.ts`, `key: p.id`).
  const handles = [...new Set([creatorHandleOf(source.profileHandle), creatorHandleOf(source.mergedFrom)].filter(Boolean))];
  const [profileRes, videosRes, audiences] = await Promise.all([
    createServiceClient().from("competitor_profiles").select(PROFILE_COLUMNS).eq("id", source.key).maybeSingle(),
    supabase
      .from("scraped_videos")
      .select(VIDEO_COLUMNS)
      .eq("platform", "tiktok")
      .in("creator_handle", handles)
      .not("outlier_multiplier", "is", null),
    listAudiences(supabase),
  ]);
  if (profileRes.error) throw new Error(`creator profile read failed: ${profileRes.error.message}`);
  if (videosRes.error) throw new Error(`creator videos read failed: ${videosRes.error.message}`);
  const profile = profileRes.data as CreatorProfileRow | null;
  // Removed between the two reads.
  if (!profile) return { state: "gone" };
  const videos = (videosRes.data ?? []) as CreatorVideoRow[];
  return { state: "ready", creator: creatorPageOf({ source, profile, videos, audiences, now }) };
}
