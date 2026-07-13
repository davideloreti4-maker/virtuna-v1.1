/**
 * Mock skill fixtures — hand-authored, schema-valid blocks for a zero-cost demo thread.
 *
 * WHY: iterate on the composer / audience model / thread rendering + feel without burning
 * Qwen (+Apify) tokens on every run. These are realistic, deterministic block payloads —
 * NOT model output — that render through the EXACT production renderers (MessageBlocks →
 * per-skill ThreadViews). One representative message per skill covers every card surface.
 *
 * DEV-ONLY. Consumed by:
 *  - /api/dev/mock/seed  → inserts these into the open thread (the "preloaded populated chat")
 *  - the tool-route mock short-circuit (Layer 2) → persists the matching skill's blocks
 *
 * CONTRACT: every block here MUST satisfy BlockUnionSchema (blocks.ts). The fixtures test
 * (`__tests__/fixtures.test.ts`) parses all of them so an invalid edit fails CI instead of
 * silently degrading to an <UnsupportedBlock> at the write boundary (insertMessage / D-14).
 *
 * THEME: a fitness / high-protein creator, matching the seeded thread titles already in the
 * test account ("5 minute high protein breakfast", "meal prep for busy professionals").
 */

import type { BlockUnion } from "@/lib/tools/blocks";

/** A seed message = one persisted `messages` row (role + its block array). */
export interface SeedMessage {
  role: "user" | "assistant" | "tool";
  blocks: BlockUnion[];
}

/** The skills a mock fixture set exists for (keys into FIXTURE_BLOCKS_BY_SKILL). */
export type MockSkill =
  | "hooks"
  | "ideas"
  | "script"
  | "remix"
  | "chat"
  | "explore"
  | "profile"
  | "simulate"
  | "predict";

// A small reusable 3-persona reaction (S3′) so the ambient "why?" modal has real data.
const HOOK_PERSONAS = [
  { archetype: "The skeptical lifter", verdict: "stop" as const, quote: "ok wait 40g from ONE bowl? show me." },
  { archetype: "The time-poor parent", verdict: "stop" as const, quote: "if this is actually 5 min i'm in." },
  { archetype: "The macro optimizer", verdict: "scroll" as const, quote: "heard the 'high protein' angle a hundred times." },
];

// ─── Hooks (Make) — ranked hook-card blocks ──────────────────────────────────
const HOOK_BLOCKS: BlockUnion[] = [
  {
    type: "hook-card",
    props: {
      hookLine: "I ate 40g of protein before 8am without cooking a single egg.",
      audienceArchetype: "The time-poor parent",
      mechanism: "Specific number + a defied assumption (no eggs) forces a 'how?' open loop.",
      seedHook: "40g protein before 8am, no eggs",
      rank: 1,
      band: "Strong",
      fraction: "8/10 stop",
      scrollQuote: "wait, 40g with no eggs? I need the recipe.",
      model: "sim1-flash",
      scored: true,
      channel: "spoken",
      personas: HOOK_PERSONAS,
    },
  },
  {
    type: "hook-card",
    props: {
      hookLine: "The 'healthy' breakfast keeping you hungry by 10am.",
      audienceArchetype: "The macro optimizer",
      mechanism: "Names a shared frustration and blames a trusted habit — indictment hook.",
      seedHook: "your healthy breakfast is the problem",
      rank: 2,
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "…is this why I'm starving mid-morning?",
      model: "sim1-flash",
      scored: true,
      channel: "spoken",
    },
  },
  {
    type: "hook-card",
    props: {
      hookLine: "Stop buying protein powder. Do this instead.",
      audienceArchetype: "The skeptical lifter",
      mechanism: "Pattern-interrupt command + withheld payoff drives the swipe-up curiosity.",
      seedHook: "stop buying protein powder",
      rank: 3,
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "bold claim, but I'll bite.",
      model: "sim1-flash",
      scored: true,
      channel: null,
    },
  },
];

