/**
 * Decode + Adapt contract types — the integration seam between the two parallel
 * remix worktrees (Phase 3 Decode + Phase 4 Adapt), reconciled at merge.
 *
 * Canonical decode payload = `DecodeResult` (what Phase 3 actually produces and
 * persists to `variants.remix.decode`). The Adapt frame consumes it via the
 * `decodeResultToAdaptInput` adapter in `adapt.ts` — it does NOT read raw beats.
 *
 * DecodeResult is the payload shape for variants.remix.decode (D-10).
 * overall_score stays null on decode rows — completion is signaled by
 * variants.remix != null, NOT by overall_score.
 *
 * Invariants:
 *   D-06: beats MUST be exactly 4, in fixed order: hook_pattern → structure_pacing → the_turn → emotional_beat
 *   D-02: absent beats carry an honest body line, never fabricated content
 *   D-04: luck array is always length >= 1 (backstop in runDecode)
 *   D-05: luck categories restricted to fixed taxonomy via Zod enum
 *   D-07: body lines are third-person, no advice verbs
 *   D-01: luck is NEVER mapped into AdaptInput.
 *         ⚠ PARTIALLY REVERSED (D2, owner 2026-08-10): Adapt no longer draws only from the
 *         repeatable lane — `AdaptInput.blueprint` carries the source's verbatim `spoken` text
 *         so the shoot sheet can be written beat-for-beat. See AdaptInput's docstring.
 */
import { z } from "zod";
import { emptyBlueprint } from "./blueprint";
import type { SourceBlueprint } from "./blueprint";

// =====================================================
// Beat IDs — fixed order, must match the model's required output
// =====================================================

export type BeatId = "hook_pattern" | "structure_pacing" | "the_turn" | "emotional_beat";

export const BEAT_IDS: BeatId[] = [
  "hook_pattern",
  "structure_pacing",
  "the_turn",
  "emotional_beat",
];

// =====================================================
// Luck category taxonomy — D-05: restricted to this fixed enum
// =====================================================

export type LuckCategory =
  | "timing_trend_moment"
  | "existing_audience_reach"
  | "algorithmic_outlier"
  | "topic_zeitgeist";

// =====================================================
// TypeScript interfaces
// =====================================================

export interface DecodeBeat {
  id: BeatId;
  /** 1-2 honest declarative lines, third-person, no advice verbs (D-06/D-07) */
  body: string;
  verdict: "present" | "weak" | "absent";
}

export interface DecodeResult {
  /** EXACTLY 4 beats in fixed order (D-06) */
  beats: DecodeBeat[];
  /** Structural moves the creator can repeat */
  repeatable: string[];
  /** length >= 1 ALWAYS — pure-TS backstop in runDecode ensures this (D-04) */
  luck: { category: LuckCategory; note: string }[];
}

/** Subset of OmniAnalysisOutput fields consumed by the decode engine */
export interface OmniStructuralInput {
  hook_decomposition: {
    visual_stop_power: number;
    audio_hook_quality: number;
    text_overlay_score: number;
    first_words_speech_score: number;
    weakest_modality: string;
    visual_audio_coherence: number;
    cognitive_load: number;
  };
  factors: Array<{
    name: string;
    score: number;
    rationale: string;
    improvement_tip?: string;
  }>;
  segments?: Array<{
    t_start: number;
    t_end: number;
    visual_event: string;
    audio_event: string;
    scene_boundary_reason?: string;
    is_hook_zone?: boolean;
  }>;
  video_signals: {
    visual_production_quality: number;
    pacing_score: number;
    transition_quality: number;
  };
  emotion_arc?: Array<{
    timestamp_ms: number;
    intensity_0_1: number;
    label?: "low" | "mid" | "high";
  }>;
  content_summary: string;
  overall_impression: string;
  content_type: string;
  niche_primary_slug: string;
}

// =====================================================
// Zod schemas — enforce D-06 (beats.length 4) + D-04 (luck.min 1) + D-05 (enum)
// =====================================================

export const DecodeBeatSchema = z.object({
  id: z.enum(["hook_pattern", "structure_pacing", "the_turn", "emotional_beat"]),
  body: z.string().min(1),
  verdict: z.enum(["present", "weak", "absent"]),
});

