export interface EvalArgs {
  corpusVersion: string;
  baseline: boolean;
  leaveOneOut: boolean;
  maxTotalCostCents: number;
  delayMs: number;
  output?: string;
  engineVersion?: string;
}

export class EvalArgsError extends Error {
  constructor(message: string, public readonly usage: string) {
    super(message);
    this.name = "EvalArgsError";
  }
}

export const EVAL_USAGE = [
  "Usage: tsx scripts/eval.ts --corpus-version <v> [options]",
  "",
  "Required:",
  "  --corpus-version <v>           Corpus version identifier (e.g., full.2026-05-12)",
  "",
  "Options:",
  "  --baseline                     Run measureV21Baseline (hardcodes ENGINE_VERSION)",
  "  --engine-version <v>           Override engine version label (default: ENGINE_VERSION from aggregator.ts)",
  "  --leave-one-out                Compute per-signal LOO contribution (6x cost; opt-in per RESEARCH §C.3)",
  "  --max-total-cost-cents <N>     Hard cost cap; abort run when exceeded (default: 5000 = $50)",
  "  --delay-ms <N>                 Rate-limit delay between rows in ms (default: 2000)",
  "                                 LOWER = faster eval, higher rate-limit risk",
  "                                 HIGHER = slower eval, safer against API throttling",
  "  --output <path>                Write the full BenchmarkReport JSON to disk (optional)",
].join("\n");

/**
 * Parse CLI arguments for scripts/eval.ts. Pure function — returns a typed
 * EvalArgs struct on success or throws EvalArgsError on validation failure.
 * Does NOT call process.exit; the CLI shell does that.
 */
export function parseEvalArgs(argv: string[]): EvalArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
    if (i < 0) return undefined;
    const a = argv[i]!;
    if (a.includes("=")) return a.split("=", 2)[1];
    const next = argv[i + 1];
    // Conflicting-flag guard: a flag value must not itself start with `--`.
    if (next === undefined || next.startsWith("--")) {
      throw new EvalArgsError(`Flag ${flag} requires a value`, EVAL_USAGE);
    }
    return next;
  };

  const corpusVersion = get("--corpus-version");
  if (!corpusVersion) {
    throw new EvalArgsError("--corpus-version is required", EVAL_USAGE);
  }

  const baseline = argv.includes("--baseline");
  const leaveOneOut = argv.includes("--leave-one-out");

  const parseIntFlag = (flag: string, defaultValue: number): number => {
    const raw = get(flag);
    if (raw === undefined) return defaultValue;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new EvalArgsError(`${flag} must be a non-negative integer (got ${raw})`, EVAL_USAGE);
    }
    return n;
  };

  return {
    corpusVersion,
    baseline,
    leaveOneOut,
    maxTotalCostCents: parseIntFlag("--max-total-cost-cents", 5000),
    delayMs: parseIntFlag("--delay-ms", 2000),
    output: get("--output"),
    engineVersion: get("--engine-version"),
  };
}
