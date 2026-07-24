"use client";

/**
 * AmbientDetail — Ambient Audience v2, the DETAIL view (one stimulus, two tabs).
 *
 * L3 two-page instrument: `The brain` (out-Sapient) | `The audience` (out-AS). Detail is ALWAYS
 * one stimulus (comparison lives on the Overview). Shared header: back-to-overview · `N of M`
 * pager · the verdict hero · tab switch. Same fixed height as every v2 surface.
 *
 * Round-4 grammar, with the owner's mark applied: the little bar-chart glyph beside the % is GONE
 * (it added no value — build handoff §4). The verdict stands alone as the biggest type = the answer.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BrainFrame } from "./BrainTab";
import { PopulationFrame } from "./AudienceTab";
import type { DomainTemplate } from "./domain-template";
import { useCountUp } from "@/hooks/useCountUp";

// ── view-model ───────────────────────────────────────────────────────────────

export interface AttentionData {
  hold: number;
  transcript: string;
  peakWordIndex: number;
  clipSeconds: number;
  points: number[]; // 0..80 attention over the clip
  moments: { t: string; v: number; dip?: boolean }[];
}

export interface SignalRow {
  label: string;
  score: number; // 0..100
  band: "strong" | "okay" | "weak";
  vsBase?: number; // #8 — delta vs the domain baseline (see BrainFrameData.signalsBaseline); anchors the score
}

export interface NetworkRow {
  label: string;
  z: number; // z-score σ — kept as the quiet receipt (credibility), no longer the row's headline
  read: string; // P2: the plain-word state — "scattered, won't lock on" (translate σ, don't jargon it)
  loss?: boolean;
}

/** One taste cluster on the terrain (nodes = people, 1 node ≈ 10 agents). */
export interface TerrainCluster {
  name: string;
  cx: number; // layout anchor in the 380×210 terrain viewBox
  cy: number;
  spread: number;
  n: number; // nodes in this cluster
  lit: number; // 0..1 share that stopped (lights the cluster)
}

/** Attention tri-state split (%). NOTE: the live engine's attention axis is binary stop/scroll —
 *  the "skimmed" middle is a NEW contract (build handoff §6); r4 fixture carries it as the target. */
export interface TriState {
  stopped: number;
  skimmed: number;
  scrolled: number;
}

export interface SegmentStop {
  label: string;
  pct: number;
  loss?: boolean; // the loudest-no segment (coral)
}

/** A coded objection/endorsement — the reason speaks for N; the persona is its exemplar voice. */
export interface CodedReason {
  label: string;
  count: number;
  quote: string; // serif verbatim
  who: string; // "Maya · skeptic"
  loss?: boolean; // the dominant objection (coral count)
  /** Cross-tab thread — this human reason IS a brain moment. `toMoment` matches a brain
   *  `whyThisSecond.moment` ("0:04 · the drop"); rendered as a tappable link that jumps to the
   *  brain tab and flashes that moment. The audience "why" and the brain "why" are one story. */
  thread?: { toMoment: string };
}

// shared r4 tone system
export const TONE = {
  cream: "#ece7de",
  dim: "rgba(236,231,222,.62)",
  faint: "rgba(236,231,222,.38)",
  ghost: "rgba(236,231,222,.16)",
  coral: "#FF6363",
  border: "rgba(255,255,255,.06)",
  hair: "rgba(255,255,255,.08)",
  well: "#262624",
} as const;

// shared kicker — quiet, airy small-caps chrome (premium restraint: a whisper, not a shout)
export function Kick({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.15em]">
      <span style={{ color: "rgba(236,231,222,.32)" }}>{children}</span>
      {tag ? <span style={{ color: "rgba(236,231,222,.24)", letterSpacing: "0.1em" }}>{tag}</span> : null}
    </div>
  );
}

export function SecHead({
  q,
  ownLabel,
  ownValue,
  weak,
}: {
  q: string;
  ownLabel: string;
  ownValue: string;
  weak?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-baseline justify-between">
      <span className="text-[15px] font-medium" style={{ color: TONE.cream }}>
        {q}
      </span>
      <span className="text-[13px]" style={{ color: TONE.faint }}>
        {ownLabel}{" "}
        <b className="text-[16px] font-medium" style={{ color: weak ? TONE.coral : TONE.cream }}>
          {ownValue}
        </b>
      </span>
    </div>
  );
}

