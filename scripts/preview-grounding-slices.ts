/**
 * preview-grounding-slices.ts — print the REAL per-skill grounding blocks that generation
 * would receive, retrieved from the REAL corpus.
 *
 * WHY THIS EXISTS: grounding is invisible. It is a string spliced into a prompt, behind a
 * flag, inside a runner — there is no surface a human can look at, and the whole 532-row
 * curated corpus reached the model through a renderer that silently dropped its three
 * richest fields for weeks without a single test failing. A block you cannot cheaply LOOK
 * AT will drift, and reading the source will not catch it. This is the look.
 *
 * Run: npx tsx scripts/preview-grounding-slices.ts ["your query"] [tiktok|instagram|youtube]
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { retrieveCachedExamples, isProofGrade, hasReusableSignal, isFreshTeardown, resolveRetrieveConfig } =
  require("@/lib/grounding/retrieve");
const { buildCorpusBlock, CORPUS_CHAR_BUDGET } = require("@/lib/grounding/prompt");
const { getCorpusClient, matchSharedTeardowns } = require("@/lib/grounding/corpus");
const { embedQueryText } = require("@/lib/grounding/embedder");

const QUERY = process.argv[2] ?? "how to grow on tiktok";
const PLATFORM = process.argv[3] ?? "tiktok";
const DEBUG = process.argv.includes("--debug");
const SKILLS = ["hooks", "ideas", "script"] as const;

/**
 * Show WHICH filter rejected each candidate. A retrieval that returns nothing is indis-
 * tinguishable from a retrieval that found nothing relevant — unless you can see the
 * rejects. "0 good of 12 matched" is a symptom; this prints the cause.
 */
async function debugRejects(): Promise<void> {
  const cfg = resolveRetrieveConfig();
  const embedding = await embedQueryText(QUERY);
  const rows = await matchSharedTeardowns(getCorpusClient(), {
    embedding,
    count: 12,
    filterPlatform: PLATFORM,
  });

  console.log(`\n  candidates (minSim=${cfg.minSimilarity}, gate=≥3× vs followers):`);
  for (const r of rows) {
    const reasons: string[] = [];
    if (r.similarity < cfg.minSimilarity) reasons.push(`sim ${r.similarity.toFixed(3)} < ${cfg.minSimilarity}`);
    if (!isProofGrade(r)) reasons.push(`mult ${r.outlier_multiplier ?? "—"} < 3×`);
    if (!hasReusableSignal(r)) reasons.push("no signal");
    if (!isFreshTeardown(r.proof_captured_at, cfg.freshDays)) reasons.push("stale");
    const verdict = reasons.length === 0 ? "KEPT" : `drop: ${reasons.join(" · ")}`;
    console.log(
      `   sim=${r.similarity.toFixed(3)} mult=${String(r.outlier_multiplier ?? "—").padStart(6)} ` +
        `@${(r.creator_handle ?? "?").padEnd(22)} ${verdict}`,
    );
  }
  console.log();
}

async function main(): Promise<void> {
  const res = await retrieveCachedExamples({ query: QUERY, platform: PLATFORM, niche: null });

  console.log(`\nQUERY: "${QUERY}"  ·  platform: ${PLATFORM}`);
  console.log(
    `retrieved ${res.examples.length} examples · enough=${res.enough} · ` +
      `matched=${res.stats.matched} · good=${res.stats.good} · minSim=${res.stats.minSimilarity}`,
  );

  if (DEBUG) await debugRejects();

  if (res.examples.length === 0) {
    console.log("\nNo examples cleared the bar — generation would run ungrounded (honestly labeled).");
    return;
  }

  for (const skill of SKILLS) {
    const { corpus, used } = buildCorpusBlock(res.examples, skill);
    const bar = "=".repeat(96);
    console.log(`\n${bar}`);
    console.log(
      `  ${skill.toUpperCase()} SLICE — ${corpus.length}/${CORPUS_CHAR_BUDGET} chars · ` +
        `${used.length}/${res.examples.length} examples rendered`,
    );
    console.log(bar);
    console.log(corpus);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