// ─── Ideas (Make) — idea-card blocks ─────────────────────────────────────────
const IDEA_BLOCKS: BlockUnion[] = [
  {
    type: "idea-card",
    props: {
      title: "The $3 high-protein breakfast tier list",
      angle: "Rank cheap breakfasts by protein-per-dollar, not by 'clean eating' vibes.",
      whyItFits: "Your audience over-indexes on budget + macros — a tier list rewards both.",
      mechanism: "Ranking format = built-in retention (they wait for #1).",
      seedHook: "ranking cheap breakfasts by protein per dollar",
      needsTake: false,
      topic: "Budget high-protein breakfasts",
      take: "Protein-per-dollar beats 'clean' every time",
      format: "Tier list",
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "finally someone ranking by macros AND price.",
      model: "sim1-flash",
      scored: true,
    },
  },
  {
    type: "idea-card",
    props: {
      title: "I tried the viral cottage cheese bowl for 7 days",
      angle: "A first-person test of a trend your audience keeps seeing but hasn't tried.",
      whyItFits: "Trend-jacking with a personal receipt — the honesty your audience trusts.",
      mechanism: "Time-boxed challenge = a promised before/after payoff.",
      seedHook: "7 days of the viral cottage cheese bowl",
      needsTake: true,
      topic: "Cottage cheese protein bowls",
      take: "Add your real day-4 'I was sick of it' moment",
      format: "Vlog / challenge",
      band: "Mixed",
      fraction: "6/10 stop",
      scrollQuote: "does it actually get boring? tell me the truth.",
      model: "sim1-flash",
      scored: true,
    },
  },
  {
    type: "idea-card",
    props: {
      title: "Why your protein goal is probably too low",
      angle: "Reframe the standard 0.8g/kg advice against a body-recomposition goal.",
      whyItFits: "Myth-bust format performs for your saves-driven, evidence-hungry viewers.",
      mechanism: "Contrarian correction of a 'known fact' = comment-bait.",
      seedHook: "your protein target is too low",
      needsTake: false,
      topic: "Protein requirements",
      take: "The RDA is a floor, not a goal",
      format: null,
      band: "Strong",
      fraction: "8/10 stop",
      scrollQuote: "wait, the number I've been using is the MINIMUM?",
      model: "sim1-flash",
      scored: true,
    },
  },
];

// ─── Script (Make) — one script-card block ───────────────────────────────────
const SCRIPT_BLOCKS: BlockUnion[] = [
  {
    type: "script-card",
    props: {
      openingBeatSeed: "40g protein before 8am, no eggs",
      beats: [
        {
          label: "Hook",
          content: "I ate 40 grams of protein before 8am — and I didn't cook a single egg.",
          timing: "0–3s",
          retentionMarker: "Concrete number + defied assumption opens a 'how?' loop immediately.",
        },
        {
          label: "Setup",
          content: "Most 'high protein' breakfasts need a stove, 20 minutes, and a sink full of pans.",
          timing: "3–8s",
          retentionMarker: "Names the friction the viewer feels every rushed morning.",
        },
        {
          label: "Turn",
          content: "Here's the 90-second bowl: skyr, a scoop of isolate, frozen berries, and a spoon of PB2.",
          timing: "8–18s",
          retentionMarker: "The reveal pays off the hook with a specific, repeatable recipe.",
        },
        {
          label: "Payoff",
          content: "That's 41 grams, roughly 320 calories, zero cooking, and it actually tastes like dessert.",
          timing: "18–25s",
          retentionMarker: "Stacks the proof (macros + taste) so the value feels undeniable.",
        },
        {
          label: "CTA",
          content: "Follow for the 5 other no-cook breakfasts I rotate through the week.",
          timing: "25–28s",
          retentionMarker: "Promises a series — a reason to follow, not just like.",
        },
      ],
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "no cook AND 40g? saving this immediately.",
      model: "sim1-flash",
    },
  },
];

// ─── Remix (Make) — one remix-card block ─────────────────────────────────────
const REMIX_BLOCKS: BlockUnion[] = [
  {
    type: "remix-card",
    props: {
      adaptedHook: "I ranked every gas-station snack by protein-per-dollar.",
      angle: "Borrow the 'rank an everyday category' structure and point it at your niche.",
      whoItsFor: "Budget-conscious lifters who eat on the road",
      formatBorrowed: "Ranked tier list with a controversial #1",
      sourceDecode: {
        hookPattern: "Opens on the single most surprising entry, not #1 — curiosity before authority.",
        structure: "Fast cuts, one item per beat, on-screen price + metric as a persistent HUD.",
        theTurn: "Midway 'the one everybody's wrong about' reframe resets attention.",
        emotionalBeat: "Validation — 'the cheap option is actually the smart option.'",
      },
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "gas station protein tier list is genuinely useful, go on.",
      model: "sim1-flash",
      audienceName: "Budget lifters",
    },
  },
];

