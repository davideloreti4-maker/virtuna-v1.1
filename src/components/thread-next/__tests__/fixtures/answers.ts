/**
 * answers.ts — fixture blocks for the thread's new answer renderer (part 3, step 1).
 *
 * Shared by the `src/lib/thread-next` tests, the component tests and the `/dev/answers` page.
 * Every builder returns a block the real registry accepts (`validateBlock`; pinned by
 * `answers.test.ts`), with every required prop filled by a plain, neutral value.
 *
 * The named packs carry the drawing's content (`.scratch/next-look/part3/answers/answers.html`,
 * constants `AXH`, `AXID`, `AXSC` and the remix and video parts). The repository is public: handles
 * are the drawing's invented stand-ins, ids are made up, covers are relative paths or null, and
 * there are no colour literals or absolute links here.
 *
 * Proof handles are stored WITHOUT the "@" (as the runners store them; the receipt adds it).
 */

import type {
  AccountReadBlock,
  BroughtCardBlock,
  CorpusReference,
  CorpusReferencesBlock,
  HookCardBlock,
  HookProof,
  IdeaCardBlock,
  InputRequestBlock,
  MarkdownBlock,
  MultiAudienceReadBlock,
  OutlierGridBlock,
  PersonaChatTurnBlock,
  RemixCardBlock,
  RunHeaderBlock,
  ScriptCardBlock,
} from "@/lib/tools/blocks";
import type {
  PredictionGaugeBlock,
  ProfileReadBlock,
  ReactionDistributionBlock,
  VideoTestCardBlock,
} from "@/lib/tools/profile-blocks";
import type { ComposedCardBlock } from "@/lib/tools/composed-card-schema";
import type { PopulationAggregate } from "@/lib/audience/population";
import type { SimSealMap } from "@/lib/threads/sim-seals";

type Props<B extends { props: unknown }> = B["props"];
type Beat = ScriptCardBlock["props"]["beats"][number];

