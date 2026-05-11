/**
 * Download all corpus videos to .planning/videos-cache/ via yt-dlp.
 *
 * Stage 1 of the corpus video persistence flow. Stage 2 (R2 upload + DB
 * schema) is a separate script.
 *
 * Usage:
 *   pnpm tsx scripts/download-corpus-videos.ts [--version <slug>] [--retry-failed] [--dry-run]
 *
 * Idempotency: skips any video_id whose .mp4 already exists on disk.
 * Run in retry-failed mode to re-attempt only the previously-failed IDs.
 */

import { resolve } from "path";
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";
import { spawn } from "child_process";

// Load .env.local (consistent with other scripts)
config({ path: resolve(__dirname, "../.env.local") });

// Register tsconfig-paths for @/ aliases
const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8")
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

// ─── Logging helpers ─────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[download-corpus] ${msg}`);
const warn = (msg: string) => console.warn(`[download-corpus] WARN: ${msg}`);
const err = (msg: string) => console.error(`[download-corpus] ERROR: ${msg}`);

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  if (a.includes("=")) return a.split("=", 2)[1];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) {
    return ""; // flag present but no value — treat as boolean
  }
  return next;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.some((a) => a === flag);
}

// ─── Failure categories ───────────────────────────────────────────────────────

type FailureCategory = "deleted" | "region_locked" | "rate_limited" | "other";

function classifyFailure(stderr: string): FailureCategory {
  const s = stderr.toLowerCase();
  if (s.includes("429") || s.includes("rate limit") || s.includes("too many requests")) {
    return "rate_limited";
  }
  if (
    s.includes("404") ||
    s.includes("video not found") ||
    s.includes("does not exist") ||
    s.includes("removed") ||
    s.includes("no longer available") ||
    s.includes("this video is private") ||
    s.includes("unavailable")
  ) {
    return "deleted";
  }
  if (
    s.includes("region") ||
    s.includes("country") ||
    s.includes("geo") ||
    s.includes("not available in your")
  ) {
    return "region_locked";
  }
  return "other";
}

// ─── yt-dlp runner ────────────────────────────────────────────────────────────

interface YtDlpResult {
  exitCode: number;
  stderr: string;
  durationMs: number;
}

function runYtDlp(videoUrl: string, outputTemplate: string): Promise<YtDlpResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = [
      "-o", outputTemplate,
      "--write-info-json",
      "--write-thumbnail",
      "--convert-thumbnails", "jpg",
      "--no-warnings",
      "--no-playlist",
      "--retries", "2",
      "--socket-timeout", "30",
      "--sleep-interval", "2",
      "--max-sleep-interval", "5",
      "--restrict-filenames",
      "--no-progress",
      videoUrl,
    ];

    const proc = spawn("yt-dlp", args);
    const stderrChunks: Buffer[] = [];

    proc.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    proc.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        durationMs: Date.now() - start,
      });
    });

    proc.on("error", (e) => {
      resolve({
        exitCode: 1,
        stderr: e.message,
        durationMs: Date.now() - start,
      });
    });
  });
}

// ─── Manifest types ───────────────────────────────────────────────────────────

interface NicheStats {
  attempted: number;
  succeeded: number;
  failed: number;
  bytes: number;
}

interface FailedVideo {
  platform_video_id: string;
  video_url: string;
  niche: string;
  category: FailureCategory;
  stderr_excerpt: string;
}

interface Manifest {
  corpus_version: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  total_attempted: number;
  total_succeeded: number;
  total_skipped_already_downloaded: number;
  total_failed: number;
  total_bytes: number;
  per_niche: Record<string, NicheStats>;
  failure_categories: Record<FailureCategory, number>;
  failed_videos: FailedVideo[];
}

// ─── File size helper ─────────────────────────────────────────────────────────

