"use client";

/**
 * AmbientOverview — Ambient Audience v2, surface ① (the room's home).
 *
 * Round-4 grammar (`.scratch/panel-v6-round4.html`), built in real code + a 2026-07-22 premium pass:
 *   room header (rest) · SIMULATING-NOW live card · RANKED screening list · cast on call.
 *
 * Design laws honored:
 *  - Sapient DE-BOX: hairline dividers, no bordered tiles (the one live card earns its hairline).
 *  - Section = mono kicker + human question + owning number.
 *  - Cream is the room; coral is only where you lose them (the loudest-no row).
 *  - Sealed verdicts during watching — staged progress is honest, never a fabricated partial.
 *  - Words are the enemy; motion is simulation physics (staged fill + a travelling scan report
 *    real progress; the ranked bars settle in on mount, they do not perform).
 *
 * Premium pass (2026-07-22):
 *  - Live card: a breathing live dot, a travelling cream scan over the fill, a connected stage
 *    stepper (replacing four loose words), and a sealed-lock affordance that reveals the verdict.
 *  - Ranked selector: rank numerals, a settle-in cascade, sharper hover, and — per owner ask —
 *    each row now SHOWS its run state (sealed vs queued) instead of one blanket "simulated" tag.
 *
 * Reuse note: a clean composition of the round-4 anatomy — it deliberately does NOT drag in
 * `audience-presence`'s switcher/portal apparatus. Data shapes mirror the live contract.
 */

import { useEffect, useRef, useState } from "react";

// ── view-model ───────────────────────────────────────────────────────────────

/** Fidelity tier (L5): SIM-1 Flash n=1,000 / SIM-1 Max n=10,000. */
export type SimTier = "flash" | "max";

/** Run provenance of a ranked row. `simulated` = a sealed result (default). `queued` = added
 *  but not yet run (shown as an honest absence, never a fabricated score). */
export type RankState = "simulated" | "queued";

/** What KIND of thing was screened — so a mixed board (hooks + ideas + a video test…) is legible
 *  at a glance. Surfaced as a small mono kind chip per row. */
export type RankKind = "hook" | "idea" | "video" | "script" | "remix" | "concept";

/** One screened stimulus in the ranked list. `stopPct` = the audience's would-stop % (sealed
 *  rows, ranked; the top is the win). `personaStops` = how many of 10 personas would stop at
 *  GENERATION — queued rows are already ranked by it before the audience runs, so they carry
 *  their own rank + bar (a persona estimate, not a measured verdict, shown muted). */
export interface RankedStimulus {
  id: string;
  stimulus: string;
  stopPct: number;
  personaStops?: number; // 0–10 — generation-time personas who would stop (queued rows)
  viralScore?: number | null; // VIDEO rows only — the tested video's native craft/viral score (0–100),
  //  shown in place of a projection. Distinct from the attention % (which appears only once simulated).
  kind?: RankKind;
  state?: RankState; // defaults to "simulated"
}

/** A run in flight. Verdict is SEALED until every agent decides; `verdictPct` reveals then. */
export interface WatchingRun {
  stimulus: string;
  verdictPct?: number;
}

export interface CastMember {
  id: string;
  initial: string;
}

export interface OverviewData {
  audienceName: string;
  provenance: string; // "calibrated · 3d"
  tier: SimTier;
  watching?: WatchingRun | null; // null ⇒ rest state (no run)
  ranked: RankedStimulus[];
  cast: CastMember[];
  castOverflow?: number;
}

/** Shared fixed height across all three v2 surfaces (build handoff §4 — "same fixed height"). */
export const AMBIENT_PANEL_HEIGHT = 800;

