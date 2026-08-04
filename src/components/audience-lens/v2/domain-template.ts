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

/** The cognitive "why they reacted" breakdown for a TEXT/concept sim (◇ swap). A text sim has no
 *  attention-over-time axis; its honest driver is the REAL dominant-reason tally the population math
 *  emits for each stopper (interest / strong-hook / weak-hook / novelty-mismatch / hype-vs-skeptic /
 *  too-slow) — real deterministic counts, not an invented curve. Friction reasons ride `loss` (coral). */
export interface ReasonBreakdownData {
  question: string; // "Why they stopped"
  total: number; // stoppers coded — the denominator each row's count is a share of
  rows: { label: string; count: number; share: number; loss?: boolean }[]; // real reason counts, weightiest first
  read?: string; // one-line plain synthesis of the leading driver
}

/** The "why this ___" driver-axis figure (◇ swap). Creator video = attention over the clip; text =
 *  the reason breakdown; pricing = resistance over price. A new domain adds a `kind` here + a figure in
 *  BrainTab's BrainDriverSlot. */
export type BrainDriver =
  | { kind: "attention-scrubber"; data: AttentionData }
  | { kind: "reason-breakdown"; data: ReasonBreakdownData }
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

// ── Sapient-depth sections (optional — the fuller brain read) ──────────────────

/** ① Nine breakdown signals — the Sapient decomposition. Each cell: a modeled 0..100 score, a status
 *  word (tone-coded), the delta vs the user's typical (#8), and the one-line "why this score". */
export interface SignalCell {
  key: string;
  label: string; // "Visual Pull" | "Voice Impact" | … (from SIGNAL_DEFS)
  score: number; // 0..100 (modeled)
  word: string; // display grade — "Weakness" | "Okay" | "Strong"
  tone: "weak" | "okay" | "strong";
  delta?: number; // vs the user's typical hook
  whyScore: string;
  muted?: boolean; // a visual-only read on a TEXT sim (no video substrate to measure) → rendered greyed
  /** LOW is good (Hesitation/Risk, Mental Effort). `brain-signals.ts` bands these on `100 − score`,
   *  which is why a 58 Hesitation earns WEAK while a 58 Visual Pull earns OKAY. The grade was always
   *  right; the CARD never said the direction, so the two read as the same scale contradicting itself.
   *  The renderer marks the cell and prints the legend once. */
  lowerIsBetter?: boolean;
}

/** ② Raw network activation — a network's z-score at the decisive second + its plain band word. */
export interface NetworkBar {
  label: string;
  z: number; // σ from the clip's own baseline
  band: string; // "slightly above" | "clearly below" | …
  loss?: boolean; // the standout loss network (coral)
}

/** ③ KPI activation per second — every decoded system, one row of 0..100 intensities per second. */
export interface KpiHeatmapData {
  seconds: number; // clip length in whole seconds (columns)
  rows: { label: string; values: number[]; muted?: boolean }[]; // each values[i] = 0..100 at second i;
  //   `muted` = a sensory row (Visual/Audio/Face) on a TEXT sim — greyed (no video/audio to measure)
}

/** ④ Purchase-intent moments — a buy-intent curve over the clip with a threshold + the peak seconds. */
export interface BuyIntentData {
  points: number[]; // 0..100 buy-intent across the clip
  threshold: number; // 0..100 — the clip's own average (the dashed line)
  abovePct: number; // % of the clip above threshold (the headline number)
  peaks: { t: string; v: number }[]; // "0:05" · 73
  caption: string; // the honest "what this is / isn't" one-liner for the section
}

// ── rev 12 — the shared atoms the three pages are built from ──────────────────
//
// Everything below is OPTIONAL. A domain that authors none of it renders exactly what it rendered
// before (pricing does; the sealed/walkthrough templates do), and the rail's rev-12 blocks omit
// themselves rather than draw an empty frame. Same discipline as the depth sections above.