// ─── Chat (Ask · The room) — assistant markdown turns ────────────────────────
const CHAT_BLOCKS: BlockUnion[] = [
  {
    type: "markdown",
    props: {
      text:
        "Dropping the raw thought in **The room** — here's what your audience is likely feeling.\n\n" +
        "Your budget lifters respond to **specificity + receipts**: the exact macros, the exact price, and a real first-person test. " +
        "The angle that keeps landing for you is *\"the cheap/lazy option is actually the smart one\"* — it flatters the viewer for a choice they were already making.\n\n" +
        "If you want, I can turn this into a hook set or a full script.",
    },
  },
];

// ─── Explore (Make · Discover) — one outlier-grid block ──────────────────────
const EXPLORE_BLOCKS: BlockUnion[] = [
  {
    type: "outlier-grid",
    props: {
      mode: "niche",
      tiles: [
        {
          platformVideoId: "demo-7412001",
          videoUrl: "https://www.tiktok.com/@demo.macros/video/7412001",
          caption: "The $3 breakfast that hits 40g protein",
          views: 2_400_000,
          likes: 318_000,
          comments: 9_200,
          shares: 44_000,
          saves: 187_000,
          durationSeconds: 27,
          postedAt: "2026-06-28T14:00:00.000Z",
          multiplier: 18.4,
          baselineLabel: "vs niche",
          source: "High-protein niche",
          fit: { level: "Strong" },
          trackable: true,
          trackHandle: "demo.macros",
        },
        {
          platformVideoId: "demo-7412002",
          videoUrl: "https://www.tiktok.com/@lazy.gains/video/7412002",
          caption: "I ranked gas station snacks by protein",
          views: 1_100_000,
          likes: 142_000,
          comments: 5_400,
          shares: 21_000,
          saves: 96_000,
          durationSeconds: 41,
          postedAt: "2026-06-30T18:30:00.000Z",
          multiplier: 9.1,
          baselineLabel: "vs niche",
          source: "High-protein niche",
          fit: { level: "Fair" },
          trackable: true,
          trackHandle: "lazy.gains",
        },
        {
          platformVideoId: "demo-7412003",
          videoUrl: "https://www.tiktok.com/@quietbulk/video/7412003",
          caption: "Your protein goal is a floor, not a target",
          views: 640_000,
          likes: 71_000,
          comments: 8_800,
          shares: 12_000,
          saves: 54_000,
          durationSeconds: 33,
          postedAt: "2026-07-02T09:15:00.000Z",
          multiplier: 5.3,
          baselineLabel: "vs niche",
          source: "High-protein niche",
          fit: { level: "Weak" },
          trackable: false,
        },
      ],
    },
  },
];

