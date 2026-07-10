/**
 * spike-grounding.ts — THROWAWAY proof-spike for the grounded-generation thesis.
 *
 * Question: does grounding hook generation in REAL live-scraped outlier videos produce
 * visibly better hooks than today's cold generation? (docs/GROUNDED-GENERATION-VISION.md)
 *
 * Isolates grounding as the SINGLE variable: cold and grounded both run the REAL
 * assembleBundle → real qwen3.7-plus call with a NULL profile. The only difference is a
 * retrieved-teardown block injected through the real `overrides` injection fence.
 *
 * Pipeline (all real, wired paths):
 *   1. scrape 30   — ApifyScrapingProvider.scrapeVideos(query, 30, "search")  [clockworks]
 *   2. outlier gate — rankOutliers(videos, "niche")                           [outlier-compute]
 *   3. extract      — 1 qwen3.7-plus call, THINKING-ON, on top outliers → teardowns
 *   4. generate ×2  — assembleBundle(mode:hooks) → qwen json_object (cold vs grounded)
 *   5. print side-by-side + the proof list + timings
 *
 * NOT productized. No DB writes. ~1 Apify search + 3 LLM calls. Discard after reading.
 *
 * Run: npx tsx scripts/spike-grounding.ts ["search query"] ["creator ask"] [topN]
 */

// ── Bootstrap (verbatim repo pattern — dotenv + tsconfig-paths BEFORE @/ imports) ──
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });
import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// ── Imports (must follow bootstrap) ──
import { ApifyScrapingProvider } from "../src/lib/scraping/apify-provider";
import { rankOutliers } from "../src/lib/discover/outlier-compute";
import { assembleBundle } from "../src/lib/kc/assembler";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../src/lib/engine/qwen/client";
import type { VideoData } from "../src/lib/scraping/types";
import type { RankedOutlier } from "../src/lib/discover/outlier-compute";

// ── Args ──
const argv = process.argv.slice(2);
const SEARCH_QUERY = argv[0] ?? "high protein breakfast";
const CREATOR_ASK = argv[1] ?? SEARCH_QUERY;
const TOP_N = argv[2] ? parseInt(argv[2], 10) : 3;
const PLATFORM = "tiktok" as const;

// ── Small helpers ──
function handleFromUrl(url: string): string {
  const m = /@([A-Za-z0-9._]+)/.exec(url ?? "");
  return m?.[1] ? `@${m[1]}` : "@unknown";
}
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
/** Fetch + crudely de-timestamp a WEBVTT subtitle file → the opening spoken line(s). */
async function fetchOpening(subtitleUrl?: string): Promise<string | null> {
  if (!subtitleUrl) return null;
  try {
    const res = await fetch(subtitleUrl);
    if (!res.ok) return null;
    const vtt = await res.text();
    const lines = vtt
      .split(/\r?\n/)
      .filter(
        (l) =>
          l.trim() &&
          !/^WEBVTT/i.test(l) &&
          !/-->/.test(l) &&
          !/^\d+$/.test(l.trim()),
      );
    const opening = lines.slice(0, 6).join(" ").replace(/\s+/g, " ").trim();
    return opening ? opening.slice(0, 240) : null;
  } catch {
    return null;
  }
}

