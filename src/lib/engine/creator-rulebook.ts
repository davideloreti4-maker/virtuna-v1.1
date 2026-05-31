/**
 * Creator Rulebook — deterministic, display-layer scorecard.
 *
 * Turns the creator intelligence (see `creator-rules.ts` / the research doc
 * `.planning/research/creator-intelligence.md`) from prompt *advice* into a set of
 * concrete, ATTRIBUTED pass/warn/fail checks computed deterministically from signals
 * the engine ALREADY extracts on a `PredictionResult`. No LLM call, no I/O — same
 * input always yields the same Rulebook.
 *
 * SCOPE (v1): only the rules computable from existing signals (hook_decomposition,
 * video_signals, cta_segment, audio_signals, the 5 Omni factors, duration). Rules that
 * need NEW vision extraction (objects-in-frame, exact hook-seconds, reading-level grade,
 * face-vs-object, But/Therefore structure) are deliberately OUT until a Wave-0 Omni pass
 * emits them — they would be guesses today.
 *
 * HONESTY CONTRACT: this is a DISPLAY + advice artifact. It is NOT wired into
 * `overall_score`. Per `.planning/AUDIT-engine-pipeline.md` (F1/F3), the 0–100 score is
 * unvalidated against real outcomes; adding an unmeasured creator-rule weight would make
 * that worse. The Rulebook gives the user concrete, fixable, sourced feedback WITHOUT
 * touching the number. The learning loop (`src/lib/engine/learning/`) is the only path
 * that may later earn these checks real score-weight, per-niche, against real views.
 *
 * Every check reads defensively: a signal absent on text / tiktok_url fallback paths
 * yields status "unknown" (excluded from coverage), never a fabricated pass/fail.
 */
import type {
  CtaSegmentResult,
  Factor,
  GeminiAudioSignals,
  GeminiVideoSignals,
  HookDecomposition,
  PredictionResult,
} from "./types";

export type RuleStatus = "pass" | "warn" | "fail" | "unknown";
export type Creator = "Hoyos" | "Ava" | "Hormozi";

export interface RulebookCheck {
  /** Stable id (snake_case) — safe as a React key / analytics dimension. */
  id: string;
  /** Human-readable rule label (the named framework or numeric rule). */
  rule: string;
  /** Which creator the rule is attributed to. */
  creator: Creator;
  status: RuleStatus;
  /** Measured value as a display string ("4.8/10", "2/3", "31s", "present"); null when unknown. */
  actual: string | null;
  /** The target the rule asks for ("≥7/10", "3/3", "~34s · ≤60s"). */
  target: string;
  /** Row number in CREATOR_RULES_NUMERIC when the check maps to one (for citation). */
  numericRule?: number;
  /** One-line, rule-grounded note shown under the check. */
  note: string;
}

export interface CreatorRulebook {
  checks: RulebookCheck[];
  passCount: number;
  warnCount: number;
  failCount: number;
  /** Checks with a determinate status (status !== "unknown"). */
  knownCount: number;
  /** Percentage of the rulebook computable on this input (knownCount / total). */
  coveragePct: number;
}

// Thresholds — single place to tune. Documented against the source rules.
const HOOK_STRONG = 7; // visual_stop_power "strong hook" floor
const HOOK_WEAK = 4; // below this = fail
const STACK_PRESENT = 4; // a hook modality counts as "present" at ≥4/10
const TEXT_OK = 6; // burned-in text overlay strength floor
const TEXT_WEAK = 3;
const LOAD_LOW = 4; // cognitive_load (INVERTED: lower = better) — "low load" ceiling
const LOAD_HIGH = 6; // above this = fail
const PACING_OK = 7;
const PACING_WEAK = 4;
const AUDIO_HOOK_OK = 6;
const AUDIO_HOOK_WEAK = 3;
const FACTOR_OK = 7; // 0–10 Omni factor "good" floor
const FACTOR_WEAK = 4;

/** Higher value is better. */
function band(value: number | null | undefined, passMin: number, warnMin: number): RuleStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "unknown";
  if (value >= passMin) return "pass";
  if (value >= warnMin) return "warn";
  return "fail";
}