export const LuckCategoryEnum = z.enum([
  "timing_trend_moment",
  "existing_audience_reach",
  "algorithmic_outlier",
  "topic_zeitgeist",
]);

export const DecodeResultZodSchema = z.object({
  beats: z.array(DecodeBeatSchema).length(4),
  repeatable: z.array(z.string()).min(1),
  luck: z.array(
    z.object({
      category: LuckCategoryEnum,
      note: z.string().min(1),
    }),
  ).min(1),
});

export type DecodeResultZod = z.infer<typeof DecodeResultZodSchema>;

// =====================================================
// Adapt contract (Phase 4) — consumes DecodeResult via the adapt.ts adapter
// =====================================================

/**
 * A single structural item Adapt draws from, derived from Decode's `repeatable[]`
 * lane. `why_repeatable` may be empty when the source provides only a bare label.
 */
export interface RepeatableItem {
  /** Short structural label, e.g. "open-loop cold open". */
  label: string;
  /** Why this pattern is structurally reusable (may be empty). */
  why_repeatable: string;
}

/** One beat of the creator's own version, written against the source beat at the same index. */
export interface AdaptedBeat {
  /** Matches SourceBlueprint.beats[].index — the beat this line replaces. */
  index: number;
  /** What the creator says. On a no-speech source this stays empty and on_screen_text carries it. */
  spoken: string;
  /** Overlay text for this beat. */
  on_screen_text: string;
  /** How to shoot this beat — framing, camera position, movement. */
  shot: string;
  /** Present only when the source beat was flagged weak and this beat repairs it. */
  repair?: string;
}

/**
 * Input to the Adapt generator.
 *
 * Content-leak guard (D-01, Pitfall 1): AdaptInput has NO `luck` lane and NO caption/
 * content_summary field, so passing luck or a raw source caption to the adapt prompt is a
 * compile-time error. The `decodeResultToAdaptInput` adapter never maps luck in.
 *
 * ⚠ The rest of D-01 is REVERSED. It also used to guarantee, at compile time, that the source's
 * own WORDS could not reach the prompt — the four beat bodies are third-person prose ABOUT the
 * video, never quotes from it. `blueprint` breaks that: it carries verbatim `spoken` text,
 * because a shoot sheet written against a paraphrase of a beat is not a shoot sheet. The
 * replacement is mechanical, not structural — `sharedContentTokens` (echo-guard.ts) measures
 * topical echo between a source line and its adapted line after the fact.
 */
export interface AdaptInput {
  /** The viral hook pattern (from the `hook_pattern` beat body). */
  hook_pattern: string;
  /** Temporal structure of the video (from the `structure_pacing` beat body). */
  structure: string;
  /** The pivotal moment that changes the emotional trajectory (from the `the_turn` beat). */
  the_turn: string;
  /** The dominant emotional arc (from the `emotional_beat` beat body). */
  emotional_beat: string;
  /** Structural items that can be replicated in any niche (D-01). */
  repeatable: RepeatableItem[];
  /** The creator-profile niche slug/label (ADAPT-02). Fallback when `target` is null. */
  niche: string;
  /**
   * The source's timed structural skeleton (D2/D10, 2026-08-10). Adapt writes one line per beat.
   *
   * REQUIRED, not optional, and deliberately so: a caller that has a blueprint and forgets to
   * pass it would silently ship the old concept-only prompt with no test able to see it. The
   * three callers that genuinely have no video pass `emptyBlueprint()`, which is a statement,
   * not an omission.
   */
  blueprint: SourceBlueprint;
  /**
   * The creator's brief (D3). When non-empty this IS the adaptation target and `niche` is ignored;
   * null → fall back to `niche`. Exists so a fitness source can be remixed into SaaS onboarding.
   */
  target: string | null;
}

