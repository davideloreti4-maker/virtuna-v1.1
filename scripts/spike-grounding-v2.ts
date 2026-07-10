/**
 * spike-grounding-v2.ts — THROWAWAY proof-spike, round 2.
 *
 * v1 proved the MECHANISM (scrape→gate→extract→ground→generate) works, cheap, live —
 * but ran a NULL profile, so it handicapped the "made for me" leg and grounding sometimes
 * PARROTED the source caption. v2 tests the leg that actually decides the thesis:
 *
 *   Q1  Does a REAL creator voice make grounded decisively beat cold — and KILL the over-copy?
 *   Q2  Does attaching the RECEIPT (each hook → its proven source) hold up?
 *   Q3  (optional) Does a Tier-2a `plus` silent video-watch deepen a VISUAL outlier's teardown?
 *
 * 3 generation arms isolate both variables (same model qwen3.7-plus, thinking-off):
 *   A  cold      + NULL profile   (v1 baseline)
 *   B  cold      + REAL voice     (voice only, no grounding)
 *   C  grounded  + REAL voice     (voice + live outlier teardowns)  ← the product
 * B-vs-C = grounding is the only variable, with voice present → the decisive read.
 *
 * NOT productized. No DB writes. ~1-2 Apify runs + 4 LLM calls. Discard after reading.
 *
 * Run: npx tsx scripts/spike-grounding-v2.ts ["search query"] ["creator ask"] [topN] [--watch]
 */

// ── Bootstrap ──
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });
import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// ── Imports ──
import { ApifyScrapingProvider } from "../src/lib/scraping/apify-provider";
import { rankOutliers } from "../src/lib/discover/outlier-compute";
import { assembleBundle } from "../src/lib/kc/assembler";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../src/lib/engine/qwen/client";
import type { ProfileRow } from "../src/lib/kc/profile-role-map";
import type { VideoData } from "../src/lib/scraping/types";
import type { RankedOutlier } from "../src/lib/discover/outlier-compute";

// ── Args ──
const argv = process.argv.slice(2);
const SEARCH_QUERY = argv.find((a) => !a.startsWith("--")) ?? "high protein breakfast";
const positional = argv.filter((a) => !a.startsWith("--"));
const CREATOR_ASK = positional[1] ?? SEARCH_QUERY;
const TOP_N = positional[2] ? parseInt(positional[2], 10) : 3;
const DO_WATCH = argv.includes("--watch");
const PLATFORM = "tiktok" as const;

// ── The REAL synthetic creator — deliberately DISTINCT voice/angle from generic food ──
// If grounding just parrots @sohonutrition ("crispy cottage cheese"), it will be OBVIOUSLY
// wrong for this blunt budget-trainer-for-busy-dads persona → the over-copy failure is legible,
// and success = proven STRUCTURE translated into HIS voice.
const CREATOR: ProfileRow = {
  niche_primary: "fitness",
  niche_sub: "high-protein nutrition for busy dads",
  target_audience: { age_range: "30-45", gender_skew: "male", geo: "US", language: "English" },
  primary_goal: "grow to 100k and sell a $27 meal-prep guide",
  creator_stage: "growth",
  past_wins: [{ url: "https://tiktok.com/@x/1" }, { url: "https://tiktok.com/@x/2" }],
  past_flops: [{ url: "https://tiktok.com/@x/3" }],
  target_platforms: ["tiktok"],
  writing_voice_sample:
    "Look — you don't need 6am cold plunges or 12 supplements. You need 3 things that actually " +
    "work and take zero willpower. Stop overcomplicating breakfast. Here's exactly what I eat " +
    "before a 12-hour shift, and what I feed my kids. No fluff, no guru nonsense. Just protein.",
};

