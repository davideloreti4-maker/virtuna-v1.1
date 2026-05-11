export interface BuildCorpusArgs {
  version: string;
  isPilot: boolean;
  dryRun: boolean;
  maxCostCents?: number;
}

export class BuildCorpusArgsError extends Error {
  constructor(
    message: string,
    public readonly usage: string,
  ) {
    super(message);
    this.name = "BuildCorpusArgsError";
  }
}

export const BUILD_CORPUS_USAGE = [
  "Usage: tsx scripts/build-corpus.ts --version <pilot.YYYY-MM-DD|full.YYYY-MM-DD> --pilot|--full [options]",
  "",
  "Required:",
  "  --version <v>                  Corpus version identifier (e.g., pilot.2026-05-12)",
  "  --pilot OR --full              Pick exactly one — determines target distribution",
  "",
  "Options:",
  "  --dry-run                      Run the full pipeline but skip the DB write",
  "  --max-cost-cents <N>           Soft cost ceiling for monitoring (orchestrator does not enforce)",
].join("\n");

/**
 * Parse CLI arguments for scripts/build-corpus.ts. Pure function — returns a typed
 * BuildCorpusArgs struct on success or throws BuildCorpusArgsError on validation failure.
 * Does NOT call process.exit; the CLI shell does that.
 */
export function parseBuildCorpusArgs(argv: string[]): BuildCorpusArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
    if (i < 0) return undefined;
    const a = argv[i]!;
    if (a.includes("=")) return a.split("=", 2)[1];
    const next = argv[i + 1];
    // Conflicting-flag guard: a flag value must not itself start with `--`.
    if (next === undefined || next.startsWith("--")) {
      throw new BuildCorpusArgsError(
        `Flag ${flag} requires a value`,
        BUILD_CORPUS_USAGE,
      );
    }
    return next;
  };

  const version = get("--version");
  if (!version) {
    throw new BuildCorpusArgsError("--version is required", BUILD_CORPUS_USAGE);
  }

  const isPilot = argv.includes("--pilot");
  const isFull = argv.includes("--full");
  if (isPilot && isFull) {
    throw new BuildCorpusArgsError(
      "Pass exactly one of --pilot or --full",
      BUILD_CORPUS_USAGE,
    );
  }
  if (!isPilot && !isFull) {
    throw new BuildCorpusArgsError("Pass --pilot or --full", BUILD_CORPUS_USAGE);
  }

  const dryRun = argv.includes("--dry-run");

  const maxCostRaw = get("--max-cost-cents");
  let maxCostCents: number | undefined;
  if (maxCostRaw !== undefined) {
    const n = Number(maxCostRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new BuildCorpusArgsError(
        `--max-cost-cents must be a non-negative integer (got ${maxCostRaw})`,
        BUILD_CORPUS_USAGE,
      );
    }
    maxCostCents = n;
  }

  return { version, isPilot, dryRun, maxCostCents };
}
