"use client";

/**
 * BrainTab — Ambient Audience v2, page ① "Brain": why it happened in the head.
 *
 * Runs headline → the answer → what → substrate, and every block on it is brain material. Nothing
 * here is a reach, watch or reaction metric: those are the other two pages' jobs (§15's standing
 * rule — a block lives on the page whose question it answers).
 *
 *   the cortex, grounded on the real retention curve (the 270px hero — NEVER shrink it, §0)
 *   → the answer: the verdict headline, its evidence as a stat row, and THE FIX, which acts
 *   → Signal breakdown — the nine, movers full-width above a six-cell grid, all of them visible
 *   → Network activation — seven σ bars with a zero line and the plain-word read inline
 *   → Activation per second — the ten decoded systems on the clip's own axis
 *   → How to read these numbers · the sim disclosure
 *
 * Rev 8 folded the instrument into the drawer so the surface would speak one unit. That was the
 * wrong cure — the page came back thinner than the shipped tab it replaced. The unit problem is
 * fixed instead by each card's right-meta NAMING its scale, and the instrument stays on the surface.
 *
 * ◇ swap slots survive: a text sim's driver is the coded reasons, pricing's is the resistance curve.
 * A new domain authors figures into the slots; it never edits this frame.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { driveFor, hashSeed, predictedBold, type DriveInput } from "@/lib/brain/cortex-sim";
import { TONE, VerdictChip, type SignalRow } from "./AmbientDetail";
import { Card, CardHead, AStat, BarRow, HeatCells, Axis, MethodFoot, SURFACE, curvePath } from "./rail-kit";
import type {
  BrainFrameData,
  DomainTemplate,
  DrillAnswer,
  DrillFixApplied,
  KpiHeatmapData,
  NetworkBar,
  ReasonBreakdownData,
  ResistanceCurveData,
  SignalCell,
} from "./domain-template";

// CortexCanvas is WebGL (three.js) — client-only, never SSR (mirrors BrainView.tsx:115).
const CortexCanvas = dynamic(() => import("../CortexCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" style={{ background: SURFACE.figure }} />,
});

const CLIP_LOOP_MS = 8000; // replay the clip on an 8s loop (r4 RDUR)

/** rev 10 — the networks are named by FUNCTION, the words the read already speaks. The anatomical
 *  names move to the method drawer, where σ is explained. A label outside this map passes through
 *  untouched, so a non-Yeo domain is unaffected. */
const NET_FUNCTION: Record<string, string> = {
  Somatomotor: "Body",
  "Dorsal Attention": "Focus",
  "Ventral Attention": "Alertness",
  Limbic: "Emotion",
  Frontoparietal: "Effort",
  "Default Mode": "Mind-wandering",
};

/** Two signals translated out of neuro-speak into creator language, and the rest set in sentence
 *  case. Keyed by the grid's stable `key`, so a label rewrite upstream cannot silently un-translate. */
const SIGNAL_LABEL: Record<string, string> = {
  visual: "Visual pull",
  voice: "Delivery",
  grip: "Easy to follow",
  emotion: "Emotional hit",
  memory: "Memorability",
  attention: "Attention",
  buy: "Buy signal",
  risk: "Hesitation",
  effort: "Mental effort",
};

// ── the hero — the cortex, grounded ──────────────────────────────────────────

function Corner({ side, children }: { side: "l" | "r"; children: React.ReactNode }) {
  return (
    <span
      className={`absolute top-[9px] rounded-[7px] px-2 py-1 text-[11px] font-medium tabular-nums ${side === "l" ? "left-[9px]" : "right-[9px]"}`}
      style={{ background: "rgba(20,20,19,.78)", color: side === "l" ? "rgba(236,231,222,.85)" : TONE.faint }}
    >
      {children}
    </span>
  );
}

