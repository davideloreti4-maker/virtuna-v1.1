/**
 * S1 — the walkthrough's frozen example analysis, and the SEAL that withholds beat 2.
 *
 * The analysis is REAL. It was run once through the production `/api/analyze` route
 * (`input_mode: "tiktok_url"`, engine 3.21.0) and frozen by
 * `scripts/freeze-walkthrough-fixture.mts`, which refuses to emit a degraded run. The template is
 * then assembled by the REAL adapters, exactly as `detail-live-fixture.ts` does, so the walkthrough
 * renders real product output rather than a marketing replica of it.
 *
 * Zero network after load: everything here is a module constant.
 *
 * SOURCE — `https://www.tiktok.com/@ahormozi/video/7665552990991895822` (Alex Hormozi, public, 29s).
 * A third-party video is analysed on a commercial page, so keep it analytical and imply no
 * endorsement. Swapping it is a data change: re-run the freeze script and rewrite the two insight
 * payloads below from the new run's real output.
 *
 * ⚠️ The two insight payloads are the engine's OWN words, lightly split into why/fix. Do not
 * "improve" them into copy — the moment they stop being the run's real output, the wall becomes
 * fabricated proof (`docs/ONBOARDING-FUNNEL-DESIGN.md` §4).
 */

import type { PopulationAggregate } from "@/lib/audience/population";
import { buildPopulationFrameData } from "@/lib/surfaces/ambient-v2-population";
import { buildVideoDomainTemplate } from "@/lib/surfaces/ambient-v2-brain";
import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";
import {
  FROZEN_ANALYSIS,
  FROZEN_COMPLETION_PCT,
  FROZEN_LOSS_DELTA_PCT,
  FROZEN_LOSS_MOMENT,
  FROZEN_MONOTONIC_DECLINE,
  FROZEN_SOURCE_ID,
} from "./frozen-analysis";

/**
 * The honesty gate (design §4). Now FALSE: the data below is a real, non-degraded run, verified by
 * the freeze script's refusal checks. Flip back to true if the fixture is ever replaced by
 * hand-authored numbers — `/go` will stop mounting the walkthrough in production.
 */
export const WALKTHROUGH_IS_PLACEHOLDER = false;

/** Carried on every funnel event so a video swap stays measurable (design §6.1). */
export const WALKTHROUGH_STIMULUS_KEY = `demo-${FROZEN_SOURCE_ID}`;

export { FROZEN_LOSS_DELTA_PCT, FROZEN_MONOTONIC_DECLINE, FROZEN_COMPLETION_PCT };

// ── the modeled audience ──────────────────────────────────────────────────────────────────────
// The population projection is what the $1 unlocks, so it is sealed away before render. It is
// modeled at the General baseline — this demo has no calibrated room, and claiming one would be
// the exact fabrication the design bans.
const DEMO_POP: PopulationAggregate = {
  total: 1000,
  stop: Math.round(FROZEN_COMPLETION_PCT * 10),
  scroll: 1000 - Math.round(FROZEN_COMPLETION_PCT * 10),
  stopPct: FROZEN_COMPLETION_PCT,
  segments: [
    { archetype: "builder", displayName: "builders", share: 0.27, total: 270, stop: 208, stopPct: 77 },
    { archetype: "scroller", displayName: "scrollers", share: 0.41, total: 410, stop: 250, stopPct: 61 },
    { archetype: "skeptic", displayName: "skeptics", share: 0.2, total: 200, stop: 94, stopPct: 47 },
    { archetype: "drop-in", displayName: "drop-ins", share: 0.12, total: 120, stop: 71, stopPct: 59 },
  ],
  reasons: [
    { reason: "The same point lands three times", count: 241 },
    { reason: "The free-vs-paid rule is genuinely useful", count: 198 },
    { reason: "Took too long to name the subject", count: 132 },
  ],
};

const DEMO_PERSONAS = [
  { archetype: "builder", verdict: "stop" as const, quote: "the litmus test is the whole video, and it's good" },
  { archetype: "scroller", verdict: "scroll" as const, quote: "he made the point, then made it again" },
  { archetype: "skeptic", verdict: "scroll" as const, quote: "took a beat too long to say what this was about" },
  { archetype: "builder", verdict: "stop" as const, quote: "free if it scales — i can actually use that" },
];