/** Lower value is better (e.g. cognitive_load — polarity inverted per gemini/schemas.ts). */
function bandInverted(
  value: number | null | undefined,
  passMax: number,
  warnMax: number,
): RuleStatus {
  if (value === null || value === undefined || Number.isNaN(value)) return "unknown";
  if (value <= passMax) return "pass";
  if (value <= warnMax) return "warn";
  return "fail";
}

function score10(value: number | null | undefined): string | null {
  return value === null || value === undefined || Number.isNaN(value)
    ? null
    : `${Math.round(value * 10) / 10}/10`;
}

function factorScore(factors: Factor[] | undefined, name: string): number | null {
  const f = factors?.find((x) => x.name === name);
  return f ? f.score : null;
}

/** Length fit — Hoyos ~34s ideal (#5), sub-30s needs ~100% retention (#6), Ava ≤60s cap (#37). */
function deriveLengthFit(dur: number | null): { status: RuleStatus; actual: string | null; note: string } {
  if (dur === null || Number.isNaN(dur)) {
    return { status: "unknown", actual: null, note: "Duration unavailable on this input." };
  }
  const actual = `${Math.round(dur)}s`;
  if (dur > 90) {
    return { status: "fail", actual, note: "Far over Ava's ≤60s cap — re-cut to a single arc." };
  }
  if (dur > 60) {
    return { status: "warn", actual, note: "Over Ava's ≤60s cap; tighten toward Hoyos' ~34s." };
  }
  if (dur >= 30) {
    return { status: "pass", actual, note: "In Hoyos' ~34s sweet spot." };
  }
  if (dur >= 10) {
    return { status: "warn", actual, note: "Sub-30s needs ~100% retention (Hoyos #6)." };
  }
  return { status: "warn", actual, note: "Very short — hard to land a full hook→payoff arc." };
}

/** Three-Hook Stack — Ava #2: see (visual) + read (text) + hear (audio) in the first 3s. */
function deriveThreeHookStack(
  hook: HookDecomposition | null | undefined,
): { status: RuleStatus; actual: string | null } {
  if (!hook) return { status: "unknown", actual: null };
  const present = [
    hook.visual_stop_power >= STACK_PRESENT,
    hook.text_overlay_score >= STACK_PRESENT,
    hook.audio_hook_quality >= STACK_PRESENT,
  ].filter(Boolean).length;
  const status: RuleStatus = present === 3 ? "pass" : present === 2 ? "warn" : "fail";
  return { status, actual: `${present}/3` };
}

/** Cross-platform watermark anti-pattern — a reposted TikTok/IG/YT watermark suppresses reach. */
function deriveWatermark(
  hook: HookDecomposition | null | undefined,
): { status: RuleStatus; actual: string | null } {
  const wm = hook?.watermark_detected;
  if (!wm) return { status: "unknown", actual: null };
  const marked = [wm.tiktok && "TikTok", wm.ig && "IG", wm.yt && "YT"].filter(Boolean) as string[];
  return marked.length
    ? { status: "fail", actual: marked.join(" + ") }
    : { status: "pass", actual: "none" };
}

/**
 * Derive the deterministic Creator Rulebook from an engine PredictionResult.
 * Pure — no I/O, no model calls. Absent signals → "unknown" (not a fabricated verdict).
 */
