/**
 * backfill-teardown-embeddings.ts — one-shot embedding backfill for the §13
 * teardown corpus (outlier_teardowns + personal_teardowns rows written before
 * the embedder landed, i.e. embedding IS NULL).
 *
 * Producer: grounding/embedder.ts (DashScope text-embedding-v3, 768d — NOT gemini),
 * subject text via buildTeardownEmbeddingText (§13 formula SSOT). Pre-migration rows
 * have no stored caption/hashtags — their text degrades to spoken_hook + idea.angle
 * (still topical: both derive from the caption). Rows with NO signal are skipped
 * (embedding an empty string would poison retrieval).
 *
 * Run: npx tsx scripts/backfill-teardown-embeddings.ts [--dry-run]
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

// Load .env.local (Next.js convention — same pattern as scripts/embed-corpus.ts)
config({ path: resolve(__dirname, "../.env.local") });

// Register tsconfig-paths so @/ aliases resolve correctly at runtime.
const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildTeardownEmbeddingText, embedTexts } = require("../src/lib/grounding/embedder");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const log = (msg: string) => console.log(`[backfill-teardowns] ${msg}`);

interface NullEmbeddingRow {
  id: string;
  caption: string | null;
  hashtags: string[] | null;
  spoken_hook: string | null;
  idea: { angle?: string } | null;
}

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillTable(table: string): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from(table)
    .select("id, caption, hashtags, spoken_hook, idea")
    .is("embedding", null);
  if (error) throw new Error(`${table} select failed: ${error.message}`);

  const rows = (data ?? []) as NullEmbeddingRow[];
  log(`${table}: ${rows.length} rows with embedding IS NULL`);
  if (rows.length === 0) return;

  const withText = rows
    .map((r) => ({
      id: r.id,
      text: buildTeardownEmbeddingText({
        caption: r.caption,
        hashtags: r.hashtags,
        spokenHook: r.spoken_hook,
        ideaAngle: r.idea?.angle,
      }),
    }))
    .filter((r) => r.text.length > 0);
  const skipped = rows.length - withText.length;
  if (skipped > 0) log(`${table}: skipping ${skipped} rows with no embeddable signal`);
  if (withText.length === 0) return;

  if (DRY_RUN) {
    for (const r of withText) log(`DRY ${r.id}: "${r.text.slice(0, 100).replace(/\n/g, " · ")}"`);
    return;
  }

  const vectors = await embedTexts(withText.map((r) => r.text));

  let updated = 0;
  for (let i = 0; i < withText.length; i++) {
    const { error: upErr } = await supabase
      .from(table)
      .update({ embedding: JSON.stringify(vectors[i]) })
      .eq("id", withText[i]!.id);
    if (upErr) throw new Error(`${table} update ${withText[i]!.id} failed: ${upErr.message}`);
    updated++;
  }
  log(`${table}: ${updated} rows embedded + written`);
}

async function main(): Promise<void> {
  log(`start${DRY_RUN ? " (dry-run)" : ""}`);
  await backfillTable("outlier_teardowns");
  await backfillTable("personal_teardowns");
  log("done");
}

main().catch((err) => {
  console.error(`[backfill-teardowns] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
