/**
 * spike-persona-population.ts — a THROWAWAY proof of the Audience Sim v2 architecture.
 *
 * SSOT: docs/DESIGN-2026-07-15-audience-simulation-v2.md. This touches NOTHING in the app — it is a
 * standalone script (like scripts/measure-targeting.ts) whose only job is to let us LOOK at output
 * and answer two questions before we touch the engine:
 *
 *   Q1. Does ONE generator, fed only a context bundle (sparse OR rich), produce a genuinely VARIED,
 *       plausible audience — or mush?
 *   Q2. Does a CHEAP, transparent scoring function (no LLM per persona) produce a believable and
 *       DIFFERENTIATED reaction distribution across different content?
 *
 * If both hold, the pivot is real and we design the engine integration. If not, we learned it for the
 * cost of one script.
 *
 * The shape it proves (per the design doc):
 *   generate(contextBundle) --1 LLM call--> K segments (+ topic vocab)   [ONCE, at "calibration"]
 *   expand(segments, N)      --pure math--> N individuals (centroid + jitter)
 *   characterize(content)    --1 LLM call--> a content vector in the SAME named axes
 *   react(individuals, content) --O(N) math--> distribution              [per content test]
 *
 * Run:   npx tsx scripts/spike-persona-population.ts
 * Cost:  2 generator calls (sparse+rich) + (2 contexts × 3 hooks) characterization calls. ~cents.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { register } from "tsconfig-paths";
import tsconfig from "../tsconfig.json";

config({ path: resolve(__dirname, "../.env.local") });
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");

// ─── Schema (the design-doc strawman, inline for the spike) ───────────────────

interface ReactionProfile {
  interests: Record<string, number>; // topic → affinity 0..1
  hookSensitivity: number; // 0..1 how strong an opening it demands
  noveltyBias: number; // 0..1 comfort-watcher(0) ↔ trend-chaser(1)
  skepticism: number; // 0..1 distrust of hype/claims
  attentionSpan: number; // 0..1 patience for a slow build
}
interface BehaviorProfile {
  watchThrough: number;
  sharePropensity: number;
  commentPropensity: number;
  savePropensity: number;
}
interface Segment {
  name: string;
  share: number; // Σ = 1
  blurb: string;
  whyFollows: string;
  spread: number; // 0..1 how internally diverse this segment is (drives individual jitter)
  centroid: ReactionProfile & BehaviorProfile;
}
interface Persona {
  id: string;
  segment: string;
  reaction: ReactionProfile;
  behavior: BehaviorProfile;
}
// A content candidate scored into the SAME axes the personas use.
interface ContentVector {
  topics: Record<string, number>; // affinity this content has for each topic 0..1
  hookStrength: number; // 0..1 how arresting the opening is
  novelty: number; // 0..1 how novel/trend-forward
  hype: number; // 0..1 how much it makes big/claimy promises
  slowness: number; // 0..1 how slow the payoff is
}

// ─── Seeded RNG (reproducible; mulberry32) ────────────────────────────────────

function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Box–Muller gaussian from a uniform generator
function gauss(rand: () => number) {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ─── The Qwen JSON call ───────────────────────────────────────────────────────

async function qwenJSON(system: string, user: string, temperature: number): Promise<unknown> {
  const ai = getQwenClient();
  const res = await ai.chat.completions.create(
    {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
      seed: QWEN_SEED,
      enable_thinking: false,
    } as never,
  );
  const raw = (res as { choices: { message: { content: string } }[] }).choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

// ─── (1) THE GENERATOR — one call, context-bundle in → segments out ───────────

const GEN_SYSTEM = `You model the AUDIENCE of a social-media creator as a small set of distinct viewer SEGMENTS.
You are given whatever context exists — it may be rich or almost nothing. Produce a plausible, VARIED
audience regardless: real audiences are heterogeneous, so segments must genuinely differ from each other
(a passive scroller and a craft-obsessed student are not slight variations — they are opposites on most axes).

Output STRICT JSON, no prose:
{
  "topicVocab": string[],   // 6-12 canonical topic tags this niche's content spans (lowercase_snake)
  "segments": [
    {
      "name": string,                 // human label, e.g. "Frame-by-frame craft students"
      "share": number,                // 0..1, all shares SUM TO 1
      "blurb": string,                // one line the creator would read
      "whyFollows": string,           // what they come for
      "spread": number,               // 0..1 internal diversity (tight niche = low, broad casual = high)
      "centroid": {
        "interests": { "<topic from topicVocab>": number },  // 0..1 affinity, only the topics that matter to them
        "hookSensitivity": number,    // 0..1 how strong an opening they DEMAND before they stay
        "noveltyBias": number,        // 0..1 comfort-watcher(0) ↔ trend-chaser(1)
        "skepticism": number,         // 0..1 distrust of hype/big claims
        "attentionSpan": number,      // 0..1 patience for a slow build
        "watchThrough": number,       // 0..1 completion tendency
        "sharePropensity": number,    // 0..1
        "commentPropensity": number,  // 0..1
        "savePropensity": number      // 0..1
      }
    }
  ]
}
Rules: 8-12 segments. Shares sum to 1.0. Every centroid number in [0,1]. Make segments SPREAD OUT across
the axes — do not cluster them all in the middle. Interests should reference only topicVocab tags.`;

async function generatePopulation(label: string, contextBundle: string): Promise<{ segments: Segment[]; topicVocab: string[] }> {
  const out = (await qwenJSON(
    GEN_SYSTEM,
    `CONTEXT BUNDLE for this creator (${label}):\n\n${contextBundle}\n\nGenerate the audience.`,
    0.7, // want diversity in the generated segments
  )) as { topicVocab?: string[]; segments?: Segment[] };

  const segments = (out.segments ?? []).filter((s) => s && s.centroid);
  // Normalize shares defensively (LLM rarely sums to exactly 1)
  const total = segments.reduce((s, x) => s + (x.share || 0), 0) || 1;
  segments.forEach((s) => (s.share = (s.share || 0) / total));
  return { segments, topicVocab: out.topicVocab ?? [] };
}

// ─── (2) EXPANSION — pure math, segments → N individuals ──────────────────────

function expand(segments: Segment[], N: number, seed: number): Persona[] {
  const rand = rng(seed);
  const people: Persona[] = [];
  segments.forEach((seg, si) => {
    const count = Math.max(1, Math.round(seg.share * N));
    const sigma = 0.08 + 0.22 * clamp01(seg.spread); // tight segment → small jitter, broad → large
    for (let i = 0; i < count; i++) {
      const jitter = (base: number) => clamp01(base + gauss(rand) * sigma);
      const c = seg.centroid;
      const interests: Record<string, number> = {};
      for (const [k, v] of Object.entries(c.interests || {})) interests[k] = jitter(v);
      people.push({
        id: `${si}-${i}`,
        segment: seg.name,
        reaction: {
          interests,
          hookSensitivity: jitter(c.hookSensitivity),
          noveltyBias: jitter(c.noveltyBias),
          skepticism: jitter(c.skepticism),
          attentionSpan: jitter(c.attentionSpan),
        },
        behavior: {
          watchThrough: jitter(c.watchThrough),
          sharePropensity: jitter(c.sharePropensity),
          commentPropensity: jitter(c.commentPropensity),
          savePropensity: jitter(c.savePropensity),
        },
      });
    }
  });
  return people;
}

// ─── (3) CONTENT CHARACTERIZATION — one call, into the SAME axes ──────────────

const CHAR_SYSTEM = `You score a short-form video HOOK on fixed axes so an audience model can react to it.
Output STRICT JSON, no prose:
{
  "topics": { "<tag>": number },  // 0..1 how strongly the hook engages each RELEVANT topic (use the given vocab)
  "hookStrength": number,         // 0..1 how arresting the first 2 seconds are
  "novelty": number,              // 0..1 how novel / trend-forward vs familiar
  "hype": number,                 // 0..1 how much it over-promises / makes big claims
  "slowness": number              // 0..1 how slow the payoff is (0 = instant, 1 = long build)
}
All numbers in [0,1]. topics keys MUST come from the provided vocabulary.`;

async function characterize(hook: string, topicVocab: string[]): Promise<ContentVector> {
  const out = (await qwenJSON(
    CHAR_SYSTEM,
    `TOPIC VOCABULARY: ${topicVocab.join(", ")}\n\nHOOK: "${hook}"\n\nScore it.`,
    0,
  )) as ContentVector;
  return out;
}

// ─── (4) THE CHEAP SCORER — transparent, auditable, no LLM ────────────────────
//
// A logit built from named interactions, so we can always say WHY a persona stopped. Constants are
// eyeball-tuned for the spike; the whole point is to LOOK at the distribution and adjust.

function pStop(p: Persona, c: ContentVector): { p: number; why: string } {
  // interestMatch = the persona's affinity for the topics THIS hook actually hits (content-weighted).
  let num = 0;
  let den = 0;
  for (const [t, w] of Object.entries(c.topics || {})) {
    num += w * (p.reaction.interests[t] ?? 0);
    den += w;
  }
  const interestMatch = den > 0 ? num / den : 0;

  const hookGap = Math.max(0, p.reaction.hookSensitivity - c.hookStrength); // hook too weak for them
  const noveltyMismatch = Math.abs(p.reaction.noveltyBias - c.novelty);
  const hypePenalty = p.reaction.skepticism * c.hype;
  const patiencePenalty = (1 - p.reaction.attentionSpan) * c.slowness;

  const logit =
    -0.4 + // TikTok default is to scroll
    3.2 * interestMatch -
    2.2 * hookGap -
    1.4 * noveltyMismatch -
    1.6 * hypePenalty -
    1.6 * patiencePenalty;
  const prob = 1 / (1 + Math.exp(-logit));

  // Dominant reason (largest-magnitude contributor) — the auditable "why".
  const terms: [string, number][] = [
    ["interest", 3.2 * interestMatch],
    ["weak-hook", -2.2 * hookGap],
    ["novelty-mismatch", -1.4 * noveltyMismatch],
    ["hype-vs-skeptic", -1.6 * hypePenalty],
    ["too-slow", -1.6 * patiencePenalty],
  ];
  terms.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { p: prob, why: terms[0][0] };
}

// ─── (5) REACT + AGGREGATE ────────────────────────────────────────────────────

function react(people: Persona[], c: ContentVector) {
  const perSeg = new Map<string, { stop: number; total: number }>();
  let stop = 0;
  const reasons = new Map<string, number>();
  for (const p of people) {
    const { p: prob, why } = pStop(p, c);
    const stopped = prob > 0.5;
    if (stopped) stop++;
    const seg = perSeg.get(p.segment) ?? { stop: 0, total: 0 };
    seg.total++;
    if (stopped) seg.stop++;
    perSeg.set(p.segment, seg);
    if (stopped) reasons.set(why, (reasons.get(why) ?? 0) + 1);
  }
  return { stopPct: (100 * stop) / people.length, perSeg, reasons };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONTEXTS: { label: string; bundle: string }[] = [
  {
    label: "SPARSE (new profile, no scrape)",
    bundle: `A brand-new TikTok account. All we know: the creator wants to make "magic / illusion" videos.
No videos posted yet, no audience data, no scrape available.`,
  },
  {
    label: "RICH (creator description)",
    bundle: `TikTok creator in the cinematic "magic"/illusion + VFX space (think Zach King). Seamless,
practical-looking edits where everyday reality bends — teleport cuts, objects morphing, walls opening
like zippers. Very large, broad, family-friendly following: kids, casual scrollers, aspiring editors,
VFX/compositing learners, and people who follow trends rather than the creator. Highly shareable,
"how did they do that" comment culture, strong save rate from people studying the technique.`,
  },
];

const HOOKS = [
  "I zipped open my apartment wall like a tent and walked through it.", // broad spectacle
  "The exact frame where this illusion breaks — let me slow it down for you.", // craft/technique
  "POV: your morning routine, but physics is optional.", // relatable comedy
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const N = 300;

async function main() {
  for (const ctx of CONTEXTS) {
    console.log("\n" + "█".repeat(78));
    console.log(`█ CONTEXT: ${ctx.label}`);
    console.log("█".repeat(78));

    const { segments, topicVocab } = await generatePopulation(ctx.label, ctx.bundle);
    console.log(`\nTOPIC VOCAB: ${topicVocab.join(", ")}`);
    console.log(`\nGENERATED ${segments.length} SEGMENTS (${N} individuals sampled):`);
    for (const s of segments) {
      const c = s.centroid;
      console.log(
        `  ${(Math.round(s.share * 100) + "%").padStart(4)}  ${s.name.padEnd(34)} ` +
          `hookDemand ${c.hookSensitivity.toFixed(2)} · novelty ${c.noveltyBias.toFixed(2)} · ` +
          `skeptic ${c.skepticism.toFixed(2)} · attn ${c.attentionSpan.toFixed(2)} · spread ${s.spread.toFixed(2)}`,
      );
      console.log(`        ↳ ${s.blurb}`);
    }

    const people = expand(segments, N, 12345);
    console.log(`\n  (expanded to ${people.length} individuals)`);

    for (const hook of HOOKS) {
      const cv = await characterize(hook, topicVocab);
      const { stopPct, perSeg, reasons } = react(people, cv);
      console.log(`\n  ─── HOOK: "${hook}"`);
      console.log(
        `      content: topics{${Object.entries(cv.topics || {})
          .map(([k, v]) => `${k}:${(v as number).toFixed(1)}`)
          .join(" ")}} hook ${cv.hookStrength.toFixed(2)} nov ${cv.novelty.toFixed(2)} hype ${cv.hype.toFixed(2)} slow ${cv.slowness.toFixed(2)}`,
      );
      console.log(`      OVERALL STOP: ${stopPct.toFixed(1)}%`);
      const rows = [...perSeg.entries()]
        .map(([name, v]) => ({ name, pct: (100 * v.stop) / v.total }))
        .sort((a, b) => b.pct - a.pct);
      for (const r of rows) console.log(`        ${(r.pct.toFixed(0) + "%").padStart(4)}  ${r.name}`);
      console.log(
        `      dominant reasons: ${[...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}(${n})`).join(", ")}`,
      );
    }
  }
  console.log("\nDONE. Look for: (Q1) do segments SPREAD across the axes, or cluster in the middle?");
  console.log("       (Q2) do different hooks light up DIFFERENT segments, or move everyone together?\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