/** A receipt with every field present; pass only what differs. */
export function proof(p: Partial<HookProof> & { handle: string }): HookProof {
  return {
    videoUrl: null,
    coverUrl: null,
    hookTemplate: null,
    archetype: null,
    multiplier: null,
    views: null,
    baselineLabel: null,
    fitLabel: null,
    ...p,
  };
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function hook(text: string, opts: Partial<Props<HookCardBlock>> = {}): HookCardBlock {
  return {
    type: "hook-card",
    props: {
      hookLine: text,
      audienceArchetype: "lurker",
      mechanism: "Names a cost the viewer already feels.",
      seedHook: text,
      rank: 1,
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "",
      model: "sim1-flash",
      channel: null,
      ...opts,
    },
  };
}

export function idea(title: string, angle = "", opts: Partial<Props<IdeaCardBlock>> = {}): IdeaCardBlock {
  return {
    type: "idea-card",
    props: {
      title,
      angle,
      whyItFits: "It fits what your audience already watches.",
      mechanism: "Turns a habit into a question.",
      seedHook: title,
      needsTake: false,
      topic: "Studying",
      take: "",
      format: null,
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "",
      model: "sim1-flash",
      ...opts,
    },
  };
}

/** A beat for `script()`: content and timing, the rest neutral. */
export type BeatInput = Pick<Beat, "content" | "timing"> & Partial<Beat>;

const DEFAULT_BEATS: BeatInput[] = [
  { label: "Hook", content: "Here is the fastest lunch I make.", timing: "0–3s" },
  { label: "Payoff", content: "Five minutes, five dollars.", timing: "3–8s" },
];

export function script(beats: readonly BeatInput[] = DEFAULT_BEATS, opts: Partial<Props<ScriptCardBlock>> = {}): ScriptCardBlock {
  const full: Beat[] = beats.map((b, i) => ({ label: `Beat ${i + 1}`, retentionMarker: "It keeps the promise moving.", ...b }));
  return {
    type: "script-card",
    props: {
      beats: full,
      openingBeatSeed: full[0]?.content ?? "",
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "",
      model: "sim1-flash",
      ...opts,
    },
  };
}

export function remix(adaptedHook: string, opts: Partial<Props<RemixCardBlock>> = {}): RemixCardBlock {
  return {
    type: "remix-card",
    props: {
      adaptedHook,
      angle: "The same reveal, in your niche.",
      whoItsFor: "Students on a budget",
      formatBorrowed: "Talking head → Demo → Payoff",
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "",
      model: "sim1-flash",
      ...opts,
    },
  };
}

export function video(analysisId: string, opts: Partial<Props<VideoTestCardBlock>> = {}): VideoTestCardBlock {
  return {
    type: "video-test-card",
    props: {
      craftScore: null,
      drivers: [],
      filmstrip: [],
      dropLabel: null,
      durationLabel: null,
      working: [],
      notWorking: [],
      fixes: [],
      audienceName: "General",
      analysisId,
      model: "sim1-max",
      tier: "Directional",
      ...opts,
    },
  };
}

export function md(text: string, origin?: string): MarkdownBlock {
  return { type: "markdown", props: origin === undefined ? { text } : { text, origin } };
}

export function runHeader(skill: string, audienceLabel?: string): RunHeaderBlock {
  return { type: "run-header", props: audienceLabel === undefined ? { skill } : { skill, audienceLabel } };
}

function source(p: Partial<CorpusReference> & { handle: string }): CorpusReference {
  return { ...proof(p), spokenHook: null, format: null, visualSetting: null, editingStyle: null, ...p };
}

export function corpus(opts: Partial<Props<CorpusReferencesBlock>> = {}): CorpusReferencesBlock {
  return {
    type: "corpus-references",
    props: {
      query: "meal prep for students",
      warrant: "topical",
      sources: [
        source({ handle: "dij.arc", views: 21000 }),
        source({ handle: "lacapture", views: 154000 }),
        source({ handle: "nia.tests" }),
      ],
      ...opts,
    },
  };
}

export function inputRequest(opts: Partial<Props<InputRequestBlock>> = {}): InputRequestBlock {
  return {
    type: "input-request",
    props: {
      kind: "link",
      action: "remix",
      label: "Paste the video link and I'll adapt it for your audience.",
      placeholder: "Video link",
      ...opts,
    },
  };
}

export function composed(opts: Partial<Props<ComposedCardBlock>> = {}): ComposedCardBlock {
  return {
    type: "composed-card",
    props: {
      recipe: "comparison",
      deliverable: { kind: "claim", text: "Two hooks compared" },
      body: [
        {
          kind: "comparison",
          columns: [
            { title: "The $40 hook", points: ["Names a real cost"] },
            { title: "The 3-step hook", points: ["Promises a quick fix"] },
          ],
        },
        { kind: "bullets", items: ["Lead with the cost.", "Keep the fix in the same line."] },
        { kind: "note", text: "Both name finals week." },
      ],
      ...opts,
    },
  };
}

export function outlierGrid(opts: Partial<Props<OutlierGridBlock>> = {}): OutlierGridBlock {
  return {
    type: "outlier-grid",
    props: {
      mode: "niche",
      tiles: [
        {
          platformVideoId: "fixture-outlier-1",
          videoUrl: "/fixtures/outlier-1",
          caption: "The $5 lunch that got me through finals",
          coverUrl: "/covers/c9.jpg",
          views: 154000,
          likes: 12000,
          comments: 300,
          shares: 900,
          saves: 4000,
          durationSeconds: 29,
          postedAt: "2026-11-01T00:00:00Z",
          multiplier: 10.4,
          baselineLabel: "vs followers",
          source: "Meal prep",
        },
      ],
      ...opts,
    },
  };
}

/** The drawing's fallback card ("Your account", three lines, then "Show all"). */
export function accountRead(opts: Partial<Props<AccountReadBlock>> = {}): AccountReadBlock {
  return {
    type: "account-read",
    props: {
      handle: "nia.tests",
      profile: { handle: "nia.tests", displayName: "Nia", avatarUrl: "", verified: false, followerCount: 1200, videoCount: 40 },
      analyzedVideos: [],
      patterns: {
        recurringHooks: [],
        formatMix: [],
        dropPoints: [],
        working: ["Mostly talking to camera.", "Videos run 20 to 30 seconds.", "You post 4 times a week."],
        fix: ["Your first second is often a slow pan."],
      },
      trackRecord: null,
      ...opts,
    },
  };
}

export function profileRead(opts: Partial<Props<ProfileReadBlock>> = {}): ProfileReadBlock {
  return {
    type: "profile-read",
    props: {
      subjectName: "Late-night studiers",
      subjectKind: "panel",
      identity: { traits: ["Busy", "Budget-minded"], commStyle: "Short and direct", drivers: ["Saving time"] },
      tells: [{ tell: "Skips long intros", evidence: "just get to the point" }],
      howTheyReact: "They stay for a clear payoff.",
      goalScope: "Watch to the end",
      caveat: "A read, not a promise.",
      savedAudienceId: "aud-fixture-1",
      model: "sim1-flash",
      tier: "Directional",
      ...opts,
    },
  };
}

export function multiAudienceRead(opts: Partial<Props<MultiAudienceReadBlock>> = {}): MultiAudienceReadBlock {
  const audience = (name: string, lever: string) => ({
    name,
    band: "Mixed" as const,
    fraction: "5/10 stop",
    interpretation: "Half of them stay for the price.",
    lever,
    whoNotFor: "",
    personas: [],
  });
  return {
    type: "multi-audience-read",
    props: {
      audiences: [audience("Students", "Lead with the price"), audience("General", "Show the food first")],
      model: "sim1-flash",
      concept: "The $5 meal prep",
      ...opts,
    },
  };
}

export function reactionDistribution(kind: "person" | "panel"): ReactionDistributionBlock {
  if (kind === "person") {
    return {
      type: "reaction-distribution",
      props: {
        audienceName: "Nia",
        subjectKind: "person",
        read: { verdict: "receptive", reasoning: "The price lands first.", quote: "I'd try the five dollar one." },
        model: "sim1-flash",
        tier: "Directional",
      },
    };
  }
  return {
    type: "reaction-distribution",
    props: {
      audienceName: "Students",
      subjectKind: "panel",
      band: "Mixed",
      fraction: "5/10 react",
      reactions: [
        { archetype: "lurker", verdict: "stop", quote: "The price got me." },
        { archetype: "tough_crowd", verdict: "scroll", quote: "Seen this before." },
      ],
      model: "sim1-flash",
      tier: "Directional",
    },
  };
}

export function predictionGauge(opts: Partial<Props<PredictionGaugeBlock>> = {}): PredictionGaugeBlock {
  return {
    type: "prediction-gauge",
    props: {
      audienceName: "Students",
      scenario: "Posting at 8pm doubles saves",
      band: "Lean yes",
      range: { min: 40, max: 60 },
      confidence: "Medium",
      factors: [
        { analystArchetype: "saver", driver: "Evening is when they plan meals", direction: "for" },
        { analystArchetype: "tough_crowd", driver: "Late posts sink under exam content", direction: "against" },
      ],
      panel: [{ archetype: "saver", lean: "lean_yes", reasoning: "They plan the week on Sunday night." }],
      assumptions: [],
      successCriterion: null,
      caveat: "A forecast, not a promise.",
      model: "sim1-flash",
      tier: "Directional",
      ...opts,
    },
  };
}

export function personaChatTurn(opts: Partial<Props<PersonaChatTurnBlock>> = {}): PersonaChatTurnBlock {
  return {
    type: "persona-chat-turn",
    props: { archetype: "lurker", role: "assistant", text: "I would stay if the price came first.", ...opts },
  };
}

export function broughtCard(opts: Partial<Props<BroughtCardBlock>> = {}): BroughtCardBlock {
  return {
    type: "brought-card",
    props: {
      stimulus: "My own hook about cheap lunches",
      kind: "draft",
      lens: "stop",
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "Feels like an ad.",
      model: "sim1-flash",
      ...opts,
    },
  };
}

// ─── Seals ───────────────────────────────────────────────────────────────────

/** A population aggregate of 1,000 viewers at a given stop rate (no segments, no reasons). */
export function population(stopPct: number): PopulationAggregate {
  const total = 1000;
  const stop = Math.round((stopPct / 100) * total);
  return { total, stop, scroll: total - stop, stopPct, segments: [], reasons: [] };
}

/**
 * A population with the given segments, `[archetype, share (0..1), stopPct]`, weightiest share first as
 * stored. The whole's `stopPct` is their share-weighted mean to one decimal. `displayNames` sets a stored
 * display name (the page must never print it).
 */
export function segmentsPopulation(
  rows: readonly (readonly [string, number, number])[],
  displayNames: Partial<Record<string, string>> = {},
): PopulationAggregate {
  const total = 1000;
  const segments = rows.map(([archetype, share, stopPct]) => {
    const n = Math.round(share * total);
    return { archetype, displayName: displayNames[archetype] ?? archetype, share, total: n, stop: Math.round((stopPct / 100) * n), stopPct };
  });
  const stopPct = Math.round(rows.reduce((sum, [, share, pct]) => sum + share * pct, 0) * 10) / 10;
  const stop = Math.round((stopPct / 100) * total);
  return { total, stop, scroll: total - stop, stopPct, segments, reasons: [] };
}

/** Hook 1's real run as drawn (`AXGR`: share of the audience, % that would stop; weighted 30). "Quiet
 *  Watchers" is an old era's stored display name: the page shows "Quiet watchers" (`groupName`). */
export const HOOK_1_POPULATION: PopulationAggregate = segmentsPopulation(
  [
    ["loyalist", 0.18, 1],
    ["lurker", 0.14, 52],
    ["high_engager", 0.12, 6],
    ["sharer", 0.12, 36],
    ["tough_crowd", 0.09, 27],
    ["saver", 0.09, 100],
    ["cross_niche_curiosity", 0.08, 38],
    ["purposeful_viewer", 0.06, 5],
    ["niche_deep_buyer", 0.06, 3],
    ["niche_deep_scout", 0.06, 42],
  ],
  { lurker: "Quiet Watchers" },
);

// ─── The drawing's content ───────────────────────────────────────────────────

const HOOK_1 = "I spent $40 on meal prep and it tasted like regret. Here is the $5 version that actually keeps me alive during finals.";
const HOOK_2 = "Stop eating sad desk lunch: my 3-step fix for brain fog during exams.";
const HOOK_3 = "I tried the viral 5-hour meal prep challenge so you don’t have to. Spoiler: I failed, but here is what actually worked.";

/** `AXH`: the three hooks of the meal-prep thread; hook 1 carries its sheet details. */
export const MEAL_PREP_HOOKS: readonly HookCardBlock[] = [
  hook(HOOK_1, {
    rank: 1,
    mechanism: "It breaks the idea that meal prep means expensive wellness culture.",
    visualHook: { technique: "Cold open", onScreen: "Sad grey food next to textbooks" },
    proof: proof({ handle: "dij.arc", coverUrl: "/covers/c8.jpg", videoUrl: "/clips/dij-arc", multiplier: 50.2, baselineLabel: "their followers", views: 21000 }),
  }),
  hook(HOOK_2, { rank: 2 }),
  hook(HOOK_3, { rank: 3 }),
];

/** `AXID`: four ideas, title and one grey line. */
export const IDEAS_4: readonly IdeaCardBlock[] = [
  idea("The ‘Productivity Porn’ Trap", "Aesthetic routines are performative, not functional."),
  idea("The Two-Hour Study Lie", "Short sessions stick better."),
  idea("Your To-Do List Is a Mood Board", "Writing a task down is not doing it."),
  idea("Rest Is Part of the Work", "A burnout week costs more."),
];

/** An idea opened (P12's second idea, with a take, a why and a format to show; invented). */
export const IDEA_SHEET: IdeaCardBlock = idea("The Two-Hour Study Lie", "Short sessions stick better.", {
  take: "Long study blocks feel productive, but most of the second hour is gone by the next morning. Three short sessions beat one long one.",
  whyItFits: "Your audience saves study advice that admits a habit was wrong. They comment when a routine they keep gets questioned.",
  format: "Talking head with an on-screen timer",
  seedHook: "I studied two hours a day for a month. Here is how much I remembered.",
});

const SCRIPT_OPENING = "I fed 10 million viral videos into an AI to simulate your exact audience.";

const SCRIPT_AI_BEATS: readonly BeatInput[] = [
  { label: "Hook", content: SCRIPT_OPENING, timing: "0–3s" },
  { label: "Setup", content: "It watched my draft and showed me who would scroll away.", timing: "3–8s" },
  { label: "Turn", content: "Half of them were gone before my second sentence.", timing: "8–14s" },
  { label: "Payoff", content: "So I cut the intro, ran it again, and they stayed.", timing: "14–20s" },
  { label: "CTA", content: "Comment “sim” and I’ll run your video next.", timing: "20–24s" },
];

/** The opening line + `AXSC`, five beats ending at 0:24. No filming cues, no plan: no "How to film it". */
export const SCRIPT_AI: ScriptCardBlock = script(SCRIPT_AI_BEATS, { openingBeatSeed: SCRIPT_OPENING });

/** A shoot plan as the runner sends it: the three it always has, and the edit it sometimes has. */
const SHOOT_PLAN = {
  shots: "One talking head at eye level and two screen recordings of the simulation.",
  onScreenText: "The number on the hook, the drop-off on the turn.",
  setup: "Phone at eye level, window light on your face, the mic close.",
};

/** The cue the model gave on some beats (the Hook, the Turn and the CTA), not on every one. */
const FILMING: Partial<Record<string, string>> = {
  Hook: "Close-up, handheld. Text on screen: 10 million videos. Flat, certain delivery.",
  Turn: "Screen recording of the drop-off, then cut straight back to your face.",
  CTA: "Lean into the camera with a half smile. Text on screen: comment sim.",
};

/** `SCRIPT_AI` filmed (thread depth §3.2): cues on three beats of five, and a plan with its edit. */
export const SCRIPT_FILMED: ScriptCardBlock = script(
  SCRIPT_AI_BEATS.map((b) => (FILMING[b.label!] ? { ...b, filming: FILMING[b.label!] } : b)),
  { openingBeatSeed: SCRIPT_OPENING, production: { ...SHOOT_PLAN, edit: "Hard cuts only, no zooms. Keep the one-take feel." } },
);

/** `SCRIPT_AI` with a plan and no edit, and no cue on any beat. */
export const SCRIPT_PLANNED: ScriptCardBlock = script(SCRIPT_AI_BEATS, { openingBeatSeed: SCRIPT_OPENING, production: SHOOT_PLAN });

/** The remix sample: @lacapture's camera move. */
export const REMIX_CAMERA: RemixCardBlock = remix("I’m gonna show y’all how you can fake a $10M camera move", {
  formatBorrowed: "Visual Hook → Concept → Tools → Footage",
  proof: proof({ handle: "lacapture", coverUrl: "/covers/c9.jpg", views: 154000, multiplier: 10.4, baselineLabel: "their average" }),
});

const sealAt = (stopPct: number) => ({ pct: 70, band: null, at: "2026-11-21T00:00:00Z", population: population(stopPct) });

/** The meal-prep pack fully simulated: 30, 22, 45 (pct is a decoy at 70 and must never show). */
export const SEALS_DONE: SimSealMap = {
  [HOOK_1]: sealAt(30),
  [HOOK_2]: sealAt(22),
  [HOOK_3]: sealAt(45),
};
