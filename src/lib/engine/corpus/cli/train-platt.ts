/**
 * Platt Calibration Training CLI — fits Platt scaling parameters from corpus
 * prediction/outcome pairs and stores them to the platt_parameters table.
 *
 * Runs the engine over the corpus (via runEvalOverCorpus) to get predicted vs
 * actual score pairs, then fits Platt scaling and persists to DB.
 *
 * Usage:
 *   npx tsx src/lib/engine/corpus/cli/train-platt.ts \
 *     --version full.2026-05-11 \
 *     [--dry-run] \
 *     [--max-rows N]
 *
 * Output:
 *   - Inserts a row into platt_parameters (a, b, fitted_at, sample_count)
 *   - --dry-run prints fitted parameters to stdout without DB write
 */

import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../../../../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, "../../../../.."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runEvalOverCorpus } = require("@/lib/engine/corpus/eval-runner");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fitPlattScaling } = require("@/lib/engine/calibration");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("@/lib/supabase/service");

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

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

// ─── Bucket to numeric actual value (binary Platt mapping) ───────────────────

function bucketToActual(bucket: string): number {
  if (bucket === "viral") return 1.0;
  if (bucket === "average") return 0.5;
  return 0.0; // "under"
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  const version = getArg(argv, "--version");
  if (!version) {
    err("--version is required (e.g., full.2026-05-11)");
    process.exit(1);
  }

  const versionRegex = /^(pilot|full)\.\d{4}-\d{2}-\d{2}$/;
  if (!versionRegex.test(version)) {
    err(
      `Invalid version format: "${version}". Expected pattern: (pilot|full).YYYY-MM-DD`,
    );
    process.exit(1);
  }

  const dryRun = hasFlag(argv, "--dry-run");
  const maxRowsRaw = getArg(argv, "--max-rows");
  const maxRows = maxRowsRaw !== undefined ? Number(maxRowsRaw) : undefined;

  log(`Training Platt calibration — corpus version: ${version}`);
  log(`Dry run: ${dryRun}`);
  if (maxRows !== undefined) log(`Max rows: ${maxRows}`);

  // Run the engine over the corpus to get predicted vs actual score pairs
  const results = await runEvalOverCorpus({
    corpusVersion: version,
    maxRows,
    maxTotalCostCents: 5000,
    rateLimitDelayMs: 2000,
  });

  const total = results.length;
  log(`Processed ${total} rows from corpus`);

  // Build OutcomePair array: normalize predicted_score (0-100 → 0-1), map actual bucket
  const pairs: Array<{ predicted: number; actual: number }> = [];
  let skipped = 0;

  for (const row of results) {
    if (row.predicted_overall_score === null || row.error !== null) {
      skipped++;
      continue;
    }
    pairs.push({
      predicted: row.predicted_overall_score / 100,
      actual: bucketToActual(row.actual_bucket),
    });
  }

  if (skipped > 0) warn(`Skipped ${skipped} rows (null score or error)`);
  log(`Valid pairs: ${pairs.length}`);

  if (pairs.length < 50) {
    err(`Insufficient data: need ≥50 pairs, got ${pairs.length}.`);
    process.exit(1);
  }

  // Fit Platt scaling
  const params = fitPlattScaling(pairs);

  if (params === null) {
    err("fitPlattScaling returned null — insufficient or invalid samples.");
    process.exit(1);
  }

  log("");
  log("=== Platt Parameters (fitted) ===");
  log(`  a: ${params.a.toFixed(4)}`);
  log(`  b: ${params.b.toFixed(4)}`);
  log(`  sample_count: ${params.sampleCount}`);
  log(`  fitted_at: ${params.fittedAt}`);
  log("");

  if (dryRun) {
    log("Dry run — skipping DB insert.");
    process.exit(0);
  }

  // Store to platt_parameters table
  const supabase = createServiceClient();
  const { error: insertError } = await supabase
    .from("platt_parameters")
    .insert({
      a: params.a,
      b: params.b,
      fitted_at: params.fittedAt,
      sample_count: params.sampleCount,
    });

  if (insertError) {
    err(`Failed to store Platt parameters: ${insertError.message}`);
    process.exit(1);
  }

  log("Platt parameters stored to platt_parameters table.");
}

main().catch((e) => {
  err(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