/**
 * How a v2 surface is mounted.
 *  - `rail` (default) — the ≥xl right column: fills top-to-bottom, capped at 440, its own left
 *    hairline divides it from the thread, paints its own #181817 ground.
 *  - `sheet` — the <xl mobile header sheet: full-bleed inside a host that already owns the ground,
 *    the rounding and the height cap, so the surface drops its width cap, hairline and background
 *    and simply flexes to the space the sheet gives it. Tighter gutters for a ~390px viewport.
 *
 * This is a PRESENTATION switch only — every surface renders the same anatomy and the same real
 * data in both modes (the mobile room must not become a second, lesser room).
 */
export type AmbientPresentation = "rail" | "sheet";

/** Horizontal gutter per presentation — 26px reads generous in a 400px rail, cramped at 390 - 52. */
export const ambientGutter = (p: AmbientPresentation) => (p === "sheet" ? "px-[18px]" : "px-[26px]");

const TIER_N: Record<SimTier, number> = { flash: 1000, max: 10000 };
const TIER_LABEL: Record<SimTier, string> = { flash: "sim-1 flash", max: "sim-1 max" };

/** Deterministic thousands separator — `toLocaleString()` is locale-dependent (SSR/client drift). */
const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// r4 tone system (mirrors the sketch :root — kept local for pixel fidelity to the target).
const TONE = {
  cream: "#ece7de",
  dim: "rgba(236,231,222,.62)",
  faint: "rgba(236,231,222,.38)",
  ghost: "rgba(236,231,222,.16)",
  mute: "rgba(236,231,222,.25)",
  sage: "#8ea68a", // --color-positive: the winning bar (the best would-stop)
  border: "rgba(255,255,255,.06)",
  hair: "rgba(255,255,255,.08)",
  hover: "rgba(255,255,255,.03)",
} as const;

// The ranked bars measure against "half the room stops" as the visual full — gives low-ish
// stop-rates room to differentiate without inflating them. Refined live if it reads wrong.
const BAR_REF = 50;

// ── small primitives (r4 grammar) ────────────────────────────────────────────

function Kicker({
  children,
  tag,
  live,
}: {
  children: React.ReactNode;
  tag?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[12px] uppercase tracking-[0.08em]">
      <span className="flex items-center gap-2" style={{ color: TONE.faint }}>
        {live ? (
          <span
            className="ambient-live-pulse inline-block h-[6px] w-[6px] flex-none translate-y-[-1px] rounded-full"
            style={{ background: TONE.cream }}
          />
        ) : null}
        {children}
      </span>
      {tag ? (
        <span style={{ color: "rgba(236,231,222,.28)", letterSpacing: "0.06em" }}>{tag}</span>
      ) : null}
    </div>
  );
}

