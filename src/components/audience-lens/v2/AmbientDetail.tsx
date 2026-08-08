"use client";

/**
 * AmbientDetail — Ambient Audience v2, the DETAIL view (one stimulus, THREE pages).
 *
 * Each page answers ONE question, and a block lives on the page whose question it answers:
 *   Brain — why it happened in the head · Engagement — what they did with it · Audience — who was
 *   in the room. Order is `brain · engagement · audience`: the answer's evidence is the retention
 *   curve so verdict and proof are adjacent, Brain and Engagement are both about the CLIP while
 *   Audience is about the ROOM, and scope widens left to right.
 *
 * Chrome is TikTok Studio's: the pinned strip is the nav row ONLY. Identity renders once above the
 * tabs and scrolls away; the tabs are sticky INSIDE the scroll. The rev-5 "persistent answer, never
 * behind a tab" decision was owner-REVERSED — the answer is content, on Brain, once.
 *
 * Twelve revisions settled these; they are not open:
 *   · the 270px hero figure NEVER shrinks — it is the product's wow, and deleting it killed revs 3–5
 *   · figures may carry a colormap; CHROME stays one-accent, coral = loss, ≤1 zone per page
 *   · benchmarks are the creator's OWN catalogue, never an industry band
 *   · no sentences in the UI: the verdict headline is the surface's one, and cards end on their data
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BrainFrame } from "./BrainTab";
import { EngagementFrame } from "./EngagementTab";
import { PopulationFrame } from "./AudienceTab";
import { SURFACE } from "./rail-kit";
import type { DomainTemplate, DrillFixApplied, DrillIdentity } from "./domain-template";
import type { AmbientPresentation } from "./AmbientOverview";
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

// The r4 chrome that used to live here — `Kick`, `SecHead`, `HowToRead` and the boxed `Unlock` —
// is GONE with the pages that rendered it. It was uppercase-mono micro-labels and hairline rules,
// the exact tell rev 4 was rejected for; rev 12 speaks in filled cards with sentence-case heads,
// a right-meta only where the label IS data, and one shared "How to read these numbers" foot
// (`rail-kit.tsx`). Two grammars for one surface is how the two-namespace drift starts.

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

// ── identity — thumbnail · one-line title · the projected counts ──────────────

const ICONS: Record<DrillIdentity["stats"][number]["kind"], string> = {
  play: "M5 3 19 12 5 21Z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z",
  msg: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.5Z",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  save: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
};

/** Renders ONCE, above the tabs, and scrolls away. rev 8 DEMOTED the stat row: these are
 *  projections for a post that does not exist yet, and at cream they were the loudest data on the
 *  page. The answer has to win the first fixation. */
