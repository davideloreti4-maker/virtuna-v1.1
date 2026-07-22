/**
 * Dev-gallery fixtures — the exact block payloads the thread renders, per skill.
 *
 * SSOT: blocks are the SAME shapes validated by src/lib/tools/blocks.ts + profile-blocks.ts
 * (block-registry.ts). Typed to the Zod-inferred block types below, so a schema change breaks
 * the build here first. Group A blocks feed the real *-thread-view wrappers (1:1 with a
 * just-completed run); Group B blocks render through MessageBlocks exactly as the thread mounts
 * them (profile / simulate / predict / text-Read / primitives).
 *
 * Cover / avatar URLs use picsum.photos seeds so image-bearing cards render *populated*; the
 * real cards take ephemeral TikTok-CDN URLs and degrade to placeholders on error (that degrade
 * path is exercised by the 4th analyzed-video below, which omits a coverUrl).
 */

import type {
  IdeaCardBlock,
  HookCardBlock,
  ScriptCardBlock,
  RemixCardBlock,
  OutlierGridBlock,
  MultiAudienceReadBlock,
  AccountReadBlock,
  MarkdownBlock,
  PersonasBlock,
  PersonaChatTurnBlock,
  ReactionPersona,
} from "@/lib/tools/blocks";
import type {
  ProfileReadBlock,
  ReactionDistributionBlock,
  PredictionGaugeBlock,
} from "@/lib/tools/profile-blocks";
import type { StageState } from "@/components/thread/progress-checklist";

const IMG = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** A reusable 10-persona reaction spread (the exact {archetype, verdict, quote} SIMs emit). */
export const PERSONAS: ReactionPersona[] = [
  { archetype: "The Skeptic", verdict: "scroll", quote: "Heard this a hundred times — what's actually new?" },
  { archetype: "The Aspirant", verdict: "stop", quote: "Okay that opening line got me, I need to know the rest." },
  { archetype: "The Busy Pro", verdict: "stop", quote: "Fast and to the point — I'll give it 10 seconds." },
  { archetype: "The Lurker", verdict: "scroll", quote: "Feels like an ad, keep scrolling." },
  { archetype: "The Superfan", verdict: "stop", quote: "She always delivers, watching all of it." },
  { archetype: "The Newcomer", verdict: "stop", quote: "Wait, is that actually true? Tell me more." },
  { archetype: "The Critic", verdict: "scroll", quote: "The hook overpromises, I can smell the letdown." },
  { archetype: "The Sharer", verdict: "stop", quote: "My group chat needs to see this immediately." },
  { archetype: "The Time-poor", verdict: "scroll", quote: "Too slow to get going, out." },
  { archetype: "The Believer", verdict: "stop", quote: "This is exactly the nudge I needed today." },
];

/**
 * PER-PERSONA GENERATION (`target`) — WHO a calibrated card was written FOR, and how that exact
 * reader then reacted in the SIM. Present ONLY on a calibrated run (a General run omits it). The
 * generative fixtures below carry this on their FIRST (calibrated) card so the dev gallery previews
 * the "Written for The Aspirant → they stopped" line the live card shows; the second variant omits
 * it to preview the un-targeted state. `archetype` binds to one of the fixed 10; `label` is the
 * display name.
 */
const TARGET_ASPIRANT: import("@/lib/tools/blocks").CardTarget = {
  archetype: "aspirant",
  label: "The Aspirant",
  share: 0.14,
  verdict: "stop",
  quote: "Okay that opening line got me, I need to know the rest.",
};
const TARGET_BUSY_PRO: import("@/lib/tools/blocks").CardTarget = {
  archetype: "busy-pro",
  label: "The Busy Pro",
  share: 0.11,
  verdict: "stop",
  quote: "Fast and to the point — I'll give it 10 seconds.",
};

/**
 * AUDIENCE SIM v2 (`population`) — the honest N-individual projection: a REAL O(N) score of ~1,000
 * sampled individuals across the signature's 10 segments (NOT the 10's rollup). Carried on a
 * calibrated card so the AudienceLens Population·1,000 Sheet renders the genuine distribution. The
 * generative fixtures below reference this on their calibrated card so the gallery previews the
 * Sheet without a live characterized run. Totals reconcile: shares sum to 1.00, segment totals sum
 * to 1,000, and segment stops sum to the top-line stop (544).
 */
export const POPULATION_1K: import("@/lib/tools/blocks").PopulationAggregateBlock = {
  total: 1000,
  stop: 544,
  scroll: 456,
  stopPct: 54.4,
  segments: [
    { archetype: "skeptic", displayName: "The Skeptic", share: 0.12, total: 120, stop: 40, stopPct: 33.3 },
    { archetype: "aspirant", displayName: "The Aspirant", share: 0.14, total: 140, stop: 98, stopPct: 70.0 },
    { archetype: "busy-pro", displayName: "The Busy Pro", share: 0.11, total: 110, stop: 74, stopPct: 67.3 },
    { archetype: "lurker", displayName: "The Lurker", share: 0.09, total: 90, stop: 27, stopPct: 30.0 },
    { archetype: "superfan", displayName: "The Superfan", share: 0.08, total: 80, stop: 64, stopPct: 80.0 },
    { archetype: "newcomer", displayName: "The Newcomer", share: 0.1, total: 100, stop: 62, stopPct: 62.0 },
    { archetype: "critic", displayName: "The Critic", share: 0.09, total: 90, stop: 25, stopPct: 27.8 },
    { archetype: "sharer", displayName: "The Sharer", share: 0.1, total: 100, stop: 71, stopPct: 71.0 },
    { archetype: "time-poor", displayName: "The Time-poor", share: 0.08, total: 80, stop: 20, stopPct: 25.0 },
    { archetype: "believer", displayName: "The Believer", share: 0.09, total: 90, stop: 63, stopPct: 70.0 },
  ],
  reasons: [
    { reason: "The outcome-first claim opened a concrete curiosity gap.", count: 231 },
    { reason: "Recognized the pain from their own experience.", count: 168 },
    { reason: "Read as another over-promising ad and kept scrolling.", count: 142 },
  ],
};

