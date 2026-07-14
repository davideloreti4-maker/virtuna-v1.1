export interface ProfileData {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  followerCount: number;
  followingCount: number;
  /**
   * Total likes across the account. TikTok-specific (authorMeta.heart). Instagram and
   * YouTube expose NO profile-level total-likes, so their remaps set this to 0 — an honest
   * absence the analytics layer drops (never rendered as a fake "Likes: 0" tile), NOT a
   * fabricated engagement number.
   */
  heartCount: number;
  videoCount: number;
  /**
   * Profile-level total views. Populated by YouTube (channelTotalViews — lifetime channel
   * views → the "Views" tile). TikTok and Instagram profiles expose no such total (TikTok's
   * Views tile is a windowed per-post SUM computed by the cron, not this field), so their
   * remaps leave it undefined → the Views tile is omitted honestly. Optional/additive.
   */
  viewCount?: number | null;
}

export interface VideoData {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hashtags: string[];
  durationSeconds: number;
  postedAt: Date;
  /**
   * Free native-subtitle WEBVTT URL (§P.12 — `tiktokLink`, no auth). Present only on the
   * profile-bundle scrape (downloadSubtitlesOptions). Optional/additive — existing
   * Discover/Explore/single-post paths leave it undefined. Feeds creator-voice synthesis.
   */
  subtitleUrl?: string;
  /** True if the post is pinned (skews engagement ratios — excluded from the bundle). */
  isPinned?: boolean;
  /**
   * Downloadable mp4 URL (private Apify KV-store record) — populated on the profile-bundle
   * scrape when `shouldDownloadVideos:true`. The omni-flash watch reads this directly (with
   * the Apify token appended), so calibration needs NO per-video rehost call. Optional —
   * absent on metadata-only Discover/Explore paths.
   */
  mediaUrl?: string;
  /**
   * Static cover-image URL for the post (clockworks `videoMeta.coverUrl`). A TikTok-CDN
   * signed image — ephemeral (expires), so it is DISPLAY-ONLY (Account Read cover strip,
   * Discover/Remix thumbnails) and never persisted as a stable reference. Optional —
   * absent on metadata-only paths that don't surface a thumbnail.
   */
  coverUrl?: string;
}

/**
 * One `tiktok-profile-scraper` run = profile + N videos + free subtitle links (§P.1
 * 1-scrape collapse). Replaces the old parallel `scrapeProfile` + `scrapeVideos` pair
 * for the calibration path.
 */
export interface ProfileBundle {
  profile: ProfileData;
  videos: VideoData[];
  /** Native-subtitle coverage, e.g. "6/8" — recorded in signature provenance. */
  subCoverage: string;
}

/**
 * Resolved video result returned by resolveVideoUrl.
 * mp4Url is a validated, SSRF-checked URL ready for downstream fetch (Plan 03).
 */
export interface ResolvedVideo {
  mp4Url: string;
  durationSeconds: number;
  /**
   * Static cover-image URL for the resolved post (clockworks `videoMeta.coverUrl`). An
   * ephemeral TikTok-CDN image — display-only (the Remix card's source thumbnail).
   * Optional — absent when the rehost item carried no cover.
   */
  coverUrl?: string;
  /**
   * Who made the post, and how it did. The actor already returns both on the SAME item we
   * parse for `mediaUrls` (`authorMeta.name`, `playCount`) — they were simply dropped, so a
   * Remix card could show the video's picture but not its author. Attribution is what makes
   * a source citable, so they come through now.
   *
   * Optional and honest: absent when the item carried no author block. NOTE these are the
   * only two facts we hold about a remix source — there is no follower baseline and so no
   * outlier multiplier, unlike a grounding `RetrievedExample`. Do not synthesize one.
   */
  handle?: string;
  views?: number;
  /** Canonical post permalink (`webVideoUrl`) — makes the receipt clickable back to source. */
  videoUrl?: string;
}

/**
 * Typed failure discriminant for all non-success paths in resolveVideoUrl.
 *
 * - empty_dataset   : Apify returned 0 items (unexpected empty run)
 * - no_media_url    : Item present but no mediaUrls / empty array (carousel, photo post)
 * - not_found       : Item present but item.error set — deleted / private / 404 post
 * - ssrf_rejected   : Resolved mp4 host is not in the HTTPS TikTok/Apify-CDN allowlist
 * - scrape_failed   : Actor call threw (network, timeout, actor crash)
 */
export type IngestErrorKind =
  | "empty_dataset"
  | "no_media_url"
  | "not_found"
  | "ssrf_rejected"
  | "scrape_failed";

/** Typed error for all resolveVideoUrl failure classes. Carries kind + originating URL. */
export class IngestError extends Error {
  readonly kind: IngestErrorKind;
  readonly url: string;

  constructor(kind: IngestErrorKind, url: string, cause?: unknown) {
    super(`IngestError[${kind}]: ${url}`);
    this.name = "IngestError";
    this.kind = kind;
    this.url = url;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface ScrapingProvider {
  /** Scrape a single TikTok profile by handle. Throws if profile not found. */
  scrapeProfile(handle: string): Promise<ProfileData>;

  /**
   * Scrape a single Instagram profile by handle (light, profile-only — no media download).
   * Powers the multi-platform connect → analytics path. heartCount is 0 (IG has no
   * profile-level total-likes) and viewCount is undefined (no profile view total). Optional
   * so existing mock/TikTok-only providers stay valid. Throws if the profile isn't found.
   */
  scrapeInstagramProfile?(handle: string): Promise<ProfileData>;

  /**
   * Scrape a single YouTube channel by handle (light, channel-only). heartCount is 0 (no
   * channel-level total-likes), followingCount is 0 (no "following" concept), and viewCount
   * carries the lifetime channelTotalViews (→ the Views tile). Optional so existing
   * mock/TikTok-only providers stay valid. Throws if the channel isn't found.
   */
  scrapeYouTubeChannel?(handle: string): Promise<ProfileData>;

  /**
   * §P 1-scrape collapse: ONE `tiktok-profile-scraper` run returns the profile +
   * N latest videos (pinned excluded) + free native subtitle links. Replaces the
   * parallel scrapeProfile + scrapeVideos pair on the calibration path. Throws if
   * the handle returns no data. Optional so existing mock providers stay valid.
   */
  scrapeProfileBundle?(handle: string, limit?: number): Promise<ProfileBundle>;

  /**
   * Scrape a result set for Discover/Explore. `query` is a handle (profile mode) or a
   * niche/search phrase (search mode); `mode` selects the clockworks input field
   * (profiles vs searchQueries). Returns validated videos (invalid items skipped).
   */
  scrapeVideos(
    query: string,
    limit?: number,
    mode?: "profile" | "search",
  ): Promise<VideoData[]>;

  /**
   * Resolve ONE non-owned TikTok URL to a fetchable mp4 URL.
   * Throws IngestError on any failure class.
   */
  resolveVideoUrl(url: string): Promise<ResolvedVideo>;

  /**
   * Scrape PUBLIC METRICS for ONE posted TikTok URL (outcome capture, FLYWHEEL-01).
   *
   * Single-URL path → clockworks VIDEO_ACTOR (apidojo forbids single-post URLs,
   * Pitfall 2). Returns the metrics-only VideoData (views/likes/comments/shares/saves);
   * null when the post is deleted/private/404 (so callers degrade honestly, never zero-fill).
   * Throws IngestError on scrape failure / empty dataset / SSRF rejection.
   */
  scrapeSinglePostMetrics(url: string): Promise<VideoData | null>;
}
