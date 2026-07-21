"use client";

/**
 * AmbientOverview — Ambient Audience v2, surface ① (the room's home).
 *
 * Round-4 grammar (`.scratch/panel-v6-round4.html`), built in real code:
 *   room header (rest) · SIMULATING-NOW watching-in-place · RANKED screening list · cast on call.
 *
 * Design laws honored:
 *  - Sapient DE-BOX: hairline dividers, no bordered tiles.
 *  - Section = mono kicker + human question + owning number.
 *  - Cream is the room; coral is only where you lose them (the loudest-no row).
 *  - Sealed verdicts during watching — staged progress is honest, never a fabricated partial.
 *  - Words are the enemy; motion is simulation physics (the staged fill reports real progress).
 *
 * Reuse note: this is a clean composition of the round-4 anatomy — it deliberately does NOT drag
 * in `audience-presence`'s switcher/portal apparatus (build handoff §5 dedup reckoning). Data
 * shapes mirror the live contract (`AmbientFocusSibling`, `Person`) so an adapter grafts later.
 */

import { useEffect, useRef, useState } from "react";

// ── view-model ───────────────────────────────────────────────────────────────

/** Fidelity tier (L5): SIM-1 Flash n=1,000 / SIM-1 Max n=10,000. */
export type SimTier = "flash" | "max";

/** One screened stimulus in the ranked list. `stopPct` = would-stop %, `loss` = the loudest-no. */
export interface RankedStimulus {
  id: string;
  stimulus: string;
  stopPct: number;
  loss?: boolean;
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
  coral: "#FF6363",
  border: "rgba(255,255,255,.06)",
  hair: "rgba(255,255,255,.08)",
} as const;

// The ranked bars measure against "half the room stops" as the visual full — gives low-ish
// stop-rates room to differentiate without inflating them. Refined live if it reads wrong.
const BAR_REF = 50;

// ── small primitives (r4 grammar) ────────────────────────────────────────────

function Kicker({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[12px] uppercase tracking-[0.08em]">
      <span style={{ color: TONE.faint }}>{children}</span>
      {tag ? (
        <span style={{ color: "rgba(236,231,222,.28)", letterSpacing: "0.06em" }}>{tag}</span>
      ) : null}
    </div>
  );
}

// ── watching card (staged fill, sealed verdict) ──────────────────────────────

const STAGES = ["reading", "brains", "votes", "verdict"] as const;
const CUTS = [0.12, 0.55, 0.96, 1.01];

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
      className="mt-3 rounded-[12px] p-4"
      style={{ border: `1px solid ${TONE.hair}` }}
    >
      <div
        className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
        style={{ color: TONE.cream }}
      >
        {run.stimulus}
      </div>

      {/* progress track — cream fill, driven by rAF via transform (no per-frame re-render) */}
      <div
        className="relative mt-3.5 h-1 overflow-hidden rounded-full"
        style={{ background: TONE.ghost }}
      >
        <span
          ref={fillRef}
          className="absolute inset-0 block origin-left rounded-full"
          style={{ background: TONE.cream, opacity: 0.85, transform: "scaleX(0)" }}
        />
      </div>

      {/* staged log: reading · brains · votes · verdict */}
      <div className="mt-3 flex gap-3.5 font-mono text-[12px] tracking-[0.05em]">
        {STAGES.map((s, i) => {
          const done = complete || i < liveStage;
          const live = !complete && i === liveStage;
          return (
            <span
              key={s}
              className="transition-colors duration-300"
              style={{ color: live ? TONE.cream : done ? TONE.faint : "rgba(236,231,222,.25)" }}
            >
              {s}
            </span>
          );
        })}
      </div>

      {/* meta: N decided · sealed → verdict on complete */}
      <div className="mt-2.5 flex items-baseline justify-between text-[13px]">
        <span style={{ color: TONE.faint }}>
          {complete
            ? `${withCommas(n)} of ${withCommas(n)}`
            : `${withCommas(decided)} of ${withCommas(n)} decided`}
        </span>
        <span style={{ color: complete ? TONE.cream : TONE.dim }}>
          {complete && run.verdictPct != null ? `${run.verdictPct}% would stop` : "sealed"}
        </span>
      </div>
    </div>
  );
}