/** The sealed padlock — the verdict is withheld until n-of-n decide (design law: sealed). */
function SealGlyph({ color }: { color: string }) {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden style={{ color }}>
      <rect x="1.25" y="5" width="7.5" height="6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ── stage stepper (connected rail, live node breathes) ───────────────────────

const STAGES = ["reading", "brains", "votes", "verdict"] as const;
const CUTS = [0.12, 0.55, 0.96, 1.01];

function StageStepper({ liveStage, complete }: { liveStage: number; complete: boolean }) {
  return (
    <div className="mt-4 flex items-start">
      {STAGES.map((s, i) => {
        const done = complete || i < liveStage;
        const live = !complete && i === liveStage;
        const first = i === 0;
        const last = i === STAGES.length - 1;
        return (
          <div key={s} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className="h-px flex-1"
                style={{ background: first ? "transparent" : done || live ? TONE.faint : TONE.ghost }}
              />
              <span
                className={live ? "animate-stage-breathe" : ""}
                style={{
                  flex: "none",
                  width: done || live ? 7 : 6,
                  height: done || live ? 7 : 6,
                  borderRadius: 9999,
                  background: done || live ? TONE.cream : "transparent",
                  border: done || live ? "none" : `1px solid ${TONE.mute}`,
                }}
              />
              <span
                className="h-px flex-1"
                style={{ background: last ? "transparent" : done ? TONE.faint : TONE.ghost }}
              />
            </div>
            <span
              className="mt-2 font-mono text-[11px] tracking-[0.04em] transition-colors duration-300"
              style={{ color: live ? TONE.cream : done ? TONE.faint : TONE.mute }}
            >
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── watching card (staged fill, travelling scan, sealed verdict) ─────────────

function WatchingCard({
  run,
  tier,
  reducedMotion,
}: {
  run: WatchingRun;
  tier: SimTier;
  reducedMotion: boolean;
}) {
  const n = TIER_N[tier];
  const fillRef = useRef<HTMLSpanElement>(null);
  // Reduced-motion renders a single static mid-run frame (~62%); lazy-init avoids
  // setState-in-effect. Live motion's only setState is inside the rAF callback below.
  const [decided, setDecided] = useState(() => (reducedMotion ? Math.round(0.62 * n) : 0));
  const [liveStage, setLiveStage] = useState(() => (reducedMotion ? 2 : 0));
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      if (fillRef.current) fillRef.current.style.transform = "scaleX(0.62)";
      return;
    }
    let raf = 0;
    let start = 0;
    let lastD = -1;
    let lastStage = -1;
    let lastComplete: boolean | null = null;
    const DUR = 9000;
    const HOLD = 2400;
    const loop = (now: number) => {
      if (!start) start = now;
      const el = (now - start) % (DUR + HOLD);
      const p = Math.min(el / DUR, 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      const d = p < 1 ? Math.round(p * n) : n;
      if (d !== lastD) {
        lastD = d;
        setDecided(d);
      }
      const s = p >= CUTS[2]! ? 3 : p >= CUTS[1]! ? 2 : p >= CUTS[0]! ? 1 : 0;
      if (s !== lastStage) {
        lastStage = s;
        setLiveStage(s);
      }
      const c = p >= 1;
      if (c !== lastComplete) {
        lastComplete = c;
        setComplete(c);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, n]);

  return (
    <div
      className="ambient-row-in mt-3 rounded-[12px] p-4"
      style={{ border: `1px solid ${TONE.hair}`, background: "rgba(236,231,222,.02)" }}
    >
      <div
        className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] leading-snug"
        style={{ color: TONE.cream }}
      >
        {run.stimulus}
      </div>

      {/* progress track — cream fill (rAF via transform) + a travelling cream scan for liveness */}
      <div
        className="relative mt-4 h-[5px] overflow-hidden rounded-full"
        style={{ background: TONE.ghost }}
      >
        <span
          ref={fillRef}
          className="absolute inset-0 block origin-left rounded-full"
          style={{ background: TONE.cream, opacity: 0.85, transform: "scaleX(0)" }}
        />
        {!complete ? (
          <span
            className="ambient-fill-flow absolute inset-y-0 left-0 block w-1/3 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.9) 50%, transparent 100%)",
            }}
          />
        ) : null}
      </div>

      {/* connected stage stepper: reading · brains · votes · verdict */}
      <StageStepper liveStage={liveStage} complete={complete} />

      {/* meta: N decided · sealed → verdict on complete */}
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span className="tabular-nums" style={{ color: TONE.faint }}>
          {complete
            ? `${withCommas(n)} of ${withCommas(n)}`
            : `${withCommas(decided)} of ${withCommas(n)} decided`}
        </span>
        {complete && run.verdictPct != null ? (
          <span className="tabular-nums text-[14px] font-medium" style={{ color: TONE.cream }}>
            {run.verdictPct}% <span className="text-[12px] font-normal" style={{ color: TONE.dim }}>would stop</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.06em]" style={{ color: TONE.dim }}>
            <SealGlyph color={TONE.faint} />
            sealed
          </span>
        )}
      </div>
    </div>
  );
}

// ── ranked row ───────────────────────────────────────────────────────────────

/** A kind chip — a small mono tag so a mixed board (hook / idea / video …) is legible at a glance. */
function KindChip({ kind, dim }: { kind: RankKind; dim?: boolean }) {
  return (
    <span
      className="flex-none font-mono text-[10.5px] uppercase tracking-[0.06em]"
      style={{ color: dim ? TONE.mute : TONE.faint }}
    >
      {kind}
    </span>
  );
}

/** A SEALED result row — ranked, clickable into the detail/brain. */
function SealedRow({
  rank,
  r,
  index,
  onOpen,
}: {
  rank: number;
  r: RankedStimulus;
  index: number;
  onOpen?: (id: string) => void;
}) {
  const w = Math.min(1, r.stopPct / BAR_REF);
  const top = rank === 1;

  return (
    <li className="ambient-row-in" style={{ animationDelay: `${0.04 + index * 0.05}s` }}>
      <button
        type="button"
        onClick={() => onOpen?.(r.id)}
        className="group block w-full cursor-pointer rounded-[8px] px-2 py-3.5 text-left transition-colors"
        style={{ borderBottom: `1px solid ${TONE.border}` }}
        onMouseEnter={(e) => (e.currentTarget.style.background = TONE.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span className="flex items-baseline gap-3">
          <span
            className="w-[14px] flex-none tabular-nums font-mono text-[12px]"
            style={{ color: top ? TONE.dim : TONE.faint }}
          >
            {rank}
          </span>
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
            style={{ color: TONE.cream, opacity: top ? 1 : 0.88 }}
          >
            {r.stimulus}
          </span>
          {r.kind ? <KindChip kind={r.kind} /> : null}
          {/* a tested video keeps its native viral score in view — the % is the audience read on top */}
          {r.kind === "video" && r.viralScore != null ? (
            <span
              className="flex-none font-mono text-[10.5px] uppercase tracking-[0.06em]"
              style={{ color: TONE.faint }}
            >
              {r.viralScore} viral
            </span>
          ) : null}
          <span className="flex-none tabular-nums text-[14px] font-medium" style={{ color: TONE.cream }}>
            {r.stopPct.toFixed(1)}%
          </span>
        </span>

        <span
          className="relative mt-2.5 ml-[26px] block h-[3px] overflow-hidden rounded-full transition-[filter] group-hover:brightness-110"
          style={{ background: TONE.ghost }}
        >
          {/* the top would-stop is the win — its bar goes sage-green; the rest hold cream */}
          <span
            className="absolute inset-0 block origin-left rounded-full"
            style={{ transform: `scaleX(${w})`, background: top ? TONE.sage : "rgba(236,231,222,.55)" }}
          />
        </span>
      </button>
    </li>
  );
}

/** A QUEUED row — ranked at GENERATION by the personas (N of 10 would stop), not yet run past the
 *  audience. Same anatomy as a sealed row (rank · stimulus · kind · value · bar-under) so the two
 *  groups read as one system; the bar is MUTED (a persona estimate, not a measured verdict) and
 *  the whole row is the quick-simulate door — the value slot reveals `Simulate →` on hover. */
function QueuedRow({
  rank,
  r,
  index,
  onSimulate,
}: {
  rank: number;
  r: RankedStimulus;
  index: number;
  onSimulate?: (id: string) => void;
}) {
  const n = r.personaStops ?? 0;
  // A VIDEO carries a native viral score (0–100), not a persona estimate — its native slot shows that
  // and its bar measures against 100. A concept shows N/10. Both swap to "Simulate →" on hover.
  const isVideo = r.kind === "video";
  const viral = r.viralScore ?? null;
  const w = isVideo && viral != null ? Math.min(1, viral / 100) : Math.min(1, n / 10);

  return (
    <li className="ambient-row-in" style={{ animationDelay: `${0.04 + index * 0.05}s` }}>
      <button
        type="button"
        onClick={() => onSimulate?.(r.id)}
        className="group block w-full cursor-pointer rounded-[8px] px-2 py-3.5 text-left transition-colors"
        style={{ borderBottom: `1px solid ${TONE.border}` }}
        onMouseEnter={(e) => (e.currentTarget.style.background = TONE.hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span className="flex items-baseline gap-3">
          <span className="w-[14px] flex-none tabular-nums font-mono text-[12px]" style={{ color: TONE.mute }}>
            {rank}
          </span>
          <span
            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
            style={{ color: TONE.cream, opacity: 0.62 }}
          >
            {r.stimulus}
          </span>
          {r.kind ? <KindChip kind={r.kind} dim /> : null}
          {/* value slot — the native score stays put (the Simulate cue is its own persistent line
              below, so it reads on every device, not just on hover) */}
          <span className="flex-none text-right tabular-nums text-[13px]" style={{ color: TONE.dim }}>
            {isVideo && viral != null ? (
              <>
                {viral}
                <span className="ml-1 text-[10px] uppercase tracking-[0.06em]" style={{ color: TONE.mute }}>
                  viral
                </span>
              </>
            ) : (
              <>
                {n}
                <span className="text-[11px]" style={{ color: TONE.mute }}>
                  /10
                </span>
              </>
            )}
          </span>
        </span>

        {/* bar — the native estimate (concept N/10 · video viral score), muted (not a measured verdict) */}
        <span
          className="relative mt-2.5 ml-[26px] block h-[3px] overflow-hidden rounded-full"
          style={{ background: TONE.ghost }}
        >
          <span
            className="absolute inset-0 block origin-left rounded-full"
            style={{ transform: `scaleX(${w})`, background: "rgba(236,231,222,.34)" }}
          />
        </span>

        {/* the Simulate cue — its own persistent line on EVERY device (hover-reveal hid it from touch
            users and buried it on desktop). Brightens with the row on hover for a pointer affordance. */}
        <span
          className="mt-2.5 ml-[26px] flex items-center gap-1.5 border-t pt-2 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors group-hover:text-[#ece7de]"
          style={{ borderColor: TONE.hair, color: TONE.dim }}
        >
          Simulate&nbsp;→
        </span>
      </button>
    </li>
  );
}

// ── room header glyph — a calm audience cluster (people, not a sparkline) ─────
// The old constellation's connecting lines read as a stock line-chart. This is a small crowd of
// cream nodes at varied depth (opacity), no lines — reads as "your room of people". Static: the
// only live motion on the surface belongs to the run in flight (SIMULATING NOW), so the mark stays
// calm and doesn't compete.

function RoomGlyph() {
  return (
    <svg viewBox="0 0 20 16" className="h-[15px] w-[18px] flex-none" aria-hidden>
      <circle cx="4" cy="11" r="2" fill="#ece7de" opacity=".9" />
      <circle cx="9.5" cy="6" r="2" fill="#ece7de" opacity=".62" />
      <circle cx="14.5" cy="11.5" r="1.9" fill="#ece7de" opacity=".78" />
      <circle cx="16.5" cy="5" r="1.5" fill="#ece7de" opacity=".4" />
    </svg>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientOverview({
  data,
  reducedMotion = false,
  onOpenStimulus,
  onQuickSimulate,
  onTestVariant,
  presentation = "rail",
  className,
}: {
  data: OverviewData;
  reducedMotion?: boolean;
  onOpenStimulus?: (id: string) => void;
  onQuickSimulate?: (id: string) => void;
  onTestVariant?: () => void;
  presentation?: AmbientPresentation;
  className?: string;
}) {
  const { audienceName, provenance, tier, watching, ranked, cast, castOverflow } = data;
  const sheet = presentation === "sheet";
  const gutter = ambientGutter(presentation);

  // Split the board: SEALED results on top (ranked high→low), the un-run QUEUED ones below.
  const sealed = ranked
    .filter((r) => r.state !== "queued")
    .sort((a, b) => b.stopPct - a.stopPct);
  const queued = ranked
    .filter((r) => r.state === "queued")
    .sort((a, b) => (b.personaStops ?? 0) - (a.personaStops ?? 0));

  return (
    <div
      data-testid="ambient-overview"
      data-presentation={presentation}
      className={
        (sheet
          ? // Sheet: the host bar owns the ground, the rounding and the height cap; the surface just
            // flexes into it (min-h-0 so its scroll region can shrink below content height).
            "flex min-h-0 w-full flex-1 flex-col"
          : "flex w-full max-w-[440px] flex-col") + ` ${className ?? ""}`
      }
      style={{
        // Connected rail — fills its column top-to-bottom (part of the thread page, NOT a floating
        // card). A single left hairline divides it from the thread; no shadow, no rounding, no gaps.
        // Sheet mode inherits all three from its host instead.
        ...(sheet
          ? {}
          : { height: "100%", background: "#181817", borderLeft: `1px solid ${TONE.border}` }),
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* room header — audience mark · name · calibration chip · switch caret. Omitted in sheet
          mode: the mobile bar the sheet hangs from ALREADY carries this exact identity, and the
          legacy header's sin was saying the audience's name twice in 60 vertical pixels. */}
      {sheet ? null : (
      <div className="flex items-center gap-2.5 px-[26px] pt-[26px]">
        <RoomGlyph />
        <span className="text-[16px] font-semibold tracking-[-0.015em]">{audienceName}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ color: TONE.faint, border: `1px solid ${TONE.hair}` }}
        >
          <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: TONE.dim }} />
          {provenance}
        </span>
        <button
          type="button"
          aria-label="Switch audience"
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full transition-colors"
          style={{ color: TONE.faint }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = TONE.cream;
            e.currentTarget.style.background = TONE.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = TONE.faint;
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
            <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      )}

      {/* scroll region — watching + ranked */}
      <div className={`min-h-0 flex-1 overflow-y-auto ${gutter}`}>
        {watching ? (
          <div className="mt-8">
            <Kicker tag={TIER_LABEL[tier]} live>
              Simulating now
            </Kicker>
            <WatchingCard run={watching} tier={tier} reducedMotion={reducedMotion} />
          </div>
        ) : null}

        <div className="mt-8">
          <Kicker tag={`${sealed.length} sealed`}>Ranked · would they stop</Kicker>
          <ul className="mt-1.5">
            {sealed.map((r, i) => (
              <SealedRow key={r.id} rank={i + 1} r={r} index={i} onOpen={onOpenStimulus} />
            ))}
          </ul>

          {/* the un-run group — split below, an honest waiting-room with a quick-simulate door */}
          {queued.length > 0 ? (
            <div className="mt-7">
              <Kicker tag={`${queued.length} queued`}>Not simulated yet</Kicker>
              <ul className="mt-1.5">
                {queued.map((r, i) => (
                  <QueuedRow key={r.id} rank={i + 1} r={r} index={sealed.length + i} onSimulate={onQuickSimulate} />
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onTestVariant}
            className="mt-1 w-full cursor-pointer rounded-[8px] px-2 py-3.5 text-left text-[13px] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            ＋ Test a new variant
          </button>
        </div>
      </div>

      {/* cast on call — pinned footer */}
      <div
        className={`${sheet ? "mx-[18px] mb-[18px]" : "mx-[26px] mb-[26px]"} mt-[18px] flex items-center gap-1.5 pt-4`}
        style={{ borderTop: `1px solid ${TONE.border}` }}
      >
        {cast.map((c) => (
          <span
            key={c.id}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px]"
            style={{ background: "#262624", border: "1px solid rgba(255,255,255,.12)", color: TONE.dim }}
          >
            {c.initial}
          </span>
        ))}
        {castOverflow ? (
          <span
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px]"
            style={{ background: "#262624", border: "1px solid rgba(255,255,255,.12)", color: TONE.dim }}
          >
            +{castOverflow}
          </span>
        ) : null}
        <span className="ml-1 text-[12px]" style={{ color: TONE.faint }}>
          on call
        </span>
      </div>
    </div>
  );
}
