export interface ProfileData {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
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
}

/**
 * Resolved video result returned by resolveVideoUrl.
 * mp4Url is a validated, SSRF-checked URL ready for downstream fetch (Plan 03).
 */
export interface ResolvedVideo {
  mp4Url: string;
  durationSeconds: number;
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
