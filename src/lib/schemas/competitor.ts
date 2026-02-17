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
    .object({ duration: z.coerce.number().optional() })
    .optional(),
});

/** Validated Apify profile data (after Zod parsing) */
export type ApifyProfile = z.infer<typeof apifyProfileSchema>;

/** Validated Apify video data (after Zod parsing) */
export type ApifyVideo = z.infer<typeof apifyVideoSchema>;