/** A number + its label, as the answer block and the tiles state facts. `loss` is the ONE coral
 *  zone's opt-in — a page carries at most one (design law), so it is set deliberately, never derived. */
export interface AnswerStat {
  value: string;
  label: string;
  loss?: boolean;
}

/** A key-metric tile — label · big number · the delta vs the creator's OWN catalogue (never an
 *  industry band). `lead` = the metric the answer is about; it reads first by position + fill,
 *  never by colour. */
export interface MetricTile {
  label: string;
  value: string;
  delta?: string;
  lead?: boolean;
}

/** One second on the clip worth a chip: where the playhead parks and what share is still watching. */
export interface RetentionMoment {
  at: number; // seconds into the clip
  pct: number; // 0..100 — share of the room still watching
}

/** The retention instrument (Engagement's hero on a video). ONE playhead drives the cover's progress
 *  line, the curve, the chips and the transcript — they are one instrument, not four readings. */
export interface RetentionInstrument {
  clipSeconds: number;
  /** 0..1 per second — share of the room still watching (`heatmap.weighted_curve`). */
  curve: number[];
  /** The creator's own median post — the only benchmark band we hold (§5.2). */
  median?: number[];
  /** The second the opening collapse finishes; the curve is drawn coral up to it. */
  breakAt?: number;
  /** The read, annotated ON the figure ("62% gone by 0:03") rather than written under it. */
  anno?: string;
  transcript: string;
  /** The word under the break — underlined coral in the one-line strip. */
  breakWordIndex?: number;
  moments: RetentionMoment[];
  coverLabel: string; // "0:28" — the duration chip on the mini frame
  coverSrc?: string | null; // the drill's real cover; absent ⇒ the matte placeholder
}

/** This clip among the creator's own last N — the benchmark the meta was citing, DRAWN. */
export interface RankStripData {
  values: number[]; // the catalogue, in the strip's unit
  median: number;
  max: number; // the axis top
  value: number; // this clip
  unit: string; // "s"
}

/** When the room reacts, on the clip's own axis — the heatmap grammar, counts matching the tiles. */
export interface ReactionTimelineData {
  seconds: number;
  rows: { label: string; count: number; intensity: number[] }[]; // intensity 0..1 per second
}

/** A simulated viewer speaking. The ONLY serif on the surface — content, not chrome. `echo` is how
 *  many of the room would say the same thing, and it must fit INSIDE the row it belongs to. */
export interface VoiceRow {
  who: string;
  tag: string; // a human descriptor ("small creator"), never an archetype caste
  quote: string;
  echo: number;
  echoOf?: number; // the denominator the echo bar is a share of
  loss?: boolean;
  /** The swing, folded into the segment it names ("Win these 201: watched 38% → 47%"). */
  swing?: string;
}

/** Engagement — what the room DID with the clip, second by second and in aggregate. */
export interface EngagementFrameData {
  retention?: RetentionInstrument; // VIDEO only (§3.3: text has no timeline)
  watch?: { title: string; meta?: string; tiles: MetricTile[]; rank?: RankStripData };
  reactionTimeline?: ReactionTimelineData; // VIDEO only — same reason
  reactions?: { title: string; meta?: string; tiles: MetricTile[] };
  /** TEXT's instrument: the voices lead, because a text sim has the voices and no timeline. */
  voices?: { title: string; rows: VoiceRow[] };
}

/** The re-simulated state a fix produces. Authored/derived as a whole so before → after is one
 *  swap, and `Undo` is one state flip — never a pile of independently-mutated numbers. */
