/**
 * Calibrate empirical thresholds from a raw scrape JSONL cache (D-09).
 *
 * Usage:
 *   npx tsx scripts/calibrate-thresholds.ts \
 *     --version full.2026-05-12 \
 *     [--cache .planning/cache/raw-full.2026-05-12.jsonl] \
 *     [--p-viral 90] \
 *     [--p-under 30]
 *
 * Output:
 *   - Per-niche statistics table (rowCount, P10, P30, P50, P70, P90)
 *   - Sanity warnings (noisy samples, tight bucket separation, fatal errors)
 *   - TypeScript code block to paste into THRESHOLD_SNAPSHOTS in thresholds.ts
 *
 * Exits 0 on success, 1 if any niche has a fatal error (empty/NaN).
 *
 * NOTE: This script ONLY prints the code block. It does NOT write to
 * thresholds.ts directly (D-13 immutability — operator hand-seals).
 */

import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

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
const { readRawCache, defaultCachePath } = require("../src/lib/engine/corpus/orchestrator");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calibrate, formatThresholdCodeBlock } = require("../src/lib/engine/corpus/calibration");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NICHES } = require("../src/lib/engine/corpus/eval-config");

const log = (msg: string) => console.log(msg);
const warn = (msg: string) => console.warn(`[WARN] ${msg}`);
const err = (msg: string) => console.error(`[ERROR] ${msg}`);

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  if (a.includes("=")) return a.split("=", 2)[1];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) {
    throw new Error(`Flag ${flag} requires a value`);
  }
  return next;
}

async function main() {
  const argv = process.argv.slice(2);

  const version = getArg(argv, "--version");
  if (!version) {
    err("--version is required (e.g., full.2026-05-12)");
    err("Usage: npx tsx scripts/calibrate-thresholds.ts --version <slug> [--cache <path>] [--p-viral 90] [--p-under 30]");
    process.exit(1);
  }

  if (!/^(pilot|full)\.\d{4}-\d{2}-\d{2}$/.test(version)) {
    err(`--version must match pilot.YYYY-MM-DD or full.YYYY-MM-DD (got: ${version})`);
    process.exit(1);
  }

  const cachePath = getArg(argv, "--cache") ?? defaultCachePath(version);
  const pViralRaw = getArg(argv, "--p-viral") ?? "90";
  const pUnderRaw = getArg(argv, "--p-under") ?? "30";

  const pViral = Number(pViralRaw);
  const pUnder = Number(pUnderRaw);

  if (!isFinite(pViral) || pViral < 0 || pViral > 100) {
    err(`--p-viral must be 0-100 (got: ${pViralRaw})`);
    process.exit(1);
  }
  if (!isFinite(pUnder) || pUnder < 0 || pUnder > 100) {
    err(`--p-under must be 0-100 (got: ${pUnderRaw})`);
    process.exit(1);
  }

  log(`\nCalibration for version: ${version}`);
  log(`Cache: ${cachePath}`);
  log(`Percentiles: viralFloor=P${pViral}, underCeiling=P${pUnder}\n`);

  // ─── Read cache ─────────────────────────────────────────────────────────────
  let rows: Array<{ niche: string; views: number }>;
  try {
    rows = await readRawCache(cachePath);
  } catch (e) {
    err(`Failed to read cache file: ${cachePath}`);
    err(e instanceof Error ? e.message : String(e));
    err("Run --scrape mode first to generate the cache file.");
    process.exit(1);
  }

  if (rows.length === 0) {
    err("Cache file is empty. Run --scrape mode first.");
    process.exit(1);
  }

  log(`Loaded ${rows.length} rows from cache.\n`);

  // ─── Group by niche ──────────────────────────────────────────────────────────
  const viewsByNiche: Record<string, number[]> = {};
  for (const niche of NICHES as string[]) {
    viewsByNiche[niche] = [];
  }
  for (const row of rows) {
    const nicheRows = viewsByNiche[row.niche];
    if (nicheRows) {
      nicheRows.push(row.views);
    }
  }

  // ─── Calibrate ───────────────────────────────────────────────────────────────
  const result = calibrate(
    viewsByNiche as Record<string, number[]>,
    pViral,
    pUnder
  );

  // ─── Print stats table ───────────────────────────────────────────────────────
  log("Per-Niche View Distributions:");
  log("─────────────────────────────────────────────────────────────────────────────");
  log(
    "Niche      ".padEnd(12) +
    "Rows".padEnd(8) +
    "P10".padEnd(12) +
    "P30".padEnd(12) +
    "P50".padEnd(12) +
    "P70".padEnd(12) +
    "P90".padEnd(12) +
    "viralFloor".padEnd(14) +
    "underCeiling"
  );
  log("─────────────────────────────────────────────────────────────────────────────");
  for (const s of result.stats) {
    const fmt = (n: number) => isNaN(n) ? "NaN".padEnd(12) : n.toLocaleString().padEnd(12);
    log(
      s.niche.padEnd(12) +
      String(s.rowCount).padEnd(8) +
      fmt(s.p10) +
      fmt(s.p30) +
      fmt(s.p50) +
      fmt(s.p70) +
      fmt(s.p90) +
      s.proposedViralFloor.toLocaleString().padEnd(14) +
      s.proposedUnderCeiling.toLocaleString()
    );
  }
  log("");

  // ─── Print warnings ──────────────────────────────────────────────────────────
  if (result.warnings.length > 0) {
    log("Sanity Warnings:");
    log("─────────────────────────────────────────────────────────────────────────────");
    for (const w of result.warnings) {
      if (w.level === "error") {
        err(w.message);
      } else {
        warn(w.message);
      }
    }
    log("");
  }

  // ─── Print code block ────────────────────────────────────────────────────────
  if (!result.hasErrors) {
    log("Proposed TypeScript block to paste into THRESHOLD_SNAPSHOTS in thresholds.ts:");
    log("─────────────────────────────────────────────────────────────────────────────");
    log(formatThresholdCodeBlock(version, result.stats));
    log("─────────────────────────────────────────────────────────────────────────────");
    log("\nNOTE: Copy the block above and paste it into THRESHOLD_SNAPSHOTS in");
    log("      src/lib/engine/corpus/thresholds.ts (D-13 — operator hand-seals).");
    log("      Do NOT modify any existing entries.\n");
    process.exit(0);
  } else {
    err("Calibration failed due to fatal errors above. Fix the data issues and retry.");
    process.exit(1);
  }
}

main().catch((e) => {
  err(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) err(e.stack);
  process.exit(1);
});