export function deriveCreatorRulebook(result: PredictionResult): CreatorRulebook {
  const hook: HookDecomposition | null | undefined = result.hook_decomposition;
  const vs: GeminiVideoSignals | null | undefined = result.video_signals;
  const cta: CtaSegmentResult | null | undefined = result.cta_segment;
  const audio: GeminiAudioSignals | null | undefined = result.audio_signals;
  const dur = result.feature_vector?.durationSeconds ?? null;

  const length = deriveLengthFit(dur);
  const stack = deriveThreeHookStack(hook);
  const watermark = deriveWatermark(hook);

  const ctaPresent = cta?.cta_present;
  const ctaStatus: RuleStatus =
    ctaPresent === undefined || ctaPresent === null ? "unknown" : ctaPresent ? "pass" : "warn";

  const checks: RulebookCheck[] = [
    {
      id: "hook_strength",
      rule: "The Hook Decides Everything",
      creator: "Hoyos",
      status: band(hook?.visual_stop_power, HOOK_STRONG, HOOK_WEAK),
      actual: score10(hook?.visual_stop_power),
      target: "≥7/10",
      numericRule: 16,
      note: "First 2–3s decides ~80% of performance — keep critique weight here.",
    },
    {
      id: "three_hook_stack",
      rule: "Three-Hook Stack (see + read + hear)",
      creator: "Ava",
      status: stack.status,
      actual: stack.actual,
      target: "3/3",
      numericRule: 2,
      note: "Stack a visual, a text, and an audio hook inside the first 3 seconds.",
    },
    {
      id: "audio_off_text",
      rule: "Burned-in text for audio-off viewers",
      creator: "Hormozi",
      status: band(hook?.text_overlay_score, TEXT_OK, TEXT_WEAK),
      actual: score10(hook?.text_overlay_score),
      target: "readable on mute",
      numericRule: 19,
      note: "~50% watch muted — on-screen text is mandatory, not optional.",
    },
    {
      id: "length_fit",
      rule: "Optimal Short length",
      creator: "Hoyos",
      status: length.status,
      actual: length.actual,
      target: "~34s · ≤60s",
      numericRule: 5,
      note: length.note,
    },
    {
      id: "cta_architecture",
      rule: "CTA / Conversion Architecture Built In",
      creator: "Hormozi",
      status: ctaStatus,
      actual: ctaPresent === undefined || ctaPresent === null ? null : ctaPresent ? "present" : "absent",
      target: "present",
      note: "The ending emotion / ask decides the viewer's verdict — build it in.",
    },
    {
      id: "clean_repost",
      rule: "No cross-platform watermark",
      creator: "Ava",
      status: watermark.status,
      actual: watermark.actual,
      target: "none",
      note: "A reposted-platform watermark suppresses native algorithmic reach.",
    },
    {
      id: "pacing",
      rule: "Clean cuts / pace breaks",
      creator: "Hormozi",
      status: band(vs?.pacing_score, PACING_OK, PACING_WEAK),
      actual: score10(vs?.pacing_score),
      target: "≥7/10",
      numericRule: 20,
      note: "Clean cut every 3–4s; cut filler and dead time before the hook lands.",
    },
    {
      id: "cognitive_load",
      rule: "Low cognitive load (reading-level proxy)",
      creator: "Ava",
      status: bandInverted(hook?.cognitive_load, LOAD_LOW, LOAD_HIGH),
      actual: score10(hook?.cognitive_load),
      target: "≤4/10 load",
      numericRule: 3,
      note: "Proxy for the 5th-grade rule — lower load reads faster. (Polarity inverted.)",
    },
    {
      id: "audio_hook_2s",
      rule: "Audio hook in the first 2s",
      creator: "Hormozi",
      status: band(audio?.audio_hook_first_2s_0_10, AUDIO_HOOK_OK, AUDIO_HOOK_WEAK),
      actual: score10(audio?.audio_hook_first_2s_0_10),
      target: "≥6/10",
      numericRule: 18,
      note: "The attention window is the first 2 seconds — the audio must earn it.",
    },
    {
      id: "share_trigger",
      rule: "Shareability trigger",
      creator: "Hoyos",
      status: band(factorScore(result.factors, "Share Trigger"), FACTOR_OK, FACTOR_WEAK),
      actual: score10(factorScore(result.factors, "Share Trigger")),
      target: "≥7/10",
      numericRule: 35,
      note: "Shareability (not just retention) drives true viral growth.",
    },
    {
      id: "emotional_charge",
      rule: "Emotional charge",
      creator: "Hoyos",
      status: band(factorScore(result.factors, "Emotional Charge"), FACTOR_OK, FACTOR_WEAK),
      actual: score10(factorScore(result.factors, "Emotional Charge")),
      target: "≥7/10",
      note: "A clear emotional payoff is what gets a video shared and rewatched.",
    },
  ];

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let knownCount = 0;
  for (const c of checks) {
    if (c.status === "pass") passCount++;
    else if (c.status === "warn") warnCount++;
    else if (c.status === "fail") failCount++;
    if (c.status !== "unknown") knownCount++;
  }

  return {
    checks,
    passCount,
    warnCount,
    failCount,
    knownCount,
    coveragePct: checks.length === 0 ? 0 : Math.round((knownCount / checks.length) * 100),
  };
}