// ── helpers ──
function handleFromUrl(url: string): string {
  const m = /@([A-Za-z0-9._]+)/.exec(url ?? "");
  return m?.[1] ? `@${m[1]}` : "@unknown";
}
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
async function fetchOpening(subtitleUrl?: string): Promise<string | null> {
  if (!subtitleUrl) return null;
  try {
    const res = await fetch(subtitleUrl);
    if (!res.ok) return null;
    const vtt = await res.text();
    const lines = vtt
      .split(/\r?\n/)
      .filter((l) => l.trim() && !/^WEBVTT/i.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()));
    const opening = lines.slice(0, 6).join(" ").replace(/\s+/g, " ").trim();
    return opening ? opening.slice(0, 240) : null;
  } catch {
    return null;
  }
}

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
        `caption: ${v.caption}\nhashtags: ${v.hashtags.join(" ")}`,
    )
    .join("\n\n");
  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a short-form video analyst. Tear each proven outlier into a REUSABLE hook framework — " +
            "name the mechanism, don't summarize the topic. JSON only.",
        },
        {
          role: "user",
          content:
            `Tear down these ${items.length} proven TikTok outliers. For each return: archetype (hook pattern), ` +
            `template (GENERALIZED structure with [slots] any niche could fill), spokenHook (best reconstruction of ` +
            `the opening line), whyItWorks (one sentence on the retention mechanism).\n` +
            `JSON: { "teardowns": [ { "archetype","template","spokenHook","whyItWorks" } ] } (${items.length}, in order).\n\n` +
            payload,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      enable_thinking: false,
      max_tokens: 2000,
    } as never,
  );
  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { teardowns?: Teardown[] };
  return Array.isArray(parsed.teardowns) ? parsed.teardowns : [];
}

interface Hook {
  hookLine: string;
  mechanism: string;
  sourceIndex?: number; // grounded arm only: 1..N → which proven source it adapts (0 = none)
}
const SYSTEM_HOOKS =
  "You are an elite short-form hook writer. Write scroll-stopping first lines with distinct mechanisms.";
function contract(grounded: boolean): string {
  const shape = grounded
    ? `{ "hooks": [ { "hookLine": string, "mechanism": string, "sourceIndex": number } ] }`
    : `{ "hooks": [ { "hookLine": string, "mechanism": string } ] }`;
  return (
    `\n\n---\nOUTPUT FORMAT: single JSON object, no prose. Shape: ${shape}. ` +
    `Return exactly 5 STRONG, DISTINCT-mechanism hooks. Every field required, non-empty. ` +
    `"mechanism" is plain-prose reasoning, never a bracket-tag.` +
    (grounded
      ? ` "sourceIndex" is the number (1-N) of the proven example whose STRUCTURE this hook adapts, or 0 if none.`
      : "")
  );
}
async function generateHooks(userMessage: string, grounded: boolean): Promise<Hook[]> {
  const ai = getQwenClient();
  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: SYSTEM_HOOKS + contract(grounded) },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      seed: QWEN_SEED,
      enable_thinking: false,
      max_tokens: 1600,
    } as never,
  );
  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { hooks?: Hook[] };
  return Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 5) : [];
}

// ── optional Tier-2a: silent `plus` watch to deepen a VISUAL outlier's teardown ──
async function watchVisualOutlier(provider: ApifyScrapingProvider, video: VideoData): Promise<string> {
  const resolved = await provider.resolveVideoUrl(video.videoUrl); // extra Apify run → mp4
  const ai = getQwenClient();
  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL, // §9 Tier-2a target: plus is "sighted/deaf" (watches, no audio)
      messages: [
        {
          role: "user",
          content: [
            { type: "video_url", video_url: { url: resolved.mp4Url } },
            {
              type: "text",
              text:
                "Watch this silently. In 3 short lines, name the VISUAL HOOK (first-frame device), the FORMAT " +
                "(container), and the EDITING style. Be concrete — this is a 178× outlier; what makes it stop the scroll?",
            },
          ],
        },
      ],
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: 500,
    } as never,
  );
  return res.choices[0]?.message?.content ?? "(empty)";
}