function CortexFigure({
  seedKey,
  stopRatio,
  clipSeconds,
  retentionCurve,
  reducedMotion,
  verdict,
  corner,
}: {
  seedKey: string;
  stopRatio: number;
  clipSeconds: number;
  /** The room's REAL retention per second (0..1). Present ⇒ grounded; absent ⇒ simulated. */
  retentionCurve?: number[];
  reducedMotion: boolean;
  verdict?: DomainTemplate["verdict"];
  corner: string;
}) {
  const seed = useMemo(() => hashSeed(seedKey), [seedKey]);
  // GROUNDED when the room's real retention is in hand — attention IS retention, salience fires at
  // the breaks, drift rises with the people who checked out. `driveFor` owns that choice (it used to
  // be a hardcoded `mode: "simulated"` here, which is why every video drill showed a seeded envelope
  // carrying no information). A text/concept sim has no curve and correctly stays simulated.
  // After the fix this receives the RE-SIMULATED curve, so the figure repaints rather than sitting
  // on the old still under a corner that claims otherwise.
  const drive = useMemo<DriveInput>(
    () => driveFor({ seedKey, stopRatio, durationS: clipSeconds, retentionCurve }),
    [retentionCurve, stopRatio, clipSeconds, seedKey],
  );
  const [t, setT] = useState(reducedMotion ? clipSeconds * 0.33 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let start = 0;
    let lastQuarter = -1;
    const loop = (now: number) => {
      if (!start) start = now;
      const p = ((now - start) % CLIP_LOOP_MS) / CLIP_LOOP_MS;
      const tt = p * clipSeconds;
      // Throttle bold recompute to ~4Hz — CortexCanvas lerps between targets on its own frame loop.
      const q = Math.floor(tt * 4);
      if (q !== lastQuarter) {
        lastQuarter = q;
        setT(tt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, clipSeconds]);

  const bold = useMemo(() => predictedBold(drive, t), [drive, t]);

  return (
    <div
      className="relative mt-3.5 overflow-hidden rounded-[14px]"
      style={{ height: 270, border: `1px solid ${TONE.border}`, background: SURFACE.figure }}
    >
      <CortexCanvas seed={seed} bold={bold} t={t} reducedMotion={reducedMotion} />
      <Corner side="l">Predicted cortex</Corner>
      <Corner side="r">{corner}</Corner>
      {verdict ? <VerdictChip verdict={verdict} /> : null}
    </div>
  );
}

// ── the answer — the ONE coral zone on the page, and the ONE control ─────────

function AnswerBlock({
  answer,
  applied,
  onApplyFix,
  onUndoFix,
  onSeeEvidence,
}: {
  answer: DrillAnswer;
  applied: DrillFixApplied | null;
  onApplyFix: () => void;
  onUndoFix: () => void;
  onSeeEvidence?: () => void;
}) {
  if (applied) {
    return (
      <div className="mt-3.5 pl-[13px]" style={{ borderLeft: `2px solid rgba(236,231,222,.5)` }}>
        <h2 className="text-[16px] font-semibold leading-[1.28] tracking-[-0.018em]" style={{ color: TONE.cream }}>
          {applied.head}
        </h2>
        {/* before → after on one line: a change you can see, not two screens to remember between */}
        <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5" style={{ background: SURFACE.card }}>
          <span className="flex flex-col gap-0.5">
            <i className="whitespace-nowrap text-[10px] not-italic" style={{ color: TONE.faint }}>
              {applied.was.label}
            </i>
            <b className="text-[17px] font-normal leading-none tracking-[-0.012em] tabular-nums" style={{ color: TONE.faint }}>
              {applied.was.value}
            </b>
          </span>
          <span className="mt-3 text-[13px]" style={{ color: TONE.faint }}>
            →
          </span>
          <span className="flex flex-col gap-0.5">
            <i className="whitespace-nowrap text-[10px] not-italic" style={{ color: TONE.faint }}>
              {applied.now.label}
            </i>
            <b className="text-[17px] font-medium leading-none tracking-[-0.012em] tabular-nums" style={{ color: TONE.cream }}>
              {applied.now.value}
            </b>
          </span>
          <span className="ml-auto self-end rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium" style={{ background: SURFACE.chip, color: TONE.faint }}>
            projected
          </span>
        </div>
        <AStat stats={applied.stats} />
        {/* The applied state's ONLY control, so it carries a control's affordance. As dim plain text it
            read as a caption next to the numbers it undoes — "See the evidence →" can stay bare because
            it sits beside a filled primary; this has nothing to be secondary to. Chip, not cream fill:
            the primary action is spent, and undo is a way back, not the thing to do. */}
        <button
          type="button"
          onClick={onUndoFix}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-[6px] text-[12px] transition-colors"
          style={{ background: SURFACE.chip, color: TONE.dim }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SURFACE.chipOn;
            e.currentTarget.style.color = TONE.cream;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = SURFACE.chip;
            e.currentTarget.style.color = TONE.dim;
          }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
          Undo the fix
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3.5 pl-[13px]" style={{ borderLeft: `2px solid ${TONE.coral}` }}>
      <h2 className="text-[16px] font-semibold leading-[1.28] tracking-[-0.018em]" style={{ color: TONE.cream }}>
        {answer.head}
      </h2>
      <AStat stats={answer.stats} />
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        {answer.fix ? (
          // Cream-filled: the system says active/primary is cream on a lighter fill, never coral.
          <button
            type="button"
            onClick={onApplyFix}
            className="inline-flex items-center gap-2 rounded-[9px] py-[7px] pl-2.5 pr-3 text-left transition-colors"
            style={{ background: TONE.cream }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = TONE.cream)}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#1c1b19" strokeWidth={1.6} strokeLinejoin="round" style={{ opacity: 0.55 }}>
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
            </svg>
            <span className="text-[13px] font-medium" style={{ color: "#1c1b19" }}>
              {answer.fix.label}
            </span>
            {answer.fix.gain ? (
              <span className="text-[12px] font-medium tabular-nums" style={{ color: "rgba(28,27,25,.55)" }}>
                {answer.fix.gain}
              </span>
            ) : null}
          </button>
        ) : null}
        {onSeeEvidence ? (
          <button
            type="button"
            onClick={onSeeEvidence}
            className="text-[12px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.dim)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            See the evidence →
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── the decomposition — all nine, ranked ─────────────────────────────────────

const gradeOf = (c: SignalCell) => (c.muted ? "no signal" : c.tone);

/** The direction mark. Hesitation and Mental Effort band on `100 − score` (`brain-signals.ts`), so a
 *  58 Hesitation reads WEAK while a 58 Visual Pull reads OKAY — correct, and unreadable while the card
 *  named one scale and showed two directions on it. The mark rides the label; the legend below prints
 *  once, in the same chrome the activation card's `weak → strong` key already uses.
 *
 *  A footnote mark, NOT an arrow: `↓` and `↑` are already spoken for on this surface — the watch and
 *  reaction tiles one page over use them for went-down/went-up ("↓1.5s", "0.5% of viewers ↓"). Reusing
 *  the glyph for "lower is better" would put two meanings on one mark inside a single instrument,
 *  which is the defect this fix exists to close, one level down. */
function Dir({ c }: { c: SignalCell }) {
  if (!c.lowerIsBetter) return null;
  return (
    <span aria-label="lower is better" title="lower is better" className="flex-none text-[11px] leading-none" style={{ color: TONE.faint }}>
      *
    </span>
  );
}

/** Score · its delta vs the creator's baseline · the label · the grade word. Grades carry NO colour:
 *  an unbenchmarked cutoff must not shout, and the page's one coral belongs to the loss. */
function SignalsCard({ cells, movers, scale }: { cells: SignalCell[]; movers?: string[]; scale?: string }) {
  const keys = new Set(movers ?? []);
  const lead = (movers ?? []).map((k) => cells.find((c) => c.key === k)).filter((c): c is SignalCell => !!c);
  const rest = cells.filter((c) => !keys.has(c.key));
  const label = (c: SignalCell) => SIGNAL_LABEL[c.key] ?? c.label;
  const anyInverted = cells.some((c) => c.lowerIsBetter);
  return (
    <Card>
      <CardHead title="Signal breakdown" meta={scale} />
      {lead.length ? (
        <div className="mt-1.5">
          {lead.map((c) => (
            <div key={c.key} className="flex items-baseline gap-2 py-2" style={{ borderBottom: `1px solid ${TONE.border}` }}>
              <b className="min-w-[30px] text-[21px] font-normal leading-none tracking-[-0.012em] tabular-nums" style={{ color: TONE.cream }}>
                {c.muted ? "—" : c.score}
              </b>
              {!c.muted && c.delta != null ? (
                <span className="text-[10px] font-medium tabular-nums" style={{ color: TONE.faint }}>
                  {c.delta > 0 ? "+" : ""}
                  {c.delta}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 items-baseline gap-1 truncate text-[13px]" style={{ color: TONE.dim }}>
                {label(c)}
                <Dir c={c} />
              </span>
              <span className="text-[10px] uppercase tracking-[0.04em]" style={{ color: c.tone === "strong" ? TONE.dim : TONE.faint }}>
                {gradeOf(c)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[10px]" style={{ background: TONE.border }}>
        {rest.map((c) => (
          <div key={c.key} className="px-2.5 pb-[11px] pt-2.5" style={{ background: SURFACE.chip }}>
            <span className="flex items-baseline gap-1">
              <b className="text-[19px] font-normal leading-none tracking-[-0.01em] tabular-nums" style={{ color: c.muted ? TONE.ghost : TONE.cream }}>
                {c.muted ? "—" : c.score}
              </b>
              {!c.muted && c.delta != null ? (
                <span className="text-[10px] font-medium tabular-nums" style={{ color: TONE.faint }}>
                  {c.delta > 0 ? "+" : ""}
                  {c.delta}
                </span>
              ) : null}
            </span>
            <span className="mt-1.5 flex items-baseline gap-1 text-[11px]" style={{ color: c.muted ? TONE.ghost : TONE.dim }}>
              <span className="min-w-0 truncate">{label(c)}</span>
              {c.muted ? null : <Dir c={c} />}
            </span>
            <span
              className="mt-1 block text-[10px] uppercase tracking-[0.04em]"
              style={{ color: c.muted ? TONE.ghost : c.tone === "strong" ? TONE.dim : TONE.faint }}
            >
              {gradeOf(c)}
            </span>
          </div>
        ))}
      </div>
      {anyInverted ? (
        <div className="mt-2.5 text-[10px] uppercase tracking-[0.04em]" style={{ color: TONE.faint }}>
          * lower is better
        </div>
      ) : null}
    </Card>
  );
}

/** The lean fallback when a domain authors no nine-grid (pricing) — the ONE informative atom, the
 *  delta vs its baseline. */
function SignalRowsCard({ signals, scale }: { signals: SignalRow[]; scale?: string }) {
  if (!signals.length) return null;
  return (
    <Card>
      <CardHead title="Signal breakdown" meta={scale} />
      <div className="mt-1.5">
        {signals.map((s, i) => (
          <div
            key={s.label}
            className="flex items-baseline justify-between py-2"
            style={{ borderBottom: i < signals.length - 1 ? `1px solid ${TONE.border}` : undefined }}
          >
            <span className="text-[13px]" style={{ color: TONE.dim }}>
              {s.label}
            </span>
            <span className="text-[13px] font-medium tabular-nums" style={{ color: TONE.cream }}>
              {s.vsBase != null ? `${s.vsBase > 0 ? "+" : ""}${s.vsBase}` : s.score}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── the substrate ────────────────────────────────────────────────────────────

const SIGMA_FULL = 1.2; // σ that fills a half-bar

/** Raw networks, z-scored, each with the plain-word read the σ alone cannot give. The zero centre
 *  line is load-bearing: a z-score bar without one cannot be read at all — a bar at −0.73σ and one
 *  at +0.35σ are just two lengths. The shipped bars have none. */
function NetworksCard({ rows, scale }: { rows: NetworkBar[]; scale?: string }) {
  return (
    <Card>
      <CardHead title="Network activation" meta={scale} />
      <div className="mt-2">
        {rows.map((r) => {
          const w = Math.min(48, (Math.abs(r.z) / SIGMA_FULL) * 50);
          return (
            <div key={r.label} className="flex items-center gap-2.5 py-1.5">
              <span className="w-24 flex-none truncate text-[12px]" style={{ color: TONE.faint }}>
                {NET_FUNCTION[r.label] ?? r.label}
              </span>
              <span className="relative h-3.5 flex-1 rounded-[3px]" style={{ background: "rgba(236,231,222,.05)" }}>
                <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(236,231,222,.22)" }} />
                <span
                  className="absolute top-1 h-1.5 rounded-sm"
                  style={{ width: `${w.toFixed(1)}%`, background: "rgba(236,231,222,.5)", ...(r.z < 0 ? { right: "50%" } : { left: "50%" }) }}
                />
              </span>
              {/* the read rides WITH its σ — on its own line it doubled the card height for no gain */}
              <span className="w-[82px] flex-none whitespace-nowrap text-right text-[11px] tabular-nums" style={{ color: TONE.dim }}>
                {r.z > 0 ? "+" : ""}
                {r.z.toFixed(2)}σ
                <span className="mt-0.5 block text-[10px]" style={{ color: TONE.faint, fontVariantNumeric: "normal" }}>
                  {r.band}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Where in the clip each decoded system fires. Sensory rows on a TEXT sim render flat with one
 *  honest note — a text concept has no video substrate to measure. */
function ActivationCard({ data }: { data: KpiHeatmapData }) {
  const dead = data.rows.filter((r) => r.muted).map((r) => r.label);
  // A text concept has no clock, so it gets no clock: same rows, same order, an axis that reads
  // start → end instead of 0s → 6s. The 6 was a nominal proxy the adapter picked for the cortex loop
  // and it was reaching the surface as a measured duration, three lines under a comment explaining
  // that a modeled timeline is the one thing text does not have.
  const untimed = !!data.untimed;
  return (
    <Card>
      <CardHead
        title={untimed ? "Where each system fires" : "Activation per second"}
        meta={untimed ? `${data.rows.length} systems` : `${data.seconds}s · ${data.rows.length} systems`}
      />
      <div className="mt-3 flex flex-col gap-0.5">
        {data.rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-[58px] flex-none text-right text-[10px] uppercase tracking-[0.04em]" style={{ color: TONE.faint }}>
              {r.label}
            </span>
            <HeatCells values={r.values.map((v) => 0.05 + (v / 100) * 0.75)} dead={r.muted} />
          </div>
        ))}
      </div>
      <Axis left={untimed ? "start" : "0s"} right={untimed ? "end" : `${data.seconds}s`} indent={66} />
      {/* The key is drawn in the grid's OWN cells, not a ramp. `HeatCells` renders discrete steps at
          the exact alphas a real row uses, so the legend is a sample of the figure rather than a
          second encoding of it — and the surface keeps its no-gradient law, which the soft ramp that
          shipped here quietly broke. */}
      <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.04em]" style={{ color: TONE.faint }}>
        <span className="flex w-14">
          <HeatCells values={[0.05, 0.25, 0.45, 0.65, 0.88]} height={6} />
        </span>
        <span>weak → strong</span>
        {untimed ? null : <span className="ml-auto">each cell = 1s</span>}
      </div>
      {dead.length ? (
        <p className="mt-2.5 text-[11px] leading-[1.5]" style={{ color: TONE.faint }}>
          {dead.join(", ")} carry no signal — a text concept has no video substrate.
        </p>
      ) : null}
    </Card>
  );
}

// ── ◇ driver swap slots ──────────────────────────────────────────────────────

/** The group caption on "Why they scrolled" — the break the sort order implies, said out loud. */
function ReasonGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-2.5 text-[10px] font-medium uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
      {children}
    </div>
  );
}

/** A text concept has no timeline (§3.3) — its "when" is a WHY, so the coded reasons take the
 *  moment's slot and the instrument continues underneath, identical in both kinds. */
function ReasonsCard({ data }: { data: ReasonBreakdownData }) {
  const max = Math.max(1, ...data.rows.map((r) => r.count));
  // FRICTION first. The tally is mixed by construction — it is the dominant reason each person
  // gave, pull and friction together — and sorting it by raw count put "Strong hook" at the top of
  // a card titled "Why they scrolled", which reads as a polarity error even though the number is
  // right. The pull reasons stay on the card, below, at their true weight; only the ORDER changes,
  // so the leading row is about leaving and the card means what its title says.
  const rows = [...data.rows].sort((a, b) => Number(!!b.loss) - Number(!!a.loss) || b.count - a.count);
  // The sort alone was not an encoding. A pull reason can still own the LONGEST bar on a card titled
  // "Why they scrolled" — "Strong hook 51%" did — and order is the only thing that said otherwise, in
  // a list with no break in it. The two groups are named where they change, so the reader is told what
  // the order means instead of having to infer it. One group ⇒ no headings; the card is already that.
  const split = rows.findIndex((r) => !r.loss);
  const grouped = split > 0 && split < rows.length;
  return (
    <Card id="reasons">
      <CardHead title="Why they scrolled" meta={`coded from ${data.total}`} />
      <div className="mt-2">
        {grouped ? <ReasonGroup>Why they left</ReasonGroup> : null}
        {rows.map((r, i) => (
          <div key={r.label}>
            {grouped && i === split ? <ReasonGroup>What held the rest</ReasonGroup> : null}
            <BarRow
              label={r.label}
              value={`${Math.round(r.share * 100)}%`}
              frac={r.count / max}
              lead={i === 0 && !!r.loss}
              low={!r.loss}
              labelWidth={122}
              valueWidth={36}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Pricing's driver — resistance rises with price and a coral marker flags the spike (the loss). */
function ResistanceCard({ data }: { data: ResistanceCurveData }) {
  const W = 366;
  const H = 96;
  const P = 6;
  const line = curvePath(data.points.map((v) => v / 100), W, H, P);
  const sx = P + data.spikeAt * (W - 2 * P);
  return (
    <Card>
      <CardHead title={data.question} meta={data.spikeLabel} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full">
        <path d={`${line} L${W - P},${H - P} L${P},${H - P} Z`} fill="rgba(236,231,222,.045)" />
        <path d={line} fill="none" stroke="rgba(236,231,222,.72)" strokeWidth={1.6} />
        <line x1={sx} y1={0} x2={sx} y2={H} stroke={TONE.coral} strokeWidth={1} strokeDasharray="3 3" />
      </svg>
    </Card>
  );
}

// ── the brain role-frame ─────────────────────────────────────────────────────

export function BrainFrame({
  brain,
  verdict,
  answer,
  unlock,
  applied = null,
  onApplyFix,
  onUndoFix,
  onSeeEvidence,
  reducedMotion = false,
  flashMoment = null,
  method,
  methodOpen = false,
  onToggleMethod,
  simline,
}: {
  brain: BrainFrameData;
  verdict: DomainTemplate["verdict"];
  answer?: DrillAnswer;
  unlock?: DomainTemplate["unlock"];
  applied?: DrillFixApplied | null;
  onApplyFix?: () => void;
  onUndoFix?: () => void;
  onSeeEvidence?: () => void;
  reducedMotion?: boolean;
  /** Cross-page thread — when Audience jumps here, the matching moment scrolls into view. */
  flashMoment?: string | null;
  method?: { heading: string; notes: string[] }[];
  methodOpen?: boolean;
  onToggleMethod?: () => void;
  simline?: string;
}) {
  // A template with no authored answer still has a verdict and (usually) an unlock — the one
  // actionable atom the page has always carried. Rendering it in the answer's grammar keeps every
  // existing domain meaningful instead of leaving the page headless.
  const resolved: DrillAnswer | undefined =
    answer ??
    (unlock
      ? { head: unlock.lever, stats: [...(unlock.gain ? [{ value: unlock.gain, label: "projected" }] : []), { value: verdict.value, label: verdict.label }] }
      : undefined);
  const heroVerdict = applied?.verdict ?? answer?.verdict ?? verdict;
  const corner = applied?.cortexCorner ?? answer?.cortexCorner ?? "simulated";
  const driver = brain.driver;

  return (
    <div data-page="brain" data-flash-moment={flashMoment ?? undefined}>
      <CortexFigure
        seedKey={brain.cortexSeedKey}
        stopRatio={Math.min(1, Math.max(0, brain.stopRatio))}
        clipSeconds={applied?.retention?.clipSeconds ?? brain.clipSeconds}
        retentionCurve={applied?.retention?.curve ?? brain.retentionCurve}
        reducedMotion={reducedMotion}
        verdict={heroVerdict}
        corner={corner}
      />
      {resolved ? (
        <AnswerBlock
          answer={resolved}
          applied={applied}
          onApplyFix={onApplyFix ?? (() => {})}
          onUndoFix={onUndoFix ?? (() => {})}
          onSeeEvidence={onSeeEvidence}
        />
      ) : null}
      {/* Applying the fix fires NO model call — it swaps in the projected state, so the evidence below
          is still the read of the clip as posted. That is why Signal breakdown, Network activation and
          Activation per second sit byte-identical while the hero repaints: no fold ran, so there is no
          delta to draw. Naming it costs one line; leaving it unsaid makes a working surface look broken,
          and the alternative — hiding the cards — would hide the only measured thing on the page.
          Simline grammar (10px, faint, dot-separated), because this is a disclosure, not prose. */}
      {applied ? (
        <div className="mt-4 text-[10px] leading-[1.5]" style={{ color: TONE.faint }}>
          Everything below is measured on the clip as posted · the trim is projected, not re-simulated
        </div>
      ) : null}
      {/* ◇ the driver axis. The attention scrubber is NOT here: retention is what the room DID with
          the clip, so it belongs on Engagement with the video that produced it (owner, twice). */}
      {driver.kind === "reason-breakdown" ? <ReasonsCard data={driver.data} /> : null}
      {driver.kind === "resistance-curve" ? <ResistanceCard data={driver.data} /> : null}
      {brain.signalGrid ? (
        <SignalsCard cells={brain.signalGrid} movers={brain.signalMovers} scale={brain.signalScale ?? brain.signalsBaseline} />
      ) : (
        <SignalRowsCard signals={brain.signals} scale={brain.signalScale ?? brain.signalsBaseline} />
      )}
      {brain.networkBars ? <NetworksCard rows={brain.networkBars} scale={brain.networkScale} /> : null}
      {brain.kpiHeatmap ? <ActivationCard data={brain.kpiHeatmap} /> : null}
      <MethodFoot
        open={methodOpen}
        onToggle={onToggleMethod ?? (() => {})}
        method={method ?? (brain.calibrationNote ? [{ heading: "What this is not", notes: [brain.calibrationNote] }] : undefined)}
        simline={simline}
      />
    </div>
  );
}
