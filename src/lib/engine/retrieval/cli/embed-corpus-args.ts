/**
 * CLI argument parser for scripts/embed-corpus.ts (Phase 8 Plan 05).
 *
 * Two mutually exclusive primary modes:
 *   --backfill              Embed rows where embedding IS NULL (default)
 *   --derive-percentiles    Compute NON_CORPUS_ENGAGEMENT_PERCENTILES from scraped_videos
 *                           for the 5 non-calibrated niches and print TS code block
 *
 * Mirrors the parse pattern of build-corpus-args.ts. Pure function — throws
 * EmbedCorpusArgsError on validation failure; does NOT call process.exit.
 */

export type EmbedMode = "backfill" | "derive-percentiles";
export type EmbedTable = "training_corpus" | "scraped_videos" | "both";

export interface EmbedCorpusArgs {
  /** Selected execution mode. */
  mode: EmbedMode;
  /** Which table(s) to operate on (backfill mode only; ignored for derive-percentiles). */
  table: EmbedTable;
  /** Texts per Gemini embed call, max 100 (sync limit). */
  batchSize: number;
  /** Skip the .update() writes — print what would happen. */
  dryRun: boolean;
  /** DANGER: re-embed ALL rows including non-null embedding columns. */
  reEmbedAll: boolean;
}

export class EmbedCorpusArgsError extends Error {
  constructor(
    message: string,
    public readonly usage: string,
  ) {
    super(message);
    this.name = "EmbedCorpusArgsError";
  }
}

export const EMBED_CORPUS_USAGE = [
  "Usage: pnpm tsx scripts/embed-corpus.ts [options]",
  "",
  "Modes (mutually exclusive — pick at most one; defaults to --backfill):",
  "  --backfill                    Embed rows where embedding IS NULL (default)",
  "  --derive-percentiles          Compute NON_CORPUS_ENGAGEMENT_PERCENTILES code block",
  "",
  "Options:",
  "  --table=NAME                  Limit to 'training_corpus' | 'scraped_videos' | 'both'",
  "                                (default: both — applies to --backfill mode only)",
  "  --batch-size=N                Texts per Gemini embed call, max 100 (default: 50)",
  "  --dry-run                     Print what would happen without writing",
  "  --re-embed-all                DANGER: UPDATE all embeddings, including non-null.",
  "                                Use after D-06 formula changes only.",
  "  --help, -h                    Show this message",
  "",
  "Examples:",
  "  pnpm tsx scripts/embed-corpus.ts",
  "  pnpm tsx scripts/embed-corpus.ts --table=training_corpus --batch-size=100",
  "  pnpm tsx scripts/embed-corpus.ts --derive-percentiles",
  "  pnpm tsx scripts/embed-corpus.ts --re-embed-all --dry-run",
].join("\n");

/**
 * Parse CLI arguments for scripts/embed-corpus.ts. Pure function — returns a typed
 * EmbedCorpusArgs struct on success or throws EmbedCorpusArgsError on validation failure.
 * Does NOT call process.exit; the CLI shell does that.
 */
export function parseEmbedCorpusArgs(argv: string[]): EmbedCorpusArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    throw new EmbedCorpusArgsError("Help requested", EMBED_CORPUS_USAGE);
  }

  const hasBackfill = argv.includes("--backfill");
  const hasDerivePercentiles = argv.includes("--derive-percentiles");

  if (hasBackfill && hasDerivePercentiles) {
    throw new EmbedCorpusArgsError(
      "Modes are mutually exclusive — pass at most one of --backfill | --derive-percentiles",
      EMBED_CORPUS_USAGE,
    );
  }

  const mode: EmbedMode = hasDerivePercentiles ? "derive-percentiles" : "backfill";

  let table: EmbedTable = "both";
  let batchSize = 50;
  const dryRun = argv.includes("--dry-run");
  const reEmbedAll = argv.includes("--re-embed-all");

  for (const a of argv) {
    if (a.startsWith("--table=")) {
      const v = a.slice("--table=".length);
      if (v !== "training_corpus" && v !== "scraped_videos" && v !== "both") {
        throw new EmbedCorpusArgsError(
          `--table must be 'training_corpus' | 'scraped_videos' | 'both'; got '${v}'`,
          EMBED_CORPUS_USAGE,
        );
      }
      table = v;
    }
    if (a.startsWith("--batch-size=")) {
      const raw = a.slice("--batch-size=".length);
      const n = parseInt(raw, 10);
      if (!Number.isInteger(n) || n <= 0 || n > 100) {
        throw new EmbedCorpusArgsError(
          `--batch-size must be 1..100; got '${raw}'`,
          EMBED_CORPUS_USAGE,
        );
      }
      batchSize = n;
    }
  }

  return { mode, table, batchSize, dryRun, reEmbedAll };
}