// ─── Profile / Simulate / Predict — the always-in-thread result blocks ───────
// These render via MessageBlocks regardless of activeTool (there is no "profile" tool
// gate). They cover the Profile read, the Simulate reaction spread, and the Predict gauge.
const PROFILE_BLOCKS: BlockUnion[] = [
  {
    type: "profile-read",
    props: {
      subjectName: "Budget lifters (General)",
      subjectKind: "panel",
      identity: {
        traits: ["Value-driven", "Skeptical of hype", "Time-constrained"],
        commStyle: "Blunt, receipts-first, allergic to fluff",
        drivers: ["Getting stronger cheaply", "Not being sold to", "Efficient routines"],
      },
      tells: [
        {
          tell: "Rewards concrete numbers over vibes",
          evidence: "\"show me the macros or it didn't happen\"",
        },
        {
          tell: "Distrusts anything that sounds like an ad",
          evidence: "\"cool story, what are you selling\"",
        },
      ],
      howTheyReact: "They lean in on specific, testable claims and bounce off generic 'eat clean' advice.",
      goalScope: "Grow a trusting audience around budget high-protein eating",
      caveat: "Directional read from a General panel — calibrate a saved audience for a sharper signal.",
      savedAudienceId: "demo-audience-budget-lifters",
      model: "sim1-flash",
      tier: "Directional",
    },
  },
  {
    type: "reaction-distribution",
    props: {
      audienceName: "Budget lifters",
      audienceId: "demo-audience-budget-lifters",
      subjectKind: "panel",
      band: "Strong",
      fraction: "8/10 react",
      themes: [
        { label: "Price-anchored trust", quote: "the per-dollar framing is why I'd save this." },
        { label: "Proof-hungry", quote: "give me the exact bowl and I'll try it tomorrow." },
      ],
      reactions: [
        { archetype: "The skeptical lifter", verdict: "stop", quote: "40g with no eggs, no way — prove it." },
        { archetype: "The time-poor parent", verdict: "stop", quote: "no-cook is the only way I'd do this." },
        { archetype: "The macro optimizer", verdict: "scroll", quote: "seen the high-protein angle before." },
      ],
      model: "sim1-flash",
      tier: "Directional",
    },
  },
  {
    type: "prediction-gauge",
    props: {
      audienceName: "Budget lifters",
      scenario: "Posting the $3 protein tier list as a Reel this week",
      band: "Lean yes",
      range: { min: 55, max: 72 },
      confidence: "Medium",
      factors: [
        { analystArchetype: "The trend analyst", driver: "Tier-list format is peaking in the niche", direction: "for" },
        { analystArchetype: "The skeptic", driver: "'High protein' hooks are saturated right now", direction: "against" },
        { analystArchetype: "The audience modeler", driver: "Budget angle matches your saves-driven viewers", direction: "for" },
      ],
      panel: [
        { archetype: "The trend analyst", lean: "lean_yes", reasoning: "Format tailwind, but execution has to be tight." },
        { archetype: "The skeptic", lean: "toss_up", reasoning: "Hook fatigue could cap the ceiling." },
        { archetype: "The audience modeler", lean: "strongly_yes", reasoning: "Squarely in your proven lane." },
      ],
      assumptions: ["Posted as a <30s Reel", "Hook is the price-per-protein line", "No paid boost"],
      successCriterion: "Beats your last 10 posts' median saves",
      caveat: "Directional forecast — a calibrated audience tightens the range.",
      model: "sim1-flash",
      tier: "Directional",
    },
  },
];

/**
 * Per-skill fixture blocks. Layer 2 (tool-route mock) persists the matching entry; the
 * seed route flattens these into the demo thread.
 */
export const FIXTURE_BLOCKS_BY_SKILL: Record<MockSkill, BlockUnion[]> = {
  hooks: HOOK_BLOCKS,
  ideas: IDEA_BLOCKS,
  script: SCRIPT_BLOCKS,
  remix: REMIX_BLOCKS,
  chat: CHAT_BLOCKS,
  explore: EXPLORE_BLOCKS,
  profile: [PROFILE_BLOCKS[0]!],
  simulate: [PROFILE_BLOCKS[1]!],
  predict: [PROFILE_BLOCKS[2]!],
};

/**
 * The demo thread, in render order. One assistant message per skill so the rehydration
 * bucketing (composer.tsx) sorts each into its per-skill ThreadView, cleanly gated on the
 * active skill pill.
 *
 * NOTE: the Profile / Simulate / Predict result blocks (PROFILE_BLOCKS) are DELIBERATELY
 * excluded from the default seed. Unlike the card skills, those blocks render tool-INDEPENDENTLY
 * (persistedProfileBlocks) — i.e. pinned to the TOP of EVERY skill view — so seeding them made
 * the big forensic Read card dominate the Hooks/Chat/etc. views and read as "wrong" (a Read card
 * on top of The room). They stay in FIXTURE_BLOCKS_BY_SKILL for Layer 2 (on-demand mock runs),
 * where each renders in isolation when you actually run that skill. To eyeball them via seed,
 * temporarily add `{ role: "assistant", blocks: PROFILE_BLOCKS }` here.
 */
export const SEED_MESSAGES: SeedMessage[] = [
  { role: "assistant", blocks: HOOK_BLOCKS },
  { role: "assistant", blocks: IDEA_BLOCKS },
  { role: "assistant", blocks: SCRIPT_BLOCKS },
  { role: "assistant", blocks: REMIX_BLOCKS },
  { role: "assistant", blocks: EXPLORE_BLOCKS },
  { role: "assistant", blocks: CHAT_BLOCKS },
];