function Identity({ identity, thumbLabel }: { identity: DrillIdentity; thumbLabel: string }) {
  return (
    <div className="flex items-center gap-[11px] pt-4">
      <div
        className="relative flex h-[54px] w-10 flex-none items-end justify-center overflow-hidden rounded-[7px] pb-1"
        style={{ background: SURFACE.figure }}
      >
        {identity.coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            className="absolute inset-0"
            style={{ background: "repeating-linear-gradient(104deg,#2c2926 0 8px,#232120 8px 16px)", opacity: 0.5 }}
          />
        )}
        <span className="relative text-[10px] font-medium tabular-nums" style={{ color: TONE.faint }}>
          {thumbLabel}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] leading-[1.35]" style={{ color: TONE.dim }}>
          {identity.title}
        </div>
        <div className="mt-[7px] flex items-center gap-3.5">
          {identity.stats.map((s) => (
            <span key={s.kind} className="flex items-center gap-1.5">
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={TONE.cream} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d={ICONS[s.kind]} />
              </svg>
              <b className="text-[11px] font-normal leading-none tabular-nums" style={{ color: TONE.faint }}>
                {s.value}
              </b>
            </span>
          ))}
          {identity.projected ? (
            <span className="ml-auto rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium" style={{ background: SURFACE.chip, color: TONE.faint }}>
              projected
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── the detail view ──────────────────────────────────────────────────────────

export type Tab = "brain" | "engagement" | "audience";

/** The order is load-bearing — see the file header. Changing it is a design decision, not a tidy-up. */
const TAB_ORDER = ["brain", "engagement", "audience"] as const;
/** The v8 verdict report's order (spec §2 + mock §6). OPT-IN via `tabOrder`; the drill keeps
 *  TAB_ORDER, which twelve revisions settled and which this constant does not reopen. */
export const REPORT_TAB_ORDER: readonly Tab[] = ["audience", "brain", "engagement"];
const TAB_LABEL: Record<Tab, string> = { brain: "Brain", engagement: "Engagement", audience: "Audience" };

export function AmbientDetail({
  template,
  initialTab,
  tab: controlledTab,
  reducedMotion = false,
  onBack,
  presentation = "rail",
  className,
  brainNote,
  populationNote,
  noteAction,
  onPrev,
  onNext,
  onInterview,
  onApplyFix,
  tabOrder,
  audienceSlot,
}: {
  template: DomainTemplate;
  initialTab?: Tab;
  /** CONTROLLED tab. Omit for the normal self-managed view (every in-app mount). When set, the
   *  host drives which page is shown and the view stops owning it — added for the /go probe,
   *  which is `inert` and has to VISIT both pages on a timer to show they exist. Driving it by
   *  prop rather than remounting with a `key` is the difference between the body swapping and
   *  the whole pane tearing down and reflowing under the visitor. */
  tab?: Tab;
  reducedMotion?: boolean;
  /** Omit to render no back affordance at all — a back button that goes nowhere is a dead control. */
  onBack?: () => void;
  /** `rail` (≥xl column) vs `sheet` (the <xl header sheet, whose host owns ground/cap). */
  presentation?: AmbientPresentation;
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
  /** Rendered under BOTH honest-absence notes — the sealed drill's one action (the $1 wall CTA).
   *  A slot, not behavior: this view stays ignorant of checkout. Absent ⇒ notes render alone. */
  noteAction?: React.ReactNode;
  /** The room's drills are siblings — ‹ › walks them. Omit both and the stepper does not render:
   *  a pager that cannot page is the same dead control as a back button that goes nowhere. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Talking to a simulated viewer is the most differentiated thing in the product; the frames have
   *  always taken this and the surface finally offers it on every voice. */
  onInterview?: (who: string) => void;
  /** THE FIX ACTS. `template.answer.fix` carries the re-simulated state; this fires when the user
   *  pulls the lever, so a host that can genuinely re-run (the v1 room's `onRewrite`) does. The view
   *  shows the projected before → after either way, labelled `projected`, and `Undo` restores. */
  onApplyFix?: (lever: string) => void;
  /** Tab order override. Omit for the drill's settled `brain · engagement · audience`; the v8
   *  verdict report passes REPORT_TAB_ORDER (spec §2's Audience-first order). */
  tabOrder?: readonly Tab[];
  /** Replaces the Audience page's <PopulationFrame> wholesale. The v8 report's personas-only
   *  grade has real voices and NO Stage-2 projection, so it supplies its own honest frame rather
   *  than a synthesized aggregate. Omit ⇒ today's behaviour exactly. */
  audienceSlot?: React.ReactNode;
}) {
  const { backLabel, pager, verdict, unlock, brain, population, identity, answer, engagement, simline, method } = template;
  // Brain is a VIDEO producer — absent for a text sim. Honest-unavailable, never faked.
  const brainAvailable = !!brain && !brainNote;
  // Engagement is what the room DID with the clip: the retention instrument, the watch metrics and
  // the reaction counts. A template that authors none of it has nothing to show, so the tab dims —
  // the same honest-locked affordance the other two carry, decided before the tap rather than after.
  const engagementData = engagement ?? (population?.actionIntent ? {} : undefined);
  const engagementAvailable = !!engagement || !!population?.actionIntent;
  // An audience SLOT *is* the audience page: a host that supplies one has something real behind
  // the tab even when `population` is null.
  const audienceAvailable = !!audienceSlot || !!population;
  const order = tabOrder ?? TAB_ORDER;
  const [internalTab, setTab] = useState<Tab>(
    initialTab ??
      order.find((t) =>
        t === "brain" ? brainAvailable : t === "engagement" ? engagementAvailable : audienceAvailable,
      ) ??
      order[order.length - 1]!,
  );
  const tab = controlledTab ?? internalTab;

  // The fix's applied state and the method drawer are the view's, not a page's: `setTab` must NOT
  // reset them (walking to the evidence and back is one reading, not two), while a new stimulus
  // remounts the view and clears them by construction.
  const [applied, setApplied] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

  // A NEW stimulus clears the fix. `setTab` deliberately does not — walking to the evidence and
  // back is one reading — but the drill's host swaps `template` in place rather than remounting, so
  // without this you page from a trimmed clip to the next one and read ITS numbers under the
  // previous one's applied state. Keyed on a STABLE identity string, not on the template object:
  // the adapters build a fresh object every render, so `[template]` would clear the fix instantly.
  const stimulusKey = `${template.id}|${template.pager}|${template.verdict.value}|${template.identity?.title ?? ""}`;
  const [seenStimulus, setSeenStimulus] = useState(stimulusKey);
  if (seenStimulus !== stimulusKey) {
    // Adjusted DURING render, not in an effect: an effect would paint the new stimulus once under
    // the old applied state before clearing it.
    setSeenStimulus(stimulusKey);
    setApplied(false);
    setMethodOpen(false);
  }
  const fix = answer?.fix;
  const appliedState: DrillFixApplied | null = applied && fix ? fix.applied : null;
  const bodyRef = useRef<HTMLDivElement>(null);

  const goTab = (t: Tab) => {
    setTab(t);
    // A new page starts at its own top; carrying the previous page's offset lands you mid-figure.
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
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
      data-presentation={presentation}
      className={
        (presentation === "sheet"
          ? "flex min-h-0 w-full flex-1 flex-col"
          : "flex w-full max-w-[440px] flex-col") + ` ${className ?? ""}`
      }
      style={{
        // Connected rail — mirrors AmbientOverview's root exactly: fills its column top-to-bottom (part
        // of the thread page, NOT a floating card), same darker #181817 tone, a single left hairline
        // divider, no rounding, no full border, no shadow (owner call 2026-07-24 — the Brain/Audience
        // detail must read as the SAME surface as the Overview it drills from).
        // Sheet mode inherits ground + cap + rounding from its host bar instead.
        ...(presentation === "sheet"
          ? {}
          : { height: "100%", background: "#181817", borderLeft: `1px solid ${TONE.border}` }),
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* The pinned strip is the NAV ROW ONLY (owner, 7.2: "I don't like this fixed header at all").
          Identity and the tabs live inside the scroll, TikTok Studio's exact chrome. */}
      <div className="px-[22px] pt-5">
        <div className="flex h-5 items-center justify-between">
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
          {/* No pager, no chip. The v8 report is not the drill's pager — an empty pill in the
              nav row reads as a control that lost its label. */}
          {pager ? (
            <span
              data-testid="ambient-detail-pager"
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[12px] font-medium tabular-nums"
              style={{ background: SURFACE.chip, color: TONE.faint }}
            >
              {onPrev ? <Step onClick={onPrev}>‹</Step> : null}
              {pager}
              {onNext ? <Step onClick={onNext}>›</Step> : null}
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[30px]">
        {identity ? <Identity identity={identity} thumbLabel={appliedState?.thumbLabel ?? identity.thumbLabel} /> : null}

        {/* Sticky INSIDE the scroll — it needs an opaque rail fill so content slides under it. */}
        <div className="sticky top-0 z-[6] pt-3" style={{ background: "#181817" }}>
          <div className="flex rounded-[10px] p-[3px]" style={{ background: SURFACE.chip }}>
            {order.map((t) => {
              const on = t === tab;
              // Honest locked affordance: a text sim has no brain, a template with no engagement
              // material has no middle page, and a withheld/absent run has no audience. Dimming says
              // "nothing behind this" BEFORE the tap, not after.
              const dim =
                (t === "brain" && !brainAvailable) ||
                (t === "engagement" && !engagementAvailable) ||
                (t === "audience" && !audienceAvailable);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => goTab(t)}
                  className="flex-1 rounded-lg py-[7px] text-[13px] font-medium"
                  style={{
                    // Active is cream on a lighter fill — never coral. The system reserves the
                    // accent for loss; an interactive state that borrows it flattens the hierarchy.
                    background: on ? SURFACE.chipOn : "transparent",
                    color: on ? TONE.cream : TONE.faint,
                    opacity: dim && !on ? 0.5 : 1,
                  }}
                >
                  {TAB_LABEL[t]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 h-px" style={{ background: TONE.border }} />
        </div>

        {tab === "brain" ? (
          brainAvailable && brain ? (
            <BrainFrame
              brain={brain}
              verdict={verdict}
              answer={answer}
              unlock={unlock}
              applied={appliedState}
              onApplyFix={() => {
                setApplied(true);
                if (fix) onApplyFix?.(fix.label);
              }}
              onUndoFix={() => setApplied(false)}
              // Only when there is evidence to see. A domain whose answer points at a page it never
              // authored (pricing) gets no control at all — the same rule as the back button that
              // goes nowhere.
              onSeeEvidence={
                answer?.evidence === "reasons" || !engagementAvailable ? undefined : () => goTab("engagement")
              }
              reducedMotion={reducedMotion}
              flashMoment={flashMoment}
              method={method}
              methodOpen={methodOpen}
              onToggleMethod={() => setMethodOpen((v) => !v)}
              simline={simline}
            />
          ) : (
            <Absence note={brainNote ?? "The brain decomposition reads a video's frames. This was a text concept sim — no attention timeline to show."} title="The brain — a video read" action={noteAction} />
          )
        ) : tab === "engagement" ? (
          engagementAvailable && engagementData ? (
            <EngagementFrame
              data={engagementData}
              actionIntent={population?.actionIntent}
              applied={appliedState}
              method={method}
              methodOpen={methodOpen}
              onToggleMethod={() => setMethodOpen((v) => !v)}
              simline={simline}
              onInterview={onInterview}
            />
          ) : (
            <Absence note="No run yet — engagement is what the room did with the clip second by second." action={noteAction} />
          )
        ) : audienceSlot ? (
          audienceSlot
        ) : population ? (
          <PopulationFrame
            population={population}
            verdict={verdict}
            reducedMotion={reducedMotion}
            onInterview={onInterview}
            method={method}
            methodOpen={methodOpen}
            onToggleMethod={() => setMethodOpen((v) => !v)}
            simline={simline}
            onJumpToBrain={(moment) => {
              // Only cross to the brain when it exists (a video read); otherwise stay on the audience.
              if (!brainAvailable) return;
              setFlashMoment(moment);
              goTab("brain");
            }}
          />
        ) : (
          <Absence note={populationNote ?? "The audience — no run yet."} action={noteAction} />
        )}
      </div>
    </div>
  );
}

function Step({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-1 text-[13px] font-normal leading-none transition-colors"
      style={{ color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      {children}
    </button>
  );
}

/** An honest-absence state. NEVER a fabricated figure: what is locked or missing is genuinely not in
 *  the rendered template, so there is nothing on screen to "reveal". */
function Absence({ note, title, action }: { note: string; title?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center" style={{ color: TONE.faint }}>
      {title ? (
        <span className="text-[13px]" style={{ color: TONE.dim }}>
          {title}
        </span>
      ) : null}
      <span className="max-w-[280px] text-[12px] leading-[1.5]">{note}</span>
      {action}
    </div>
  );
}