export interface DrillFixApplied {
  head: string;
  stats: AnswerStat[];
  was: AnswerStat; // before → after, on one line, in the answer block
  now: AnswerStat;
  verdict: { value: string; label: string }; // the hero chip after the fix
  cortexCorner?: string; // "after the trim" — the cortex repaints from the new curve
  thumbLabel?: string; // the clip is shorter now
  retention?: {
    curve: number[];
    clipSeconds: number;
    anno?: string;
    moments?: RetentionMoment[];
    /** Words the trim removed from the front of the transcript. */
    trimWords?: number;
  };
  watchTiles?: MetricTile[];
  rankValue?: number;
  reactionTiles?: MetricTile[];
  reactionMeta?: string;
  /** Scales the reaction timeline's counts with the new reach. */
  reactionScale?: number;
}

/** THE FIX, as a control rather than a sentence. `unlock` states one; this one runs. */
export interface DrillFix {
  label: string; // "Trim 0:00–0:03"
  gain?: string; // "→ 8.4K"
  applied: DrillFixApplied;
}

/** The answer block — the verdict headline (the surface's ONE sentence), its evidence as a stat row,
 *  and the fix. Its ONLY home is Brain; it is content, never pinned (owner-reversed 7.2). */
export interface DrillAnswer {
  head: string;
  stats: AnswerStat[];
  /** The cortex's right corner — what second the figure is showing ("at 0:03, the drop"). */
  cortexCorner?: string;
  /** The hero chip on Brain, when the page's headline differs from the template verdict. */
  verdict?: { value: string; label: string };
  fix?: DrillFix;
  /** Where "See the evidence →" goes: one tab right to the curve (video), or down to the reasons. */
  evidence?: "engagement" | "reasons";
}

/** The rail's identity strip — thumbnail · one-line title · the projected counts. Rendered ONCE,
 *  above the tabs, and it scrolls away (the TikTok chrome). */
export interface DrillIdentity {
  title: string;
  thumbLabel: string; // "0:28" | "HOOK"
  coverSrc?: string | null;
  stats: { kind: "play" | "heart" | "msg" | "share" | "save"; value: string }[];
  /** These are projections for a post that does not exist yet — the tag says so, and the row is
   *  dimmed so it is never the loudest data on the page. */
  projected?: boolean;
}

