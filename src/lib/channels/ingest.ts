/**
 * channels/ingest.ts — Discover Feed Phase 1.1 per-channel ingest core.
 *
 * Scrape ONE channel's profile bundle (scrapeProfileBundle) and persist it into the
 * SHARED corpus: upsert competitor_profiles (the channel store) + upsert the bundle's
 * videos into scraped_videos with the measured outlier/engagement signals
 * (computeChannelMetrics). Idempotent + cache-gated: a competitor_profiles row whose
 * last_scraped_at is within CHANNEL_RESCRAPE_HOURS skips the (paid) re-scrape and
 * returns the cached profile — the freshness gate is the per-channel cost control.
 *
 * Shared-across-users by construction (Architecture decision 1): ingest is user-agnostic
 * (no user_id) — the per-user watchlist coupling (tracked_accounts) is the caller's job
 * (the Channels page composes ingest + POST /api/tracked-accounts).
 *
 * Service-role writes only: scraped_videos is public-read / service-write, and the
 * competitor_profiles upsert mirrors app/actions/competitors/add.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import type { ProfileData, VideoData } from "@/lib/scraping";
import {
  computeChannelMetrics,
  CHANNEL_BASELINE_LABEL,
} from "./compute-channel-metrics";

/** Re-scrape gate: a channel scraped within this window is served from cache (no paid re-scrape). */
export const CHANNEL_RESCRAPE_HOURS = 24;

const MS_PER_HOUR = 3_600_000;

/** A trimmed channel profile echoed back to the caller (the Channels watchlist tile reads it). */
export interface IngestedChannelProfile {
  handle: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  videoCount: number;
}

export interface ChannelIngestResult {
  /** 'scraped' — a fresh scrape ran + rows were upserted; 'cached' — within the freshness window, skipped. */
  status: "scraped" | "cached";
  handle: string;
  profile: IngestedChannelProfile;
  /** Videos upserted into scraped_videos this call (0 on the cached path). */
  videosUpserted: number;
}

/** Thrown when the channel can't be scraped. The route maps `not_found` → 404, else → 502. */
export class ChannelIngestError extends Error {
  readonly kind: "not_found" | "scrape_failed";
  constructor(kind: "not_found" | "scrape_failed", message: string, cause?: unknown) {
    super(message);
    this.name = "ChannelIngestError";
    this.kind = kind;
    if (cause !== undefined) this.cause = cause;
  }
}

interface IngestOptions {
  /** Bypass the freshness gate (force a re-scrape even when last_scraped_at is recent).
   *  Internal-only — NOT exposed via the API body, so a client can't burn Apify budget. */
  force?: boolean;
}

/**
 * Ingest a single channel by NORMALIZED handle (no '@', lowercased — the caller normalizes,
 * so creator_handle matches tracked_accounts.handle for the feed's watched-tab join).
 */
export async function ingestChannel(
  handle: string,
  opts: IngestOptions = {},
): Promise<ChannelIngestResult> {
  const service = createServiceClient();

  // ── (1) Freshness gate — competitor_profiles.last_scraped_at within the window ──
  const { data: existing } = await service
    .from("competitor_profiles")
    .select("display_name, avatar_url, follower_count, video_count, last_scraped_at")
    .eq("tiktok_handle", handle)
    .maybeSingle();

  if (!opts.force && existing?.last_scraped_at) {
    const ageHours =
      (Date.now() - new Date(existing.last_scraped_at).getTime()) / MS_PER_HOUR;
    if (ageHours < CHANNEL_RESCRAPE_HOURS) {
      return {
        status: "cached",
        handle,
        profile: {
          handle,
          displayName: existing.display_name ?? handle,
          avatarUrl: existing.avatar_url ?? "",
          followerCount: existing.follower_count ?? 0,
          videoCount: existing.video_count ?? 0,
        },
        videosUpserted: 0,
      };
    }
  }

  // ── (2) Scrape the profile bundle (profile + N videos + free subtitle links) ──
  const scraper = createScrapingProvider();
  if (!scraper.scrapeProfileBundle) {
    throw new ChannelIngestError("scrape_failed", "scraping provider has no scrapeProfileBundle");
  }

  let profile: ProfileData;
  let videos: VideoData[];
  try {
    ({ profile, videos } = await scraper.scrapeProfileBundle(handle));
  } catch (cause) {
    // scrapeProfileBundle throws "No profile data returned for handle" for an empty/invalid handle.
    const message = cause instanceof Error ? cause.message : String(cause);
    const kind = /no profile data/i.test(message) ? "not_found" : "scrape_failed";
    throw new ChannelIngestError(kind, message, cause);
  }

  // ── (3) Persist: channel store + measured-signal videos into the shared corpus ──
  const nowIso = new Date().toISOString();
  await upsertChannelProfile(service, handle, profile, nowIso);
  const videosUpserted = await upsertChannelVideos(service, handle, videos, nowIso);

  return {
    status: "scraped",
    handle,
    profile: {
      handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      followerCount: profile.followerCount,
      videoCount: profile.videoCount,
    },
    videosUpserted,
  };
}

