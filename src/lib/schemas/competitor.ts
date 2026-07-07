import { z } from "zod";

/**
 * Normalize a TikTok handle from various input formats.
 * - Extracts handle from TikTok URLs
 * - Strips leading @
 * - Lowercases
 */
export function normalizeHandle(input: string): string {
  const trimmed = input.trim();

  // Extract handle from TikTok URLs like https://tiktok.com/@user123
  const urlMatch = trimmed.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1].toLowerCase();
  }

  // Strip leading @ and lowercase
  return trimmed.replace(/^@/, "").toLowerCase();
}

/**
 * Zod schema for Apify profile scraper output.
 *
 * The clockworks/tiktok-profile-scraper actor returns video-level items
 * with profile data nested under `authorMeta`. Field mapping:
 *   authorMeta.name → handle, authorMeta.nickName → displayName,
 *   authorMeta.fans → followerCount, authorMeta.heart → heartCount,
 *   authorMeta.video → videoCount, authorMeta.following → followingCount
 */
export const apifyProfileSchema = z.object({
  authorMeta: z.object({
    name: z.string().transform(normalizeHandle),
    nickName: z.string().optional().default(""),
    signature: z.string().optional().default(""),
    avatar: z.string().url().optional(),
    verified: z.boolean().optional().default(false),
    fans: z.coerce.number().int().nonnegative().default(0),
    following: z.coerce.number().int().nonnegative().default(0),
    heart: z.coerce.number().int().nonnegative().default(0),
    video: z.coerce.number().int().nonnegative().default(0),
  }),
});

/**
 * Zod schema for Apify video scraper output.
 * Validates a single TikTok video with engagement metrics.
 *
 * Uses z.coerce.number() for metric fields and safeParse
 * is expected for batch processing (skip invalid items).
 */
export const apifyVideoSchema = z.object({
  id: z.string(),
  webVideoUrl: z.string().url().optional(),
  text: z.string().optional().default(""),
  createTime: z.coerce.number().optional(),
  playCount: z.coerce.number().int().nonnegative().default(0),
  diggCount: z.coerce.number().int().nonnegative().default(0),
  shareCount: z.coerce.number().int().nonnegative().default(0),
  commentCount: z.coerce.number().int().nonnegative().default(0),
  collectCount: z.coerce.number().int().nonnegative().default(0),
  hashtags: z
    .array(z.object({ name: z.string() }))
    .optional()
    .default([]),
  videoMeta: z
    .object({
      duration: z.coerce.number().optional(),
      /**
       * Static cover image (TikTok CDN, signed/ephemeral). Display-only thumbnail for
       * the Account Read cover strip + Discover/Remix tiles — never a stable reference.
       */
      coverUrl: z.string().url().optional(),
      /**
       * Free native subtitle links (§P.12 live probe — $0, ~6/8 coverage incl. top video).
       * Populated when `downloadSubtitlesOptions:"DOWNLOAD_SUBTITLES"` is passed. The
       * `tiktokLink` fetches the WEBVTT transcript with NO auth (downloadLink needs ?token=).
       * Feeds the Creator Persona voice (`writing_style_sample`), never AI-transcribed.
       */
      subtitleLinks: z
        .array(
          z.object({
            language: z.string().optional(),
            downloadLink: z.string().url().optional(),
            tiktokLink: z.string().url().optional(),
          }),
        )
        // clockworks returns `null` (not `undefined`) for subtitle-less videos — accept it
        // so wordless profiles (e.g. khaby.lame) are not silently dropped whole. `remapClockworksVideo`
        // coalesces with `?? []`, so null and absent are equivalent downstream.
        .nullable()
        .optional(),
    })
    .optional(),
  /** Pinned/ad flags — pinned skews engagement ratios (§P.10b excludePinnedPosts). */
  isPinned: z.boolean().optional(),
  isAd: z.boolean().optional(),
  /**
   * Apify KV-store mp4 download URLs.
   * Populated when `shouldDownloadVideos: true` is passed to the actor.
   * Confirmed by spike 2026-06-01: mediaUrls[0] is a private api.apify.com KV record.
   * Optional so existing scrapeVideos (handle-based) calls are unaffected.
   */
  mediaUrls: z.array(z.string().url()).optional(),
});

/** Validated Apify profile data (after Zod parsing) */
export type ApifyProfile = z.infer<typeof apifyProfileSchema>;

/** Validated Apify video data (after Zod parsing) */
export type ApifyVideo = z.infer<typeof apifyVideoSchema>;

// ───────────────────────────────────────────────────────────────────────────
// apidojo Discover actors (Phase 08, D-12) — DIFFERENT field names than clockworks.
//
// Pitfall 1: apidojo/tiktok-scraper returns `views/likes/comments/shares/bookmarks/
// uploadedAt/channel.followers` where clockworks returns `playCount/diggCount/
// shareCount/commentCount/collectCount/createTime`. Reusing apifyVideoSchema above
// would SILENTLY ZERO every metric (each metric field has `.default(0)` and the key
// names never match). These apidojo-shaped schemas remap onto the SAME VideoData /
// ProfileData interface so every downstream consumer (outlier-compute, the grid) is
// actor-agnostic (RESEARCH Pattern 2: normalize at the scrape boundary).
//
// The clockworks apifyVideoSchema / apifyProfileSchema above are LEFT UNTOUCHED — the
// existing competitors/cron/webhook path still consumes them (A4: Discover-scoped swap,
// not a global retire).
// ───────────────────────────────────────────────────────────────────────────