// ── room header glyph (r4 constellation, one coral node) ─────────────────────

function RoomGlyph() {
  return (
    <svg viewBox="0 0 22 16" className="h-4 w-[22px] flex-none" aria-hidden>
      <circle cx="3" cy="12" r="1.6" fill="#ece7de" opacity=".9" />
      <circle cx="9" cy="5" r="1.3" fill="#ece7de" opacity=".55" />
      <circle cx="15" cy="10" r="1.6" fill="#ece7de" opacity=".8" />
      <circle cx="19" cy="3" r="1.2" fill="#FF6363" opacity=".9" />
      <line x1="3" y1="12" x2="9" y2="5" stroke="#ece7de" strokeOpacity=".25" />
      <line x1="9" y1="5" x2="15" y2="10" stroke="#ece7de" strokeOpacity=".25" />
      <line x1="15" y1="10" x2="19" y2="3" stroke="#ece7de" strokeOpacity=".25" />
    </svg>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientOverview({
  data,
  reducedMotion = false,
  onOpenStimulus,
  onTestVariant,
  className,
}: {
  data: OverviewData;
  reducedMotion?: boolean;
  onOpenStimulus?: (id: string) => void;
  onTestVariant?: () => void;
  className?: string;
}) {
  const { audienceName, provenance, tier, watching, ranked, cast, castOverflow } = data;

  return (
    <div
      data-testid="ambient-overview"
      className={`flex w-full max-w-[380px] flex-col rounded-[16px] ${className ?? ""}`}
      style={{
        height: AMBIENT_PANEL_HEIGHT,
        background: "#1f1f1e",
        border: `1px solid ${TONE.border}`,
        color: TONE.cream,
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* room header */}
      <div className="flex items-center gap-2.5 px-[26px] pt-[26px]">
        <RoomGlyph />
        <span className="text-[16px] font-semibold tracking-[-0.01em]">{audienceName}</span>
        <span
          className="rounded-full px-2.5 py-[3px] font-mono text-[11px] uppercase tracking-[0.08em]"
          style={{ color: TONE.faint, border: `1px solid ${TONE.hair}` }}
        >
          {provenance}
        </span>
        <span className="ml-auto text-[12px]" style={{ color: TONE.faint }}>
          ▾
        </span>
      </div>

      {/* scroll region — watching + ranked */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[26px]">
        {watching ? (
          <div className="mt-8">
            <Kicker tag={TIER_LABEL[tier]}>Simulating now</Kicker>
            <WatchingCard run={watching} tier={tier} reducedMotion={reducedMotion} />
          </div>
        ) : null}

        <div className="mt-8">
          <Kicker tag="simulated">Ranked · would they stop</Kicker>
          <ul className="mt-1">
            {ranked.map((r) => {
              const w = Math.min(1, r.stopPct / BAR_REF);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpenStimulus?.(r.id)}
                    className="group block w-full cursor-pointer py-3.5 text-left"
                    style={{ borderBottom: `1px solid ${TONE.border}` }}
                  >
                    <span className="flex items-baseline gap-3">
                      <span
                        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] opacity-[.88] transition-opacity group-hover:opacity-100"
                        style={{ color: TONE.cream }}
                      >
                        {r.stimulus}
                      </span>
                      <span className="flex-none text-[14px] font-medium" style={{ color: TONE.cream }}>
                        {r.stopPct.toFixed(1)}%
                      </span>
                    </span>
                    <span
                      className="relative mt-2.5 block h-[3px] overflow-hidden rounded-full"
                      style={{ background: TONE.ghost }}
                    >
                      <span
                        className="absolute inset-0 block origin-left"
                        style={{
                          transform: `scaleX(${w})`,
                          background: r.loss ? TONE.coral : "rgba(236,231,222,.55)",
                          opacity: r.loss ? 0.8 : 1,
                        }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onTestVariant}
            className="w-full cursor-pointer py-3.5 text-left text-[13px] transition-colors"
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
        className="mx-[26px] mb-[26px] mt-[18px] flex items-center gap-1.5 pt-4"
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
