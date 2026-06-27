import { ApifyClient } from "apify-client";
import {
  apifyVideoSchema,
  apifyProfileSchema,
  apidojoProfileSchema,
  apidojoVideoSchema,
} from "@/lib/schemas/competitor";
import type {
  ProfileData,
  VideoData,
  ScrapingProvider,
  ResolvedVideo,
  ProfileBundle,
} from "./types";
import { IngestError } from "./types";

// ── Discover/Explore actors — clockworks (reverted from apidojo 2026-06-20) ───
// scrapeVideos / scrapeProfile pull search/profile result sets for Discover + Explore.
// REVERTED to clockworks: apidojo/tiktok-scraper is a PAID/rental actor that refuses
// Apify Free-plan API runs ("You cannot use the API with the Free Plan"), which blocked
// every live Discover/Explore pull. clockworks runs on the Free plan and returns real
// engagement metrics; its field shape (playCount/diggCount/collectCount/createTime) is
// remapped onto VideoData/ProfileData via the clockworks apify*Schema (NOT apidojo).
// Profile pulls → `profiles:[handle]`; niche/search pulls → `searchQueries:[query]`.
const DISCOVER_PROFILE_ACTOR = "clockworks/tiktok-profile-scraper";
const DISCOVER_VIDEO_ACTOR = "clockworks/tiktok-scraper";

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
    ...(v.video?.cover ? { coverUrl: v.video.cover } : {}),
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

/**
 * Remap one clockworks/tiktok-scraper video item onto VideoData.
 * clockworks shape: playCount→views, diggCount→likes, commentCount→comments,
 * shareCount→shares, collectCount→saves, createTime(unix s)→postedAt. Returns null
 * (skipped) on parse failure — mirrors the batch-skip behaviour.
 */
export function remapClockworksVideo(item: unknown): VideoData | null {
  const result = apifyVideoSchema.safeParse(item);
  if (!result.success) {
    console.warn(`[scraping] clockworks video validation failed:`, result.error.issues);
    return null;
  }

  const v = result.data;
  // Prefer the no-auth English `tiktokLink` for the free VTT (§P.12); fall back to the
  // first available subtitle link. Undefined when the video carries no native subs.
  const subs = v.videoMeta?.subtitleLinks ?? [];
  const eng = subs.find((s) => s.language?.toLowerCase().startsWith("en"));
  const subtitleUrl = (eng ?? subs[0])?.tiktokLink ?? (eng ?? subs[0])?.downloadLink;

  return {
    platformVideoId: v.id,
    videoUrl: v.webVideoUrl ?? "",
    caption: v.text,
    views: v.playCount,
    likes: v.diggCount,
    comments: v.commentCount,
    shares: v.shareCount,
    saves: v.collectCount,
    hashtags: v.hashtags.map((h) => h.name),
    durationSeconds: v.videoMeta?.duration ?? 0,
    postedAt: v.createTime ? new Date(v.createTime * 1000) : new Date(),
    ...(subtitleUrl ? { subtitleUrl } : {}),
    ...(v.isPinned !== undefined ? { isPinned: v.isPinned } : {}),
    ...(v.mediaUrls?.[0] ? { mediaUrl: v.mediaUrls[0] } : {}),
    ...(v.videoMeta?.coverUrl ? { coverUrl: v.videoMeta.coverUrl } : {}),
  };
}

/**
 * Remap one clockworks profile item onto ProfileData. clockworks/tiktok-profile-scraper
 * returns video-level items with profile data nested under `authorMeta`.
 */
