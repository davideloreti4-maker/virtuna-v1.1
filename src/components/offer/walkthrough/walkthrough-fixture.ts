/**
 * S1 — the walkthrough's frozen example analysis, and the SEAL that withholds beat 2.
 *
 * Built by the REAL adapters (`buildVideoDomainTemplate` + `buildPopulationFrameData`), exactly as
 * `detail-live-fixture.ts` does, so the walkthrough renders real product output rather than a
 * marketing replica of it. Zero network: everything here is a module constant.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 THE NUMBERS BELOW ARE PLACEHOLDERS AND MUST NOT SHIP.
 *
 * `ONBOARDING-FUNNEL-DESIGN.md` §4 sets an honesty floor: the demo's analysis has to be REAL —
 * run once through the real pipeline and frozen. Invented numbers on a commercial page are
 * fabricated proof, the same rule that bans invented testimonials.
 *
 * `WALKTHROUGH_IS_PLACEHOLDER` is therefore a real gate, not a comment: while it is true, `/go`
 * refuses to mount the walkthrough in production (see `walkthrough.tsx`). To ship:
 *   1. run the owner's demo video through the REAL `/api/analyze` (`input_mode: "tiktok_url"`,
 *      `route.ts:482`, costs 10 credits) so the frozen data comes from the production code path;
 *   2. paste the persisted analysis into `DEMO_INPUT` below;
 *   3. extract the keyframe stills to `/public` and fill `keyframe_uri`;
 *   4. flip this flag to false.
 * The shape is already right, so that is a data change, not a rewrite.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import { buildPopulationFrameData } from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate, type BrainSnapshotInput } from "@/lib/surfaces/ambient-v2-brain";
import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";

/** 🔴 Blocks the walkthrough from mounting in production. Flip only when the data is a real run. */
export const WALKTHROUGH_IS_PLACEHOLDER = true;

/** Which example the visitor saw — carried on every funnel event so a swap stays measurable (§6.1). */
export const WALKTHROUGH_STIMULUS_KEY = "demo-v1-placeholder";

// ── the frozen analysis ───────────────────────────────────────────────────────────────────────
// A 12s clip in 6 segments. The curve carries TWO dips, and which one we reveal is the whole
// design: idx 4 (0:08) is the shallower sag we give away in full, idx 2 (0:04) is the deep one
// we withhold. Two dips is not decoration — a wall with only one insight behind it has nothing
// to prove itself with.
const DEMO_INPUT: BrainSnapshotInput = {
  stopPct: 38,
  stimulusKey: WALKTHROUGH_STIMULUS_KEY,
  conceptLabel: "hook",
  heatmap: {
    segments: [
      { idx: 0, t_start: 0, t_end: 2, label: "cold open", is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 2, t_end: 4, label: "the claim", is_hook_zone: true, keyframe_uri: null },
      { idx: 2, t_start: 4, t_end: 6, label: "the stall", is_hook_zone: false, keyframe_uri: null },
      { idx: 3, t_start: 6, t_end: 8, label: "the turn", is_hook_zone: false, keyframe_uri: null },
      { idx: 4, t_start: 8, t_end: 10, label: "the proof", is_hook_zone: false, keyframe_uri: null },
      { idx: 5, t_start: 10, t_end: 12, label: "the close", is_hook_zone: false, keyframe_uri: null },
    ],
    personas: [],
    weighted_curve: [0.86, 0.91, 0.34, 0.58, 0.44, 0.4],
    weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    weights_source: "default",
    weighted_completion_pct: 0.58,
  },
  videoSignals: {
    hook_visual_impact: 8.4,
    visual_production_quality: 6.9,
    pacing_score: 4.2,
    transition_quality: 3.5,
  },
  verbatim: {
    hook: { spoken_words: "I quit my 9-5 with $400", on_screen_text: null },
    segments: [
      { idx: 0, spoken_text: "I quit my nine to five", on_screen_text: null },
      { idx: 1, spoken_text: "with four hundred dollars in my account", on_screen_text: null },
      { idx: 2, spoken_text: "and I want to be honest with you", on_screen_text: null },
      { idx: 3, spoken_text: "here is exactly what month one looked like", on_screen_text: null },
      { idx: 4, spoken_text: "the numbers surprised even me", on_screen_text: null },
      { idx: 5, spoken_text: "so here is what I would do differently", on_screen_text: null },
    ],
  },
};

const DEMO_POP: PopulationAggregate = {
  total: 1000,
  stop: 380,
  scroll: 620,
  stopPct: 38,
  segments: [
    { archetype: "builder", displayName: "builders", share: 0.27, total: 270, stop: 221, stopPct: 82 },
    { archetype: "scroller", displayName: "scrollers", share: 0.41, total: 410, stop: 209, stopPct: 51 },
    { archetype: "skeptic", displayName: "skeptics", share: 0.2, total: 200, stop: 24, stopPct: 12 },
    { archetype: "drop-in", displayName: "drop-ins", share: 0.12, total: 120, stop: 48, stopPct: 40 },
  ],
  reasons: [
    { reason: "The payoff comes too late", count: 253 },
    { reason: "The $400 stake feels real", count: 190 },
    { reason: "Heard this story before", count: 121 },
  ],
};