// ── Qwen: extract teardowns (THINKING-ON — the §9 "one change") ──
interface Teardown {
  archetype: string;
  template: string;
  spokenHook: string;
  whyItWorks: string;
}
async function extractTeardowns(
  items: { caption: string; hashtags: string[]; opening: string | null; views: number; multiplier: number }[],
): Promise<Teardown[]> {
  const ai = getQwenClient();
  const payload = items
    .map(
      (v, i) =>
        `VIDEO ${i + 1} — ${fmt(v.views)} views, ${v.multiplier.toFixed(1)}× its account baseline\n` +
        `opening (spoken/transcript): ${v.opening ?? "(none — infer from caption/on-screen)"}\n` +
        `caption: ${v.caption}\n` +
        `hashtags: ${v.hashtags.join(" ")}`,
    )
    .join("\n\n");

  const system =
    "You are a short-form video analyst. For each proven outlier video, tear it down into a REUSABLE hook framework. " +
    "Be concrete and structural — name the mechanism, don't summarize the topic. Respond as JSON only.";
  const user =
    `Tear down each of these ${items.length} proven TikTok outliers. For each, return:\n` +
    `- archetype: the hook pattern (e.g. Secret Reveal, Contrarian, Question, Authority, List, Trap Mistake, Case Study, Personal Experience)\n` +
    `- template: the GENERALIZED hook structure with [slots] a creator in ANY niche could fill\n` +
    `- spokenHook: your best reconstruction of the actual opening line\n` +
    `- whyItWorks: one sentence on the retention mechanism\n\n` +
    `Return JSON: { "teardowns": [ { "archetype", "template", "spokenHook", "whyItWorks" } ] } (${items.length} items, in order).\n\n` +
    payload;

  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      enable_thinking: false, // spike: OFF for a guaranteed-complete run (DashScope thinking can
      // require stream:true). §9 target is thinking-ON — retest in a rerun once proven end-to-end.
      max_tokens: 2000,
    } as never,
  );
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { teardowns?: Teardown[] };
  return Array.isArray(parsed.teardowns) ? parsed.teardowns : [];
}

// ── Qwen: generate hooks (replicates hooks-runner params EXACTLY — thinking OFF) ──
interface Hook {
  hookLine: string;
  mechanism: string;
}
const HOOKS_CONTRACT =
  `\n\n---\nOUTPUT FORMAT: single JSON object, no prose. ` +
  `Shape: { "hooks": [ { "hookLine": string, "mechanism": string } ] }. ` +
  `Return exactly 5 STRONG, DISTINCT-mechanism hooks. Every field required, non-empty. ` +
  `"mechanism" is plain-prose reasoning, never a bracket-tag.`;

async function generateHooks(userMessage: string): Promise<Hook[]> {
  const ai = getQwenClient();
  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        // Spike uses a compact craft system prompt (the real runner uses KC_HOOKS_SYSTEM_PROMPT;
        // held constant across cold+grounded so it never confounds the comparison).
        {
          role: "system",
          content:
            "You are an elite short-form hook writer. Write scroll-stopping first lines with distinct mechanisms." +
            HOOKS_CONTRACT,
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      enable_thinking: false,
      max_tokens: 1500,
    } as never,
  );
  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { hooks?: Hook[] };
  return Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 5) : [];
}