export function remapClockworksProfile(item: unknown): ProfileData {
  const { authorMeta } = apifyProfileSchema.parse(item);
  return {
    handle: authorMeta.name,
    displayName: authorMeta.nickName,
    bio: authorMeta.signature,
    avatarUrl: authorMeta.avatar ?? "",
    verified: authorMeta.verified,
    followerCount: authorMeta.fans,
    followingCount: authorMeta.following,
    heartCount: authorMeta.heart,
    videoCount: authorMeta.video,
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

    return remapClockworksProfile(items[0]);
  }

  /**
   * §P 1-scrape collapse (BUILD step 2). ONE `tiktok-profile-scraper` run returns the
   * profile (authorMeta) + N latest videos + free native subtitle links — replacing the
   * old parallel scrapeProfile(resultsPerPage:1) + scrapeVideos pair on the calibration
   * path. Config per §P.10b:
   *   - resultsPerPage: default 12 (10-20 cap) — above the THIN_MIN_VIDEOS=10 engagement
   *     floor; bounds mp4 download count (download-count = scrape-count, see below).
   *   - profileSorting:"latest" — current audience + voice (includes flops for what_falls_flat);
   *     NOT "popular" (stale/biased).
   *   - excludePinnedPosts:true — pinned skews engagement ratios.
   *   - shouldDownloadVideos:TRUE — returns the mp4 KV record (`mediaUrls[0]` → `mediaUrl`) per
   *     video in THIS one reliable run, so the omni-watch reads it directly. Replaces the flaky
   *     per-video clockworks single-URL rehost (`resolveVideoUrl`) — 6 Apify runs collapse to 1.
   *   - downloadSubtitlesOptions:"DOWNLOAD_SUBTITLES" — FREE native subs only. AI-transcribe
   *     ($48/1k) NEVER fires, not even as fallback (§P.4 / P-4).
   *
   * The clockworks profile-scraper returns video-level items with profile nested under
   * authorMeta, so item[0] yields the profile and every item yields a video. Throws when
   * the handle returns no items (caller maps to scrape_failed).
   */
  async scrapeProfileBundle(handle: string, limit = 12): Promise<ProfileBundle> {
    const capped = Math.min(Math.max(limit, 10), 20); // §P.10b 10-20 cap
    const run = await this.client.actor(DISCOVER_PROFILE_ACTOR).call(
      {
        profiles: [handle],
        resultsPerPage: capped,
        profileSorting: "latest",
        excludePinnedPosts: true,
        // shouldDownloadVideos:TRUE — one reliable run returns the mp4 KV record per video
        // (probe 2026-06-24: mediaUrls 6/6) so the omni-watch reads `mediaUrl` directly. This
        // REPLACES the per-video clockworks single-URL rehost (`resolveVideoUrl`), which was
        // the flaky step (3/5 scrape_failed in UAT). Download-count = scrape-count, so limit
        // defaults to 12 (above the THIN_MIN_VIDEOS=10 engagement floor) to bound waste.
        shouldDownloadVideos: true,
        shouldDownloadCovers: false,
        downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
      },
      { waitSecs: 240 },
    );

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    const profile = remapClockworksProfile(items[0]);
    const videos = items
      .map((item) => remapClockworksVideo(item))
      .filter((v): v is VideoData => v !== null);

    const withSubs = videos.filter((v) => v.subtitleUrl).length;
    const subCoverage = `${withSubs}/${videos.length}`;

    return { profile, videos, subCoverage };
  }

  /**
   * Pull a result set for Discover/Explore.
   * @param query a handle (profile mode) OR a niche/search phrase (search mode).
   * @param limit resultsPerPage cap.
   * @param mode  "profile" → clockworks `profiles:[query]`; "search" → `searchQueries:[query]`.
   *              clockworks `profiles` expects usernames; a multi-word niche phrase must go
   *              through `searchQueries` or it returns nothing — hence the explicit mode.
   */
  async scrapeVideos(
    query: string,
    limit = 30,
    mode: "profile" | "search" = "profile",
  ): Promise<VideoData[]> {
    const input =
      mode === "search"
        ? { searchQueries: [query], resultsPerPage: limit }
        : { profiles: [query], resultsPerPage: limit };

    const run = await this.client
      .actor(DISCOVER_VIDEO_ACTOR)
      .call(input, { waitSecs: 120 });

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    return items
      .map((item) => remapClockworksVideo(item))
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
