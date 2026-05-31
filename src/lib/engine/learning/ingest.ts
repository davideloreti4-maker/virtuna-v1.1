/**
 * 1:1 E2E learning loop — ingest.
 *
 * Turns a scraped social video into a training row: download the RAW mp4, store
 * it in the SAME `videos` bucket the production pipeline reads (under a
 * `training/` prefix, so the later engine run is byte-identical to a user
 * upload), and insert an `engine_training_videos` row with the real platform
 * metrics as ground truth.
 *
 * Reuses corpus/normalize-scrape for the metric parsing (that logic is sound —
 * it's the text-proxy EVALUATION we distrust, not the scrape normalizer). The
 * Apify actor run itself stays in the caller; this module takes already-fetched
 * raw items so the core is decoupled + unit-testable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import {
  normalizeScrapedItem,
  type NormalizedCorpusRow,
} from "../corpus/normalize-scrape";
import type { Niche, ScrapeConfigKind } from "../corpus/apify-jobs";

const log = createLogger({ module: "learning/ingest" });

const VIDEO_BUCKET = "videos"; // MUST match pipeline.ts:499 storage.from("videos")
const TRAINING_PREFIX = "training";

/** Storage key for a training video — lives in the `videos` bucket so the engine reads it 1:1. */
export function trainingVideoStorageKey(platformVideoId: string): string {
  // sanitize: storage keys must avoid path traversal / odd chars
  const safe = platformVideoId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${TRAINING_PREFIX}/${safe}.mp4`;
}

/**
 * Pull a directly-downloadable mp4 URL out of a raw Apify item.
 * clockworks exposes `mediaUrls[]` (CDN, short-lived) and `videoMeta.downloadAddr`.
 * Returns null when no downloadable URL is present (caller skips the item).
 */
export function extractDownloadUrl(rawItem: unknown): string | null {
  if (typeof rawItem !== "object" || rawItem === null) return null;
  const raw = rawItem as Record<string, unknown>;

  const mediaUrls = raw["mediaUrls"];
  if (Array.isArray(mediaUrls)) {
    const first = mediaUrls.find(
      (u): u is string => typeof u === "string" && u.startsWith("http"),
    );
    if (first) return first;
  }

  const videoMeta = raw["videoMeta"] as Record<string, unknown> | undefined;
  for (const key of ["downloadAddr", "playAddr"]) {
    const v = videoMeta?.[key];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  return null;
}

/** Row shape inserted at the `scraped` stage (engine fields filled later by the predict sweep). */
export interface EngineTrainingVideoInsert {
  platform: "tiktok";
  platform_video_id: string;
  video_url: string | null;
  creator_handle: string | null;
  posted_at: string | null;
  video_storage_path: string;
  duration_seconds: number | null;
  society_id: string | null;
  niche: string;
  real_views: number;
  real_likes: number;
  real_comments: number;
  real_shares: number;
  real_saves: number;
  real_completion_pct: number | null;
  follower_count: number | null;
  status: "scraped";
}

/** Pure mapper: NormalizedCorpusRow + storage key → insert row. */
export function buildTrainingVideoInsert(
  n: NormalizedCorpusRow,
  videoStoragePath: string,
  societyId?: string | null,
): EngineTrainingVideoInsert {
  return {
    platform: "tiktok",
    platform_video_id: n.platform_video_id,
    video_url: n.video_url,
    creator_handle: n.creator_handle,
    posted_at: n.posted_at.toISOString(),
    video_storage_path: videoStoragePath,
    duration_seconds: n.duration_seconds,
    society_id: societyId ?? n.niche,
    niche: n.niche,
    real_views: n.views,
    real_likes: n.likes,
    real_comments: n.comments,
    real_shares: n.shares,
    real_saves: n.saves,
    real_completion_pct: n.completion_pct,
    follower_count: n.follower_count,
    status: "scraped",
  };
}

export type IngestSkipReason =
  | "normalize_failed"
  | "no_download_url"
  | "download_failed"
  | "store_failed"
  | "duplicate";

export interface IngestResult {
  ok: boolean;
  platform_video_id: string | null;
  skipped?: IngestSkipReason;
  error?: string;
}

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB guard

/** Download an mp4 to a Buffer with a size cap. Returns null on failure. */
async function downloadVideo(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn("video download non-200", { status: res.status });
      return null;
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_VIDEO_BYTES) {
      log.warn("video exceeds size cap; skipping", { len });
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_VIDEO_BYTES) return null;
    return buf;
  } catch (err) {
    log.warn("video download threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Ingest one raw Apify item end-to-end: normalize → download mp4 → store →
 * insert row. Skip-on-fail (never throws); returns a structured result.
 */
export async function ingestScrapedItem(
  rawItem: unknown,
  niche: Niche,
  opts: {
    corpusVersion: string;
    scrapeKind: ScrapeConfigKind;
    societyId?: string | null;
    supabase?: SupabaseClient;
  },
): Promise<IngestResult> {
  const supabase = opts.supabase ?? createServiceClient();

  const normalized = normalizeScrapedItem(
    rawItem,
    niche,
    opts.corpusVersion,
    opts.scrapeKind,
  );
  if (!normalized) return { ok: false, platform_video_id: null, skipped: "normalize_failed" };

  const downloadUrl = extractDownloadUrl(rawItem);
  if (!downloadUrl) {
    return { ok: false, platform_video_id: normalized.platform_video_id, skipped: "no_download_url" };
  }

  const bytes = await downloadVideo(downloadUrl);
  if (!bytes) {
    return { ok: false, platform_video_id: normalized.platform_video_id, skipped: "download_failed" };
  }

  const storageKey = trainingVideoStorageKey(normalized.platform_video_id);
  const { error: uploadErr } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(storageKey, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadErr) {
    return {
      ok: false,
      platform_video_id: normalized.platform_video_id,
      skipped: "store_failed",
      error: uploadErr.message,
    };
  }

  const row = buildTrainingVideoInsert(normalized, storageKey, opts.societyId);
  const { error: insertErr } = await supabase
    .from("engine_training_videos")
    .upsert(row, { onConflict: "platform,platform_video_id", ignoreDuplicates: true });
  if (insertErr) {
    return {
      ok: false,
      platform_video_id: normalized.platform_video_id,
      skipped: "duplicate",
      error: insertErr.message,
    };
  }

  log.info("ingested training video", {
    id: normalized.platform_video_id,
    niche,
    views: normalized.views,
  });
  return { ok: true, platform_video_id: normalized.platform_video_id };
}

/** Batch ingest. Sequential to bound memory (videos are large); returns per-item results. */
export async function ingestScrapedItems(
  items: unknown[],
  niche: Niche,
  opts: {
    corpusVersion: string;
    scrapeKind: ScrapeConfigKind;
    societyId?: string | null;
    supabase?: SupabaseClient;
  },
): Promise<{ ingested: number; skipped: number; results: IngestResult[] }> {
  const supabase = opts.supabase ?? createServiceClient();
  const results: IngestResult[] = [];
  for (const item of items) {
    results.push(await ingestScrapedItem(item, niche, { ...opts, supabase }));
  }
  const ingested = results.filter((r) => r.ok).length;
  return { ingested, skipped: results.length - ingested, results };
}
