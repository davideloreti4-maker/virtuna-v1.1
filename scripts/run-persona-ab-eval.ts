#!/usr/bin/env tsx
/**
 * Phase 7 D-14: Lightweight A/B eval on the Phase 1 corpus.
 *
 * Runs the corpus twice via the existing runEvalHarness (which already computes
 * macro_f1 / ECE / viral_recall / under_precision and persists to benchmark_results):
 *   - Run A: baseline (aggregator reads deepseek.behavioral_predictions)
 *   - Run B: substituted (aggregator reads pipelineResult.personaBehavioralAggregate)
 *
 * Writes comparison report to `.planning/research/persona-aggregate-ab-YYYY-MM-DD.md`
 * with real metric deltas pulled from the two BenchmarkReports.
 *
 * Cost: ~$0.20 LLM cost on 225-row corpus (substituted run adds Wave 3 cost on top
 * of Phase 1 baseline ~$0.33).
 *
 * Usage:
 *   npx tsx scripts/run-persona-ab-eval.ts --corpus-version full.2026-05-11
 *   npx tsx scripts/run-persona-ab-eval.ts --corpus-version full.2026-05-11 --max-cost-cents 500  # smoke
 */

import { config } from "dotenv";
import { resolve } from "path";
import { promises as fs } from "fs";
import path from "node:path";
import { runEvalHarness, type BenchmarkReport } from "../src/lib/engine/corpus/eval-harness";
import { createLogger } from "../src/lib/logger";

// Load .env.local (Next.js convention — same pattern as scripts/benchmark.ts).
// `config({ path: ... })` is a side-effecting call; ESM/TypeScript hoists ALL imports
// before any non-import statements, so this runs AFTER the imports above. The previous
// `register()` from `tsconfig-paths` (WR-09) was non-functional for the same hoisting
// reason — `runEvalHarness` was imported before `register()` could run. `tsx` resolves
// tsconfig `@/` paths natively, so the `tsconfig-paths` machinery was redundant; deleted.
config({ path: resolve(__dirname, "../.env.local") });

const log = createLogger({ module: "scripts.run-persona-ab-eval" });

interface CliArgs {
  corpusVersion: string;
  maxTotalCostCents?: number;
  maxRows?: number;
  rateLimitMs: number;
  engineVersionPrefix: string;
}

/**
 * CR-03: validate `parseInt` output. parseInt("abc", 10) returns NaN; NaN is falsy on
 * truthy checks (`!NaN === true`), so downstream `opts.maxRows ?? fallback` and
 * `if (totalCost > NaN)` silently bypass row/cost caps. Hard-exit on bad input instead.
 */