/** A completed 3-step stage plan → drives the collapsed "✓ Ran your audience · N steps" receipt. */
export const doneStages = (names: string[]): StageState[] =>
  names.map((name) => ({ name, status: "done" }));

// ─────────────────────────────────────────────────────────────────────────────
// Group A — skill blocks (feed the real *-thread-view wrappers)
// ─────────────────────────────────────────────────────────────────────────────

export const IDEA_BLOCKS: IdeaCardBlock[] = [
  {
    type: "idea-card",
    props: {
      title: "The 30-day silence experiment",
      angle: "Absence as a growth lever — what happens when you deliberately go quiet.",
      whyItFits: "Your top 3 posts all lead with a counter-intuitive claim about consistency.",
      mechanism: "Curiosity gap + identity threat (creators fear disappearing).",
      seedHook: "I stopped posting for 30 days. Here's what actually happened to my account.",
      needsTake: true,
      topic: "Creator growth",
      take: "Consistency is overrated; strategic absence compounds attention.",
      format: "Talking-head + on-screen data",
      band: "Strong",
      fraction: "8/10 stop",
      scrollQuote: "Okay that opening line got me, I need to know the rest.",
      model: "sim1-flash",
      scored: true,
      personas: PERSONAS,
      // §11f fan-out — the grounded idea variant carries the SAME shared ProofReceipt as the
      // hook card (real outlier the structure was drawn from). The second fixture is the same
      // RUN but cited no source, so together these two ARE the half-attributed grid the owner
      // saw: receipt here, stated absence there. Keep them paired — this is the only place the
      // mixed state is previewable without a live grounded run.
      grounded: true,
      proof: {
        handle: "nourish.me.now",
        videoUrl: "https://www.tiktok.com/@nourish.me.now/video/7300000000000000002",
        coverUrl: null,
        hookTemplate: "I stopped [common habit] for [timeframe]. Here's what happened to my [thing].",
        archetype: "resource-drop",
        multiplier: 277.4,
        views: 4300000,
        baselineLabel: "vs followers",
        fitLabel: "adjacent",
      },
      // Calibrated run → this idea was WRITTEN FOR a named reader, and the Population·1,000 Sheet
      // renders the genuine N-individual distribution. The second card omits both (un-targeted).
      target: TARGET_ASPIRANT,
      population: POPULATION_1K,
    },
  },
  {
    type: "idea-card",
    props: {
      title: "Why your best video underperformed",
      angle: "Post-mortem a 'good' video that flopped — teach the diagnosis, not the win.",
      whyItFits: "Your audience over-indexes on 'why did this happen' explainer hooks.",
      mechanism: "Loss-framing + open loop (they fear making the same mistake).",
      seedHook: "This is the best video I've ever made. It flopped. Here's why.",
      needsTake: false,
      topic: "Content strategy",
      take: "Quality ≠ reach; distribution timing beat the edit.",
      format: null,
      band: "Mixed",
      fraction: "6/10 stop",
      scrollQuote: "Wait, is that actually true? Tell me more.",
      model: "sim1-flash",
      scored: true,
      personas: PERSONAS.slice(2, 8),
      // Same grounded run as the card above, but the model wrote this one from scratch (no
      // sourceIndex). It renders <NoSourceNote>, not a hole. Drop `grounded` here and you are
      // looking at the original bug.
      grounded: true,
    },
  },
];

