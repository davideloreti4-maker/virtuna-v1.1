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
 * Validates and normalizes a single TikTok profile.
 *
 * Uses z.coerce.number() for all numeric fields because
 * Apify actors sometimes return strings for large numbers.
 */
export const apifyProfileSchema = z.object({
  uniqueId: z.string().transform(normalizeHandle),
  nickname: z.string().optional().default(""),
  signature: z.string().optional().default(""),
  avatarLarger: z.string().url().optional(),
  verified: z.boolean().optional().default(false),
  followerCount: z.coerce.number().int().nonnegative().default(0),
  followingCount: z.coerce.number().int().nonnegative().default(0),
  heartCount: z.coerce.number().int().nonnegative().default(0),
  videoCount: z.coerce.number().int().nonnegative().default(0),
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