/** The COMPLETE analysis — everything revealed. Every other state is derived from this by the seal. */
export const WALKTHROUGH_TEMPLATE: DomainTemplate = buildVideoDomainTemplate({
  ...FROZEN_ANALYSIS,
  reasons: [
    { reason: "too-slow", count: 241 },
    { reason: "interest", count: 198 },
    { reason: "weak-hook", count: 132 },
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
 * The CRAFT score, shown at every beat including behind the wall — it is a property of the video
 * itself, not of anyone's audience, so showing it costs nothing and it is what makes the mechanism
 * legible before payment. Derived from the four measured craft dims so it cannot drift from them.
 */
const CRAFT_DIMS = FROZEN_ANALYSIS.videoSignals!;
export const CRAFT_SCORE = Math.round(
  ((CRAFT_DIMS.hook_visual_impact +
    CRAFT_DIMS.visual_production_quality +
    CRAFT_DIMS.pacing_score +
    CRAFT_DIMS.transition_quality) /
    4) *
    10,
);

/** Where attention falls fastest. SHOWN — a timestamp on a real video is a demonstration. */
export const LOSS_MOMENT = FROZEN_LOSS_MOMENT;

/**
 * Beat 1 — GIVEN AWAY IN FULL. The sample that proves the mechanism: without it the visitor is
 * asked to pay for an answer whose quality they have no evidence of.
 * Verbatim from the run's `suggestions[0]` (hook_structure, priority high) and `suggestions[2]`.
 */
export const REVEALED_INSIGHT = {
  moment: "0:00",
  where: "the hook — strong delivery, late subject",
  why: "The hook opens with a conditional (“Anything that scales”) before the subject is clear.",
  fix: "Front-load the contrast frame so the viewer knows what's being compared in the first half-second, not after the clause resolves. The on-screen line “What you give away for free vs what you charge for” is the strongest line in the video — make it the spoken hook too, so audio and text align from frame one.",
} as const;

/**
 * Beat 2 — GENUINELY WITHHELD. The seal removes it from the rendered template, so the locked panel
 * is an absence, never a blur over placeholder text (design §4, the honesty floor).
 * Verbatim from the run's `suggestions[1]` (retention_pacing), anchored on the measured steepest drop.
 *
 * ⚠️ Zero network means this ships in the client bundle — a determined visitor can read it in
 * devtools. Accepted: the promise is that what unlocks IS what was hidden, not that it is secret.
 * It is one public video's analysis, not user data. Do NOT "solve" this by putting fake text here.
 */
export const SEALED_INSIGHT = {
  moment: FROZEN_LOSS_MOMENT,
  where: `the steepest drop — ${FROZEN_LOSS_DELTA_PCT} points of attention in one segment`,
  why: "The body repeats the same point three times (“if it doesn't scale, you gotta pay” / “if it scales, it's free” / “price tag is a good litmus test”).",
  fix: "Tighten to one clean pass with a concrete example to add specificity and cut dead air between loops.",
} as const;

// ── the seal ──────────────────────────────────────────────────────────────────────────────────

/** Which parts of the analysis the current beat is allowed to render. */
export type SealState = "sealed" | "open";

/**
 * Derive the template the walkthrough actually renders.
 *
 * `sealed` strips the three things the $1 buys — and strips them from the DATA, so the real
 * `AmbientDetail` renders its honest unavailable states rather than a fake overlay:
 *   • `unlock`              the director's fix
 *   • `brain.whyThisSecond` the diagnosis — the WHY
 *   • `population`          the audience-specific score and the gap
 *
 * Everything in the SHOWN column survives: the filmstrip, the measured curve (so the drop is still
 * visibly where we say it is), and the craft signals.
 */
export function sealTemplate(template: DomainTemplate, state: SealState): DomainTemplate {
  if (state === "open") return template;

  const { unlock: _fix, brain, population: _audience, ...rest } = template;
  void _fix;
  void _audience;

  return {
    ...rest,
    // The verdict chip is the AUDIENCE number — that is the sealed one. Behind the wall the hero
    // carries the craft score instead, which we are allowed to show, so the figure never reads as
    // an empty state.
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