// ── Main ──
async function main() {
  const t0 = Date.now();
  console.log(`\n${"═".repeat(78)}`);
  console.log(`GROUNDED-GENERATION PROOF SPIKE`);
  console.log(`search query : "${SEARCH_QUERY}"`);
  console.log(`creator ask  : "${CREATOR_ASK}"`);
  console.log(`platform     : ${PLATFORM} | extract top ${TOP_N}`);
  console.log(`${"═".repeat(78)}\n`);

  // 1. SCRAPE 30 (live, clockworks search)
  console.log(`[1/5] scraping 30 via clockworks searchQueries…`);
  const tScrape = Date.now();
  const provider = new ApifyScrapingProvider();
  let videos: VideoData[] = [];
  try {
    videos = await provider.scrapeVideos(SEARCH_QUERY, 30, "search");
  } catch (e) {
    console.error(`  ✗ scrape failed: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${videos.length} videos in ${((Date.now() - tScrape) / 1000).toFixed(1)}s`);
  if (videos.length === 0) {
    console.error(`  ✗ zero videos — query too narrow or actor returned nothing. Try a broader query.`);
    process.exit(1);
  }

  // 2. OUTLIER GATE (rank by recency-decayed multiplier vs result-set median)
  const ranked: RankedOutlier[] = rankOutliers(videos, "niche");
  const top = ranked.slice(0, TOP_N);
  console.log(`\n[2/5] outlier gate → top ${top.length} (multiplier = views ÷ ${ranked[0]?.baselineLabel ?? "median"}):`);
  for (const v of top) {
    console.log(`  • ${handleFromUrl(v.videoUrl)}  ${v.multiplier.toFixed(1)}×  ${fmt(v.views)} views  — ${v.caption.slice(0, 60).replace(/\n/g, " ")}…`);
  }

  // 3. EXTRACT teardowns (fetch native subs where present, then 1 thinking-ON call)
  console.log(`\n[3/5] extracting teardowns (qwen3.7-plus, thinking-ON; fetching native subs…)`);
  const tExtract = Date.now();
  const enriched = await Promise.all(
    top.map(async (v) => ({
      caption: v.caption,
      hashtags: v.hashtags,
      views: v.views,
      multiplier: v.multiplier,
      opening: await fetchOpening(v.subtitleUrl),
    })),
  );
  const subHits = enriched.filter((e) => e.opening).length;
  let teardowns: Teardown[] = [];
  try {
    teardowns = await extractTeardowns(enriched);
  } catch (e) {
    console.error(`  ✗ extraction failed: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${teardowns.length} teardowns in ${((Date.now() - tExtract) / 1000).toFixed(1)}s (native-sub hits: ${subHits}/${top.length})`);
  teardowns.forEach((t, i) => {
    const v = top[i];
    console.log(`\n  ── ${handleFromUrl(v?.videoUrl ?? "")} · ${v?.multiplier.toFixed(1)}× · ${fmt(v?.views ?? 0)} ──`);
    console.log(`     archetype : ${t.archetype}`);
    console.log(`     template  : ${t.template}`);
    console.log(`     spokenHook: ${t.spokenHook}`);
    console.log(`     why       : ${t.whyItWorks}`);
  });

  // Build the grounding block (rides in through the real `overrides` injection fence)
  const groundingBlock =
    `GROUNDING — real proven outlier hooks pulled LIVE from ${PLATFORM} for this topic. Each went far ` +
    `above its account's own baseline. ADAPT these proven structures to the creator's topic; prefer ` +
    `these mechanisms over generic craft. Keep the creator's angle, borrow the proven structure.\n\n` +
    teardowns
      .map((t, i) => {
        const v = top[i];
        return `${i + 1}. [${t.archetype}] ${t.template}\n   proven by ${handleFromUrl(v?.videoUrl ?? "")} — ${v?.multiplier.toFixed(1)}× baseline, ${fmt(v?.views ?? 0)} views. Why: ${t.whyItWorks}`;
      })
      .join("\n");

  // 4. GENERATE ×2 — COLD vs GROUNDED (same call, null profile, only overrides differ)
  console.log(`\n[4/5] generating hooks — COLD vs GROUNDED (same model, null profile, grounding = only variable)…`);
  const coldMsg = assembleBundle({ ask: CREATOR_ASK, platform: PLATFORM, mode: "hooks" }, null);
  const groundedMsg = assembleBundle(
    { ask: CREATOR_ASK, platform: PLATFORM, mode: "hooks", overrides: groundingBlock },
    null,
  );
  const tGen = Date.now();
  const [cold, grounded] = await Promise.all([generateHooks(coldMsg), generateHooks(groundedMsg)]);
  console.log(`  ✓ generated in ${((Date.now() - tGen) / 1000).toFixed(1)}s`);

  // 5. SIDE BY SIDE
  console.log(`\n[5/5] ${"─".repeat(70)}`);
  console.log(`COLD (today — craft + null profile, no proof):`);
  cold.forEach((h, i) => console.log(`  ${i + 1}. ${h.hookLine}\n      ↳ ${h.mechanism}`));
  console.log(`\nGROUNDED (same call + ${teardowns.length} live outlier teardowns as grounding):`);
  grounded.forEach((h, i) => console.log(`  ${i + 1}. ${h.hookLine}\n      ↳ ${h.mechanism}`));

  console.log(`\n${"═".repeat(78)}`);
  console.log(`RECEIPTS AVAILABLE (the proof each grounded hook can carry):`);
  top.forEach((v, i) =>
    console.log(`  📎 ${handleFromUrl(v.videoUrl)} · ${v.multiplier.toFixed(1)}× · ${fmt(v.views)} views · ${v.videoUrl}`),
  );
  console.log(`\ntotal wall-clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`NOTE: 1 Apify search + 3 LLM calls (1 extract thinking-ON, 2 generate). Throwaway — no DB writes.`);
  console.log(`${"═".repeat(78)}\n`);
}

main().catch((e) => {
  console.error("SPIKE FATAL:", e);
  process.exit(1);
});