const DEMO_PERSONAS = [
  { archetype: "skeptic", verdict: "scroll" as const, quote: "i'd be gone before the point lands" },
  { archetype: "builder", verdict: "stop" as const, quote: "the $400 detail made me stay" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "felt slow right after the opener" },
  { archetype: "builder", verdict: "stop" as const, quote: "the honesty hooked me, i wanted the numbers" },
];

/** The COMPLETE analysis — everything revealed. The seal derives every other state from this. */
export const WALKTHROUGH_TEMPLATE: DomainTemplate = buildVideoDomainTemplate({
  ...DEMO_INPUT,
  reasons: [
    { reason: "too-slow", count: 253 },
    { reason: "strong-hook", count: 190 },
    { reason: "interest", count: 121 },
  ],
  population: buildPopulationFrameData({
    aggregate: DEMO_POP,
    personas: DEMO_PERSONAS,
    calibratedFrom: "1,000 modeled viewers",
    tier: "max",
  }),
});

// ── what the visitor is allowed to see ────────────────────────────────────────────────────────

/**
 * The CRAFT score — shown at every beat, including behind the wall. It is a property of the video
 * itself (framing, pacing, transitions), not of anyone's audience, so showing it costs us nothing
 * and it is what makes the mechanism legible before payment (design §4, the SHOWN column).
 */
export const CRAFT_SCORE = 77;

/** Where they leave. SHOWN — a specific timestamp on a real video is a demonstration, not a claim. */
export const LOSS_MOMENT = "0:04";

/**
 * The beat-1 insight, given away IN FULL. This is the sample that proves the mechanism: without it
 * the visitor is asked to pay for an answer whose quality they have no evidence of.
 * Derived from the same measured curve as beat 2 — a shallower dip, completely explained.
 */
export const REVEALED_INSIGHT = {
  moment: "0:08",
  where: "attention sags through the proof section",
  why: "The numbers arrive as narration over the same framing that carried the last four seconds. Nothing on screen changes when the most interesting claim lands, so the viewer reads it as more of the same.",
  fix: "Cut to the number on screen the moment you say it. A hard visual change on the payoff line is what tells a scroller the video just moved.",
} as const;

/**
 * The beat-2 payload — GENUINELY WITHHELD. The seal removes it from the rendered template, so the
 * locked panel is an absence, never a blur over placeholder text (design §4, the honesty floor).
 *
 * ⚠️ Zero network means this necessarily ships in the client bundle — a determined visitor can read
 * it in devtools. That is an accepted trade: the guarantee we are making is that what unlocks IS
 * what was hidden, not that it is cryptographically secret. It is one public video's analysis, not
 * user data. Do not "solve" this by putting fake text here — that breaks the actual promise.
 */
export const SEALED_INSIGHT = {
  moment: LOSS_MOMENT,
  where: "the deepest drop in the video",
  why: "The hook writes a cheque the next line doesn't cash. “I quit my 9-5 with $400” sets up a story about how; the following beat is a preamble about honesty instead. Attention was bought with a specific number and then spent on a throat-clear.",
  fix: "Delete the honesty preamble and put the month-one number at 0:04. The viewer who stopped for “$400” is asking one question, and every second they wait for it is a second they can leave.",
} as const;

// ── the seal ──────────────────────────────────────────────────────────────────────────────────

/** Which parts of the analysis the current beat is allowed to render. */
export type SealState = "sealed" | "open";

/**
 * Derive the template the walkthrough actually renders.
 *
 * `sealed` strips the three things the $1 buys — and strips them from the DATA, so the real
 * `AmbientDetail` renders its honest unavailable states rather than a fake overlay:
 *   • `unlock`             the director's fix
 *   • `brain.whyThisSecond` the diagnosis — the WHY
 *   • `population`          the audience-specific score and the gap
 *
 * Everything in the SHOWN column survives: the filmstrip, the measured curve (so "0:04" is still
 * visibly the deepest point), and the craft signals.
 */
export function sealTemplate(template: DomainTemplate, state: SealState): DomainTemplate {
  if (state === "open") return template;

  const { unlock: _fix, brain, population: _audience, ...rest } = template;
  void _fix;
  void _audience;

  return {
    ...rest,
    // The verdict chip is the AUDIENCE number ("38% would stop") — that is the sealed one. Behind
    // the wall the hero carries the craft score instead, which we are allowed to show, so the
    // figure never reads as an empty state.
    verdict: { value: String(CRAFT_SCORE), label: "craft score" },
    brain: brain
      ? (() => {
          const { whyThisSecond: _why, ...brainRest } = brain;
          void _why;
          return brainRest;
        })()
      : undefined,
    population: null,
  };
}

/** True when nothing the $1 buys is present. The test asserts the seal on the RENDERED object. */
export function isSealed(template: DomainTemplate): boolean {
  return (
    template.unlock === undefined &&
    template.brain?.whyThisSecond === undefined &&
    template.population === null
  );
}
