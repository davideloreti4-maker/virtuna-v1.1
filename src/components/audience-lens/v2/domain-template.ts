/**
 * DomainTemplate — the platform contract for the Ambient Audience v2 Detail instrument.
 *
 * The resolution to "different stuff inside per domain" (2026-07-21 config/rank model, DOMAIN
 * section + `.scratch/domain-scaffold.html`): the two ROLES are invariant — the Brain answers *why*,
 * the Population answers *who / how many* — and they ARE the locked cascade. What swaps between
 * domains is which FIGURE fills each slot. A new domain is ONE DomainTemplate object (its verdict
 * label + the figures for the swap slots); it inherits every shared slot — cortex · terrain · voices
 * + cast · trust footer · the ask-why chat — untouched. Adding a domain authors a template; it never
 * forks the page. (Same discipline as skills: add-a-skill = one meta entry.)
 *
 * Slots (● shared across every domain · ◇ swap, template-supplied):
 *   Brain:      ● cortex · ◇ driver axis ("why this ___") · ◇ signals · ◇ networks (optional) ·
 *               ● ask-why chat
 *   Population: ◇ headline + main figure · ● terrain · ◇ segments · ● voices + cast
 *
 * Scope note (2026-07-21): only the CREATOR figures are authored (attention-scrubber · tri-state).
 * The unions below NAME the seam; pricing / A-B / survey figures slot in later as new `kind`s + a
 * template — no change to the frames beyond a new case. Generalization is bounded by CALIBRATION
 * (the honest limit): the engine runs any lens, but a domain is only trustworthy when the population
 * is calibrated for that decision.
 */

import type {
  AttentionData,
  CodedReason,
  NetworkRow,
  SegmentStop,
  SignalRow,
  TerrainCluster,
  TriState,
} from "./AmbientDetail";

// ── Brain swap figures ────────────────────────────────────────────────────────

/** The "why this ___" driver-axis figure (◇ swap). Creator = attention over the clip. */
export type BrainDriver = { kind: "attention-scrubber"; data: AttentionData };
// future: | { kind: "resistance-curve"; data: ResistanceCurve }  // pricing — "why this price"

/** The shared ask-why chat slot (●). Deferred in v2 — rendered as a disabled affordance until chat
 *  infra lands, so the slot exists in the scaffold without pretending to be live. */
export interface AskWhySlot {
  enabled: boolean;
  placeholder: string; // "Ask why they reacted this way…"
}

export interface BrainFrameData {
  cortexSeedKey: string; // drifts the cortex parcellation; stable per stimulus
  clipSeconds: number; // cortex replay-loop duration (s)
  stopRatio: number; // 0..1 — drives the cortex bold, from the verdict
  driver: BrainDriver; // ◇ swap — the driver axis
  signals: SignalRow[]; // ◇ swap — the decomposition
  networks?: NetworkRow[]; // ◇ optional creator figure (z-scored σ at the playhead)
  askWhy?: AskWhySlot; // ● shared (deferred stub)
}

// ── Population swap figures ────────────────────────────────────────────────────

/** The main figure (◇ swap) — the distribution the headline summarizes. Creator = the stop/skim/
 *  scroll tri-state, headlined by the percentile line. */
export type PopulationMain = { kind: "tri-state"; data: TriState; percentileLine: string };
// future: | { kind: "demand-curve" } | { kind: "overlay" } | { kind: "answer-distribution" }

export interface PopulationFrameData {
  main: PopulationMain; // ◇ headline + main figure
  terrain: { clusters: TerrainCluster[]; lossClusterIndex: number }; // ● shared — the society
  segments: { title: string; rows: SegmentStop[] }; // ◇ swap — the tiers that matter here
  voices: { kicker: string; reasons: CodedReason[] }; // ● shared — coded reasons + exemplar cast
}

// ── the bundle ─────────────────────────────────────────────────────────────────

export interface DomainTemplate {
  id: string; // "creator"
  label: string; // "Creator · content"
  backLabel: string; // "All 5"
  pager: string; // "hook 2 of 5"
  verdict: { pct: number; label: string }; // 38.2 · "would stop"
  brain: BrainFrameData;
  population: PopulationFrameData | null; // null until a run exists
}
