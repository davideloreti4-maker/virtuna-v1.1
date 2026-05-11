import { config } from "dotenv";
import { resolve, dirname } from "path";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { register } from "tsconfig-paths";

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
const { runEvalHarness } = require("../src/lib/engine/corpus/eval-harness");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { measureV21Baseline } = require("../src/lib/engine/corpus/baseline");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseEvalArgs,
  EvalArgsError,
  EVAL_USAGE,
} = require("../src/lib/engine/corpus/cli/eval-args");

const log = (msg: string) => console.log(`[eval] ${msg}`);

async function main() {
  let args;
  try {
    args = parseEvalArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof EvalArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(1);
    }
    throw err;
  }

  log(`corpus=${args.corpusVersion} baseline=${args.baseline} loo=${args.leaveOneOut} cap=${args.maxTotalCostCents} delay=${args.delayMs}ms`);

  const report = args.baseline
    ? await measureV21Baseline(args.corpusVersion, {
        leaveOneOut: args.leaveOneOut,
        maxTotalCostCents: args.maxTotalCostCents,
        rateLimitDelayMs: args.delayMs,
      })
    : await runEvalHarness({
        corpusVersion: args.corpusVersion,
        engineVersion: args.engineVersion,
        leaveOneOut: args.leaveOneOut,
        maxTotalCostCents: args.maxTotalCostCents,
        rateLimitDelayMs: args.delayMs,
      });

  log(`macro_f1: ${report.macro_f1}`);
  log(`ece: ${report.ece}`);
  log(`cost_cents_avg: ${report.cost_cents_avg}`);
  log(`cost_cents_total: ${report.cost_cents_total}`);
  log(`latency p50/p95/p99 ms: ${report.latency_p50}/${report.latency_p95}/${report.latency_p99}`);
  log(`per-niche macro_f1: ${JSON.stringify(report.per_niche_f1)}`);
  log(`viral_recall: ${report.viral_recall}`);
  log(`under_precision: ${report.under_precision}`);
  log(`rows_processed: ${report.rows_processed} (${report.rows_failed} failed)`);
  log(`failure_cases: ${report.failure_cases.length}`);

  if (args.output) {
    const dir = dirname(args.output);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(args.output, JSON.stringify(report, null, 2));
    log(`Wrote JSON report -> ${args.output}`);
  }

  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