export function HowToRead() {
  return (
    <button
      type="button"
      className="mt-[30px] flex w-full items-center justify-between pt-4 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors"
      style={{ borderTop: `1px solid ${TONE.border}`, color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.dim)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      <span>How to read these numbers</span>
      <span>›</span>
    </button>
  );
}

// ── shared: the verdict chip (rides ON the hero figure) + the UNLOCK (the cheat code) ──

/** Split a pre-formatted verdict ("38.2%", "$24") into a countable number + its prefix/suffix, so
 *  the chip can count UP to it as the society resolves. Preserves the decimal precision of the source
 *  (38.2 → one decimal) by scaling. Returns null when there is no number to animate. */
function parseVerdictValue(
  value: string,
): { prefix: string; to: number; scale: number; decimals: number; suffix: string } | null {
  const m = value.match(/^(\D*)([\d.]+)(.*)$/);
  if (!m) return null;
  const prefix = m[1] ?? "";
  const numStr = m[2] ?? "";
  const suffix = m[3] ?? "";
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return null;
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  const scale = 10 ** decimals;
  return { prefix, to: Math.round(num * scale), scale, decimals, suffix };
}

function AnimatedVerdictValue({
  parsed,
  className,
  color,
}: {
  parsed: NonNullable<ReturnType<typeof parseVerdictValue>>;
  className: string;
  color: string;
}) {
  const { prefix, to, scale, decimals, suffix } = parsed;
  const display = useCountUp({
    to,
    duration: 1.4,
    format: (v) => `${prefix}${(v / scale).toFixed(decimals)}${suffix}`,
  });
  return (
    <motion.span className={className} style={{ color }}>
      {display}
    </motion.span>
  );
}

/** The verdict rides as a chip on the hero figure (the figure is the hero, not a big fixed number).
 *  Bottom-left, on a scrim so it reads over the cortex/terrain. When `animate`, the number counts up
 *  as the figure resolves (the terrain cascade) — `useCountUp` self-disables on reduced-motion. */
export function VerdictChip({ verdict, animate = false }: { verdict: { value: string; label: string }; animate?: boolean }) {
  const parsed = animate ? parseVerdictValue(verdict.value) : null;
  const valueCls = "text-[24px] font-light leading-none tracking-[-0.01em] tabular-nums";
  return (
    <div
      className="absolute bottom-2.5 left-2.5 flex items-baseline rounded-[10px] px-2.5 py-1.5"
      style={{ background: "rgba(20,20,19,.82)" }}
    >
      {parsed ? (
        <AnimatedVerdictValue parsed={parsed} className={valueCls} color={TONE.cream} />
      ) : (
        <span className={valueCls} style={{ color: TONE.cream }}>
          {verdict.value}
        </span>
      )}
      <span className="ml-1.5 text-[12px]" style={{ color: TONE.faint }}>
        {verdict.label}
      </span>
    </div>
  );
}

/** THE UNLOCK — the brain tab's closing payoff (the "so do this" after the analysis). De-boxed per
 *  the grammar law (the old bordered box squeezed the lever against the gain and read as slop); set
 *  apart instead by a hairline rule + type weight, STACKED so nothing competes for a line: lever →
 *  gain → the counterintuitive why. Never coral — a fix is a win. Brain-only (a timing/price lever
 *  makes no sense on the audience "who" page). */
export function Unlock({ unlock }: { unlock: { lever: string; gain?: string; insight: string } }) {
  return (
    <div className="mt-9 pt-6" style={{ borderTop: `1px solid ${TONE.border}` }}>
      {/* editorial kicker — a small-caps label that trails into a hairline, so the takeaway reads set-apart */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: TONE.faint }}>
          the unlock
        </span>
        <span className="h-px flex-1" style={{ background: TONE.border }} />
      </div>
      <div className="mt-3.5 text-[19px] font-medium leading-[1.32]" style={{ color: TONE.cream }}>
        {unlock.lever}
      </div>
      {unlock.gain ? (
        // the payoff, framed as the takeaway — the card's value peak (never coral: a fix is a win).
        // Labelled "projected" so the modeled swing is honest at a glance; the calibration line carries the rest.
        <div
          className="mt-4 inline-flex items-center gap-2.5 rounded-[10px] py-2 pl-3 pr-3.5"
          style={{ background: TONE.well, border: `1px solid ${TONE.hair}` }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: TONE.faint }}>
            projected
          </span>
          <span className="h-3.5 w-px" style={{ background: TONE.hair }} />
          <span className="font-mono text-[15px] font-medium tabular-nums" style={{ color: TONE.cream }}>
            {unlock.gain}
          </span>
        </div>
      ) : null}
      <p className="mt-4 text-[13.5px] leading-[1.55]" style={{ color: TONE.dim }}>
        {unlock.insight}
      </p>
    </div>
  );
}

// ── the detail view ──────────────────────────────────────────────────────────

type Tab = "brain" | "audience";

