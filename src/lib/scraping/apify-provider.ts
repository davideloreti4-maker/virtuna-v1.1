import { ApifyClient } from "apify-client";
import {
  apifyProfileSchema,
  apifyVideoSchema,
} from "@/lib/schemas/competitor";
import type {
  ProfileData,
  VideoData,
  ScrapingProvider,
  ResolvedVideo,
} from "./types";
import { IngestError } from "./types";

const PROFILE_ACTOR = "clockworks/tiktok-profile-scraper";
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

export class ApifyScrapingProvider implements ScrapingProvider {
  private client: ApifyClient;

  constructor(token?: string) {
    this.client = new ApifyClient({
      token: token ?? process.env.APIFY_TOKEN!,
    });
  }

  async scrapeProfile(handle: string): Promise<ProfileData> {
    const run = await this.client
      .actor(PROFILE_ACTOR)
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

    const { authorMeta } = apifyProfileSchema.parse(items[0]);

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

  async scrapeVideos(handle: string, limit = 30): Promise<VideoData[]> {
    const run = await this.client
      .actor(VIDEO_ACTOR)
      .call(
        { profiles: [handle], resultsPerPage: limit },
        { waitSecs: 120 },
      );

    const { items } = await this.client
      .dataset(run.defaultDatasetId)
      .listItems();

    return items
      .map((item) => {
        const result = apifyVideoSchema.safeParse(item);
        if (!result.success) {
          console.warn(
            `[scraping] Video validation failed:`,
            result.error.issues,
          );
          return null;
        }

        const v = result.data;
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
          postedAt: v.createTime
            ? new Date(v.createTime * 1000)
            : new Date(),
        };
      })
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
}
