import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { ApifyClient } from "apify-client";

// Load .env.local (Next.js convention — same pattern as other scripts)
config({ path: resolve(__dirname, "../.env.local") });

// Register tsconfig-paths so @/ aliases resolve correctly at runtime.
// Must happen before any @/-aliased modules are required.
const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildCorpus, scrapeRawToCache, bucketAndPersist, writeRawCache, readRawCache, defaultCachePath } =
  require("../src/lib/engine/corpus/orchestrator");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseBuildCorpusArgs,
  BuildCorpusArgsError,
} = require("../src/lib/engine/corpus/cli/build-corpus-args");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calibrate, formatThresholdCodeBlock } = require("../src/lib/engine/corpus/calibration");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NICHES } = require("../src/lib/engine/corpus/eval-config");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const log = (msg: string) => console.log(`[build-corpus] ${msg}`);
const warn = (msg: string) => console.warn(`[build-corpus] WARN: ${msg}`);

async function main() {
  let args;
  try {
    args = parseBuildCorpusArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof BuildCorpusArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(1);
    }
    throw err;
  }

  log(`Mode: ${args.mode} | Version: ${args.version} | DryRun: ${args.dryRun}`);

  // ── SMOKE mode ────────────────────────────────────────────────────────────
  if (args.mode === "smoke") {
    log("Smoke test: 1 niche × 1 hashtag × maxItems=20, dry-run");
    const niche = (args.niches?.[0] ?? "beauty") as string;
    const apifyClient = new ApifyClient({ token: process.env.APIFY_TOKEN ?? "" });

    const rows = await scrapeRawToCache({
      version: args.version,
      niches: [niche],
      configs: ["trending"],
      apifyClient,
      isPilot: true,
      apifyWaitSecs: 300,
    });

    log(`Smoke test complete. Items scraped (post-filter): ${rows.length}`);
    log("Field coverage report:");

    const hasCaptions = rows.filter((r: { caption: string | null }) => r.caption !== null).length;
    const hasViews = rows.filter((r: { views: number }) => r.views > 0).length;
    const hasHashtags = rows.filter((r: { hashtags: string[] }) => r.hashtags.length > 0).length;
    const hasPostedAt = rows.filter((r: { posted_at: Date }) => r.posted_at instanceof Date).length;
    const nullFollowerCount = rows.filter((r: { follower_count: number | null }) => r.follower_count === null).length;
    const nullSoundName = rows.filter((r: { sound_name: string | null }) => r.sound_name === null).length;
    const nullCompletionPct = rows.filter((r: { completion_pct: number | null }) => r.completion_pct === null).length;

    log(`  Total rows:             ${rows.length}`);
    log(`  Has caption:            ${hasCaptions}/${rows.length}`);
    log(`  Has views > 0:          ${hasViews}/${rows.length}`);
    log(`  Has hashtags:           ${hasHashtags}/${rows.length}`);
    log(`  Has posted_at:          ${hasPostedAt}/${rows.length}`);
    log(`  follower_count null:    ${nullFollowerCount}/${rows.length} (expected — apidojo asymmetry)`);
    log(`  sound_name null:        ${nullSoundName}/${rows.length} (expected — apidojo asymmetry)`);
    log(`  completion_pct null:    ${nullCompletionPct}/${rows.length} (expected — KNOWN GAP)`);
    process.exit(0);
  }

  // ── SCRAPE mode ───────────────────────────────────────────────────────────
  if (args.mode === "scrape") {
    log("Broad scrape: scrapeRawToCache() → JSONL cache");
    const apifyClient = new ApifyClient({ token: process.env.APIFY_TOKEN ?? "" });
    const cachePath = args.cachePath ?? defaultCachePath(args.version);

    const rows = await scrapeRawToCache({
      version: args.version,
      niches: args.niches as string[] | undefined,
      apifyClient,
      isPilot: false,
    });

    log(`Scrape complete. Rows post-filter: ${rows.length}`);
    await writeRawCache(rows, cachePath);
    log(`Cache written to: ${cachePath}`);
    log("Next: run --calibrate to compute thresholds from the cache.");
    process.exit(0);
  }

  // ── CALIBRATE mode ────────────────────────────────────────────────────────
  if (args.mode === "calibrate") {
    log("Computing empirical thresholds from cache...");
    const cachePath = args.cachePath ?? defaultCachePath(args.version);

    let rows: Array<{ niche: string; views: number }>;
    try {
      rows = await readRawCache(cachePath);
    } catch (e) {
      log(`ERROR: Failed to read cache file: ${cachePath}`);
      log((e as Error).message);
      log("Run --scrape mode first.");
      process.exit(1);
    }

    if (rows.length === 0) {
      log("ERROR: Cache file is empty. Run --scrape mode first.");
      process.exit(1);
    }

    log(`Loaded ${rows.length} rows.`);

    // Group by niche
    const viewsByNiche: Record<string, number[]> = {};
    for (const niche of NICHES as string[]) viewsByNiche[niche] = [];
    for (const r of rows) {
      const bucket = viewsByNiche[r.niche as string];
      if (bucket) bucket.push(r.views);
    }

    const result = calibrate(viewsByNiche);

    // Print stats
    log("Per-niche distributions:");
    for (const s of result.stats) {
      log(`  ${s.niche}: rows=${s.rowCount} P90=${s.p90.toLocaleString()} P30=${s.p30.toLocaleString()} → viral=${s.proposedViralFloor.toLocaleString()} under=${s.proposedUnderCeiling.toLocaleString()}`);
    }

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        if (w.level === "error") log(`ERROR: ${w.message}`);
        else warn(w.message);
      }
    }

    if (!result.hasErrors) {
      log("Proposed THRESHOLD_SNAPSHOTS entry:");
      log("──────────────────────────────────────────");
      console.log(formatThresholdCodeBlock(args.version, result.stats));
      log("──────────────────────────────────────────");
      log("Paste the block above into thresholds.ts THRESHOLD_SNAPSHOTS.");
      log("Then run --build mode to persist the bucketed rows.");
      process.exit(0);
    } else {
      log("ERROR: Calibration failed. Fix data issues and retry.");
      process.exit(1);
    }
  }

  // ── BUILD mode ────────────────────────────────────────────────────────────
  if (args.mode === "build") {
    log("Bucket-and-persist: readRawCache() → bucketAndPersist() → DB");
    const cachePath = args.cachePath ?? defaultCachePath(args.version);

    let rows: unknown[];
    try {
      rows = await readRawCache(cachePath);
    } catch (e) {
      log(`ERROR: Failed to read cache file: ${cachePath}`);
      log((e as Error).message);
      log("Run --scrape mode first.");
      process.exit(1);
    }

    log(`Loaded ${rows.length} rows from cache.`);

    if (args.dryRun) {
      log("Dry run — skipping DB write.");
      log(`Would bucket and persist ${rows.length} rows.`);
      process.exit(0);
    }

    const supabase = createServiceClient();
    let result;
    try {
      result = await bucketAndPersist({
        rows,
        version: args.version,
        supabase,
      });
    } catch (e) {
      if ((e as Error).message?.includes("Unknown corpus_version")) {
        log(`ERROR: Version "${args.version}" is not sealed in thresholds.ts.`);
        log("Run --calibrate first, paste the proposed block into thresholds.ts, then retry --build.");
        process.exit(1);
      }
      throw e;
    }

    log(`Build complete. Upserted: ${result.upserted}, Skipped: ${result.skipped}`);
    log("Per-niche×bucket breakdown:");
    for (const [key, count] of Object.entries(result.perNicheBucket)) {
      log(`  ${key}: ${count}`);
    }
    process.exit(0);
  }

  // ── Legacy --pilot / --full passthrough (mode already mapped above) ────────
  // This path is unreachable given the mode mapping above; kept as a safety net.
  log(`Starting corpus build: version=${args.version} pilot=${args.isPilot} dryRun=${args.dryRun}`);
  const result = await buildCorpus({
    corpusVersion: args.version,
    isPilot: args.isPilot,
    dryRun: args.dryRun,
  });
  log(`Inserted: ${result.inserted}`);
  log(`Failed configs: ${result.failed.length}`);
  log(`Summary: ${JSON.stringify(result.summary, null, 2)}`);
  if (result.failed.length > 0) {
    log("Failures:");
    for (const f of result.failed) log(`  ${f.niche}/${f.config}: ${f.error}`);
  }
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
