import { ApifyClient } from "apify-client";
import {
  apifyVideoSchema,
  apifyProfileSchema,
  apidojoProfileSchema,
  apidojoVideoSchema,
  instagramProfileSchema,
  youtubeChannelSchema,
  normalizeHandle,
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

// ── Single-URL actor — clockworks/tiktok-scraper (VIDEO_ACTOR) ────────────────
// One actor serves BOTH single-URL needs via clockworks' `postURLs:[url]` tier:
//   1. Remix rehost   (resolveVideoUrl) — needs the downloadable KV mp4 → shouldDownloadVideos:true
//   2. Outcome METRICS (scrapeSinglePostMetrics, Phase-10 flywheel) — metrics only
// The former metrics actor `apidojo/tiktok-scraper-api` was RETIRED from Apify (2026-07-06);
// capture migrated here. clockworks' block (playCount/diggCount/commentCount/shareCount/
// collectCount) remaps 1:1 onto the SAME VideoData the flywheel consumes (views/likes/
// comments/shares/saves) via remapClockworksVideo — deleted/private posts return an
// error/errorCode item (honest null), identical to the resolveVideoUrl precedent below.
const VIDEO_ACTOR = "clockworks/tiktok-scraper";

// ── Multi-platform connect actors (Instagram + YouTube) ───────────────────────
// Profile-only scrapes for the connect → analytics path (calibration stays TikTok-only).
// Both probe-verified plan-compatible 2026-07-07 (ran SUCCEEDED under LIMITED_PERMISSIONS,
// no Free-plan rental refusal). Field shapes remapped onto the shared ProfileData below.
//   - IG: apify/instagram-profile-scraper — one item = the profile.
//   - YT: streamers/youtube-scraper — video items with the channel block denormalized on
//     each; maxResults:1 bounds cost (one video is enough to surface the channel).
const IG_PROFILE_ACTOR = "apify/instagram-profile-scraper";
const YT_CHANNEL_ACTOR = "streamers/youtube-scraper";

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
  // #9: require a labeled subdomain (endsWith the dotted suffix). Do NOT allow the
  // bare apex (host === "tiktok.com") — real post URLs are always subdomains
  // (www./vm./vt.tiktok.com), and the apex needlessly widens the SSRF surface.
  return POST_URL_ALLOWLIST_SUFFIXES.some((suffix) => host.endsWith(suffix));
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

  // Must match an allowlisted suffix as a labeled subdomain.
  // #9: require `endsWith(".apify.com")` — resolved mp4 hosts are always subdomains
  // (api.apify.com, vXX.tiktokcdn.com); reject the bare apex (apify.com / tiktokcdn.com),
  // which the old `host === suffix.slice(1)` clause needlessly permitted.
  return SSRF_ALLOWLIST_SUFFIXES.some((suffix) => host.endsWith(suffix));
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

/**
 * Remap one apify/instagram-profile-scraper item onto ProfileData. IG exposes no
 * profile-level total-likes (heartCount:0 — honest, dropped by the analytics tiles, never
 * shown as "Likes: 0") and no profile view total (viewCount left undefined → no Views tile).
 */
export function remapInstagramProfile(item: unknown): ProfileData {
  const p = instagramProfileSchema.parse(item);
  return {
    handle: p.username,
    displayName: p.fullName || p.username,
    bio: p.biography,
    avatarUrl: p.profilePicUrlHD ?? p.profilePicUrl ?? "",
    verified: p.verified,
    followerCount: p.followersCount,
    followingCount: p.followsCount,
    heartCount: 0,
    videoCount: p.postsCount,
  };
}

/**
 * Remap one streamers/youtube-scraper item onto ProfileData. The item is a video with the
 * channel block denormalized on it. followingCount:0 (YT has no "following") and heartCount:0
 * (no channel-level total-likes) are honest absences; viewCount carries channelTotalViews
 * (lifetime channel views → the Views tile). `channelUsername` is optional per the actor, so
 * we fall back to the (already-cleaned) input handle.
 */
export function remapYouTubeChannel(item: unknown, fallbackHandle: string): ProfileData {
  const c = youtubeChannelSchema.parse(item);
  const handle = c.channelUsername ? normalizeHandle(c.channelUsername) : normalizeHandle(fallbackHandle);
  return {
    handle,
    displayName: c.channelName || handle,
    bio: c.channelDescription,
    avatarUrl: c.channelAvatarUrl ?? "",
    verified: c.isChannelVerified,
    followerCount: c.numberOfSubscribers,
    followingCount: 0,
    heartCount: 0,
    videoCount: c.channelTotalVideos,
    viewCount: c.channelTotalViews,
  };
}

export class ApifyScrapingProvider implements ScrapingProvider {
  private client: ApifyClient;

  constructor(token?: string) {
    // #10: fail fast on a missing token. The old `?? process.env.APIFY_TOKEN!` non-null
    // assertion let an unset env fall through to an empty/undefined token, which surfaced
    // downstream as an opaque Apify 401. Refuse to construct with no token instead.
    const resolved = token ?? process.env.APIFY_TOKEN;
    if (!resolved) {
      throw new Error(
        "ApifyScrapingProvider: no Apify token — pass one or set APIFY_TOKEN " +
          "(refusing to start with an empty token, which would 401 opaquely).",
      );
    }
    this.client = new ApifyClient({ token: resolved });
  }

  /**
   * #8: fetch a finished run's dataset items behind a `defaultDatasetId` guard. `.call()`
   * returns a run object even for FAILED/timed-out runs, and while Apify normally populates
   * the id, a missing one would make `.dataset(undefined)` throw opaquely — fail with a
   * contextful message instead. Centralizes the repeated `.dataset(run.defaultDatasetId)`.
   */
  private async listRunItems(run: { defaultDatasetId?: string }, ctx: string) {
    if (!run.defaultDatasetId) {
      throw new Error(
        `Apify ${ctx}: actor run returned no defaultDatasetId (the run likely failed or timed out).`,
      );
    }
    return this.client.dataset(run.defaultDatasetId).listItems();
  }

  async scrapeProfile(handle: string): Promise<ProfileData> {
    const run = await this.client
      .actor(DISCOVER_PROFILE_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: 1 },
        { waitSecs: 60 },
      );

    const { items } = await this.listRunItems(run, "scrape");

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    return remapClockworksProfile(items[0]);
  }

  /**
   * Scrape a single Instagram profile (light, profile-only — no media download). One
   * apify/instagram-profile-scraper run on `usernames:[handle]` returns exactly one item =
   * the profile. Mirrors scrapeProfile's contract (throws when the handle returns nothing).
   */
  async scrapeInstagramProfile(handle: string): Promise<ProfileData> {
    const clean = handle.replace(/^@/, "").trim();
    const run = await this.client
      .actor(IG_PROFILE_ACTOR)
      .call({ usernames: [clean] }, { waitSecs: 120 });

    const { items } = await this.listRunItems(run, "scrape-instagram");

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    return remapInstagramProfile(items[0]);
  }

  /**
   * Scrape a single YouTube channel (light, channel-only). streamers/youtube-scraper needs a
   * channel URL; we build one from the @handle and cap `maxResults:1` (one video is enough to
   * surface the denormalized channel block — bounds cost). Throws when the handle returns
   * nothing. waitSecs 180: this actor scrolls the channel page (~1min observed).
   */
  async scrapeYouTubeChannel(handle: string): Promise<ProfileData> {
    const clean = handle.replace(/^@/, "").trim();
    const run = await this.client.actor(YT_CHANNEL_ACTOR).call(
      {
        startUrls: [{ url: `https://www.youtube.com/@${clean}` }],
        maxResults: 1,
        maxResultsShorts: 0,
        maxResultStreams: 0,
      },
      { waitSecs: 180 },
    );

    const { items } = await this.listRunItems(run, "scrape-youtube");

    if (!items.length) {
      throw new Error(`No channel data returned for handle: ${handle}`);
    }

    return remapYouTubeChannel(items[0], clean);
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

    const { items } = await this.listRunItems(run, "scrape");

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

    const { items } = await this.listRunItems(run, "scrape");

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

    const { items } = await this.listRunItems(run, "scrape");

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

    const { mediaUrls, videoMeta, authorMeta, playCount, webVideoUrl } = parsed.data;

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
      // Display-only cover (no SSRF concern — rendered as a browser <img>, never fetched
      // server-side). Omitted when the rehost item carried no videoMeta.coverUrl.
      ...(videoMeta?.coverUrl ? { coverUrl: videoMeta.coverUrl } : {}),
      // Attribution for the source post. Each spread only when the actor actually gave us the
      // field, so a missing author degrades to "no receipt" rather than an anonymous one.
      // playCount defaults to 0 in the schema; 0 views is not a fact worth printing, so it is
      // treated as absent.
      ...(authorMeta?.name ? { handle: authorMeta.name } : {}),
      ...(playCount > 0 ? { views: playCount } : {}),
      ...(webVideoUrl ? { videoUrl: webVideoUrl } : {}),
    };
  }

  /**
   * Scrape PUBLIC METRICS for ONE posted TikTok URL (outcome capture, FLYWHEEL-01).
   *
   * Source = clockworks/tiktok-scraper single-URL `postURLs:[url]` tier (the same actor
   * resolveVideoUrl uses; the former apidojo `tiktok-scraper-api` was retired from Apify
   * 2026-07-06). One URL → exactly ONE video with the full public metric block; remaps via
   * `remapClockworksVideo` (playCount→views, diggCount→likes, commentCount→comments,
   * shareCount→shares, collectCount→saves) onto the SAME VideoData the flywheel consumes.
   * Metrics-only → NO `shouldDownloadVideos` (no mp4 needed; cheaper/faster than the rehost).
   *
   * SSRF (T-10-05): the pasted URL is untrusted input — guarded by isAllowedPostUrl
   * (HTTPS + TikTok host) before reaching the actor.
   *
   * Returns null for a deleted/private/404 post or an unparseable item (caller
   * degrades honestly — never zero-fills). Throws IngestError on actor failure /
   * empty dataset / a rejected input URL.
   */
  async scrapeSinglePostMetrics(url: string): Promise<VideoData | null> {
    // SSRF guard on the untrusted paste-URL input (T-10-05) BEFORE the actor call.
    if (!isAllowedPostUrl(url)) {
      throw new IngestError("ssrf_rejected", url);
    }

    let run: { defaultDatasetId: string };
    try {
      run = await this.client.actor(VIDEO_ACTOR).call(
        // clockworks single-URL tier: one postURLs entry → exactly one video. Omit
        // shouldDownloadVideos — metrics capture needs no mp4 (unlike resolveVideoUrl).
        { postURLs: [url], resultsPerPage: 1 },
        { waitSecs: 180 },
      );
    } catch (cause) {
      throw new IngestError("scrape_failed", url, cause);
    }

    const { items } = await this.listRunItems(run, "scrape");

    // Empty dataset — unexpected (actor returned no rows at all).
    if (items.length === 0) {
      throw new IngestError("empty_dataset", url);
    }

    const item = items[0] as Record<string, unknown>;

    // Deleted/private posts return count=1 with error/errorCode keys → null (honest
    // absence). Same signal resolveVideoUrl relies on for this actor (spike-confirmed).
    if (item.error !== undefined || item.errorCode !== undefined) {
      return null;
    }

    // clockworks output shape → VideoData (collectCount→saves). Returns null if unparseable.
    return remapClockworksVideo(item);
  }
}