function getFileBytes(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

// ─── Manifest I/O ─────────────────────────────────────────────────────────────

function writeManifest(manifestPath: string, manifest: Manifest): void {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

function readManifest(manifestPath: string): Manifest | null {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  const version = getArg(argv, "--version") ?? "full.2026-05-11";
  const dryRun = hasFlag(argv, "--dry-run");
  const retryFailed = hasFlag(argv, "--retry-failed");
  const limitRaw = getArg(argv, "--limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  const cacheDirRaw = getArg(argv, "--cache-dir") ?? ".planning/videos-cache";
  const cacheDir = resolve(__dirname, "..", cacheDirRaw);

  log(`Version:      ${version}`);
  log(`Cache dir:    ${cacheDir}`);
  log(`Dry run:      ${dryRun}`);
  log(`Retry failed: ${retryFailed}`);
  if (limit !== undefined) log(`Limit:        ${limit}`);
  log("");

  // ── Ensure cache dir exists ────────────────────────────────────────────────
  if (!dryRun) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const manifestPath = resolve(cacheDir, "manifest.json");

  // ── Load existing manifest (for retry-failed mode) ─────────────────────────
  let previousManifest: Manifest | null = null;
  if (retryFailed) {
    previousManifest = readManifest(manifestPath);
    if (!previousManifest) {
      err("--retry-failed requires an existing manifest.json at the cache dir. Run without the flag first.");
      process.exit(1);
    }
    log(`Loaded previous manifest. ${previousManifest.failed_videos.length} failed videos to retry.`);
    log("");
  }

  // ── Query Supabase ────────────────────────────────────────────────────────
  const supabase = createServiceClient();

  let rows: Array<{
    id: string;
    platform_video_id: string;
    video_url: string | null;
    niche: string;
    bucket: string;
    creator_handle: string | null;
  }>;

  if (retryFailed && previousManifest) {
    const failedIds = new Set(
      previousManifest.failed_videos.map((v) => v.platform_video_id)
    );
    log(`Querying Supabase for ${failedIds.size} previously failed videos...`);

    const { data, error } = await supabase
      .from("training_corpus")
      .select("id, platform_video_id, video_url, niche, bucket, creator_handle")
      .eq("corpus_version", version)
      .in("platform_video_id", Array.from(failedIds))
      .order("niche")
      .order("bucket")
      .order("id");

    if (error) {
      err(`Supabase query failed: ${error.message}`);
      process.exit(1);
    }
    rows = data ?? [];
  } else {
    log(`Querying Supabase for all rows with corpus_version=${version}...`);

    const { data, error } = await supabase
      .from("training_corpus")
      .select("id, platform_video_id, video_url, niche, bucket, creator_handle")
      .eq("corpus_version", version)
      .order("niche")
      .order("bucket")
      .order("id");

    if (error) {
      err(`Supabase query failed: ${error.message}`);
      process.exit(1);
    }
    rows = data ?? [];
  }

  if (rows.length === 0) {
    err(`No rows found for corpus_version=${version}. Check the version slug.`);
    process.exit(1);
  }

  log(`Found ${rows.length} rows.`);

  // Apply limit
  const workRows = limit !== undefined ? rows.slice(0, limit) : rows;
  if (limit !== undefined) {
    log(`Applying --limit ${limit}: processing ${workRows.length} of ${rows.length} rows.`);
  }
  log("");

  // ── Determine niches for stats ─────────────────────────────────────────────
  const niches = Array.from(new Set(workRows.map((r) => r.niche))).sort();
  const perNiche: Record<string, NicheStats> = {};
  for (const niche of niches) {
    perNiche[niche] = { attempted: 0, succeeded: 0, failed: 0, bytes: 0 };
  }

  // ── State tracking ─────────────────────────────────────────────────────────
  const startedAt = new Date().toISOString();
  const startEpoch = Date.now();

  let totalSucceeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalBytes = 0;

  const failureCategories: Record<FailureCategory, number> = {
    deleted: 0,
    region_locked: 0,
    rate_limited: 0,
    other: 0,
  };

  const failedVideos: FailedVideo[] = [];

  // ── DRY RUN early exit ─────────────────────────────────────────────────────
  if (dryRun) {
    let wouldSkip = 0;
    let wouldDownload = 0;
    let wouldSkipNull = 0;

    for (const row of workRows) {
      if (!row.video_url) {
        wouldSkipNull++;
        continue;
      }
      const mp4Path = resolve(cacheDir, `${row.platform_video_id}.mp4`);
      if (existsSync(mp4Path)) {
        wouldSkip++;
      } else {
        wouldDownload++;
      }
    }

    log("DRY RUN — no files will be downloaded.");
    log(`Would process: ${workRows.length} rows`);
    log(`  Already on disk (skip):  ${wouldSkip}`);
    log(`  Null video_url (skip):   ${wouldSkipNull}`);
    log(`  Would download:          ${wouldDownload}`);
    log(`Cache dir: ${cacheDir}`);
    process.exit(0);
  }

  // ── Main download loop ─────────────────────────────────────────────────────
  const BATCH_SIZE = 10;
  let processedSinceSave = 0;
  let lastSaveEpoch = Date.now();

  const saveProgress = () => {
    const now = new Date().toISOString();
    const durationSec = Math.round((Date.now() - startEpoch) / 1000);
    const partialManifest: Manifest = {
      corpus_version: version,
      started_at: startedAt,
      completed_at: now,
      duration_seconds: durationSec,
      total_attempted: totalSucceeded + totalFailed,
      total_succeeded: totalSucceeded,
      total_skipped_already_downloaded: totalSkipped,
      total_failed: totalFailed,
      total_bytes: totalBytes,
      per_niche: perNiche,
      failure_categories: failureCategories,
      failed_videos: failedVideos,
    };
    writeManifest(manifestPath, partialManifest);
  };

  for (let i = 0; i < workRows.length; i++) {
    const row = workRows[i]!;
    const { platform_video_id, video_url, niche, bucket } = row;

    const nicheKey = niche in perNiche ? niche : "other";
    if (!(nicheKey in perNiche)) {
      perNiche[nicheKey] = { attempted: 0, succeeded: 0, failed: 0, bytes: 0 };
    }

    const mp4Path = resolve(cacheDir, `${platform_video_id}.mp4`);
    const outputTemplate = resolve(cacheDir, `${platform_video_id}.%(ext)s`);

    const progress = `[${i + 1}/${workRows.length}]`;

    // ── Skip: null URL ─────────────────────────────────────────────────────
    if (!video_url) {
      warn(`${progress} ${platform_video_id} (${niche}/${bucket}) — video_url is null, skipping`);
      perNiche[nicheKey]!.attempted++;
      perNiche[nicheKey]!.failed++;
      totalFailed++;
      failureCategories.other++;
      failedVideos.push({
        platform_video_id,
        video_url: "",
        niche,
        category: "other",
        stderr_excerpt: "video_url is null in training_corpus",
      });
      continue;
    }

    // ── Skip: already downloaded ───────────────────────────────────────────
    if (existsSync(mp4Path)) {
      const bytes = getFileBytes(mp4Path);
      log(`${progress} ${platform_video_id} (${niche}/${bucket}) — already on disk (${Math.round(bytes / 1024)}KB), skipping`);
      totalSkipped++;
      totalBytes += bytes;
      perNiche[nicheKey]!.bytes += bytes;
      // Don't count skipped as attempted — they were done in a prior run
      continue;
    }

    // ── Download ──────────────────────────────────────────────────────────
    perNiche[nicheKey]!.attempted++;
    log(`${progress} ${platform_video_id} (${niche}/${bucket}) — downloading...`);

    const result = await runYtDlp(video_url, outputTemplate);

    if (result.exitCode === 0 && existsSync(mp4Path)) {
      const bytes = getFileBytes(mp4Path);
      totalSucceeded++;
      totalBytes += bytes;
      perNiche[nicheKey]!.succeeded++;
      perNiche[nicheKey]!.bytes += bytes;
      log(`  OK — ${Math.round(bytes / 1024 / 1024 * 10) / 10}MB in ${Math.round(result.durationMs / 1000)}s`);
    } else {
      totalFailed++;
      perNiche[nicheKey]!.failed++;

      const category = classifyFailure(result.stderr);
      failureCategories[category]++;

      const stderrExcerpt = result.stderr.slice(0, 300).trim();
      warn(`  FAILED (${category}): ${stderrExcerpt.slice(0, 120)}`);

      failedVideos.push({
        platform_video_id,
        video_url,
        niche,
        category,
        stderr_excerpt: stderrExcerpt,
      });
    }

    processedSinceSave++;
    const timeSinceSave = Date.now() - lastSaveEpoch;

    // Save every 10 videos or 30 seconds
    if (processedSinceSave >= BATCH_SIZE || timeSinceSave >= 30_000) {
      saveProgress();
      processedSinceSave = 0;
      lastSaveEpoch = Date.now();
    }
  }

  // ── Final manifest ─────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();
  const durationSeconds = Math.round((Date.now() - startEpoch) / 1000);

  const manifest: Manifest = {
    corpus_version: version,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: durationSeconds,
    total_attempted: totalSucceeded + totalFailed,
    total_succeeded: totalSucceeded,
    total_skipped_already_downloaded: totalSkipped,
    total_failed: totalFailed,
    total_bytes: totalBytes,
    per_niche: perNiche,
    failure_categories: failureCategories,
    failed_videos: failedVideos,
  };

  writeManifest(manifestPath, manifest);
  log(`\nManifest written to: ${manifestPath}`);

  // ── Final report ───────────────────────────────────────────────────────────
  const totalProcessed = totalSucceeded + totalFailed + totalSkipped;
  const successRate =
    totalProcessed > 0
      ? Math.round(((totalSucceeded + totalSkipped) / totalProcessed) * 100)
      : 0;

  log("");
  log("═══════════════════════════════════════════════════════════");
  log("  STAGE 1 DOWNLOAD COMPLETE");
  log("═══════════════════════════════════════════════════════════");
  log(`  Total: ${totalSucceeded + totalSkipped} / ${workRows.length} (${successRate}% effective)`);
  log(`    Downloaded now:   ${totalSucceeded}`);
  log(`    Already on disk:  ${totalSkipped}`);
  log(`    Failed:           ${totalFailed}`);
  log(`  Total disk:         ${Math.round(totalBytes / 1024 / 1024)}MB`);
  log(`  Duration:           ${Math.round(durationSeconds / 60)}m ${durationSeconds % 60}s`);
  log("");
  log("  Per-niche success:");
  for (const niche of Object.keys(perNiche).sort()) {
    const s = perNiche[niche]!;
    const total = s.attempted + (retryFailed ? 0 : 0);
    const pct = s.attempted > 0 ? Math.round((s.succeeded / s.attempted) * 100) : 0;
    log(`    ${niche.padEnd(10)} ${s.succeeded}/${s.attempted} (${pct}%)`);
  }
  log("");

  if (totalFailed > 0) {
    log("  Top failure categories:");
    const cats = Object.entries(failureCategories)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    for (const [cat, count] of cats) {
      log(`    ${cat.padEnd(15)} ${count}`);
    }
    log("");
  }

  log(`  Manifest: ${manifestPath}`);
  log("═══════════════════════════════════════════════════════════");

  // ── Exit code ─────────────────────────────────────────────────────────────
  const effectiveSucceeded = totalSucceeded + totalSkipped;
  const successThreshold = Math.floor(workRows.length * 0.9);
  if (effectiveSucceeded < successThreshold) {
    err(`Success rate below 90%: ${effectiveSucceeded}/${workRows.length}. Investigate failures before Stage 2.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  err(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) err(e.stack);
  process.exit(1);
});