export function AmbientDetail({
  template,
  initialTab,
  reducedMotion = false,
  onBack,
  className,
  brainNote,
  populationNote,
}: {
  template: DomainTemplate;
  initialTab?: Tab;
  reducedMotion?: boolean;
  /** Omit to render no back affordance at all — a back button that goes nowhere is a dead control. */
  onBack?: () => void;
  className?: string;
  /** When set (or `template.brain` is absent), the brain read is UNAVAILABLE — a text/concept sim has
   *  no attention/craft decomposition. The brain tab shows this honest line and the view opens on the
   *  audience tab. NEVER a fabricated brain figure. */
  brainNote?: string;
  /** The `population === null` counterpart to `brainNote`. Absent population has more than one honest
   *  cause — no run yet, or a run whose audience read is deliberately WITHHELD (the /go walkthrough's
   *  teaser wall) — and "no run yet" is the wrong sentence for the second. Says which, in the caller's
   *  words. NEVER a fabricated population figure either way. */
  populationNote?: string;
}) {
  const { backLabel, pager, verdict, unlock, brain, population } = template;
  // Brain is a VIDEO producer — absent for a text sim. Honest-unavailable, never faked.
  const brainAvailable = !!brain && !brainNote;
  const [tab, setTab] = useState<Tab>(initialTab ?? (brainAvailable ? "brain" : "audience"));
  // Cross-tab thread — a coded reason on the audience tab jumps here to the brain and briefly flashes
  // the matching moment (the human "why" and the mechanical "why" are one story). Cleared after the
  // flash so it doesn't re-trigger on a later manual visit.
  const [flashMoment, setFlashMoment] = useState<string | null>(null);

  useEffect(() => {
    if (!flashMoment) return;
    const id = setTimeout(() => setFlashMoment(null), 2200);
    return () => clearTimeout(id);
  }, [flashMoment]);

  return (
    <div
      data-testid="ambient-detail"
      className={`flex w-full max-w-[440px] flex-col ${className ?? ""}`}
      style={{
        // Connected rail — mirrors AmbientOverview's root exactly: fills its column top-to-bottom (part
        // of the thread page, NOT a floating card), same darker #181817 tone, a single left hairline
        // divider, no rounding, no full border, no shadow (owner call 2026-07-24 — the Brain/Audience
        // detail must read as the SAME surface as the Overview it drills from).
        height: "100%",
        background: "#181817",
        borderLeft: `1px solid ${TONE.border}`,
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* slim top bar — nav + tabs only. The heavy verdict/move block is gone; the hero FIGURE leads
          each tab (owner mark: the brain is the hero on brain, the nodes on audience). */}
      <div className="px-[22px] pt-[22px]">
        <div className="flex items-baseline justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-[13px] transition-colors"
              style={{ color: TONE.faint }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
            >
              ← {backLabel}
            </button>
          ) : (
            <span />
          )}
          <span className="font-mono text-[12px] tracking-[0.06em]" style={{ color: TONE.faint }}>
            {pager}
          </span>
        </div>

        {/* tabs */}
        <div className="mt-[18px] flex gap-[22px]" style={{ borderBottom: `1px solid ${TONE.border}` }}>
          {(["brain", "audience"] as const).map((t) => {
            const on = t === tab;
            // Honest locked affordance: a text sim has no brain, and a withheld/absent run has no
            // audience. Dimming says "this tab has nothing behind it" before the tap, not after.
            const dim = (t === "brain" && !brainAvailable) || (t === "audience" && !population);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="relative pb-2.5 text-[14px]"
                style={{ color: on ? TONE.cream : TONE.faint, opacity: dim && !on ? 0.5 : 1 }}
              >
                {t === "brain" ? "The brain" : "The audience"}
                {on ? (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: TONE.cream }} />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* body — the hero figure leads (frame renders hero + chip → unlock → detail) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[26px]">
        {tab === "brain" ? (
          brainAvailable && brain ? (
            <BrainFrame brain={brain} verdict={verdict} unlock={unlock} reducedMotion={reducedMotion} flashMoment={flashMoment} />
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center"
              style={{ color: TONE.faint }}
            >
              <span className="text-[13px]" style={{ color: TONE.dim }}>
                The brain — a video read
              </span>
              <span className="max-w-[280px] text-[12.5px] leading-[1.5]">
                {brainNote ?? "The brain decomposition reads a video's frames. This was a text concept sim — no attention timeline to show."}
              </span>
            </div>
          )
        ) : population ? (
          <PopulationFrame
            population={population}
            verdict={verdict}
            reducedMotion={reducedMotion}
            onJumpToBrain={(moment) => {
              // Only cross to the brain when it exists (a video read); otherwise stay on the audience.
              if (!brainAvailable) return;
              setFlashMoment(moment);
              setTab("brain");
            }}
          />
        ) : (
          <div
            className="flex h-full items-center justify-center py-16 text-center text-[13px]"
            style={{ color: TONE.faint }}
          >
            {populationNote ?? "The audience — no run yet."}
          </div>
        )}
      </div>
    </div>
  );
}