// ── Main ──
async function main() {
  const t0 = Date.now();
  console.log(`\n${"═".repeat(80)}`);
  console.log(`GROUNDED-GENERATION PROOF SPIKE v2 — real voice + receipt${DO_WATCH ? " + watch" : ""}`);
  console.log(`query "${SEARCH_QUERY}" | ask "${CREATOR_ASK}" | creator: busy-dads high-protein (blunt, anti-guru voice)`);
  console.log(`${"═".repeat(80)}\n`);

  // 1. SCRAPE
  console.log(`[1] scraping 30…`);
  const provider = new ApifyScrapingProvider();
  const videos: VideoData[] = await provider.scrapeVideos(SEARCH_QUERY, 30, "search").catch((e) => {
    console.error(`  ✗ scrape failed: ${(e as Error).message}`);
    process.exit(1);
  });
  console.log(`  ✓ ${videos.length} videos`);
  if (videos.length === 0) process.exit(1);

  // 2. GATE
  const ranked: RankedOutlier[] = rankOutliers(videos, "niche");
  const top = ranked.slice(0, TOP_N);
  console.log(`\n[2] top ${top.length} outliers:`);
  top.forEach((v) =>
    console.log(`  • ${handleFromUrl(v.videoUrl)}  ${v.multiplier.toFixed(1)}×  ${fmt(v.views)}  — ${v.caption.slice(0, 55).replace(/\n/g, " ")}…`),
  );

  // 3. EXTRACT
  console.log(`\n[3] extracting teardowns…`);
  const enriched = await Promise.all(
    top.map(async (v) => ({
      caption: v.caption,
      hashtags: v.hashtags,
      views: v.views,
      multiplier: v.multiplier,
      opening: await fetchOpening(v.subtitleUrl),
    })),
  );
  const teardowns = await extractTeardowns(enriched);
  console.log(`  ✓ ${teardowns.length} teardowns`);
  teardowns.forEach((t, i) => console.log(`   ${i + 1}. [${t.archetype}] ${t.template}`));

  // grounding block — INSTRUCTS translate-into-voice, DON'T copy (the over-copy fix) + carry index
  const groundingBlock =
    `GROUNDING — real proven outlier hooks pulled LIVE for this topic. Each went far above its account's ` +
    `own baseline. ADAPT each proven STRUCTURE into THIS creator's voice and angle — do NOT reuse the ` +
    `source's specific words or ingredients; translate the mechanism, keep it unmistakably the creator's. ` +
    `Tag each hook with the sourceIndex it adapts.\n\n` +
    teardowns
      .map((t, i) => {
        const v = top[i];
        return `${i + 1}. [${t.archetype}] ${t.template} — proven by ${handleFromUrl(v?.videoUrl ?? "")} ` +
          `(${v?.multiplier.toFixed(1)}×, ${fmt(v?.views ?? 0)}). Why: ${t.whyItWorks}`;
      })
      .join("\n");

  // 4. GENERATE ×3
  console.log(`\n[4] generating — A cold+null · B cold+voice · C grounded+voice…`);
  const msgA = assembleBundle({ ask: CREATOR_ASK, platform: PLATFORM, mode: "hooks" }, null);
  const msgB = assembleBundle({ ask: CREATOR_ASK, platform: PLATFORM, mode: "hooks" }, CREATOR);
  const msgC = assembleBundle(
    { ask: CREATOR_ASK, platform: PLATFORM, mode: "hooks", overrides: groundingBlock },
    CREATOR,
  );
  const [A, B, C] = await Promise.all([
    generateHooks(msgA, false),
    generateHooks(msgB, false),
    generateHooks(msgC, true),
  ]);

  const printArm = (label: string, hooks: Hook[], withReceipt = false) => {
    console.log(`\n${label}`);
    hooks.forEach((h, i) => {
      let receipt = "";
      if (withReceipt && h.sourceIndex && h.sourceIndex >= 1 && top[h.sourceIndex - 1]) {
        const v = top[h.sourceIndex - 1]!;
        receipt = `\n      📎 ${handleFromUrl(v.videoUrl)} · ${v.multiplier.toFixed(1)}× · ${fmt(v.views)} · ${v.videoUrl}`;
      } else if (withReceipt) {
        receipt = `\n      📎 (no source — pure craft)`;
      }
      console.log(`  ${i + 1}. ${h.hookLine}\n      ↳ ${h.mechanism}${receipt}`);
    });
  };
  console.log(`\n${"─".repeat(80)}`);
  printArm("A · COLD + NULL profile (v1 baseline — no voice, no proof):", A);
  printArm("B · COLD + REAL voice (voice only, no grounding):", B);
  printArm("C · GROUNDED + REAL voice (voice + live proof — THE PRODUCT):", C, true);

  // 5. optional watch
  if (DO_WATCH && top[0]) {
    console.log(`\n[5] Tier-2a watch on the ${top[0].multiplier.toFixed(1)}× outlier (${handleFromUrl(top[0].videoUrl)})…`);
    try {
      const watched = await watchVisualOutlier(provider, top[0]);
      console.log(`  ✓ plus WATCHED it:\n${watched.split("\n").map((l) => "     " + l).join("\n")}`);
    } catch (e) {
      console.log(`  ⚠ watch-tier NOT plug-and-play: ${(e as Error).message}`);
      console.log(`     → Tier-2a needs integration work (model/format) or the omni path — expected, useful signal.`);
    }
  }

  console.log(`\n${"═".repeat(80)}`);
  console.log(`total wall-clock: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`READ FOR: does C beat B (grounding adds value WITH voice present)? do C's hooks ADAPT (not copy)? do receipts attach?`);
  console.log(`${"═".repeat(80)}\n`);
}

main().catch((e) => {
  console.error("SPIKE FATAL:", e);
  process.exit(1);
});