export const HOOK_BLOCKS: HookCardBlock[] = [
  {
    type: "hook-card",
    props: {
      hookLine: "Stop editing your videos. Do this instead.",
      audienceArchetype: "The Busy Pro",
      mechanism: "Pattern-interrupt via a permission to quit a painful task.",
      seedHook: "Stop editing your videos.",
      rank: 1,
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "Fast and to the point — I'll give it 10 seconds.",
      model: "sim1-flash",
      scored: true,
      channel: "spoken",
      // The FIRST-FRAME technique that opens the video — the visual execution of this ranked
      // hook (owner 2026-07-22). `technique` is a real Sandcastles first-frame technique; the
      // second fixture below omits `visualHook` to preview the honest-absent state.
      visualHook: {
        technique: "crash-zoom",
        onScreen: "Hard cut to your face mid-sentence as the words slam on in bold caps.",
      },
      personas: PERSONAS,
      // §11f receipts-on-cards — the grounded variant carries a proof receipt (real outlier
      // the structure was drawn from). The other fixture below omits it (ungrounded card).
      proof: {
        handle: "braedan.health",
        videoUrl: "https://www.tiktok.com/@braedan.health/video/7300000000000000000",
        // Self-contained placeholder cover (live rows carry the real ephemeral TikTok-CDN URL).
        coverUrl:
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc5MCcgaGVpZ2h0PScxNjAnPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0nZycgeDE9JzAnIHkxPScwJyB4Mj0nMScgeTI9JzEnPjxzdG9wIG9mZnNldD0nMCcgc3RvcC1jb2xvcj0nIzNhM2EzNycvPjxzdG9wIG9mZnNldD0nMScgc3RvcC1jb2xvcj0nIzI2MjYyNCcvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSc5MCcgaGVpZ2h0PScxNjAnIGZpbGw9J3VybCgjZyknLz48cG9seWdvbiBwb2ludHM9JzM4LDY2IDM4LDk0IDY0LDgwJyBmaWxsPScjZWNlN2RlJyBvcGFjaXR5PScwLjUnLz48L3N2Zz4=",
        hookTemplate: "Stop [doing the hard thing]. Do [the easier thing] instead.",
        archetype: "trap-mistake",
        multiplier: 90.7,
        views: 621000,
        baselineLabel: "vs followers",
        fitLabel: "adjacent",
      },
      // Calibrated run → written for a named reader + the Population·1,000 projection. The rank-2
      // fixture below omits both to preview the un-targeted (General) hook state.
      target: TARGET_BUSY_PRO,
      population: POPULATION_1K,
    },
  },
  {
    type: "hook-card",
    props: {
      hookLine: "I analyzed 500 viral videos. They all break one rule.",
      audienceArchetype: "The Aspirant",
      mechanism: "Authority + curiosity gap (a hidden rule they don't know).",
      seedHook: "I analyzed 500 viral videos.",
      rank: 2,
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "She always delivers, watching all of it.",
      model: "sim1-flash",
      scored: true,
      channel: "visual",
      personas: PERSONAS.slice(1, 7),
      // Grounded but the source cover is missing/expired → the proof block falls back to the
      // play-tile placeholder (still linked to the video), demoing the never-empty thumbnail.
      proof: {
        handle: "rico.incarnati",
        videoUrl: "https://www.tiktok.com/@rico.incarnati/video/7300000000000000001",
        coverUrl: null,
        hookTemplate: "I analyzed [number] [things]. They all break [one rule].",
        archetype: "case-study",
        multiplier: 18.8,
        views: 405000,
        baselineLabel: "vs followers",
        fitLabel: "in-audience",
      },
    },
  },
];

export const SCRIPT_BLOCKS: ScriptCardBlock[] = [
  {
    type: "script-card",
    props: {
      openingBeatSeed: "I stopped editing my videos and my views tripled.",
      // A script realizes a topic in a format — the meta line beside the beat count.
      topic: "Creator growth",
      format: "Talking-head + screen-record b-roll",
      beats: [
        { label: "Hook", content: "I stopped editing my videos and my views tripled.", timing: "0–3s", retentionMarker: "Outcome-first claim creates an immediate 'how?' gap.", filming: "Close-up, handheld · text slams in on 'tripled' · deadpan delivery, no smile." },
        { label: "Setup", content: "For two years I spent 6 hours per video in CapCut. Cuts, captions, zooms — the works.", timing: "3–10s", retentionMarker: "Relatable pain establishes the stakes before the turn.", filming: "B-roll of the CapCut timeline scrubbing · VO over the screen-record · frantic pace." },
        { label: "Turn", content: "Then I noticed my raw, one-take clips were outperforming the polished ones 3 to 1.", timing: "10–20s", retentionMarker: "The counter-intuitive reversal is the payoff hinge.", filming: "Cut back to face · split-screen the two analytics graphs · let the numbers breathe." },
        { label: "Payoff", content: "Turns out the algorithm rewards watch-time, and over-editing was killing my pacing.", timing: "20–35s", retentionMarker: "Names the mechanism — gives the viewer a transferable rule.", filming: "Face, medium shot · one bold on-screen text: 'watch-time > polish' · slower, steady." },
        { label: "CTA", content: "Try one unedited take this week and tell me your retention. I bet it climbs.", timing: "35–40s", retentionMarker: "Low-friction challenge invites a comment (engagement).", filming: "Direct to camera · point at the comment area · warm, challenging tone." },
      ],
      // The consolidated "How to film" summary at the foot (owner chose BOTH per-beat + summary).
      production: {
        shots: "1 talking-head (phone, eye level) + 2 b-roll (CapCut screen-record, analytics graphs).",
        onScreenText: "Hook caption on 'tripled'; one payoff card: 'watch-time > polish'.",
        setup: "Phone at eye level, window light on your face, lav or phone mic close.",
        edit: "Hard cuts only — no zooms or transitions; keep the raw, one-take feel the video is about.",
      },
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "Fast and to the point — I'll give it 10 seconds.",
      model: "sim1-flash",
      personas: PERSONAS,
      // §11f fan-out — a grounded script carries at most ONE receipt (one script → one source);
      // shares the hook card's ProofReceipt. Placed on the face above the opener proof unit.
      proof: {
        handle: "polish1990",
        videoUrl: "https://www.tiktok.com/@polish1990/video/7300000000000000003",
        coverUrl: null,
        hookTemplate: "I stopped [doing the expected thing] and my [metric] [improved].",
        archetype: "sensory-promise",
        multiplier: 144.9,
        views: 2000000,
        baselineLabel: "vs followers",
        fitLabel: "structural",
      },
      // The script develops the hook the creator picked, so it inherits that hook's target reader;
      // `verdict`/`quote` are that reader's reaction to the OPENER only (D-01). Population·1,000
      // renders the opener-as-hook projection.
      target: TARGET_BUSY_PRO,
      population: POPULATION_1K,
    },
  },
];

