/**
 * Decode→Adapt contract types — Phase 4 canonical source.
 *
 * IMPORTANT (D-03): Phase 3 (Decode worktree) MUST import `DecodeOutput` from this
 * file and MUST NOT redefine its own decode-output shape. This is the single source
 * of truth for the integration seam between the parallel worktrees.
 *
 * No runtime imports. Pure type file — no Zod, no validators here.
 * Zod validation of DecodeOutput when Phase 3 produces it lives in
 * engine/remix/decode.ts (Phase 3), not here.
 */

/** A single item from either the repeatable[] or luck[] lane produced by Decode. */
export interface RepeatableItem {
  /** Short structural label, e.g. "open-loop cold open". */
  label: string;
  /** Why this pattern is structurally reusable / luck-dependent. */
  why_repeatable: string;
}

/**
 * Full output produced by the Decode phase (Phase 3).
 *
 * The `repeatable[]` lane is the ONLY lane Adapt draws from (D-01).
 * The `luck[]` lane is present for the Decode frame only and is EXCLUDED from
 * the adapt input — making content-copying from luck factors structurally impossible.
 */
export interface DecodeOutput {
  /** The viral hook pattern used (structural, format language). */
  hook_pattern: string;
  /** Temporal structure of the video (e.g. Hook → Tension → Reveal → CTA). */
  structure: string;
  /** The pivotal moment that changes the emotional trajectory. */
  the_turn: string;
  /** The dominant emotional arc (e.g. Curiosity → frustration → relief). */
  emotional_beat: string;
  /** Structural items that can be replicated in any niche — Adapt draws ONLY from this lane (D-01). */
  repeatable: RepeatableItem[];
  /**
   * Distribution/timing factors present for the Decode frame only.
   * EXCLUDED from AdaptInput — luck factors are NOT format patterns.
   */
  luck: RepeatableItem[];
}

/**
 * Input to the Adapt generator.
 *
 * Structural content-leak guard (D-01, Pitfall 1):
 * AdaptInput is a Pick<DecodeOutput, ...> that deliberately omits `luck` and any
 * caption/content_summary field. Passing `luck[]` or a raw source caption to the
 * adapt prompt is therefore a compile-time error.
 *
 * Plus `niche` — the creator-profile niche slug/label (ADAPT-02).
 */
export type AdaptInput = Pick<
  DecodeOutput,
  'hook_pattern' | 'structure' | 'the_turn' | 'emotional_beat' | 'repeatable'
> & { niche: string };

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
}
