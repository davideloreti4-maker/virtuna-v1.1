import { z } from "zod";
import { normalizeHandle, apifyVideoSchema } from "@/lib/schemas/competitor";
import { createLogger } from "@/lib/logger";
import { getFollowerTier, type FollowerTier } from "./follower-tier";
import type { Niche, ScrapeConfigKind } from "./apify-jobs";

const log = createLogger({ module: "corpus/normalize-scrape" });

export interface NormalizedCorpusRow {
  platform: "tiktok";
  platform_video_id: string;
  video_url: string | null;
  creator_handle: string | null;
  niche: Niche;
  corpus_version: string;
  scrape_kind: ScrapeConfigKind; // W6: which ScrapeConfigKind produced this row; powers bucket_target

  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  duration_seconds: number | null;
  completion_pct: number | null; // Always null — see KNOWN GAP in migration header

  follower_count: number | null;
  follower_tier: FollowerTier | null;

  caption: string | null;
  hashtags: string[];
  sound_name: string | null;
  posted_at: Date;
  scraped_at: Date;
}

/** apidojo-specific schema — built parallel to apifyVideoSchema (clockworks). */
const apidojoVideoSchema = z.object({
  id: z.string(),
  postPage: z.string().optional(),
  views: z.union([z.number(), z.string()]).optional(),
  likes: z.union([z.number(), z.string()]).optional(),
  comments: z.union([z.number(), z.string()]).optional(),
  shares: z.union([z.number(), z.string()]).optional(),
  bookmarks: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  uploadedAt: z.union([z.number(), z.string()]).optional(),
  channel: z
    .object({
      username: z.string().optional(),
      followers: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  video: z
    .object({
      duration: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Normalize an Apify scrape item (clockworks OR apidojo format) into a
 * NormalizedCorpusRow. Returns null on parse failure or age-filter failure
 * (skip-on-fail pattern; never throws).
 *
 * Niche is set by the orchestrator from which buildApifyJobs(niche) produced
 * the call — NOT from the item itself.
 */
export function normalizeScrapedItem(
  item: unknown,
  niche: Niche,
  corpus_version: string,
  scrapeKind: ScrapeConfigKind // W6
): NormalizedCorpusRow | null {
  // Try clockworks first (project's primary actor per apify-provider.ts:9-10).
  // apifyVideoSchema has lenient defaults via z.coerce + .default — we must
  // dispatch BEFORE trusting the parse: if a non-clockworks shape happens to
  // satisfy apifyVideoSchema's loose contract (e.g. no `id`), we'd still bail
  // in normalizeClockworks via the id check.
  const clockworks = apifyVideoSchema.safeParse(item);
  if (clockworks.success) {
    const result = normalizeClockworks(
      clockworks.data,
      niche,
      corpus_version,
      scrapeKind,
      item
    );
    if (result !== null) return result;
    // Clockworks parse succeeded but our domain rules rejected. Fall through
    // and let apidojo try — but only if the raw item shape isn't already
    // a typical clockworks shape (presence of `playCount` or `authorMeta`).
  }
  // Fallback: apidojo format
  const apidojo = apidojoVideoSchema.safeParse(item);
  if (apidojo.success) {
    return normalizeApidojo(apidojo.data, niche, corpus_version, scrapeKind);
  }
  log.debug("Item did not match any known Apify schema; skipping", {
    parseError: clockworks.error?.message,
  });
  return null;
}

function normalizeClockworks(
  parsed: z.infer<typeof apifyVideoSchema>,
  niche: Niche,
  corpus_version: string,
  scrape_kind: ScrapeConfigKind,
  rawItem: unknown
): NormalizedCorpusRow | null {
  // Use raw item for fields not in the strict schema (authorMeta, videoMeta, etc.)
  // because apifyVideoSchema only validates the public engagement counters.
  const raw = (typeof rawItem === "object" && rawItem !== null
    ? (rawItem as Record<string, unknown>)
    : ({} as Record<string, unknown>));

  const id = parsed.id;
  if (!id) return null;

  const views = parsed.playCount;
  if (views < 1) return null; // CORPUS-08 quality rule

  const createTimeSec = parsed.createTime ?? 0;
  const posted_at = new Date(createTimeSec * 1000);
  if (!isFinite(posted_at.getTime())) return null;
  if (Date.now() - posted_at.getTime() < SEVEN_DAYS_MS) return null; // Pitfall 1

  const authorMeta = (raw["authorMeta"] as Record<string, unknown> | undefined) ?? {};
  const videoMeta = (raw["videoMeta"] as Record<string, unknown> | undefined) ?? {};
  const musicMeta = raw["musicMeta"] as Record<string, unknown> | undefined;
  const hashtagItems = parsed.hashtags ?? [];
  const follower_count = toNullableNumber(authorMeta["fans"]);
  const duration_seconds = toNullableNumber(videoMeta["duration"]);
  const sound_name = typeof musicMeta?.["musicName"] === "string"
    ? (musicMeta["musicName"] as string)
    : null;

  return {
    platform: "tiktok",
    platform_video_id: id,
    video_url: typeof parsed.webVideoUrl === "string" ? parsed.webVideoUrl : null,
    creator_handle: normalizeOrNull(authorMeta["name"]),
    niche,
    corpus_version,
    scrape_kind,
    views,
    likes: parsed.diggCount,
    comments: parsed.commentCount,
    shares: parsed.shareCount,
    saves: parsed.collectCount,
    duration_seconds,
    completion_pct: null, // KNOWN GAP — not available from Apify
    follower_count,
    follower_tier: getFollowerTier(follower_count),
    caption: typeof parsed.text === "string" && parsed.text.length > 0
      ? parsed.text
      : null,
    hashtags: hashtagItems
      .map((h) => h.name)
      .filter((s): s is string => typeof s === "string" && s.length > 0),
    sound_name,
    posted_at,
    scraped_at: new Date(),
  };
}

function normalizeApidojo(
  item: z.infer<typeof apidojoVideoSchema>,
  niche: Niche,
  corpus_version: string,
  scrape_kind: ScrapeConfigKind
): NormalizedCorpusRow | null {
  const id = item.id;
  if (!id) return null;

  const views = toNumber(item.views);
  if (views < 1) return null;

  const uploadedRaw = item.uploadedAt;
  // apidojo uses ms Unix per RESEARCH §A.3 (seconds if value is small)
  const uploadedMs =
    typeof uploadedRaw === "number" && uploadedRaw < 10_000_000_000
      ? uploadedRaw * 1000
      : toNumber(uploadedRaw);
  const posted_at = new Date(uploadedMs);
  if (!isFinite(posted_at.getTime())) return null;
  if (Date.now() - posted_at.getTime() < SEVEN_DAYS_MS) return null;

  const follower_count = toNullableNumber(item.channel?.followers);

  return {
    platform: "tiktok",
    platform_video_id: id,
    video_url: item.postPage ?? null,
    creator_handle: normalizeOrNull(item.channel?.username),
    niche,
    corpus_version,
    scrape_kind,
    views,
    likes: toNumber(item.likes),
    comments: toNumber(item.comments),
    shares: toNumber(item.shares),
    saves: toNumber(item.bookmarks),
    duration_seconds: toNullableNumber(item.video?.duration),
    completion_pct: null, // KNOWN GAP
    follower_count,
    follower_tier: getFollowerTier(follower_count),
    caption: item.title && item.title.length > 0 ? item.title : null,
    hashtags: item.hashtags ?? [],
    sound_name: null, // apidojo doesn't expose sound name reliably
    posted_at,
    scraped_at: new Date(),
  };
}

function toNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string" && x.length > 0) {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = toNumber(x);
  return n > 0 ? n : null;
}

function normalizeOrNull(x: unknown): string | null {
  if (typeof x !== "string" || x.length === 0) return null;
  const trimmed = x.trim();
  if (trimmed.length === 0) return null;
  return normalizeHandle(trimmed);
}