/** Upsert the channel profile row (mirrors actions/competitors/add.ts; onConflict tiktok_handle). */
async function upsertChannelProfile(
  service: SupabaseClient,
  handle: string,
  profile: ProfileData,
  nowIso: string,
): Promise<void> {
  const { error } = await service.from("competitor_profiles").upsert(
    {
      // store the NORMALIZED handle so re-ingest hits the same row + the feed join aligns
      tiktok_handle: handle,
      display_name: profile.displayName,
      bio: profile.bio,
      avatar_url: profile.avatarUrl,
      verified: profile.verified,
      follower_count: profile.followerCount,
      following_count: profile.followingCount,
      heart_count: profile.heartCount,
      video_count: profile.videoCount,
      last_scraped_at: nowIso,
      scrape_status: "success",
    },
    { onConflict: "tiktok_handle" },
  );
  if (error) {
    throw new ChannelIngestError(
      "scrape_failed",
      `competitor_profiles upsert failed: ${error.message}`,
    );
  }
}

/**
 * Compute measured signals + upsert the bundle's videos into scraped_videos
 * (onConflict platform,platform_video_id — the canonical key, mirrors webhooks/apify).
 *
 * The payload is intentionally PARTIAL: it omits embedding / primary_niche, so a re-scrape
 * of a row the trending pipeline already enriched leaves those columns untouched (PostgREST
 * upsert only SETs provided columns) — the inverse of the webhook's WR-05 embedding regression.
 */
async function upsertChannelVideos(
  service: SupabaseClient,
  handle: string,
  videos: VideoData[],
  nowIso: string,
): Promise<number> {
  if (videos.length === 0) return 0;

  const { baseline, metrics } = computeChannelMetrics(videos);

  const rows = videos.map((v, i) => ({
    platform: "tiktok" as const,
    platform_video_id: v.platformVideoId,
    video_url: v.videoUrl,
    author: handle,
    author_url: `https://www.tiktok.com/@${handle}`,
    // NORMALIZED handle — the watched-tab join key (= tracked_accounts.handle).
    creator_handle: handle,
    description: v.caption,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    hashtags: v.hashtags,
    duration_seconds: v.durationSeconds,
    posted_at: v.postedAt.toISOString(),
    // measured signals (Architecture decision 2)
    outlier_multiplier: metrics[i]!.outlierMultiplier,
    baseline_label: CHANNEL_BASELINE_LABEL,
    engagement_rate: metrics[i]!.engagementRate,
    metadata: {
      source: "channel_ingest",
      ingested_at: nowIso,
      baseline_views: baseline,
      // ephemeral TikTok-CDN cover (display-only; may expire) — kept for the Phase 2 tile.
      cover_url: v.coverUrl ?? null,
      subtitle_url: v.subtitleUrl ?? null,
    },
  }));

  const { error } = await service
    .from("scraped_videos")
    .upsert(rows, { onConflict: "platform,platform_video_id", ignoreDuplicates: false });
  if (error) {
    throw new ChannelIngestError(
      "scrape_failed",
      `scraped_videos upsert failed: ${error.message}`,
    );
  }
  return rows.length;
}