export interface BrainFrameData {
  cortexSeedKey: string; // drifts the cortex parcellation; stable per stimulus
  clipSeconds: number; // cortex replay-loop duration (s)
  stopRatio: number; // 0..1 — drives the cortex bold, from the verdict
  /** The audience's REAL retention at each second, 0..1 (`heatmap.weighted_curve`). Present ⇒ the
   *  cortex runs `cortex-sim`'s **grounded** mode: attention tracks who is still watching, salience
   *  spikes where the curve breaks, and the default-mode network rises with the people who checked
   *  out. Absent (a text/concept sim has no timeline) ⇒ the honest seeded `simulated` envelope.
   *  MUST come from the same curve the attention driver renders — the cortex and the visible curve
   *  are one instrument, not two readings of the same run. */
  retentionCurve?: number[];
  cortexNote?: string; // #3 — the "what it is NOT" honesty caption ("a modeled proxy, not measured attention")
  driver: BrainDriver; // ◇ swap — the driver axis
  signals: SignalRow[]; // ◇ swap — the decomposition
  signalsBaseline?: string; // #8 — the referent the signal deltas are measured against ("vs your typical")
  whyThisSecond?: WhyThisSecond; // ◇ optional — the P2 synthesis that heads the networks
  networks?: NetworkRow[]; // ◇ optional creator figure (σ evidence, plain-word read per row)
  askWhy?: AskWhySlot; // ● shared (deferred stub)
  // ── Sapient-depth sections (optional; creator authors them, pricing omits). When `signalGrid` is
  //    present it REPLACES the lean 3-row `signals` delta (its delta lives on each cell instead). ──
  signalGrid?: SignalCell[]; // ① nine breakdown signals
  networkBars?: NetworkBar[]; // ② raw network activation · z-scored
  kpiHeatmap?: KpiHeatmapData; // ③ activation per second · every decoded system
  buyIntent?: BuyIntentData; // ④ purchase-intent moments
  calibrationNote?: string; // the single consolidated honesty line at the tab bottom (replaces cortexNote)
  /** rev 10 — the two or three signals the page is actually about. They render full-width above the
   *  grid, ranked, so the nine have a hierarchy without any of them being hidden (the rev-8 drawer
   *  mistake). Values are `SignalCell.key`s; unknown keys are ignored. */
  signalMovers?: string[];
  /** The scale, NAMED in the card's right-meta ("0–100 · vs your baseline"). Naming each scale is
   *  what makes a surface carrying three of them honest — hiding a block was the wrong cure. */
  signalScale?: string;
  networkScale?: string; // "z-scored · at the playhead"
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

// ── audience-depth sections (optional — the fuller society read) ───────────────

/** Who this is for — each segment's over/under-index vs the creator's typical audience (targeting). */
export interface AudienceFitData {
  baseline: string; // "vs your last 41 hooks"
  rows: { label: string; index: number; loss?: boolean }[]; // index = % over(+)/under(−) the baseline
  read: string;
}

/** Who spreads it · how far — the reshare cascade (reach depth) + which segments carry it. */
export interface AmplificationData {
  reachMultiplier: number; // ×followers (headline)
  reached: number; // modeled second-ring reach
  cascade: { label: string; count: number }[]; // saw it → reshared → their networks (reverse funnel)
  carriers: { label: string; factor: number; lead?: boolean }[]; // reshare propensity per segment (×)
  read: string;
}

/**
 * What they'd do with it — the room's ACTION profile (VIDEO only: a text sim's verdict is
 * stop/scroll, it has no action axis).
 *
 * NOT amplification: there is no reach claim here — no multiplier, no cascade, no carrier ranking.
 * We hold intent, not distribution, and the per-archetype ranking is a constant of the persona
 * registry rather than a read on the video (see `ambient-v2-video-population.ts` §5).
 */
export interface ActionIntentData {
  /** The action verbs, strongest first. `value` is a 0–100 intent INDEX, not a rate — see `note`. */
  rows: { label: string; value: number }[];
  /** The real population rate (flat mean of watch-through). A DIFFERENT kind of number from `rows`,
   *  so it rides the header as its own figure and never joins the bar set. */
  watchThroughPct: number;
  total: number; // the real cast
  actors: number; // …with any action intent above zero
  inert: number; // …at zero on every verb
  watchedButInert: number; // …of those, the ones who never scrolled away
  read: string; // one sentence, two facts: what leads (or runs together) + what the floor is
  note: string; // the denominator disclosure (the weighting)
}

/** The swing · your upside — the fence-sitters and the verdict move if you win them. */
export interface SwingData {
  nearMiss: number; // people stalled right at the line
  fromPct: number; // current verdict %
  toPct: number; // modeled potential %
  gainLabel: string; // "+11% would stop"
  read: string;
}

/** The room, by decision — the whole society recategorized into four action-states (a conversion
 *  funnel), so the audience read is a playbook (who's in · who's winnable · who needs work · who's
 *  gone) rather than a census of archetypes. Every count is a REAL partition of the projection. */
export interface DecisionStateRow {
  key: "sold" | "winnable" | "skeptical" | "gone";
  label: string; // "Sold" | "Winnable" | "Skeptical" | "Gone"
  count: number; // people in this state (partitions the room; the four sum to `total`)
  share: number; // 0..100 of the room
  lever: string; // the one action for this state ("cut the wait", "show the receipts", …)
  loss?: boolean; // the definitive loss (the scrolled-and-gone) → coral
  /** rev 10 — the row SPEAKS. Tapping it opens one simulated viewer in their own words, plus the
   *  `interview ›` affordance the drawer already ships. Talking to the room is the most
   *  differentiated thing in the product; a flat count row never said so. */
  voice?: VoiceRow;
}
export interface DecisionStatesData {
  states: DecisionStateRow[]; // exactly four, sold → gone
  total: number; // the room size (the four counts sum to this)
  read?: string; // the one-line "so what" (where the next point comes from)
}

/** The room · trust — the methodology strip (sample · calibration · confidence). */
export interface RoomTrustData {
  simulated: number; // simulated viewers
  calibratedOn: string; // "your 4.2k followers"
  confidence: number; // 0..1
  confidenceLabel: string; // "High" | "Medium" | …
  note: string; // the honesty line (engagement-calibrated, not purchase)
}

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
  /** ◇ optional — the room recategorized into four decision-states (the conversion funnel). When
   *  present it REPLACES the archetype district ledger (creator sets it; pricing keeps the ledger). */
  decisionStates?: DecisionStatesData;
  // ── audience-depth sections (optional; creator authors them) ──
  audienceFit?: AudienceFitData; // who this is for · vs your typical
  amplification?: AmplificationData; // who spreads it · how far
  /** ◇ optional — what they'd DO with it (VIDEO only). Sits in the slot `amplification` omits itself
   *  from on a video run: it answers the neighbouring question honestly (intent, not reach). */
  actionIntent?: ActionIntentData;
  swing?: SwingData; // the swing · your upside
  room?: RoomTrustData; // the room · trust strip (richer replacement for `calibration.note`)
  // ── rev 12 ──
  /** Who watches — and how long. The retention split by traffic pool: the read no platform reports,
   *  and the product's actual claim (§5.1). ONE taxonomy across terrain, watch-time, fit and spread:
   *  relationship to the creator (Followers · Returning · New viewers · Outside niche), TikTok's own
   *  vocabulary. The archetype namespace is owner-RETIRED — never re-propose it. */
  pools?: {
    title: string;
    meta?: string;
    rows: {
      label: string;
      share: string; // "65% of room"
      sharePct: number;
      curve?: number[]; // 0..1 — this pool's own retention spark
      dropAt?: string; // "0:02"
      loss?: boolean;
    }[];
  };
  /** Where & when — one card since rev 11 (the surface mix and the posting window were two thin
   *  cards on the page the owner called the most overloaded). Text has no surface mix (§3.3). */
  distribution?: {
    title: string;
    meta?: string;
    surfaces?: { label: string; value: string; weight: number }[];
    week?: { day: string; value: number; best?: boolean; hours?: string }[];
  };
  /** The line that rides ON the terrain, telling you what its district rates mean. */
  heroFigread?: string;
  /** The chip on the terrain. Each page's hero states THAT page's headline — Audience's question is
   *  who was in the room, so its chip is the room's composition, not the clip's verdict. Falls back
   *  to the template verdict when a domain has no separate one. */
  heroVerdict?: { value: string; label: string };
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
  // ── rev 12 (all optional — a domain that authors none renders exactly as before) ──
  /** The identity strip above the tabs. */
  identity?: DrillIdentity;
  /** The answer block + the acting fix. Brain's, and only Brain's. */
  answer?: DrillAnswer;
  /** The Engagement page. Absent ⇒ the tab dims, exactly like an absent brain/population. */
  engagement?: EngagementFrameData;
  /** The sim disclosure — the last line of EVERY page, same words ("1,000 simulated · your 4.2K
   *  followers · confidence 0.82"). One home, so it stops being repeated in three grammars. */
  simline?: string;
  /** "How to read these numbers" — which scale each block is on, and what the model cannot claim.
   *  The drawer EXPLAINS the instrument; it never holds a second copy of it. */
  method?: { heading: string; notes: string[] }[];
  /** OPTIONAL — a text/concept sim has no brain read (the brain decomposition is a VIDEO producer:
   *  fold attention + craft dims). When undefined, `AmbientDetail` shows the honest brain-unavailable
   *  state (`brainNote`) and defaults to the audience tab. The authored fixtures always provide it. */
  brain?: BrainFrameData;
  population: PopulationFrameData | null; // null until a run exists
}