function parseIntStrict(flag: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Invalid ${flag} value: "${raw}" — must be a positive integer`);
    process.exit(1);
  }
  return n;
}

function parseArgs(argv: string[]): CliArgs {
  const getArg = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
  };
  const corpusVersion = getArg("--corpus-version");
  if (!corpusVersion) {
    console.error("Missing required --corpus-version <version>");
    process.exit(1);
  }
  return {
    corpusVersion: corpusVersion as string,
    maxTotalCostCents: parseIntStrict("--max-cost-cents", getArg("--max-cost-cents")),
    maxRows: parseIntStrict("--max-rows", getArg("--max-rows")),
    rateLimitMs: parseIntStrict("--rate-limit-ms", getArg("--rate-limit-ms")) ?? 2000,
    engineVersionPrefix: getArg("--engine-version-prefix") ?? "3.0.0-dev",
  };
}

function fmt(n: number | null, digits = 4): string {
  return n === null ? "n/a" : n.toFixed(digits);
}

function delta(a: number | null, b: number | null): string {
  return a === null || b === null ? "n/a" : (b - a).toFixed(4);
}

function formatComparisonReport(
  args: CliArgs,
  baseline: BenchmarkReport,
  substituted: BenchmarkReport,
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `# Phase 7 D-14 Persona Aggregate A/B Comparison

**Date:** ${date}
**Corpus version:** ${args.corpusVersion}
**Rows evaluated:** ${baseline.rows_processed} (baseline) / ${substituted.rows_processed} (substituted)
**Rows failed:** ${baseline.rows_failed} (baseline) / ${substituted.rows_failed} (substituted)

## Configuration

- **Run A (baseline):** \`engine_version=${baseline.engine_version}\`, \`behavioralSource="deepseek"\` (production read).
- **Run B (substituted):** \`engine_version=${substituted.engine_version}\`, \`behavioralSource="personas"\` (Phase 7 Wave 3 aggregate substituted when non-null).

## Metrics Comparison

| Metric | Baseline (A) | Substituted (B) | Delta (B − A) |
|--------|--------------|-----------------|---------------|
| Rows failed | ${baseline.rows_failed} | ${substituted.rows_failed} | ${substituted.rows_failed - baseline.rows_failed} |
| Cost (cents total) | ${baseline.cost_cents_total.toFixed(2)} | ${substituted.cost_cents_total.toFixed(2)} | ${(substituted.cost_cents_total - baseline.cost_cents_total).toFixed(2)} |
| Cost (cents avg / row) | ${baseline.cost_cents_avg.toFixed(4)} | ${substituted.cost_cents_avg.toFixed(4)} | ${(substituted.cost_cents_avg - baseline.cost_cents_avg).toFixed(4)} |
| macro_f1 | ${fmt(baseline.macro_f1)} | ${fmt(substituted.macro_f1)} | ${delta(baseline.macro_f1, substituted.macro_f1)} |
| ECE | ${fmt(baseline.ece)} | ${fmt(substituted.ece)} | ${delta(baseline.ece, substituted.ece)} |
| viral_recall | ${fmt(baseline.viral_recall)} | ${fmt(substituted.viral_recall)} | ${delta(baseline.viral_recall, substituted.viral_recall)} |
| under_precision | ${fmt(baseline.under_precision)} | ${fmt(substituted.under_precision)} | ${delta(baseline.under_precision, substituted.under_precision)} |

## Interpretation

- **macro_f1 delta:** Baseline target ≥ 0.338 (per Phase 1 D-18; v2.1 measured 0.294). Phase 7 ships the persona aggregate as an ADDITIVE signal (D-08); the swap decision is Phase 10's call based on this evidence.
- **ECE delta:** Smaller is better (calibration drift). If persona aggregate increases ECE, Phase 10 may down-weight before swapping.
- **viral_recall delta:** Higher is better. Persona model's "tough crowd" archetype should improve under-prediction recall on viral content.
- **under_precision delta:** Higher is better. Persona model should reduce false-positive viral predictions.

## Recommendation for Phase 10

[TO BE FILLED BY HUMAN REVIEW AFTER READING METRICS]

## benchmark_results rows persisted

- \`engine_version=${baseline.engine_version}\` (Run A baseline)
- \`engine_version=${substituted.engine_version}\` (Run B substituted)

Query: \`SELECT * FROM benchmark_results WHERE engine_version IN ('${baseline.engine_version}', '${substituted.engine_version}') ORDER BY created_at DESC;\`

---

*Generated by scripts/run-persona-ab-eval.ts*
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log.info("Starting Phase 7 D-14 A/B eval", {
    args: {
      corpusVersion: args.corpusVersion,
      maxTotalCostCents: args.maxTotalCostCents,
      maxRows: args.maxRows,
      rateLimitMs: args.rateLimitMs,
      engineVersionPrefix: args.engineVersionPrefix,
    },
  });

  // Run A — baseline. Harness computes macro_f1 / ECE / viral_recall / under_precision
  // and persists to benchmark_results with engineVersion as the row tag.
  const engineVersionA = `${args.engineVersionPrefix}-personasA`;
  log.info("Run A (baseline) starting", { engineVersion: engineVersionA });
  const baseline = await runEvalHarness({
    corpusVersion: args.corpusVersion,
    engineVersion: engineVersionA,
    behavioralSource: "deepseek",
    maxTotalCostCents: args.maxTotalCostCents,
    rateLimitDelayMs: args.rateLimitMs,
    maxRows: args.maxRows,
  });
  log.info("Run A complete", {
    macro_f1: baseline.macro_f1,
    cost_cents_total: baseline.cost_cents_total,
    rows_processed: baseline.rows_processed,
  });

  // Run B — substituted. Same harness; threads behavioralSource="personas" through
  // eval-runner → aggregateScores → reads pipelineResult.personaBehavioralAggregate
  // when non-null.
  const engineVersionB = `${args.engineVersionPrefix}-personasB`;
  log.info("Run B (substituted) starting", { engineVersion: engineVersionB });
  const substituted = await runEvalHarness({
    corpusVersion: args.corpusVersion,
    engineVersion: engineVersionB,
    behavioralSource: "personas",
    maxTotalCostCents: args.maxTotalCostCents,
    rateLimitDelayMs: args.rateLimitMs,
    maxRows: args.maxRows,
  });
  log.info("Run B complete", {
    macro_f1: substituted.macro_f1,
    cost_cents_total: substituted.cost_cents_total,
    rows_processed: substituted.rows_processed,
  });

  // Write comparison report — anchor to repo root so the report lands in the same place
  // regardless of caller cwd (WR-08). The 200+ LLM-cost-burning runs above must not be
  // wasted by a final `fs.writeFile` that targets the wrong directory.
  // __dirname is `<repo>/scripts`, so `..` resolves to the repo root.
  const REPO_ROOT = resolve(__dirname, "..");
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(
    REPO_ROOT,
    ".planning",
    "research",
    `persona-aggregate-ab-${date}.md`,
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(
    reportPath,
    formatComparisonReport(args, baseline, substituted),
    "utf8",
  );
  log.info("Comparison report written", { reportPath });

  console.log("\n=== Phase 7 D-14 A/B eval complete ===");
  console.log(
    `Baseline    (A): ${baseline.engine_version} — macro_f1=${baseline.macro_f1.toFixed(4)}, cost=${baseline.cost_cents_total.toFixed(2)} cents`,
  );
  console.log(
    `Substituted (B): ${substituted.engine_version} — macro_f1=${substituted.macro_f1.toFixed(4)}, cost=${substituted.cost_cents_total.toFixed(2)} cents`,
  );
  console.log(`Report: ${reportPath}`);
  console.log(
    `\nNext: read the report, fill in the Phase 10 recommendation, commit.`,
  );
}

main().catch((err) => {
  log.error("A/B eval failed", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
