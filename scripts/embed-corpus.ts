/**
 * Phase 8 Plan 05 — One-time + re-runnable backfill CLI for the embedding column
 * on training_corpus + scraped_videos, plus a --derive-percentiles mode that
 * snapshots P80/P40 engagement rates for the 5 non-calibrated niches.
 *
 * Modes:
 *   --backfill (default)        UPDATE embedding where embedding IS NULL,
 *                               in 50-row batches via embedBatch().
 *   --derive-percentiles        SELECT views/likes/shares/comments per niche,
 *                               compute P80/P40 of engagement rate,
 *                               print a NON_CORPUS_ENGAGEMENT_PERCENTILES TS block
 *                               for the operator to paste into bucket-derivation.ts.
 *
 * Re-runnable: rows with non-null embedding are skipped by default. The
 * --re-embed-all flag overrides and overwrites every row's embedding column.
 *
 * Cost: gemini-embedding-001 = $0.15/M input tokens. Total backfill estimated
 * < $0.10 for ~7400 scraped_videos + ~225 training_corpus rows.
 *
 * RESEARCH Finding 3: training_corpus.niche uses 'edu' but D-06 subject text
 * expects NICHE_TREE form 'education'. CORPUS_NICHE_ALIASES is inverted here
 * before buildSubjectText() so backfill is byte-identical to predict-time.
 *
 * RESEARCH lines 1170-1174: rows with ALL of {caption, creator_handle, hashtags}
 * null are skipped (would produce a useless near-zero embedding).
 *
 * RESEARCH lines 519-523: on 429 / RESOURCE_EXHAUSTED, sleep 60s and continue.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

// Load .env.local (Next.js convention — same pattern as scripts/build-corpus.ts)
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
const { buildSubjectText, embedBatch } = require("../src/lib/engine/retrieval/embedder");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  REVERSE_CORPUS_NICHE_ALIASES,
} = require("../src/lib/engine/retrieval/bucket-derivation");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseEmbedCorpusArgs,
  EmbedCorpusArgsError,
} = require("../src/lib/engine/retrieval/cli/embed-corpus-args");

const log = (msg: string) => console.log(`[embed-corpus] ${msg}`);
const warn = (msg: string) => console.warn(`[embed-corpus] WARN: ${msg}`);

const PAGE = 200;
const PERCENTILE_MIN_POOL_SIZE = 30; // RESEARCH Finding 5
const RATE_LIMIT_SLEEP_MS = 60_000;
// Safety cap on the backfill loop. With PAGE=200 and a worst-case persistent
// embed failure (every row stays NULL after the embedBatch try/catch warn),
// the IS NULL re-query pattern would otherwise loop forever. 1000 iterations
// at PAGE=200 covers 200k rows — well above any realistic corpus.
const MAX_LOOPS = 1000;

type Table = "training_corpus" | "scraped_videos";

// WR-04: alias-reverse map (corpus-form 'edu' → NICHE_TREE form 'education')
// imported from bucket-derivation.ts as a single source of truth shared with
// orchestrator.bucketAndPersist. Both surfaces must agree byte-for-byte so the
// subject-text formula produces identical embeddings at backfill vs predict time.
const REVERSE_CORPUS_ALIAS = REVERSE_CORPUS_NICHE_ALIASES as Record<string, string>;

interface ScrapedRow {
  id: string;
  primary_niche: string | null;
  creator_handle: string | null;
  description: string | null;
  hashtags: string[] | null;
}

interface CorpusRow {
  id: string;
  niche: string;
  creator_handle: string | null;
  caption: string | null;
  hashtags: string[] | null;
}

interface BackfillArgs {
  batchSize: number;
  dryRun: boolean;
  reEmbedAll: boolean;
}

function rowIsUsable(row: ScrapedRow | CorpusRow, table: Table): boolean {
  const captionField =
    table === "training_corpus"
      ? (row as CorpusRow).caption
      : (row as ScrapedRow).description;
  const handle = row.creator_handle;
  const tags = row.hashtags;
  return Boolean(captionField) || Boolean(handle) || (Array.isArray(tags) && tags.length > 0);
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
}

function isTransientFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause ? String((err.cause as Error).message ?? err.cause) : "";
  return (
    msg.includes("fetch failed") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("EAI_AGAIN") ||
    msg.includes("UND_ERR_") ||
    cause.includes("ECONNRESET") ||
    cause.includes("ETIMEDOUT") ||
    cause.includes("UND_ERR_")
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientFetchError(err) || attempt === maxAttempts) throw err;
      const backoffMs = Math.min(30_000, 500 * Math.pow(2, attempt - 1));
      warn(`${label} transient error (attempt ${attempt}/${maxAttempts}): ${(err as Error).message ?? String(err)} — retrying in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

async function backfillTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: Table,
  args: BackfillArgs,
): Promise<void> {
  let totalEmbedded = 0;
  let totalSkipped = 0;
  // In default mode (filter by `embedding IS NULL`), each successful UPDATE
  // removes a row from the filter set, so we MUST NOT advance the offset
  // between iterations — re-querying `range(0, PAGE-1)` drains the NULL set
  // naturally. In --re-embed-all mode the filter predicate is constant, so
  // a monotonically-advancing offset is correct.
  let offset = 0;
  let loops = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (loops++ >= MAX_LOOPS) {
      warn(
        `${table}: hit MAX_LOOPS=${MAX_LOOPS} safety cap (loops=${loops}, totalEmbedded=${totalEmbedded}); aborting backfill to prevent infinite loop on persistent embed failure`,
      );
      break;
    }
    const selectCols =
      table === "training_corpus"
        ? "id, niche, creator_handle, caption, hashtags"
        : "id, primary_niche, creator_handle, description, hashtags";
    let q = supabase.from(table).select(selectCols);
    if (!args.reEmbedAll) {
      q = q.is("embedding", null);
    }
    const { data, error } = await withRetry(
      () => q.order("id").range(offset, offset + PAGE - 1),
      `Select ${table} offset=${offset}`,
    );
    if (error) {
      throw new Error(`Select from ${table} failed: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    // Skip rows with all-null embeddable fields (RESEARCH lines 1170-1174)
    const usable = (data as (ScrapedRow | CorpusRow)[]).filter((r) =>
      rowIsUsable(r, table),
    );
    totalSkipped += data.length - usable.length;

    // Embed in batches of args.batchSize (max 100 by Gemini sync limit)
    for (let i = 0; i < usable.length; i += args.batchSize) {
      const slice = usable.slice(i, i + args.batchSize);
      const texts = slice.map((r) => {
        // For training_corpus: invert alias 'edu' → 'education' so backfill subject text
        // is byte-identical to predict-time (which uses NICHE_TREE form). For scraped_videos:
        // primary_niche is already NICHE_TREE form (populated via deriveNicheSlug).
        const slug =
          table === "training_corpus"
            ? REVERSE_CORPUS_ALIAS[(r as CorpusRow).niche] ?? (r as CorpusRow).niche
            : (r as ScrapedRow).primary_niche;
        const caption =
          table === "training_corpus"
            ? (r as CorpusRow).caption
            : (r as ScrapedRow).description;
        return buildSubjectText({
          primary_slug: slug,
          creator_handle: r.creator_handle ?? null,
          caption: caption ?? null,
          hashtags: r.hashtags ?? null,
        });
      });

      if (args.dryRun) {
        log(`DRY-RUN would embed batch of ${slice.length} from ${table} (offset ${offset + i})`);
        totalEmbedded += slice.length;
        continue;
      }

      try {
        const { vectors } = await withRetry(
          () => embedBatch(texts),
          `embedBatch ${table} offset=${offset + i}`,
        );
        // Update each row's embedding column. .update() per row because we're
        // mutating existing rows; .upsert() requires PK + conflict.
        // Each .update() is individually wrapped in withRetry so a single
        // transient fetch failure doesn't lose the whole batch.
        // pgvector wire-format consistency: vector(768) columns are typed as
        // `string | null` in the generated Database types — both orchestrator and
        // apify webhook serialize via JSON.stringify(number[]). Match them here so
        // PostgREST receives the textual pgvector literal "[0.1,0.2,...]" rather
        // than a JSON array (which the type system would have caught but is
        // bypassed by the `supabase: any` annotation above).
        const updates = await Promise.all(
          slice.map((r, j) =>
            withRetry(
              () =>
                supabase
                  .from(table)
                  .update({ embedding: JSON.stringify(vectors[j]) })
                  .eq("id", r.id),
              `Update ${table} id=${r.id}`,
            ),
          ),
        );
        const updateError = updates.find((u: { error: unknown }) => u.error)?.error;
        if (updateError) {
          const msg = (updateError as Error).message ?? String(updateError);
          warn(`Update batch had errors (${table}, offset ${offset + i}): ${msg}`);
        }
        totalEmbedded += slice.length;
        // Brief throttle between batches to avoid hammering Supabase REST
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(
          `Batch failed (${table}, offset ${offset + i}): ${msg} — leaving embedding NULL; re-run will retry`,
        );
        if (isRateLimit(err)) {
          log(`Rate limit hit — sleeping ${RATE_LIMIT_SLEEP_MS / 1000}s`);
          await new Promise((r) => setTimeout(r, RATE_LIMIT_SLEEP_MS));
        }
      }
    }

    // CR-02: only advance offset in --re-embed-all mode. In default IS NULL mode,
    // the previous batch removed rows from the filter set so re-querying from
    // offset=0 picks up the next undone rows. Advancing offset in IS NULL mode
    // silently skips approximately N/2 rows per invocation.
    if (args.reEmbedAll) {
      offset += PAGE;
    }
    // In dry-run mode the underlying rows are NOT updated, so the IS NULL filter
    // set doesn't shrink between iterations. Advance offset so dry-run actually
    // iterates the whole table instead of pinning to the first PAGE rows.
    else if (args.dryRun) {
      offset += PAGE;
    }
  }

  log(
    `${table}: embedded ${totalEmbedded} rows, skipped ${totalSkipped} (all-null embeddable fields)`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function derivePercentiles(supabase: any): Promise<void> {
  // Non-calibrated niches: 5 niches whose THRESHOLD_SNAPSHOTS["full.2026-05-11"] entries don't exist.
  // bucket-derivation.ts uses NON_CORPUS_ENGAGEMENT_PERCENTILES for these.
  const NON_CALIBRATED = [
    "tech-gadgets",
    "gaming",
    "fashion-style",
    "music-performance",
    "food-cooking",
  ];

  log("Computing engagement-rate P80/P40 per non-calibrated niche");
  log("");
  log("// Paste the following block into src/lib/engine/retrieval/bucket-derivation.ts");
  log("// (replace the existing NON_CORPUS_ENGAGEMENT_PERCENTILES constant body)");
  log("");
  log("export const NON_CORPUS_ENGAGEMENT_PERCENTILES: Record<");
  log("  string,");
  log("  { p80: number; p40: number }");
  log("> = {");

  for (const niche of NON_CALIBRATED) {
    const { data, error } = await supabase
      .from("scraped_videos")
      .select("views, likes, shares, comments")
      .eq("primary_niche", niche)
      .gt("views", 0);
    if (error) {
      warn(`Niche ${niche}: select failed — ${error.message}`);
      continue;
    }
    const rows = (data ?? []) as Array<{
      views: number | null;
      likes: number | null;
      shares: number | null;
      comments: number | null;
    }>;
    if (rows.length < PERCENTILE_MIN_POOL_SIZE) {
      warn(
        `Niche ${niche}: only ${rows.length} rows (need >=${PERCENTILE_MIN_POOL_SIZE}); using p80=p40=0 (bucket=average fallback)`,
      );
      log(
        `  "${niche}": { p80: 0, p40: 0 },  // POOL TOO SMALL (n=${rows.length}; need >=${PERCENTILE_MIN_POOL_SIZE})`,
      );
      continue;
    }
    const rates = rows
      .map((r) => {
        const views = r.views ?? 0;
        const likes = r.likes ?? 0;
        const shares = r.shares ?? 0;
        const comments = r.comments ?? 0;
        return (likes + shares + comments) / Math.max(views, 1);
      })
      .sort((a, b) => a - b);
    const p80 = rates[Math.floor(rates.length * 0.8)] ?? 0;
    const p40 = rates[Math.floor(rates.length * 0.4)] ?? 0;
    log(
      `  "${niche}": { p80: ${p80.toFixed(6)}, p40: ${p40.toFixed(6)} },  // n=${rows.length}`,
    );
  }
  log("};");
}

async function main(): Promise<void> {
  let args;
  try {
    args = parseEmbedCorpusArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof EmbedCorpusArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(err.message === "Help requested" ? 0 : 1);
    }
    throw err;
  }

  log(
    `Mode: ${args.mode} | Table: ${args.table} | BatchSize: ${args.batchSize} | DryRun: ${args.dryRun} | ReEmbedAll: ${args.reEmbedAll}`,
  );

  const supabase = createServiceClient();

  if (args.mode === "derive-percentiles") {
    await derivePercentiles(supabase);
    process.exit(0);
  }

  // mode === "backfill"
  const tables: Table[] =
    args.table === "both"
      ? ["training_corpus", "scraped_videos"]
      : [args.table as Table];
  for (const table of tables) {
    log(
      `Starting ${table} backfill (dryRun=${args.dryRun}, reEmbedAll=${args.reEmbedAll}, batch=${args.batchSize})`,
    );
    await backfillTable(supabase, table, {
      batchSize: args.batchSize,
      dryRun: args.dryRun,
      reEmbedAll: args.reEmbedAll,
    });
  }
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
