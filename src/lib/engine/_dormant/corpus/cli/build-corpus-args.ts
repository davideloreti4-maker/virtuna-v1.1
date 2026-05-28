/**
 * CLI argument parser for scripts/build-corpus.ts.
 *
 * Four mutually exclusive modes:
 *   --smoke      Smoke test: scrape 1 niche × 1 hashtag × maxItems=20, dry-run
 *   --scrape     Broad scrape: calls scrapeRawToCache(), writes JSONL cache, no DB write
 *   --calibrate  Prints proposed thresholds from the JSONL cache, then exits
 *   --build      Bucket-and-persist: reads JSONL cache, calls bucketAndPersist(), upserts to DB
 *
 * Legacy:
 *   --pilot      DEPRECATED alias for --smoke (kept for backward compatibility)
 *   --full       DEPRECATED flag (used to mean full build; prefer --scrape + --build two-phase)
 */

export type BuildMode = "smoke" | "scrape" | "calibrate" | "build";

export interface BuildCorpusArgs {
  /** Selected execution mode. */
  mode: BuildMode;
  /** Corpus version slug, e.g. full.2026-05-12 or pilot.2026-05-12 */
  version: string;
  /** True if isPilot=true was passed (for legacy --pilot; also set by --smoke) */
  isPilot: boolean;
  /** Skip DB write even in --build mode */
  dryRun: boolean;
  maxCostCents?: number;
  /** Custom cache file path (for --scrape and --build modes) */
  cachePath?: string;
  /** Comma-separated niche filter (for --smoke convenience) */
  niches?: string[];
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
  "Usage: tsx scripts/build-corpus.ts --version <pilot.YYYY-MM-DD|full.YYYY-MM-DD> <mode> [options]",
  "",
  "Required:",
  "  --version <v>                  Corpus version identifier (e.g., full.2026-05-12)",
  "",
  "Modes (pick exactly one):",
  "  --smoke                        Smoke test: 1 niche × 1 hashtag × 20 items, dry-run",
  "                                 Prints field-coverage report (no DB write)",
  "  --scrape                       Broad scrape: scrapeRawToCache() → JSONL cache (no DB)",
  "  --calibrate                    Compute thresholds from JSONL cache, print code block",
  "  --build                        Bucket-and-persist: readCache() → bucketAndPersist() → DB",
  "                                 Requires the version to be sealed in thresholds.ts",
  "",
  "  --pilot                        DEPRECATED: alias for --smoke (kept for backward compat)",
  "  --full                         DEPRECATED: use --scrape + --build instead",
  "",
  "Options:",
  "  --dry-run                      Skip the DB write even in --build mode",
  "  --cache <path>                 Custom JSONL cache file path (default: .planning/cache/raw-<version>.jsonl)",
  "  --niches <a,b,c>               Comma-separated niche filter (useful with --smoke)",
  "  --max-cost-cents <N>           Soft cost ceiling for monitoring",
].join("\n");

/** Validate version slug format. */
function validateVersion(v: string): void {
  if (!/^(pilot|full)\.\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new BuildCorpusArgsError(
      `--version must match pilot.YYYY-MM-DD or full.YYYY-MM-DD (got: ${v})`,
      BUILD_CORPUS_USAGE,
    );
  }
}

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

  const has = (flag: string): boolean => argv.some((a) => a === flag);

  // ── Version ──────────────────────────────────────────────────────────────
  const version = get("--version");
  if (!version) {
    throw new BuildCorpusArgsError("--version is required", BUILD_CORPUS_USAGE);
  }
  validateVersion(version);

  // ── Mode ─────────────────────────────────────────────────────────────────
  const smokeFlag = has("--smoke");
  const scrapeFlag = has("--scrape");
  const calibrateFlag = has("--calibrate");
  const buildFlag = has("--build");
  // Legacy flags
  const pilotFlag = has("--pilot");
  const fullFlag = has("--full");

  // Raw mode selections (before legacy flag mapping)
  // Each raw flag counts as a separate selection — even legacy aliases
  const rawModeSelections = [
    smokeFlag, pilotFlag, scrapeFlag, fullFlag, calibrateFlag, buildFlag,
  ].filter(Boolean).length;

  if (rawModeSelections === 0) {
    throw new BuildCorpusArgsError(
      "Pass exactly one mode: --smoke | --scrape | --calibrate | --build (or legacy --pilot | --full)",
      BUILD_CORPUS_USAGE,
    );
  }
  if (rawModeSelections > 1) {
    throw new BuildCorpusArgsError(
      "Modes are mutually exclusive — pass exactly one of --smoke | --scrape | --calibrate | --build",
      BUILD_CORPUS_USAGE,
    );
  }

  // Map legacy flags to new modes
  // (--scrape and --full both map to "scrape" via the else branch below)
  const effectiveSmoke = smokeFlag || pilotFlag;

  let mode: BuildMode;
  if (effectiveSmoke) mode = "smoke";
  else if (calibrateFlag) mode = "calibrate";
  else if (buildFlag) mode = "build";
  else mode = "scrape"; // covers both --scrape and --full

  // ── Options ───────────────────────────────────────────────────────────────
  const dryRun = has("--dry-run");

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

  const cachePath = get("--cache");

  const nichesRaw = get("--niches");
  const niches = nichesRaw
    ? nichesRaw
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    : undefined;

  return {
    mode,
    version,
    isPilot: mode === "smoke" || pilotFlag,
    dryRun,
    maxCostCents,
    cachePath,
    niches,
  };
}