/**
 * apidojo/tiktok-scraper video item.
 * Field map (apidojo → VideoData): views→views, likes→likes, comments→comments,
 * shares→shares, bookmarks→saves, uploadedAt→postedAt (Date), id→platformVideoId.
 * `uploadedAt` is an ISO-8601 string (apidojo) — coerced to Date.
 */
export const apidojoVideoSchema = z.object({
  // id may arrive as a number (apidojo) — coerce to string, but require it present
  // (reject undefined/null so junk items are skipped rather than yielding "undefined").
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  // apidojo exposes the canonical post URL under postPage / webVideoUrl depending on
  // dataset version; accept either, default to "".
  postPage: z.string().url().optional(),
  webVideoUrl: z.string().url().optional(),
  title: z.string().optional().default(""),
  uploadedAt: z.string().optional(),
  views: z.coerce.number().int().nonnegative().default(0),
  likes: z.coerce.number().int().nonnegative().default(0),
  comments: z.coerce.number().int().nonnegative().default(0),
  shares: z.coerce.number().int().nonnegative().default(0),
  bookmarks: z.coerce.number().int().nonnegative().default(0),
  hashtags: z
    .array(z.union([z.string(), z.object({ name: z.string() })]))
    .optional()
    .default([]),
  video: z
    .object({
      duration: z.coerce.number().optional(),
      // Static cover image (display-only thumbnail; ephemeral CDN URL). Optional —
      // apidojo dataset versions vary; absent → the renderer shows a placeholder tile.
      cover: z.string().url().optional(),
    })
    .optional(),
  channel: z
    .object({
      followers: z.coerce.number().int().nonnegative().optional(),
    })
    .optional(),
});

/**
 * apidojo/tiktok-profile-scraper item.
 * Field map (apidojo → ProfileData): channel.username→handle, channel.name→displayName,
 * channel.bio→bio, channel.avatar→avatarUrl, channel.verified→verified,
 * channel.followers→followerCount, channel.following→followingCount,
 * channel.hearts→heartCount, channel.videos→videoCount.
 */
export const apidojoProfileSchema = z.object({
  channel: z.object({
    username: z.string().transform(normalizeHandle),
    name: z.string().optional().default(""),
    bio: z.string().optional().default(""),
    avatar: z.string().url().optional(),
    verified: z.boolean().optional().default(false),
    followers: z.coerce.number().int().nonnegative().default(0),
    following: z.coerce.number().int().nonnegative().default(0),
    hearts: z.coerce.number().int().nonnegative().default(0),
    videos: z.coerce.number().int().nonnegative().default(0),
  }),
});

export type ApidojoVideo = z.infer<typeof apidojoVideoSchema>;
export type ApidojoProfile = z.infer<typeof apidojoProfileSchema>;

// ───────────────────────────────────────────────────────────────────────────
// Multi-platform connect (Instagram + YouTube) — profile-only scrapes via Apify.
//
// Same normalize-at-the-scrape-boundary pattern as the apidojo schemas above: each
// actor has its OWN field names, remapped onto the SHARED ProfileData so the connect
// route / cron / analytics stay actor-agnostic. Both actors probe-verified plan-
// compatible 2026-07-07 (apify/instagram-profile-scraper, streamers/youtube-scraper).
//
// Honesty spine: neither IG nor YT exposes a profile-level total-likes → the remaps set
// heartCount:0 (dropped by the platform-aware analytics tiles, never shown as "Likes: 0").
// ───────────────────────────────────────────────────────────────────────────

/**
 * apify/instagram-profile-scraper item (one item = the profile).
 * Field map (IG → ProfileData): username→handle, fullName→displayName, biography→bio,
 * profilePicUrlHD/profilePicUrl→avatarUrl, verified→verified, followersCount→followerCount,
 * followsCount→followingCount, postsCount→videoCount. No total-likes, no view total.
 */
export const instagramProfileSchema = z.object({
  username: z.string().transform(normalizeHandle),
  fullName: z.string().optional().default(""),
  biography: z.string().optional().default(""),
  verified: z.boolean().optional().default(false),
  followersCount: z.coerce.number().int().nonnegative().default(0),
  followsCount: z.coerce.number().int().nonnegative().default(0),
  postsCount: z.coerce.number().int().nonnegative().default(0),
  profilePicUrl: z.string().url().optional(),
  profilePicUrlHD: z.string().url().optional(),
});

/**
 * streamers/youtube-scraper item. The actor returns VIDEO items with the channel block
 * denormalized onto every item (top-level channel* fields, duplicated under
 * aboutChannelInfo). We read the top-level fields.
 * Field map (YT → ProfileData): channelUsername→handle, channelName→displayName,
 * channelDescription→bio, channelAvatarUrl→avatarUrl, isChannelVerified→verified,
 * numberOfSubscribers→followerCount, channelTotalVideos→videoCount,
 * channelTotalViews→viewCount (lifetime). No "following", no channel-level total-likes.
 * channelUsername is optional (a channel may expose only channelId) → remap falls back
 * to the input handle.
 */
export const youtubeChannelSchema = z.object({
  channelUsername: z.string().optional(),
  channelName: z.string().optional().default(""),
  channelDescription: z.string().optional().default(""),
  isChannelVerified: z.boolean().optional().default(false),
  numberOfSubscribers: z.coerce.number().int().nonnegative().default(0),
  channelTotalVideos: z.coerce.number().int().nonnegative().default(0),
  channelTotalViews: z.coerce.number().int().nonnegative().default(0),
  channelAvatarUrl: z.string().url().optional(),
});

export type InstagramProfile = z.infer<typeof instagramProfileSchema>;
export type YoutubeChannel = z.infer<typeof youtubeChannelSchema>;
