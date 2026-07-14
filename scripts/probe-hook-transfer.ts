/**
 * probe-hook-transfer.ts — is topical cosine the RIGHT retrieval axis for hooks?
 *
 * THE QUESTION. `hook_template` is stored as a MADLIB — a hook with the topic pulled out
 * and replaced by slots. That is, by construction, an abstraction OVER niche. But retrieval
 * selects rows by cosine over a topical embedding (caption + hashtags + on-screen text +
 * spoken_hook + idea.angle — the FILLED-IN line, not the madlib), then hard-drops anything
 * under GROUNDING_CACHE_MIN_SIMILARITY. So the pipeline abstracts the topic out to build the
 * template, then picks that template by the topic it just removed.
 *
 * The owner's claim: a hook structure transfers across niches — it is not about the exact
 * words, it is about WHY it works. If true, the topical floor is destroying reusable
 * structure, and the fix is to rank hooks on structure, not subject.
 *
 * WHAT THIS MEASURES (it does not assume the answer):
 *   1. CENSUS      — what is actually in the 532 rows, per platform/pool/archetype.
 *   2. REACH       — of N rows, how many can a single real query even SEE? Retrieval asks the
 *                    RPC for fetchCount=12 (ORDER BY distance LIMIT 12) and THEN applies the
 *                    floor — so the LIMIT may bind long before the floor does. This probe asks
 *                    for ALL rows so the true cosine distribution is visible.
 *   3. UNION REACH — across many different queries, how many DISTINCT rows are ever reachable?
 *                    That is the fraction of the corpus the product can actually use.
 *   4. THE LOOK    — top-K above the floor vs the K just BELOW it, side by side: madlib,
 *                    archetype, why_it_works. If the below-floor madlibs are just as reusable,
 *                    the floor is provably discarding value and the claim is confirmed.
 *   5. DIVERSITY   — does cosine-ranked top-12 even span archetypes, or does it return 12
 *                    rows of the same structure?
 *
 * Run: npx tsx scripts/probe-hook-transfer.ts
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
const { resolveRetrieveConfig, isAdmissible, hasReusableSignal, retrieveCachedExamples } =
  require("@/lib/grounding/retrieve");
const { getCorpusClient, matchSharedTeardowns } = require("@/lib/grounding/corpus");
const { embedQueryText } = require("@/lib/grounding/embedder");

type Row = {
  id: string;
  similarity: number;
  platform: string;
  source_pool: string;
  creator_handle: string | null;
  niche: string | null;
  hook_archetype: string | null;
  format: string | null;
  spoken_hook: string | null;
  hook_template: string | null;
  why_it_works: string | null;
  outlier_multiplier: number | null;
  trust_weight: number;
};

/** Real creator asks, deliberately spread across niches — plus one control that SHOULD miss. */
const QUERIES: { q: string; platform: string; note?: string }[] = [
  { q: "personal branding for founders", platform: "tiktok" },
  { q: "faceless content ideas", platform: "tiktok" },
  { q: "how do I get my first 1000 followers", platform: "tiktok" },
  { q: "fitness tips for busy dads", platform: "tiktok" },
  { q: "sourdough baking for beginners", platform: "tiktok" },
  { q: "SaaS cold outreach that actually converts", platform: "tiktok" },
  { q: "skincare routine for oily skin", platform: "tiktok" },
  { q: "day trading psychology", platform: "tiktok" },
  { q: "carbonara recipe", platform: "tiktok", note: "CONTROL — off-topic, should score low" },
  { q: "leaking radiator repair", platform: "tiktok", note: "CONTROL — off-topic, should score low" },
];

/** Ask the RPC for EVERYTHING so the true distribution is visible (retrieval only asks 12). */
const ALL = 2000;

