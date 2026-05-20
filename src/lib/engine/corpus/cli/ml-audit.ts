/**
 * ML Classifier Audit CLI — evaluates ML signal contribution via leave-one-out
 * analysis on the corpus and produces a diagnostic report.
 *
 * Usage:
 *   npx tsx src/lib/engine/corpus/cli/ml-audit.ts \
 *     --version full.2026-05-11 \
 *     [--dry-run] \
 *     [--max-rows 50]
 *
 * Output:
 *   - Writes .planning/research/ml-audit-report.md by default
 *   - --dry-run prints metrics to stdout instead
 */

import { resolve } from "path";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

// Load .env.local (consistent with other scripts)
config({ path: resolve(__dirname, "../../../../../.env.local") });

// Register tsconfig-paths so @/ aliases resolve correctly at runtime.
// Must happen before any @/-aliased modules are required.
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
const { scoreWithoutSignal } = require("@/lib/engine/corpus/metrics/leave-one-out");
const log = (msg: string) => console.log(msg);
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  const version = getArg(argv, "--version");
  if (!version) {
    err("--version is required (e.g., full.2026-05-11)");
    err("Usage: npx tsx src/lib/engine/corpus/cli/ml-audit.ts --version <slug> [--dry-run] [--max-rows N]");
    process.exit(1);
  }

  if (!/^(pilot|full)\.\d{4}-\d{2}-\d{2}$/.test(version)) {
    err(`--version must match pilot.YYYY-MM-DD or full.YYYY-MM-DD (got: ${version})`);
    process.exit(1);
  }

  const dryRun = argv.includes("--dry-run");
  const maxRowsRaw = getArg(argv, "--max-rows");
  const maxRows = maxRowsRaw !== undefined ? Number(maxRowsRaw) : undefined;

  log(`ML Audit: version=${version} dryRun=${dryRun} maxRows=${maxRows ?? "all"}`);

  // ─── Run eval ──────────────────────────────────────────────────────────────
  const results = await runEvalOverCorpus({
    corpusVersion: version,
    maxRows,
    maxTotalCostCents: 5000, // Plan 10-01: hard cap ($50), not a budget — prevents runaway
    rateLimitDelayMs: 2000,
  });

  const total = results.length;
  log(`Processed ${total} rows`);

  // ─── Compute metrics ────────────────────────────────────────────────────────

  // Bucket-to-index mapping: under=0, average=1, viral=2
  const bucketIndex: Record<string, number> = { under: 0, average: 1, viral: 2 };
  const cm: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  let correct = 0;
  let validCount = 0;
  const looDeltas: number[] = [];

  for (const row of results) {
    if (row.predicted_bucket === null || row.error !== null) continue;
    if (!row.signalScores) continue;

    validCount++;
    const actualIdx = bucketIndex[row.actual_bucket] ?? 0;
    const predictedIdx = bucketIndex[row.predicted_bucket] ?? 0;
    cm[actualIdx]![predictedIdx]!++;

    if (row.predicted_bucket === row.actual_bucket) {
      correct++;
    }

    // LOO delta: score with ML minus score without ML signal
    if (row.predicted_overall_score !== null) {
      const withMl = row.predicted_overall_score;
      const withoutMl = scoreWithoutSignal(row.signalScores, "ml");
      looDeltas.push(withMl - withoutMl);
    }
  }

  const accuracy = validCount > 0 ? correct / validCount : 0;
  const looDelta = looDeltas.length > 0
    ? looDeltas.reduce((s, d) => s + d, 0) / looDeltas.length
    : 0;

  // ─── Build report ──────────────────────────────────────────────────────────

  const cmRows = [
    `  | under  | ${cm[0]![0]}     | ${cm[0]![1]}   | ${cm[0]![2]}     |`,
    `  | avg    | ${cm[1]![0]}     | ${cm[1]![1]}   | ${cm[1]![2]}     |`,
    `  | viral  | ${cm[2]![0]}     | ${cm[2]![1]}   | ${cm[2]![2]}     |`,
  ].join("\n");

  const report = [
    "# ML Classifier Audit Report",
    "",
    `- corpus_version: ${version}`,
    `- generated_at: ${new Date().toISOString()}`,
    `- sample_count: ${validCount}`,
    `- mode: text (completion_pct=null; audio signals absent — text-mode corpus limitation)`,
    `- accuracy: ${accuracy.toFixed(2)}`,
    `- loo_delta_ml: ${looDelta >= 0 ? "+" : ""}${looDelta.toFixed(2)}`,
    "- confusion_matrix:",
    "  |        | under | avg | viral |",
    "  |--------|-------|-----|-------|",
    cmRows,
    `- recommendation: *(to be filled by developer after reviewing numbers)*`,
    "",
  ].join("\n");

  // ─── Output ────────────────────────────────────────────────────────────────

  if (dryRun) {
    log("\n─── ML Audit Report (dry-run) ───");
    log(report);
    log("─────────────────────────────────\n");
  } else {
    const outDir = resolve(__dirname, "../../../../../.planning/research");
    const outPath = resolve(outDir, "ml-audit-report.md");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, report, "utf-8");
    log(`Wrote report -> ${outPath}`);
  }
}

main().catch((e) => {
  console.error(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