export const REMIX_BLOCKS: RemixCardBlock[] = [
  {
    type: "remix-card",
    props: {
      adaptedHook: "I fired my whole marketing team and replaced them with 3 prompts.",
      angle: "Shock-firing frame borrowed from a business-teardown viral.",
      whoItsFor: "Solo founders drowning in growth busywork.",
      formatBorrowed: "Talking-head confession + receipts overlay",
      coverUrl: IMG("remixsrc", 300, 400),
      // The attributed source post. Deliberately shows the HONEST remix shape: a handle, a
      // view count and a link back — with multiplier/baseline/fit null, because a video you
      // pasted has no follower baseline and was never scored for audience fit. The receipt
      // renders exactly the facts we hold, under its own eyebrow ("The post you're remixing"),
      // never the grounded cards' "Proven structure" claim.
      proof: {
        handle: "danielle.builds",
        videoUrl: "https://www.tiktok.com/@danielle.builds/video/7301",
        coverUrl: IMG("remixsrc", 300, 400),
        views: 2_100_000,
        hookTemplate: null,
        archetype: null,
        multiplier: null,
        baselineLabel: null,
        fitLabel: null,
      },
      sourceDecode: {
        hookPattern: "Opens on an irreversible, taboo decision ('I fired…') to trigger loss-aversion attention.",
        structure: "Confession → escalating proof → reframe → generalizable takeaway. Tight 4-beat spine.",
        theTurn: "The reveal that the 'team' was AI — recontextualizes the whole cold open.",
        emotionalBeat: "Vindication: the viewer roots for the underdog who beat the expensive system.",
      },
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "Feels like an ad, keep scrolling.",
      model: "sim1-flash",
      audienceName: "Bootstrapped Founders",
      personas: PERSONAS,
      // The shoot plan for YOUR adapted version — how to execute the borrowed "talking-head
      // confession + receipts overlay" format for the firing angle. Parallels the script card.
      production: {
        shots: "You to camera for the confession + screen-record b-roll of the 3 prompts firing.",
        onScreenText: "Cold-open caption on 'fired'; receipts overlay of the before/after numbers.",
        setup: "Phone at eye level, one soft key light, lav mic; sit close for the confession tone.",
        edit: "Cut on the reveal ('the team was AI') — hold nothing before it; punchy, no B-roll music bed.",
      },
      // The adapted hook's N-individual projection → the Population·1,000 Sheet (remix has no
      // per-persona `target`; its calibrated reader is named by `audienceName` above).
      population: POPULATION_1K,
    },
  },
];

export const CHAT_BLOCKS: MarkdownBlock[] = [
  {
    type: "markdown",
    props: {
      text:
        "For this week, lean into your **explainer** format — it's your strongest with this audience.\n\nThree angles worth posting:\n\n1. **The mistake post** — \"Why your best video underperformed.\" Diagnosis content over-indexes for your people.\n2. **The contrarian take** — challenge a piece of common advice in your niche.\n3. **The receipts post** — show a real before/after with numbers.\n\nWant me to turn any of these into hooks and test them against your audience?",
    },
  },
];

export const EXPLORE_BLOCKS: OutlierGridBlock[] = [
  {
    type: "outlier-grid",
    props: {
      mode: "profile",
      tiles: [
        {
          platformVideoId: "7291822011",
          videoUrl: "https://www.tiktok.com/@demo/video/7291822011",
          caption: "The one habit that 10x'd my mornings (it's not what you think)",
          coverUrl: IMG("out1", 300, 400),
          views: 2_400_000, likes: 312_000, comments: 8_400, shares: 41_200, saves: 96_500,
          durationSeconds: 34, postedAt: "2026-05-18T09:12:00.000Z",
          multiplier: 12.4, baselineLabel: "vs own", source: "Your channel",
          fit: { level: "Strong" }, trackable: false,
        },
        {
          platformVideoId: "7288100422",
          videoUrl: "https://www.tiktok.com/@rival/video/7288100422",
          caption: "Why your content isn't landing (harsh but true)",
          coverUrl: IMG("out2", 300, 400),
          views: 890_000, likes: 61_000, comments: 3_100, shares: 12_800, saves: 22_400,
          durationSeconds: 51, postedAt: "2026-06-02T14:40:00.000Z",
          multiplier: 4.1, baselineLabel: "vs niche", source: "Competitor",
          fit: { level: "Fair" }, trackable: true, trackHandle: "rival",
        },
        {
          platformVideoId: "7290044111",
          videoUrl: "https://www.tiktok.com/@demo/video/7290044111",
          caption: "I read 40 books this year. These 3 changed everything.",
          views: 156_000, likes: 9_200, comments: 640, shares: 1_900, saves: 7_800,
          durationSeconds: 42, postedAt: "2026-06-21T18:05:00.000Z",
          multiplier: 1.8, baselineLabel: "vs own", source: "Your channel",
          fit: { level: "Weak" }, trackable: false,
        },
      ],
    },
  },
];

