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

/** A price → resistance curve (pricing "why this price"): resistance rises with price, spiking at the
 *  point where the audience balks. Coral marks the spike (the loss). */
export interface ResistanceCurveData {
  question: string; // "Where resistance spikes"
  points: number[]; // 0..100 resistance across the price axis (rising)
  spikeAt: number; // 0..1 x-position of the resistance spike
  spikeLabel: string; // "$29 · resistance spikes"
}

/** The "why this ___" driver-axis figure (◇ swap). Creator = attention over the clip; pricing =
 *  resistance over price. A new domain adds a `kind` here + a figure in BrainTab's BrainDriverSlot. */
export type BrainDriver =
  | { kind: "attention-scrubber"; data: AttentionData }
  | { kind: "resistance-curve"; data: ResistanceCurveData };

/** The shared ask-why chat slot (●). Deferred in v2 — rendered as a disabled affordance until chat
 *  infra lands, so the slot exists in the scaffold without pretending to be live. */
export interface AskWhySlot {
  enabled: boolean;
  placeholder: string; // "Ask why they reacted this way…"
}

/** P2 — the "why this second" synthesis: the plain-language read of the decisive moment, so the
 *  network σ rows below it become EVIDENCE, not the headline (the r4 mark + Sapient's WHY-THIS-SECOND
 *  box). One sentence, split into segments so the loss clause goes coral (the room law). */
export interface WhyThisSecond {
  moment: string; // "0:04 · the drop"
  segments: { text: string; loss?: boolean }[];
}

export interface BrainFrameData {
  cortexSeedKey: string; // drifts the cortex parcellation; stable per stimulus
  clipSeconds: number; // cortex replay-loop duration (s)
  stopRatio: number; // 0..1 — drives the cortex bold, from the verdict
  cortexNote?: string; // #3 — the "what it is NOT" honesty caption ("a modeled proxy, not measured attention")
  driver: BrainDriver; // ◇ swap — the driver axis
  signals: SignalRow[]; // ◇ swap — the decomposition
  signalsBaseline?: string; // #8 — the referent the signal deltas are measured against ("vs your typical")
  whyThisSecond?: WhyThisSecond; // ◇ optional — the P2 synthesis that heads the networks
  networks?: NetworkRow[]; // ◇ optional creator figure (σ evidence, plain-word read per row)
  askWhy?: AskWhySlot; // ● shared (deferred stub)
}

// ── Population swap figures ────────────────────────────────────────────────────

/** A price → would-pay demand curve (pricing main figure): share who'd pay falls as price rises;
 *  a cream marker flags the revenue-optimal price. */
export interface DemandCurveData {
  kicker: string; // "Demand · price → would-pay"
  points: number[]; // 0..100 would-pay share across the price axis (falling)
  optimalAt: number; // 0..1 x-position of the optimal price
  optimalLabel: string; // "$24 optimal"
  loLabel: string; // "$9"
  hiLabel: string; // "$49"
  caption: string; // "+18% revenue vs $29"
}

/** The main figure (◇ swap) — the distribution the headline summarizes. Creator = the stop/skim/
 *  scroll tri-state; pricing = the demand curve. A new domain adds a `kind` here + a figure in
 *  AudienceTab's PopulationMainSlot (future: overlay for A/B · answer-distribution for survey). */
export type PopulationMain =
  | { kind: "tri-state"; data: TriState; percentileLine: string }
  | { kind: "demand-curve"; data: DemandCurveData };

export interface PopulationFrameData {
  main: PopulationMain; // ◇ headline + main figure
  terrain: { clusters: TerrainCluster[]; lossClusterIndex: number }; // ● shared — the society (labels
  //   now carry each district's rate, so the terrain self-reads the "who + how much")
  segments?: { title: string; rows: SegmentStop[] }; // ◇ optional — include ONLY when it's a cut
  //   ORTHOGONAL to the terrain districts. Creator omits it (the labeled terrain already says who
  //   stopped); pricing includes it (willingness-to-pay tiers are a different cut than the clusters).
  voices: {
    kicker: string;
    reasons: CodedReason[];
    /** Total coded voices (the "coded from N" denominator) — each reason's `count` is a share of
     *  this, so the receipts render a proportional weight bar. Defaults to 1000 when omitted. */
    total?: number;
  }; // ● shared — coded reasons + exemplar cast
  /** One-line interpretation under the terrain hero — the non-obvious read of the society ("your
   *  believers cluster in builders; skeptics are the ceiling"), so the hero figure carries insight,
   *  not just a labelled map. */
  heroRead?: string;
  /** ◇ optional — the calibration honesty line ("modeled · pricing decision · engagement-calibrated").
   *  The generalization-bounded-by-calibration law: shown when the decision leans on a calibration the
   *  audience wasn't built for (a scroll-calibrated room predicting willingness-to-pay). */
  calibration?: { note: string };
}

// ── the bundle ─────────────────────────────────────────────────────────────────

export interface DomainTemplate {
  id: string; // "creator"
  label: string; // "Creator · content"
  backLabel: string; // "All 5"
  pager: string; // "hook 2 of 5"
  verdict: { value: string; label: string }; // the answer they paid for, pre-formatted per domain:
  //   creator "38.2%" · "would stop"  ·  pricing "$24" · "optimal price"  (not always a %). Now rides
  //   as a chip ON the hero figure (the figure is the hero, per the 2026-07-21 owner mark).
  /** THE UNLOCK — the cheat-code payload. Not a flat restatement ("cut faster") but the three atoms
   *  that make an insight feel like an edge: a specific LEVER, a modeled predicted GAIN, and the
   *  counterintuitive INSIGHT (what already works vs what leaks). This is the card's value peak. */
  unlock?: { lever: string; gain?: string; insight: string };
  brain: BrainFrameData;
  population: PopulationFrameData | null; // null until a run exists
}