function pct(rows: Row[], p: number): number {
  if (rows.length === 0) return NaN;
  const sorted = [...rows].map((r) => r.similarity).sort((a, b) => b - a);
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function tally(rows: Row[], key: (r: Row) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "(null)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function show(m: Map<string, number>, limit = 12): string {
  return [...m.entries()]
    .slice(0, limit)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ");
}

function clip(s: string | null, n: number): string {
  if (!s) return "—";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** A row is USABLE-AS-HOOK-GROUNDING if it carries a structure to borrow, regardless of topic. */
function hasHookStructure(r: Row): boolean {
  return Boolean(r.hook_template || r.spoken_hook);
}

async function main(): Promise<void> {
  const cfg = resolveRetrieveConfig();
  const supabase = getCorpusClient();
  const FLOOR: number = cfg.minSimilarity;
  const FETCH: number = cfg.fetchCount;

  console.log(`\n${"█".repeat(100)}`);
  console.log(`  PROBE — does topical cosine select the right rows for HOOKS?`);
  console.log(`  floor=${FLOOR}  fetchCount=${FETCH}  maxExamples=${cfg.maxExamples}  minRows=${cfg.minRows}`);
  console.log(`${"█".repeat(100)}`);

  // ── 1. CENSUS ─────────────────────────────────────────────────────────────────
  // Use a throwaway query just to pull every row back with its metadata.
  const censusVec = await embedQueryText("content");
  const all: Row[] = await matchSharedTeardowns(supabase, { embedding: censusVec, count: ALL });

  console.log(`\n┌─ 1. CENSUS — what is actually in the corpus`);
  console.log(`│  rows with an embedding (the only ones retrievable): ${all.length}`);
  console.log(`│  platform:   ${show(tally(all, (r) => r.platform))}`);
  console.log(`│  source:     ${show(tally(all, (r) => r.source_pool))}`);
  console.log(`│  niche:      ${show(tally(all, (r) => r.niche), 6)}`);
  console.log(`│  archetype:  ${show(tally(all, (r) => r.hook_archetype), 14)}`);
  console.log(`│  with madlib (hook_template):  ${all.filter((r) => r.hook_template).length}`);
  console.log(`│  with spoken_hook:             ${all.filter((r) => r.spoken_hook).length}`);
  console.log(`│  with why_it_works:            ${all.filter((r) => r.why_it_works).length}`);
  console.log(`│  HOOK-USABLE (madlib|spoken):  ${all.filter(hasHookStructure).length}   ← the pool that COULD ground hooks`);
  console.log(`└─`);

  // ── 2 + 3. REACH, per query and unioned ───────────────────────────────────────
  console.log(`\n┌─ 2. REACH — how much of the corpus can each query actually SEE?`);
  console.log(
    `│  ${"query".padEnd(42)} ${"pool".padStart(5)} ${"max".padStart(5)} ${"p50".padStart(5)} ` +
      `${">=floor".padStart(8)} ${"in top12".padStart(9)} ${"SHIPPED".padStart(8)}`,
  );

  const unionShipped = new Set<string>();
  const unionAboveFloor = new Set<string>();

  for (const { q, platform, note } of QUERIES) {
    const vec = await embedQueryText(q);
    const rows: Row[] = await matchSharedTeardowns(supabase, {
      embedding: vec,
      count: ALL,
      filterPlatform: platform,
    });

    const aboveFloor = rows.filter((r) => r.similarity >= FLOOR);
    // What retrieval ACTUALLY does: RPC LIMIT fetchCount, THEN floor + gates, THEN slice.
    const window = rows.slice(0, FETCH);
    const shipped = window
      .filter((r) => r.similarity >= FLOOR && isAdmissible(r) && hasReusableSignal(r))
      .slice(0, cfg.maxExamples);

    aboveFloor.forEach((r) => unionAboveFloor.add(r.id));
    shipped.forEach((r) => unionShipped.add(r.id));

    const label = note ? `${q}  ⟨control⟩` : q;
    console.log(
      `│  ${clip(label, 42).padEnd(42)} ${String(rows.length).padStart(5)} ` +
        `${pct(rows, 0).toFixed(3).padStart(5)} ${pct(rows, 50).toFixed(3).padStart(5)} ` +
        `${String(aboveFloor.length).padStart(8)} ${String(window.filter((r) => r.similarity >= FLOOR).length).padStart(9)} ` +
        `${String(shipped.length).padStart(8)}`,
    );
  }
  console.log(`└─`);

  console.log(`\n┌─ 3. UNION REACH — across all ${QUERIES.length} queries combined`);
  console.log(`│  distinct rows that EVER clear the floor:      ${unionAboveFloor.size} / ${all.length}`);
  console.log(`│  distinct rows that EVER reach the model:      ${unionShipped.size} / ${all.length}   ← the corpus we actually use`);
  console.log(`│  hook-usable rows stranded (never reachable):  ${all.filter(hasHookStructure).length - unionShipped.size}`);
  console.log(`└─`);

  // ── 4. THE LOOK — above the floor vs just below it ────────────────────────────
  const LOOK_Q = "personal branding for founders";
  const lookVec = await embedQueryText(LOOK_Q);
  const lookRows: Row[] = await matchSharedTeardowns(supabase, {
    embedding: lookVec,
    count: ALL,
    filterPlatform: "tiktok",
  });
  const usable = lookRows.filter(hasHookStructure);
  const above = usable.filter((r) => r.similarity >= FLOOR).slice(0, 10);
  const below = usable.filter((r) => r.similarity < FLOOR).slice(0, 10); // the 10 nearest misses

  const card = (r: Row, i: number): string =>
    [
      `  ${String(i + 1).padStart(2)}. sim=${r.similarity.toFixed(3)}  ${(r.hook_archetype ?? "—").padEnd(20)} @${r.creator_handle ?? "?"}`,
      `      MADLIB: ${clip(r.hook_template, 96)}`,
      `      ran as: ${clip(r.spoken_hook, 96)}`,
      `      works:  ${clip(r.why_it_works, 96)}`,
    ].join("\n");

  console.log(`\n${"=".repeat(100)}`);
  console.log(`  4. THE LOOK — query: "${LOOK_Q}"`);
  console.log(`${"=".repeat(100)}`);
  console.log(`\n▲ ABOVE THE FLOOR (sim ≥ ${FLOOR}) — these reach the model today:\n`);
  above.forEach((r, i) => console.log(card(r, i)));
  console.log(`\n▼ JUST BELOW THE FLOOR (sim < ${FLOOR}) — these are DELETED before the model sees them.`);
  console.log(`  READ THE MADLIBS. If they would work for a founder-branding creator, the floor is the bug.\n`);
  below.forEach((r, i) => console.log(card(r, i)));

  // ── 5. DIVERSITY — does cosine give a spread of structures? ───────────────────
  const top12 = lookRows.slice(0, FETCH);
  console.log(`\n┌─ 5. DIVERSITY — archetype spread`);
  console.log(`│  whole corpus:       ${show(tally(all, (r) => r.hook_archetype), 14)}`);
  console.log(`│  cosine top-${FETCH} window: ${show(tally(top12, (r) => r.hook_archetype), 14)}`);
  console.log(`│  distinct archetypes — corpus: ${tally(all, (r) => r.hook_archetype).size} · top-${FETCH}: ${tally(top12, (r) => r.hook_archetype).size}`);
  console.log(`└─`);

  // ── 6. AFTER — the live structural path, same ten queries ────────────────────
  // Runs the REAL retrieveCachedExamples with skill:"hooks", so this measures what generation
  // actually receives — not a re-implementation of it that could drift from the shipped code.
  console.log(`\n┌─ 6. AFTER — rank="structural" (skill: "hooks"), same ten queries`);
  console.log(`│  ${"query".padEnd(42)} ${"shipped".padStart(8)} ${"archetypes".padStart(11)} ${"grounded".padStart(9)}`);

  const unionStructural = new Set<string>();
  for (const { q, platform, note } of QUERIES) {
    const res = await retrieveCachedExamples({ query: q, platform, skill: "hooks", niche: null });
    res.examples.forEach((e: { teardownId: string }) => unionStructural.add(e.teardownId));
    const label = note ? `${q}  ⟨control⟩` : q;
    console.log(
      `│  ${clip(label, 42).padEnd(42)} ${String(res.examples.length).padStart(8)} ` +
        `${String(res.stats.archetypes).padStart(11)} ${(res.enough ? "yes" : "no").padStart(9)}`,
    );
  }
  console.log(`│`);
  console.log(`│  distinct rows reachable — BEFORE: ${unionShipped.size} · AFTER: ${unionStructural.size}  (of ${all.length})`);
  console.log(`└─\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
