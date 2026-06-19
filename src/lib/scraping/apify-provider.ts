import { ApifyClient } from "apify-client";
import {
  apifyVideoSchema,
  apidojoProfileSchema,
  apidojoVideoSchema,
} from "@/lib/schemas/competitor";
import type {
  ProfileData,
  VideoData,
  ScrapingProvider,
  ResolvedVideo,
} from "./types";
import { IngestError } from "./types";

// ── Discover actors (Phase 08, D-12) — apidojo split actors ──────────────────
// scrapeVideos / scrapeProfile pull search/profile result sets for Discover and run
// on apidojo. apidojo returns a materially different field shape than clockworks
// (Pitfall 1) — the apidojo*Schema remaps it onto VideoData/ProfileData.
const DISCOVER_PROFILE_ACTOR = "apidojo/tiktok-profile-scraper";
const DISCOVER_VIDEO_ACTOR = "apidojo/tiktok-scraper";

// ── Single-post METRICS actor (Phase 10) — apidojo single-post tier ──────────
// apidojo/tiktok-scraper-api is a DISTINCT actor from apidojo/tiktok-scraper (the
// all-in-one Discover actor, which forbids single posts / requires ≥10 posts/query).
// tiktok-scraper-api exposes a "Single Post Query" tier: startUrls:[<post url>] returns
// exactly ONE video with the full public metric block (views/likes/comments/shares/
// bookmarks). Output shape matches the apidojo Discover actor → remap via apidojoVideoSchema
// (NOT clockworks apifyVideoSchema). We standardize single-URL metric capture on apidojo.
const SINGLE_POST_METRICS_ACTOR = "apidojo/tiktok-scraper-api";

// ── Remix rehost actor — LEFT on the single-URL-capable clockworks actor ──────
// resolveVideoUrl passes one `postURLs:[url]` + `shouldDownloadVideos:true` for the
// Remix rehost — it needs the downloadable KV mp4 that clockworks resolves, which the
// metrics-only apidojo actor does NOT return. The Remix media-resolution path stays on
// clockworks; only the Phase-10 METRICS capture moved to apidojo (above).
const VIDEO_ACTOR = "clockworks/tiktok-scraper";

/**
 * SSRF allowlist for resolved mp4 URLs.
 *
 * Derived from spike 2026-06-01:
 *   - api.apify.com          — confirmed: mediaUrls[0] is a private Apify KV-store record
 *   - apifyusercontent.com   — Apify public CDN (additive resilience)
 *   - tiktokcdn.com          — TikTok CDN suffix (fallback resilience)
 *   - tiktokcdn-us.com       — TikTok US CDN suffix (fallback resilience)
 *
 * All entries require HTTPS. Any non-matching host is rejected with ssrf_rejected.
 */
const SSRF_ALLOWLIST_SUFFIXES = [
  ".apify.com",
  ".apifyusercontent.com",
  ".tiktokcdn.com",
  ".tiktokcdn-us.com",
] as const;

/** Internal IP ranges and loopback that must never reach the fetcher. */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/i,
];

/**
 * Allowlisted host suffixes for a PASTED post URL (input to scrapeSinglePostMetrics).
 * The paste-URL is untrusted input (T-10-05 SSRF) — require HTTPS + a TikTok host
 * before it ever reaches the Apify actor. Distinct from the resolved-mp4 allowlist:
 * the input is a tiktok.com post page, not a CDN media URL.
 */
const POST_URL_ALLOWLIST_SUFFIXES = [
  ".tiktok.com",
  ".tiktokv.com",
] as const;

function isAllowedPostUrl(postUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(postUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(host))) return false;
  return POST_URL_ALLOWLIST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix),
  );
}

function isAllowedMp4Host(mp4Url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(mp4Url);
  } catch {
    return false;
  }

  // Require HTTPS
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname;

  // Reject private/internal IPs
  if (PRIVATE_IP_PATTERNS.some((re) => re.test(host))) return false;

  // Must match an allowlisted suffix
  return SSRF_ALLOWLIST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
}

/**
 * Remap one apidojo/tiktok-scraper item onto VideoData (Pitfall 1 mitigation).
 * Returns null (skipped) when the item fails to parse — mirrors the batch-skip
 * behaviour the clockworks path used. uploadedAt (ISO string) → postedAt (Date).
 */
export function remapApidojoVideo(item: unknown): VideoData | null {
  const result = apidojoVideoSchema.safeParse(item);
  if (!result.success) {
    console.warn(`[scraping] apidojo video validation failed:`, result.error.issues);
    return null;
  }

  const v = result.data;
  const postedAt = v.uploadedAt ? new Date(v.uploadedAt) : new Date();

  return {
    platformVideoId: v.id,
    videoUrl: v.postPage ?? v.webVideoUrl ?? "",
    caption: v.title,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    saves: v.bookmarks, // apidojo `bookmarks` is the save metric
    hashtags: v.hashtags.map((h) => (typeof h === "string" ? h : h.name)),
    durationSeconds: v.video?.duration ?? 0,
    // Guard an unparseable date string → fall back to now (never NaN postedAt).
    postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
  };
}

/** Remap one apidojo/tiktok-profile-scraper item onto ProfileData. */
export function remapApidojoProfile(item: unknown): ProfileData {
  const { channel } = apidojoProfileSchema.parse(item);
  return {
    handle: channel.username,
    displayName: channel.name,
    bio: channel.bio,
    avatarUrl: channel.avatar ?? "",
    verified: channel.verified,
    followerCount: channel.followers,
    followingCount: channel.following,
    heartCount: channel.hearts,
    videoCount: channel.videos,
  };
}