export const ACCOUNT_BLOCK: AccountReadBlock = {
  type: "account-read",
  props: {
    handle: "maven.creator",
    profile: {
      handle: "maven.creator",
      displayName: "Maven Creator",
      avatarUrl: IMG("avatar", 120, 120),
      verified: true,
      followerCount: 148_200,
      videoCount: 213,
    },
    // The FULL scrape (not a top-N slice) — the strip is the visible proof of how much history
    // the Read is grounded in. Ordered by views desc; the 4th omits a coverUrl to exercise the
    // placeholder-tile degrade path.
    analyzedVideos: [
      { coverUrl: IMG("post1", 120, 210), views: 2_400_000, caption: "The one habit that 10x'd my mornings", videoUrl: "https://www.tiktok.com/@demo/video/1" },
      { coverUrl: IMG("post2", 120, 210), views: 640_000, caption: "Why your content isn't landing", videoUrl: "https://www.tiktok.com/@demo/video/2" },
      { coverUrl: IMG("post3", 120, 210), views: 320_000, caption: "I read 40 books this year", videoUrl: "https://www.tiktok.com/@demo/video/3" },
      { views: 91_000, caption: "Cover expired — degrades to placeholder tile", videoUrl: "https://www.tiktok.com/@demo/video/4" },
      { coverUrl: IMG("post5", 120, 210), views: 58_000, caption: "My honest editing setup", videoUrl: "https://www.tiktok.com/@demo/video/5" },
      { coverUrl: IMG("post6", 120, 210), views: 47_000, caption: "3 hooks that never miss", videoUrl: "https://www.tiktok.com/@demo/video/6" },
      { coverUrl: IMG("post7", 120, 210), views: 41_000, caption: "Stop overthinking your first line", videoUrl: "https://www.tiktok.com/@demo/video/7" },
      { coverUrl: IMG("post8", 120, 210), views: 33_000, caption: "The retention trick nobody uses", videoUrl: "https://www.tiktok.com/@demo/video/8" },
      { coverUrl: IMG("post9", 120, 210), views: 28_500, caption: "How I script in 5 minutes", videoUrl: "https://www.tiktok.com/@demo/video/9" },
      { coverUrl: IMG("post10", 120, 210), views: 22_000, caption: "My worst-performing post (and why)", videoUrl: "https://www.tiktok.com/@demo/video/10" },
      { coverUrl: IMG("post11", 120, 210), views: 19_400, caption: "Batch a week of content in an hour", videoUrl: "https://www.tiktok.com/@demo/video/11" },
      { coverUrl: IMG("post12", 120, 210), views: 15_800, caption: "The CTA I stole from a 10M creator", videoUrl: "https://www.tiktok.com/@demo/video/12" },
      { coverUrl: IMG("post13", 120, 210), views: 12_100, caption: "Why your middles lose people", videoUrl: "https://www.tiktok.com/@demo/video/13" },
      { coverUrl: IMG("post14", 120, 210), views: 9_600, caption: "One light, one lens, zero excuses", videoUrl: "https://www.tiktok.com/@demo/video/14" },
      { coverUrl: IMG("post15", 120, 210), views: 7_300, caption: "The B-roll shot list I reuse", videoUrl: "https://www.tiktok.com/@demo/video/15" },
    ],
    patterns: {
      working: [
        "Counter-intuitive claims in the first 2 seconds",
        "On-screen data receipts backing the hook",
        "One clear takeaway per video",
      ],
      fix: [
        "Middles sag — 40% drop between 8s and 15s",
        "CTAs are vague ('follow for more')",
      ],
      recurringHooks: ['"Stop doing X"', '"I tried X for 30 days"', '"Nobody talks about X"'],
      formatMix: [
        { label: "Talking-head", count: 96, pct: 45 },
        { label: "Voiceover + b-roll", count: 64, pct: 30 },
        { label: "Text-on-screen", count: 53, pct: 25 },
      ],
      dropPoints: [
        "Second 8 — the setup runs too long before the turn",
        "Second 22 — the CTA arrives before the payoff fully lands",
      ],
    },
    trackRecord: { withinPct: 9, lastN: 12 },
  },
};

// A representative user prompt echoed at the top of each thread view (ThreadShell userTurn).
export const USER_TURNS = {
  ideas: "Give me content ideas about creator growth",
  hooks: "Write me hooks for a video on why over-editing hurts your reach",
  script: "Turn that #1 hook into a full script",
  remix: "Remix this video for bootstrapped founders",
  chat: "What should I post this week?",
  explore: "Show me what's working in my niche",
  account: "Read my account",
} as const;

