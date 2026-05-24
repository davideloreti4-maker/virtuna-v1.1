/**
 * Stage 2 of the corpus video persistence flow.
 *
 * Uploads .mp4 files from .planning/videos-cache/ to the `corpus-videos`
 * Supabase Storage bucket and backfills `training_corpus.video_storage_path`.
 *
 * Path scheme: ${corpus_version}/${platform_video_id}.mp4
 *
 * Stage 1 (scripts/download-corpus-videos.ts) must run first. This script
 * is idempotent: it skips any row whose `video_storage_path` is already set,
 * and it treats Supabase Storage 409/"Duplicate" responses as success.
 *
 * Usage:
 *   pnpm tsx scripts/upload-corpus-videos.ts [--version <slug>] [--dry-run] [--limit N] [--cache-dir <path>]
 *
 * Requires:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Stage 2 migration applied (corpus-videos bucket + video_storage_path column)
 *   - Supabase project-level upload limit raised above 66 MB if the largest
 *     mp4 exceeds the default (see migration header).
 */

import { resolve } from "path";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8")
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const BUCKET = "corpus-videos";

const log = (msg: string) => console.log(`[upload-corpus] ${msg}`);
const warn = (msg: string) => console.warn(`[upload-corpus] WARN: ${msg}`);
const err = (msg: string) => console.error(`[upload-corpus] ERROR: ${msg}`);

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  if (a.includes("=")) return a.split("=", 2)[1];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) return "";
  return next;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.some((a) => a === flag);
}

// ─── Failure categories ───────────────────────────────────────────────────────

type FailureCategory =
  | "missing_mp4"          // download script didn't produce this file
  | "missing_row"          // training_corpus row not found (shouldn't happen)
  | "oversize"             // file exceeds project upload limit
  | "storage_error"        // any other supabase.storage error
  | "db_error"             // UPDATE training_corpus failed
  | "other";

function classifyStorageError(message: string): FailureCategory {
  const m = message.toLowerCase();
  if (m.includes("payload") || m.includes("too large") || m.includes("exceed")) {
    return "oversize";
  }
  return "storage_error";
}

// ─── Manifest types ───────────────────────────────────────────────────────────

interface NicheStats {
  attempted: number;
  uploaded: number;
  skipped_already_uploaded: number;
  failed: number;
  bytes: number;
}

interface FailedUpload {
  platform_video_id: string;
  niche: string;
  category: FailureCategory;
  message: string;
}

interface UploadManifest {
  corpus_version: string;
  bucket: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  total_rows: number;
  total_attempted: number;
  total_uploaded: number;
  total_skipped_already_uploaded: number;
  total_failed: number;
  total_bytes: number;
  per_niche: Record<string, NicheStats>;
  failure_categories: Record<FailureCategory, number>;
  failed_uploads: FailedUpload[];
}

function writeManifest(path: string, manifest: UploadManifest): void {
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf-8");
}

function getFileBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  const version = getArg(argv, "--version") ?? "full.2026-05-11";
  const dryRun = hasFlag(argv, "--dry-run");
  const limitRaw = getArg(argv, "--limit");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  const cacheDirRaw = getArg(argv, "--cache-dir") ?? ".planning/videos-cache";
  const cacheDir = resolve(__dirname, "..", cacheDirRaw);

  log(`Version:    ${version}`);
  log(`Bucket:     ${BUCKET}`);
  log(`Cache dir:  ${cacheDir}`);
  log(`Dry run:    ${dryRun}`);
  if (limit !== undefined) log(`Limit:      ${limit}`);
  log("");

  // ── Query Supabase ─────────────────────────────────────────────────────────
  const supabase = createServiceClient();

  log(`Querying training_corpus for corpus_version=${version}...`);
  const { data, error } = await supabase
    .from("training_corpus")
    .select("id, platform_video_id, niche, bucket, video_storage_path")
    .eq("corpus_version", version)
    .order("niche")
    .order("bucket")
    .order("id");

  if (error) {
    err(`Supabase query failed: ${error.message}`);
    process.exit(1);
  }

  type Row = {
    id: string;
    platform_video_id: string;
    niche: string;
    bucket: string;
    video_storage_path: string | null;
  };
  const rows: Row[] = data ?? [];

  if (rows.length === 0) {
    err(`No rows found for corpus_version=${version}.`);
    process.exit(1);
  }

  log(`Found ${rows.length} rows.`);

  const workRows = limit !== undefined ? rows.slice(0, limit) : rows;
  if (limit !== undefined) {
    log(`Applying --limit ${limit}: processing ${workRows.length} of ${rows.length} rows.`);
  }
  log("");

  // ── Init stats ─────────────────────────────────────────────────────────────
  const niches = Array.from(new Set(workRows.map((r) => r.niche))).sort();
  const perNiche: Record<string, NicheStats> = {};
  for (const niche of niches) {
    perNiche[niche] = {
      attempted: 0,
      uploaded: 0,
      skipped_already_uploaded: 0,
      failed: 0,
      bytes: 0,
    };
  }

  const startedAt = new Date().toISOString();
  const startEpoch = Date.now();

  let totalUploaded = 0;
  let totalSkippedAlready = 0;
  let totalFailed = 0;
  let totalBytes = 0;

  const failureCategories: Record<FailureCategory, number> = {
    missing_mp4: 0,
    missing_row: 0,
    oversize: 0,
    storage_error: 0,
    db_error: 0,
    other: 0,
  };

  const failedUploads: FailedUpload[] = [];

  // ── DRY RUN ────────────────────────────────────────────────────────────────
  if (dryRun) {
    let wouldUpload = 0;
    let wouldSkipAlready = 0;
    let wouldSkipMissing = 0;
    let wouldUploadBytes = 0;

    for (const row of workRows) {
      const mp4 = resolve(cacheDir, `${row.platform_video_id}.mp4`);
      if (row.video_storage_path) {
        wouldSkipAlready++;
        continue;
      }
      if (!existsSync(mp4)) {
        wouldSkipMissing++;
        continue;
      }
      wouldUpload++;
      wouldUploadBytes += getFileBytes(mp4);
    }

    log("DRY RUN — no uploads will be performed.");
    log(`  Would upload:        ${wouldUpload} (${Math.round(wouldUploadBytes / 1024 / 1024)} MB)`);
    log(`  Already in DB path:  ${wouldSkipAlready}`);
    log(`  Missing mp4 on disk: ${wouldSkipMissing}`);
    process.exit(0);
  }

  // ── Upload loop ────────────────────────────────────────────────────────────
  const manifestPath = resolve(cacheDir, "upload-manifest.json");

  for (let i = 0; i < workRows.length; i++) {
    const row = workRows[i]!;
    const { id, platform_video_id, niche, bucket } = row;
    const progress = `[${i + 1}/${workRows.length}]`;
    const nicheKey = niche in perNiche ? niche : "other";
    if (!(nicheKey in perNiche)) {
      perNiche[nicheKey] = {
        attempted: 0,
        uploaded: 0,
        skipped_already_uploaded: 0,
        failed: 0,
        bytes: 0,
      };
    }

    // Skip — already uploaded per DB
    if (row.video_storage_path) {
      log(`${progress} ${platform_video_id} (${niche}/${bucket}) — already uploaded (path=${row.video_storage_path}), skipping`);
      totalSkippedAlready++;
      perNiche[nicheKey]!.skipped_already_uploaded++;
      continue;
    }

    const mp4Path = resolve(cacheDir, `${platform_video_id}.mp4`);

    // Skip — no local file (download failed)
    if (!existsSync(mp4Path)) {
      warn(`${progress} ${platform_video_id} (${niche}/${bucket}) — no mp4 on disk, skipping`);
      perNiche[nicheKey]!.attempted++;
      perNiche[nicheKey]!.failed++;
      totalFailed++;
      failureCategories.missing_mp4++;
      failedUploads.push({
        platform_video_id,
        niche,
        category: "missing_mp4",
        message: `Expected ${mp4Path} not found (download stage failed or pruned)`,
      });
      continue;
    }

    const bytes = getFileBytes(mp4Path);
    const sizeMb = Math.round((bytes / 1024 / 1024) * 10) / 10;
    const objectKey = `${version}/${platform_video_id}.mp4`;

    perNiche[nicheKey]!.attempted++;
    log(`${progress} ${platform_video_id} (${niche}/${bucket}) — uploading ${sizeMb} MB → ${objectKey}`);

    // Read file
    let body: Buffer;
    try {
      body = readFileSync(mp4Path);
    } catch (e) {
      warn(`  FAILED to read ${mp4Path}: ${(e as Error).message}`);
      perNiche[nicheKey]!.failed++;
      totalFailed++;
      failureCategories.other++;
      failedUploads.push({
        platform_video_id,
        niche,
        category: "other",
        message: `readFileSync: ${(e as Error).message}`,
      });
      continue;
    }

    // Upload
    const uploadStart = Date.now();
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectKey, body, {
        contentType: "video/mp4",
        upsert: false,
      });

    let alreadyExists = false;
    if (uploadErr) {
      const msg = uploadErr.message ?? String(uploadErr);
      // Supabase returns "Duplicate" / 409 when object already exists.
      if (/duplicate|already exists|resource already exists/i.test(msg)) {
        alreadyExists = true;
        log(`  OK — already in bucket, will backfill DB path`);
      } else {
        const category = classifyStorageError(msg);
        warn(`  FAILED (${category}): ${msg.slice(0, 160)}`);
        perNiche[nicheKey]!.failed++;
        totalFailed++;
        failureCategories[category]++;
        failedUploads.push({
          platform_video_id,
          niche,
          category,
          message: msg.slice(0, 300),
        });
        continue;
      }
    }

    if (!alreadyExists) {
      const durSec = Math.round((Date.now() - uploadStart) / 1000);
      log(`  OK — uploaded in ${durSec}s`);
    }

    // Backfill DB
    const { error: updateErr } = await supabase
      .from("training_corpus")
      .update({ video_storage_path: objectKey })
      .eq("id", id);

    if (updateErr) {
      warn(`  FAILED (db_error): ${updateErr.message}`);
      perNiche[nicheKey]!.failed++;
      totalFailed++;
      failureCategories.db_error++;
      failedUploads.push({
        platform_video_id,
        niche,
        category: "db_error",
        message: `UPDATE training_corpus: ${updateErr.message}`,
      });
      continue;
    }

    totalUploaded++;
    totalBytes += bytes;
    perNiche[nicheKey]!.uploaded++;
    perNiche[nicheKey]!.bytes += bytes;

    // Save progress every 10 uploads
    if ((totalUploaded + totalFailed) % 10 === 0) {
      const partial: UploadManifest = {
        corpus_version: version,
        bucket: BUCKET,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - startEpoch) / 1000),
        total_rows: workRows.length,
        total_attempted: totalUploaded + totalFailed,
        total_uploaded: totalUploaded,
        total_skipped_already_uploaded: totalSkippedAlready,
        total_failed: totalFailed,
        total_bytes: totalBytes,
        per_niche: perNiche,
        failure_categories: failureCategories,
        failed_uploads: failedUploads,
      };
      writeManifest(manifestPath, partial);
    }
  }

  // ── Final manifest ─────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();
  const durationSeconds = Math.round((Date.now() - startEpoch) / 1000);

  const manifest: UploadManifest = {
    corpus_version: version,
    bucket: BUCKET,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: durationSeconds,
    total_rows: workRows.length,
    total_attempted: totalUploaded + totalFailed,
    total_uploaded: totalUploaded,
    total_skipped_already_uploaded: totalSkippedAlready,
    total_failed: totalFailed,
    total_bytes: totalBytes,
    per_niche: perNiche,
    failure_categories: failureCategories,
    failed_uploads: failedUploads,
  };

  writeManifest(manifestPath, manifest);
  log("");
  log(`Manifest written to: ${manifestPath}`);

  // ── Final report ───────────────────────────────────────────────────────────
  const effectiveCovered = totalUploaded + totalSkippedAlready;
  const coverage = workRows.length > 0
    ? Math.round((effectiveCovered / workRows.length) * 100)
    : 0;

  log("");
  log("═══════════════════════════════════════════════════════════");
  log("  STAGE 2 UPLOAD COMPLETE");
  log("═══════════════════════════════════════════════════════════");
  log(`  Coverage:           ${effectiveCovered} / ${workRows.length} (${coverage}%)`);
  log(`    Uploaded now:     ${totalUploaded}`);
  log(`    Already in DB:    ${totalSkippedAlready}`);
  log(`    Failed:           ${totalFailed}`);
  log(`  Total new bytes:    ${Math.round(totalBytes / 1024 / 1024)} MB`);
  log(`  Duration:           ${Math.round(durationSeconds / 60)}m ${durationSeconds % 60}s`);
  log("");
  log("  Per-niche success (this run):");
  for (const niche of Object.keys(perNiche).sort()) {
    const s = perNiche[niche]!;
    const denom = s.attempted;
    const pct = denom > 0 ? Math.round((s.uploaded / denom) * 100) : 0;
    log(`    ${niche.padEnd(10)} ${s.uploaded}/${denom} (${pct}%)  +${s.skipped_already_uploaded} already in DB`);
  }
  log("");

  if (totalFailed > 0) {
    log("  Failure categories:");
    const cats = Object.entries(failureCategories)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a);
    for (const [cat, count] of cats) {
      log(`    ${cat.padEnd(18)} ${count}`);
    }
    log("");
  }

  log("═══════════════════════════════════════════════════════════");

  // Threshold gate: 90% coverage of work rows
  const threshold = Math.floor(workRows.length * 0.9);
  if (effectiveCovered < threshold) {
    err(`Coverage below 90%: ${effectiveCovered}/${workRows.length}. Investigate failures.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  err(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) err(e.stack);
  process.exit(1);
});
