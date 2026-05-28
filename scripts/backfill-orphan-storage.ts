/**
 * One-shot backfill script for Phase 3 (quick task 260528-nsb).
 *
 * Remediates two populations confirmed on 2026-05-28 by Supabase diagnostics
 * on project qyxvxleheckijapurisj:
 *
 * Mode A — 18 orphan storage objects in videos/ bucket with no DB referent.
 *           → Delete them.
 * Mode B — 9 analysis_results rows with video_storage_path set but storage gone.
 *           → Null out video_storage_path.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-orphan-storage.ts --dry-run   (default, safe)
 *   pnpm tsx scripts/backfill-orphan-storage.ts --apply     (mutates; run after merge)
 *
 * Idempotent: re-running --apply on already-remediated data is a no-op.
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Post-merge checklist:
 *   1. Run --dry-run to confirm counts (expect ~18 Mode A, ~9 Mode B; may drift over time).
 *   2. Run --apply to remediate.
 *   3. Re-run the diagnostic SQL from 260528-nsb-RESEARCH.md to confirm both return 0.
 */

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const dryRun = !apply;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "[backfill] ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * Mode A: Find storage objects in videos/ bucket with no matching analysis_results row.
 */
async function findOrphans(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema("storage")
    .from("objects")
    .select("name")
    .eq("bucket_id", "videos");

  if (error) {
    throw new Error(`[backfill] List storage failed: ${(error as { message: string }).message}`);
  }

  const allPaths = ((data ?? []) as { name: string }[]).map((r) => r.name);
  if (allPaths.length === 0) return [];

  const { data: matched, error: matchErr } = await supabase
    .from("analysis_results")
    .select("video_storage_path")
    .in("video_storage_path", allPaths);

  if (matchErr) {
    throw new Error(`[backfill] Match query failed: ${matchErr.message}`);
  }

  const matchedSet = new Set(
    ((matched ?? []) as { video_storage_path: string | null }[])
      .map((r) => r.video_storage_path)
      .filter((p): p is string => p !== null)
  );

  return allPaths.filter((p) => !matchedSet.has(p));
}

/**
 * Mode B: Find analysis_results rows with video_storage_path set but storage object missing.
 */
async function findDanglingRefs(): Promise<{ id: string; path: string }[]> {
  const { data: rows, error } = await supabase
    .from("analysis_results")
    .select("id, video_storage_path")
    .not("video_storage_path", "is", null);

  if (error) {
    throw new Error(`[backfill] Query analysis_results failed: ${error.message}`);
  }

  if (!rows || rows.length === 0) return [];

  const paths = (rows as { id: string; video_storage_path: string }[]).map(
    (r) => r.video_storage_path
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: storErr } = await (supabase as any)
    .schema("storage")
    .from("objects")
    .select("name")
    .eq("bucket_id", "videos")
    .in("name", paths);

  if (storErr) {
    throw new Error(
      `[backfill] Storage check failed: ${(storErr as { message: string }).message}`
    );
  }

  const existingSet = new Set(
    ((existing ?? []) as { name: string }[]).map((r) => r.name)
  );

  return (rows as { id: string; video_storage_path: string }[])
    .filter((r) => !existingSet.has(r.video_storage_path))
    .map((r) => ({ id: r.id, path: r.video_storage_path }));
}

async function main(): Promise<void> {
  console.log(`[backfill] mode: ${dryRun ? "DRY-RUN (safe)" : "APPLY (mutating)"}`);
  console.log(`[backfill] project: ${SUPABASE_URL}`);
  console.log("");

  const orphans = await findOrphans();
  console.log(`[backfill] Mode A — orphan storage objects: ${orphans.length}`);
  orphans.slice(0, 30).forEach((p) => console.log(`  ${p}`));
  if (orphans.length > 30) {
    console.log(`  ... and ${orphans.length - 30} more`);
  }

  const dangling = await findDanglingRefs();
  console.log(`[backfill] Mode B — dangling DB references: ${dangling.length}`);
  dangling.slice(0, 30).forEach((d) =>
    console.log(`  ${d.id} → ${d.path}`)
  );
  if (dangling.length > 30) {
    console.log(`  ... and ${dangling.length - 30} more`);
  }

  if (dryRun) {
    console.log("");
    console.log(
      "[backfill] Dry run complete. Re-run with --apply to remediate."
    );
    return;
  }

  // --- APPLY mode ---
  console.log("");

  if (orphans.length > 0) {
    console.log(`[backfill] Deleting ${orphans.length} orphan storage objects...`);
    const { error: delErr } = await supabase.storage
      .from("videos")
      .remove(orphans);
    if (delErr) {
      console.error(`[backfill] Storage delete failed: ${delErr.message}`);
      process.exit(1);
    }
    console.log(`[backfill] Deleted ${orphans.length} orphan storage objects. OK`);
  } else {
    console.log("[backfill] Mode A: nothing to delete.");
  }

  if (dangling.length > 0) {
    console.log(
      `[backfill] Nulling video_storage_path on ${dangling.length} dangling rows...`
    );
    const ids = dangling.map((d) => d.id);
    const { error: updErr } = await supabase
      .from("analysis_results")
      .update({ video_storage_path: null })
      .in("id", ids);
    if (updErr) {
      console.error(`[backfill] Update failed: ${updErr.message}`);
      process.exit(1);
    }
    console.log(
      `[backfill] Nulled video_storage_path on ${ids.length} rows. OK`
    );
  } else {
    console.log("[backfill] Mode B: nothing to null.");
  }

  console.log("");
  console.log("[backfill] Done.");
}

main().catch((err: unknown) => {
  console.error(
    "[backfill] Fatal:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