/**
 * The part of `AdaptInput` that crosses the wire to `POST /api/remix/adapt` — the decoded
 * anatomy only. `niche` travels as its own top-level field; `blueprint` and `target` are
 * SERVER-SUPPLIED and deliberately not accepted from a client: `blueprint` reaches the prompt
 * as verbatim text, so honouring a client-declared one would hand any caller a prompt-injection
 * lane past the D-01 guard the request schema exists to enforce (T-04-04).
 *
 * Named rather than written out at each consumer so the wire contract has one definition — the
 * hook's request type and the fixture that stands in for it cannot drift apart.
 */
export type AdaptWireDecode = Omit<AdaptInput, "niche" | "blueprint" | "target">;

/**
 * A single niche-adapted concept produced by the Adapt generator (ADAPT-01).
 *
 * UI mapping (D-09):
 * - `hook`            → bold headline (text-base font-semibold)
 * - `format_borrowed` → coral chip prefixed "Borrowed:" in the UI
 * - `angle`           → muted sub-row
 * - `who_its_for`     → muted sub-row
 */
export interface AdaptConcept {
  /** Bold actionable headline — the adapted hook in the creator's niche. */
  hook: string;
  /** The structural angle or narrative approach borrowed from the source. */
  angle: string;
  /** Who this concept is for in the creator's niche. */
  who_its_for: string;
  /** The format pattern borrowed from the source (chip text, e.g. "open-loop cold open"). */
  format_borrowed: string;
  /**
   * PROJECTION (new Qwen call system, 2026-07-22 — fan-out from hooks): the adapt call's OWN estimate
   * of how many of 10 target viewers would STOP on this adapted hook (0–10), self-emitted in place of
   * the removed persona-SIM. Drives the remix card's projected band/fraction. OPTIONAL so the old
   * `/api/remix/adapt` engine surface (which ignores it) and any pre-wiring response still validate;
   * the remix runner coerces a missing value to 0 (Weak). An ESTIMATE, never a measurement.
   */
  personaStops?: number;
  /**
   * PROJECTION: one first-person line of what a viewer who stops on the adapted hook thinks →
   * the remix card's lead scroll-quote. OPTIONAL (same back-compat reason as personaStops).
   */
  stopQuote?: string;
  /**
   * READY TO FILM (owner 2026-07-22): the shoot plan for YOUR adapted version — how to execute the
   * borrowed format for this angle. Mirrors the Script card's `production`. OPTIONAL → omitted when
   * the model returns none (back-compat; the remix card's "How to film" block simply doesn't render).
   */
  production?: {
    shots: string;
    onScreenText: string;
    setup: string;
    edit?: string;
  };
  /**
   * The beat-by-beat version of this concept (D2) — one entry per source blueprint beat, in
   * order. OPTIONAL for the same reason as `production`: a model that omits it must not fail the
   * 3-concept contract, and `/api/remix/adapt` never asks (it has no blueprint to ask against).
   */
  script?: AdaptedBeat[];
}

// =====================================================
// Reconciliation adapter — the single Decode↔Adapt seam
// =====================================================

/**
 * Bridge the canonical `DecodeResult` (what Phase 3 persists to
 * `variants.remix.decode`) into the `AdaptInput` the generator consumes.
 *
 * This is the one place the two parallel-worktree shapes meet:
 * - `beats[id].body` → flat structural fields (note: `structure_pacing` → `structure`)
 * - `repeatable: string[]` → `RepeatableItem[]` (bare structural labels; `why_repeatable`
 *   is empty because Decode emits only the move, not a rationale)
 * - `luck` is intentionally NEVER mapped in (D-01 content-leak guard — luck factors
 *   are distribution noise, not reusable format)
 */
export function decodeResultToAdaptInput(decode: DecodeResult, niche: string): AdaptInput {
  const beatBody = (id: BeatId): string =>
    decode.beats.find((b) => b.id === id)?.body ?? "";

  return {
    hook_pattern: beatBody("hook_pattern"),
    structure: beatBody("structure_pacing"),
    the_turn: beatBody("the_turn"),
    emotional_beat: beatBody("emotional_beat"),
    repeatable: decode.repeatable.map((label) => ({ label, why_repeatable: "" })),
    niche,
    // This seam starts from a STORED DecodeResult — there is no video in reach and no brief on
    // this path, so the prompt falls through to the concept-only shape it has always had.
    blueprint: emptyBlueprint(),
    target: null,
  };
}
