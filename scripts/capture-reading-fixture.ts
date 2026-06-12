/**
 * Phase 2 (DATA-02 / D-12) — REAL Reading fixture capture (authenticated path).
 *
 * Companion to scripts/smoke-tiktok-pipeline.ts. The smoke script's `--direct`
 * mode cannot authenticate against `/api/analyze` (the route requires a Supabase
 * session; the direct POST sends no cookie), and its UI mode writes the RAW row
 * as the "live" half — the wrong shape for `canonicalFromLive`, which reads
 * `result.hero` / `result.apollo_reasoning` TOP-LEVEL. So we capture the genuine
 * live `complete` SSE payload from an authenticated browser `fetch` (top-level
 * shape intact) and pair it with the persisted row here.
 *
 * This script:
 *   1. reads the captured live `complete` payload (a real PredictionResult);
 *   2. resolves the persisted `analysis_results` row for USER_ID — the most
 *      recent row IS the run just performed — and settles the post-`complete`
 *      `variants.apollo` write (Pitfall 2) before snapshotting;
 *   3. writes live-<id>.json + persisted-<id>.json (shared id) into
 *      src/lib/reading/__tests__/fixtures/.
 *
 * Usage:
 *   pnpm tsx scripts/capture-reading-fixture.ts <live-payload.json> <user-id>
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const [livePayloadPath, userId] = process.argv.slice(2);
if (!livePayloadPath || !userId) {
  console.error(
    "Usage: pnpm tsx scripts/capture-reading-fixture.ts <live-payload.json> <user-id>"
  );
  process.exit(1);
}

const FIXTURES_DIR = resolve(__dirname, "../src/lib/reading/__tests__/fixtures");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("[capture] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

/** Read the live payload; tolerate the MCP double-encoding (string-of-JSON). */
function readLivePayload(path: string): Record<string, unknown> {
  let parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as Record<string, unknown>;
}

/** Settle the post-`complete` variants.apollo write before snapshotting. */
async function fetchSettledRow(
  userIdArg: string,
  attempts = 6,
  delayMs = 2000
): Promise<Record<string, unknown> | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("user_id", userIdArg)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      const variants = (row.variants ?? null) as { apollo?: unknown } | null;
      if (variants != null && variants.apollo != null) {
        console.log(`[capture] row ${row.id} settled (variants.apollo present) on attempt ${attempt}`);
        return row;
      }
      console.log(`[capture] attempt ${attempt}/${attempts}: variants.apollo not yet present for ${row.id} — waiting ${delayMs}ms`);
    } else {
      console.log(`[capture] attempt ${attempt}/${attempts}: no row yet — waiting ${delayMs}ms`);
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function main() {
  const live = readLivePayload(livePayloadPath);
  console.log(`[capture] live payload: overall_score=${live.overall_score} hero=${!!live.hero} apollo=${!!live.apollo_reasoning}`);

  const row = await fetchSettledRow(userId);
  if (!row) {
    console.error("[capture] ABORTED — persisted row never settled (variants.apollo absent). No fixture written.");
    process.exit(1);
  }
  const id = row.id as string;
  if (!id) {
    console.error("[capture] ABORTED — persisted row has no id.");
    process.exit(1);
  }

  mkdirSync(FIXTURES_DIR, { recursive: true });
  const livePath = resolve(FIXTURES_DIR, `live-${id}.json`);
  const persistedPath = resolve(FIXTURES_DIR, `persisted-${id}.json`);
  writeFileSync(livePath, JSON.stringify(live, null, 2));
  writeFileSync(persistedPath, JSON.stringify(row, null, 2));

  console.log(`[capture] REAL fixture pair written for analysis ${id}:`);
  console.log(`  live      → ${livePath}`);
  console.log(`  persisted → ${persistedPath}`);
}

main().catch((err) => {
  console.error("[capture] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