// The engine follow-up (outro) that trails a completed generative run.
export const FOLLOWUPS = {
  ideas: "**The silence experiment** tested strongest with your audience. Want me to turn it into hooks?",
  hooks: "**#1** is your strongest opener. Want me to write it into a full script?",
  script: "The open holds 7/10. Want me to test the full script against your audience?",
  remix: "The adapted hook lands Mixed — the founder frame helps but the middle needs a sharper turn.",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Group B — in-thread blocks (rendered through MessageBlocks, exactly as the thread mounts them)
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_READ_BLOCK: ProfileReadBlock = {
  type: "profile-read",
  props: {
    subjectName: "Alex Rivera",
    subjectKind: "person",
    identity: {
      traits: ["Analytical", "Risk-averse", "Status-conscious"],
      commStyle: "Hedged and precise — qualifies claims, avoids absolutes.",
      drivers: ["Being seen as competent", "Avoiding public mistakes"],
    },
    tells: [
      { tell: "Defers commitment when uncertain", evidence: '"I\'d need to double-check before I could sign off on that."' },
      { tell: "Signals expertise pre-emptively", evidence: '"Having done this for twelve years, I can tell you…"' },
    ],
    howTheyReact: "Warms to proposals framed as low-risk, reversible pilots with a clear owner.",
    goalScope: "Get buy-in on a new content workflow",
    forensic: {
      deceptionLikelihood: "Low",
      cues: [
        { timestamp: "0:42", observation: "Steady eye contact while stating the budget number", inference: "Genuinely confident in the figure — not fabricated." },
        { timestamp: "1:15", observation: "Brief pause + qualifier before the timeline", inference: "Timeline is softer than presented; expect slippage." },
      ],
    },
    caveat: "A read on limited signal — treat as a hypothesis to test in the next conversation, not a verdict.",
    savedAudienceId: "aud_demo_alex",
    model: "sim1-max",
    tier: "Directional",
  },
};

const REACTION_DISTRIBUTION_BLOCK: ReactionDistributionBlock = {
  type: "reaction-distribution",
  props: {
    audienceName: "Bootstrapped Founders",
    audienceId: "aud_demo_founders",
    subjectKind: "panel",
    band: "Strong",
    fraction: "7/10 react",
    // The concept the room reacted to — what grounds the Lens door ("See the room →").
    stimulus: "Fire your team. Use AI. Here's the 3-person stack that replaced 12 hires.",
    themes: [
      { label: "Relief", quote: "Finally someone says the quiet part — I don't need a big team." },
      { label: "Doubt", quote: "Sounds great until it breaks at scale, then what?" },
    ],
    reactions: PERSONAS,
    model: "sim1-flash",
    tier: "Directional",
  },
};

const PREDICTION_GAUGE_BLOCK: PredictionGaugeBlock = {
  type: "prediction-gauge",
  props: {
    audienceName: "Bootstrapped Founders",
    scenario: "This 'fire your team, use AI' video crosses 500K views in a week",
    band: "Lean yes",
    range: { min: 42, max: 68 },
    confidence: "Medium",
    factors: [
      { analystArchetype: "The Sharer", driver: "Highly shareable taboo framing", direction: "for" },
      { analystArchetype: "The Skeptic", driver: "Bait-and-switch fatigue in the niche", direction: "against" },
      { analystArchetype: "The Aspirant", driver: "Aspirational cost-saving outcome", direction: "for" },
    ],
    panel: [
      { archetype: "The Sharer", lean: "strongly_yes", reasoning: "My audience would repost this on sight." },
      { archetype: "The Skeptic", lean: "lean_no", reasoning: "The hook overpromises; comments may turn hostile." },
      { archetype: "The Busy Pro", lean: "toss_up", reasoning: "Depends entirely on the first 2 seconds landing." },
    ],
    assumptions: ["Posted at a peak slot (weekday evening)", "The creator's baseline is ~120K views/post"],
    successCriterion: "500K views within 7 days",
    caveat: "A directional forecast from a General panel — not a validated prediction. Treat the range, not the midpoint, as the signal.",
    model: "sim1-flash",
    tier: "Directional",
  },
};

const MULTI_AUDIENCE_READ_BLOCK: MultiAudienceReadBlock = {
  type: "multi-audience-read",
  props: {
    model: "sim1-flash",
    tier: "Directional",
    audiences: [
      {
        name: "Bootstrapped Founders",
        band: "Strong",
        fraction: "8/10 stop",
        interpretation: "This lands hard — the 'fire the team' frame reads as permission to stop overspending.",
        lever: "Lead with the dollar amount you saved in the first 2 seconds.",
        whoNotFor: "Enterprise marketers hear it as reckless and scroll.",
        personas: PERSONAS.slice(0, 6),
      },
      {
        name: "General",
        band: "Mixed",
        fraction: "5/10 stop",
        interpretation: "Half stop for the shock; the other half suspect a bait-and-switch pitch.",
        lever: "Add a concrete receipt early to convert the skeptics.",
        whoNotFor: "Casual scrollers with no founder pain scroll past.",
        personas: PERSONAS.slice(2, 8),
      },
    ],
  },
};

// The DEFAULT Read shape since P3: ONE audience, read alone (the forced General second
// side is dead). This fixture also carries the orphaned-pin fallback marker, so the one
// state that says "Audience removed · scoring against General." is visually inspectable.
const SINGLE_AUDIENCE_READ_BLOCK: MultiAudienceReadBlock = {
  type: "multi-audience-read",
  props: {
    model: "sim1-flash",
    tier: "Directional",
    fallback: "audience-removed",
    audiences: [
      {
        name: "General",
        band: "Mixed",
        fraction: "5/10 stop",
        interpretation: "General splits (Mixed).",
        lever: "Mixed for General. Tighten the opener to push it toward Strong.",
        whoNotFor: "",
        personas: PERSONAS.slice(2, 8),
      },
    ],
  },
};

// ── The ambient audience (the two surfaces the gallery was blind to until 2026-07-13) ──
//
// `personas` renders the room that reacted to a concept, and it is the ONLY visible entry
// into the AudienceLens ("See the room →"). That entry is CONDITIONAL: PersonasBlockRenderer
// mounts the LensTrigger only when it receives a `conceptText`, and MessageBlocks derives that
// from a co-located `markdown` block in the SAME body (see inBandConceptText). So the fixture
// body is [markdown, personas] — the exact shape a test turn persists. A bare `personas` block
// would render the degraded, un-clickable variant and the flagship interaction would still be
// invisible here, which is the hole this fixture exists to close.
//
// The concept is the same stimulus the remix / simulate / predict fixtures react to, so the
// gallery reads as one coherent run rather than five unrelated demos.
const AMBIENT_CONCEPT_BLOCK: MarkdownBlock = {
  type: "markdown",
  props: {
    text: "I fired my whole marketing team and replaced them with 3 prompts.",
  },
};

const PERSONAS_BLOCK: PersonasBlock = {
  type: "personas",
  props: { personas: PERSONAS },
};

// `persona-chat-turn` is the "Ask them why →" sub-thread: ONE block per turn, persisted as
// ordinary messages in the Read's thread (no parent_message_id). The sub-thread IS the subset
// of turns sharing an `archetype` — so the fixture is a run of turns, not a single block, and
// the archetype repeats on every row exactly as it does in production.
//
// Honesty spine (blocks.ts): a persona-chat turn is in-voice SIM-1 text — NO band, NO score,
// NO fabricated crowd. The Skeptic is the natural drill-in: he is the one who scrolls in
// PERSONAS above ("The hook overpromises, I can smell the letdown"), and this is the creator
// interrogating exactly that verdict.
const PERSONA_CHAT_BLOCKS: PersonaChatTurnBlock[] = [
  {
    type: "persona-chat-turn",
    props: {
      archetype: "The Skeptic",
      role: "user",
      text: "You said the hook overpromises. What would you need to hear instead?",
    },
  },
  {
    type: "persona-chat-turn",
    props: {
      archetype: "The Skeptic",
      role: "assistant",
      text: "The number, in the first breath. Not \"I fired my team\" — \"I cut a $12k retainer down to $40 of API calls.\" Right now you're asking me to take the shocking part on faith and wait for the receipt. I don't wait.",
    },
  },
  {
    type: "persona-chat-turn",
    props: {
      archetype: "The Skeptic",
      role: "user",
      text: "And if the number is real — do you watch to the end?",
    },
  },
  {
    type: "persona-chat-turn",
    props: {
      archetype: "The Skeptic",
      role: "assistant",
      text: "I watch until you tell me what broke. Every one of these videos ends at the win. Show me the thing the prompts couldn't do and I'll believe the rest of it.",
    },
  },
];

/**
 * The chat agent's CITED SOURCES. Both warrant states are fixtured because they make DIFFERENT
 * claims and the difference is the whole point of the card: `topical` = real videos about the
 * subject, `structural` = proven shapes lifted from other subjects. Shipping only the flattering
 * one is how a card drifts into over-claiming without anyone being able to see it.
 */
const CORPUS_REFERENCES_TOPICAL_BLOCK = {
  type: "corpus-references",
  props: {
    query: "explaining a concept to camera",
    warrant: "topical",
    filters: { visualSetting: "greenscreen", platform: "instagram" },
    sources: [
      {
        handle: "explore_create_capture",
        videoUrl: "https://www.instagram.com/reel/CxAAA1/",
        coverUrl: null,
        hookTemplate: "The [tool] everyone sleeps on for [outcome].",
        spokenHook: "The editing trick everyone sleeps on for retention.",
        archetype: "secret-reveal-breakdown",
        format: "breakdowns-explainers",
        visualSetting: "greenscreen",
        editingStyle: "visual-greenscreen",
        multiplier: 14.2,
        views: 2_400_000,
        baselineLabel: "vs their usual views",
        fitLabel: "adjacent" as const,
      },
      {
        handle: "successwithumar",
        videoUrl: "https://www.instagram.com/reel/CxBBB2/",
        coverUrl: null,
        hookTemplate: "Why your [thing] stops working after [milestone].",
        spokenHook: "Why your hooks stop working after 10k followers.",
        archetype: "problem",
        format: "tutorial",
        visualSetting: "greenscreen",
        editingStyle: "notes-article-greenscreen",
        multiplier: 6.8,
        views: 820_000,
        baselineLabel: "vs their usual views",
        fitLabel: "adjacent" as const,
      },
      {
        // A CURATED exemplar: no measured multiplier, so ProofReceipt states no number and the
        // row reads "curated" rather than "proven". The mixed batch is deliberate — it is what
        // the corpus actually returns, and the card must not dress the unmeasured row up.
        handle: "kevkevkiwi",
        videoUrl: "https://www.instagram.com/reel/CxCCC3/",
        coverUrl: null,
        hookTemplate: "I tried [method] for [duration] — here is what broke.",
        spokenHook: "I tried batching a month of content in one day.",
        archetype: "personal-experience",
        format: "case-study",
        visualSetting: "greenscreen",
        editingStyle: "visual-greenscreen",
        multiplier: null,
        views: 310_000,
        baselineLabel: null,
        fitLabel: "structural" as const,
      },
    ],
  },
};

const CORPUS_REFERENCES_STRUCTURAL_BLOCK = {
  type: "corpus-references",
  props: {
    query: "quantum tax havens for hamsters",
    warrant: "structural",
    sources: [
      {
        handle: "thesocialcreativesclub",
        videoUrl: "https://www.instagram.com/reel/CxDDD4/",
        coverUrl: null,
        hookTemplate: "Nobody talks about the [hidden cost] of [popular thing].",
        spokenHook: "Nobody talks about the hidden cost of going viral.",
        archetype: "contrarian",
        format: "breakdowns-explainers",
        visualSetting: "studio_set",
        editingStyle: "office-room-yap",
        multiplier: 22.6,
        views: 4_100_000,
        baselineLabel: "vs their usual views",
        fitLabel: "structural" as const,
      },
    ],
  },
};

export interface BlockSection {
  type: string;
  label: string;
  note: string;
  body: unknown[];
}

/** Group B — rendered through MessageBlocks, exactly as the thread mounts them. */
export const BLOCK_SECTIONS: BlockSection[] = [
  {
    type: "profile-read",
    label: "Profile Read (forensic) · HIDDEN",
    note: "HIDDEN — the Profile skill is behind HORIZONTAL_ENABLED (flag OFF, owner call 2026-07-13). Not shippable today; renderer kept alive on purpose so persisted profile-read blocks in old threads still render (see lib/flags/horizontal.ts). Reference-only — this is the sole cheap way to look at it. Profile skill → behavioral read: identity + tells (verbatim evidence) + forensic cues (Max tier).",
    body: [PROFILE_READ_BLOCK],
  },
  {
    type: "reaction-distribution",
    label: "Simulate (reaction distribution) · HIDDEN",
    note: "HIDDEN — the Simulate skill is behind HORIZONTAL_ENABLED (flag OFF). Not shippable today; renderer kept so persisted reaction-distribution blocks still render. Reference-only. Simulate skill → 1 panel + stimulus: band + fraction + clustered themes + per-persona reactions.",
    body: [REACTION_DISTRIBUTION_BLOCK],
  },
  {
    type: "prediction-gauge",
    label: "Predict (prediction gauge) · HIDDEN",
    note: "HIDDEN — the Predict skill is behind HORIZONTAL_ENABLED (flag OFF). Not shippable today; renderer kept so persisted prediction-gauge blocks still render. Reference-only. Predict skill → honest forecast: band word + one feathered range + factors (each names its analyst).",
    body: [PREDICTION_GAUGE_BLOCK],
  },
  {
    type: "multi-audience-read",
    label: "Text Read (explicit compare)",
    note: "The compare — per-audience band + interpretation + Lever + who-not-for + persona drill. Explicit-only since P3 (the list page's Compare).",
    body: [MULTI_AUDIENCE_READ_BLOCK],
  },
  {
    // `type` doubles as the section's React key + anchor id on /dev/cards, so this
    // second multi-audience-read section carries a distinct suffix (same block type).
    type: "multi-audience-read--single",
    label: "Text Read (single + orphaned pin)",
    note: "The DEFAULT Read since P3 — one audience, read alone. This one also shows the orphaned-pin line: the pinned audience was deleted, so it scored General and says so.",
    body: [SINGLE_AUDIENCE_READ_BLOCK],
  },
  {
    type: "corpus-references",
    label: "Chat sources (topical — filtered)",
    note: "The chat agent's citation, rendered from the tool's own rows so the handles and numbers are DATA, not model prose. Only rows that cleared the warrant floor appear; an ungrounded search emits no block at all. Chips state the filters the search applied, so a narrowed answer admits it was narrowed. Note the third row: curated, no measured multiplier → no number, no 'proven'.",
    body: [CORPUS_REFERENCES_TOPICAL_BLOCK],
  },
  {
    type: "corpus-references--structural",
    label: "Chat sources (structural — other subjects)",
    note: "Same block, DIFFERENT claim. These rows are not about the creator's topic at all; they are proven SHAPES retrieved across subjects, and the header + subhead say so — the failure mode here is a cross-niche pattern reading as topical proof. The row eyebrow carries FACETS, not the claim: the group states what its rows share, a row states only what its siblings don't.",
    body: [CORPUS_REFERENCES_STRUCTURAL_BLOCK],
  },
  {
    type: "personas",
    label: "The room (personas)",
    note: "The ambient audience — 10 reactors + stop/scroll + verbatim, and the ONLY visible door into the AudienceLens. Body is [markdown concept, personas]: the concept is what arms 'See the room →' (without it the header renders un-clickable).",
    body: [AMBIENT_CONCEPT_BLOCK, PERSONAS_BLOCK],
  },
  {
    type: "persona-chat-turn",
    label: "Ask them why (persona chat)",
    note: "The 'Ask them why →' sub-thread — one block per turn, all sharing an archetype. In-voice SIM-1 text only: no band, no score, no crowd.",
    body: PERSONA_CHAT_BLOCKS,
  },
  {
    type: "band",
    label: "Band (primitive)",
    note: "The bare honesty signal — band dot+word + audience fraction + SIM provenance. No 0-100. All three bands and BOTH model containers (Flash lighter, Max heavier) render here: this primitive was the source of the card drift and it shipped one visible state, so nobody could see that its band color was applied twice or that its 24px band word had become two other cards' hero.",
    body: [
      { type: "band", props: { band: "Strong", fraction: "7/10 stop", model: "sim1-flash" } },
      { type: "band", props: { band: "Mixed", fraction: "5/10 stop", model: "sim1-max" } },
      { type: "band", props: { band: "Weak", fraction: "2/10 stop", model: "sim1-flash" } },
    ],
  },
  {
    type: "markdown",
    label: "Markdown (primitive)",
    note: "Plain narration between cards — the conversational connective tissue.",
    body: [
      { type: "markdown", props: { text: "Here's what your audience did with this. **6 of 10 stopped** — the opener carries, but the middle sags. Worth testing a tighter turn." } },
    ],
  },
];

/** Every raw block across BOTH groups — the drift-guard test validates these against the registry. */
export const ALL_FIXTURE_BLOCKS: unknown[] = [
  ...IDEA_BLOCKS,
  ...HOOK_BLOCKS,
  ...SCRIPT_BLOCKS,
  ...REMIX_BLOCKS,
  ...CHAT_BLOCKS,
  ...EXPLORE_BLOCKS,
  ACCOUNT_BLOCK,
  { type: "account-read", props: { handle: "brand.new.creator", fallback: "thin" } },
  ...BLOCK_SECTIONS.flatMap((s) => s.body),
];