export class ApifyScrapingProvider implements ScrapingProvider {
  private client: ApifyClient;

  constructor(token?: string) {
    this.client = new ApifyClient({
      token: token ?? process.env.APIFY_TOKEN!,
    });
  }

  async scrapeProfile(handle: string): Promise<ProfileData> {
    const run = await this.client
      .actor(DISCOVER_PROFILE_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: 1 },
        { waitSecs: 60 },
      );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    return remapApidojoProfile(items[0]);
  }

  async scrapeVideos(handle: string, limit = 30): Promise<VideoData[]> {
    const run = await this.client
      .actor(DISCOVER_VIDEO_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: limit },
        { waitSecs: 120 },
      );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    return items
      .map((item) => remapApidojoVideo(item))
      .filter((v): v is VideoData => v !== null);
  }

  /**
   * Resolve ONE non-owned TikTok URL to a fetchable mp4 URL.
   *
   * Uses clockworks/tiktok-scraper with shouldDownloadVideos:true (single-URL mode).
   * The resolved URL is a private api.apify.com KV-store record (spike-confirmed).
   * The URL is validated against the SSRF allowlist before being returned.
   *
   * Throws IngestError on any failure class.
   */
  async resolveVideoUrl(url: string): Promise<ResolvedVideo> {
    let run: { defaultDatasetId: string };

    try {
      run = await this.client.actor(VIDEO_ACTOR).call(
        { postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: true },
        { waitSecs: 180 },
      );
    } catch (cause) {
      throw new IngestError("scrape_failed", url, cause);
    }

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    // Empty dataset — unexpected (actor returned no rows at all)
    if (items.length === 0) {
      throw new IngestError("empty_dataset", url);
    }

    const item = items[0] as Record<string, unknown>;

    // Spike-confirmed: deleted/private posts return count=1 with error/errorCode keys
    // Check this BEFORE attempting mediaUrls extraction.
    if (item.error !== undefined || item.errorCode !== undefined) {
      throw new IngestError("not_found", url);
    }

    // Parse the item via the extended schema to capture mediaUrls
    const parsed = apifyVideoSchema.safeParse(item);
    if (!parsed.success) {
      // Item present but doesn't parse — treat as no_media_url
      throw new IngestError("no_media_url", url);
    }

    const { mediaUrls, videoMeta } = parsed.data;

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new IngestError("no_media_url", url);
    }

    const mp4Url = mediaUrls[0];
    if (!mp4Url) {
      throw new IngestError("no_media_url", url);
    }

    // SSRF guard (T-01-04): validate the resolved host before returning.
    // Reject file://, non-HTTPS, internal IPs, and non-allowlisted hosts.
    if (!isAllowedMp4Host(mp4Url)) {
      throw new IngestError("ssrf_rejected", url);
    }

    return {
      mp4Url,
      durationSeconds: videoMeta?.duration ?? 0,
    };
  }

  /**
   * Scrape PUBLIC METRICS for ONE posted TikTok URL (outcome capture, FLYWHEEL-01).
   *
   * Single source = apidojo's `tiktok-scraper-api` "Single Post Query" tier: one
   * `startUrls:[url]` returns exactly ONE video with the full public metric block
   * (views/likes/comments/shares/bookmarks) and NO ≥10-post minimum. Remaps via the
   * apidojo `apidojoVideoSchema` (bookmarks→saves) through `remapApidojoVideo` — the
   * SAME schema the Discover apidojo actors use (Pitfall 1: never the clockworks schema).
   *
   * SSRF (T-10-05): the pasted URL is untrusted input — guarded by isAllowedPostUrl
   * (HTTPS + TikTok host) before reaching the actor.
   *
   * Returns null for a deleted/private/404 post or an unparseable item (caller
   * degrades honestly — never zero-fills). Throws IngestError on actor failure /
   * empty dataset / a rejected input URL.
   *
   * NOTE (Plan 07 UAT): the apidojo single-post INPUT field is `startUrls` per the
   * actor's Single Post Query tier; verify the live field name + the saves field
   * (`bookmarks`) at the Plan-07 push/UAT gate against a real token, and adjust the
   * remap if apidojo names saves differently in this actor's dataset version.
   */
  async scrapeSinglePostMetrics(url: string): Promise<VideoData | null> {
    // SSRF guard on the untrusted paste-URL input (T-10-05) BEFORE the actor call.
    if (!isAllowedPostUrl(url)) {
      throw new IngestError("ssrf_rejected", url);
    }

    let run: { defaultDatasetId: string };
    try {
      run = await this.client.actor(SINGLE_POST_METRICS_ACTOR).call(
        // Single Post Query tier: one startUrls entry → exactly one video, no min.
        { startUrls: [url], resultsPerPage: 1 },
        { waitSecs: 180 },
      );
    } catch (cause) {
      throw new IngestError("scrape_failed", url, cause);
    }

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    // Empty dataset — unexpected (actor returned no rows at all).
    if (items.length === 0) {
      throw new IngestError("empty_dataset", url);
    }

    const item = items[0] as Record<string, unknown>;

    // Deleted/private posts return count=1 with error/errorCode keys → null (honest absence).
    if (item.error !== undefined || item.errorCode !== undefined) {
      return null;
    }

    // apidojo output shape → VideoData (bookmarks→saves). Returns null if unparseable.
    return remapApidojoVideo(item);
  }
}
