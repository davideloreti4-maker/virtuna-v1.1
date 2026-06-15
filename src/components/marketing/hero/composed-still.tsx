import { cn } from "@/lib/utils";
import { Placeholder } from "@/components/marketing/placeholder";

import { HERO_SCORE, RING_SIZE, RING_STROKE } from "./hero-constants";

/**
 * ComposedStill — the UNIVERSAL FLOOR of the signature "crowd → score" moment
 * (CONTEXT D-15 / HERO-04). The resolved end-state — phone + settled dot field +
 * clean coral arc ring + final score — that serves ALL of:
 *   SSR pre-hydration  ==  reduced-motion fallback  ==  mobile render  ==  at-rest
 *
 * It MUST paint pre-hydration with zero JS, so it is a pure Server Component:
 * NO "use client", NO client hooks, NO canvas. Just DOM + SVG. The 02-02 canvas
 * imports it as its `dynamic` loading fallback AND visually converges on this
 * exact ring end-state; the 02-03 boundary renders it as the still-only frame.
 *
 * Token rule (UI-SPEC §Color): coral (`--color-accent`) is confined to the
 * progress arc + the score number (the allowlist). The base dot field is
 * charcoal/cream only — NO white, NO coral. No glow filter, no gradient, no
 * tier palette (the score is a single strong "will-pop" value, so coral alone
 * is honest). No hardcoded hex — semantic tokens only (Pitfall 4).
 */

// Clean arc geometry (re-derived from ViralScoreRing.tsx:87-93; glow/tiers/white
// stripped). radius = (SIZE - STROKE) / 2; offset encodes the score so the arc is
// never hardcoded full/empty.
const RADIUS = (RING_SIZE - RING_STROKE) / 2; // 114
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = RING_SIZE / 2;

/**
 * Settled dot field (A1) — a small, STATIC, server-rendered scatter of low-alpha
 * cream/charcoal `<circle>`s representing the crowd come to rest around the ring.
 * Crisp, ~zero cost, no canvas. Deterministic (precomputed) so SSR === client
 * markup (no hydration mismatch). A few charcoal-chip dots add depth; most are
 * cream at low alpha. None are coral or white.
 *
 * Polar ring layout in two loose orbits just outside the arc, plus a sparse outer
 * sprinkle — reads as a settled flock hugging the instrument.
 */
interface Dot {
  cx: number;
  cy: number;
  r: number;
  fill: "--color-cream-secondary" | "--color-cream-muted" | "--color-charcoal-chip";
  opacity: number;
}

function buildSettledField(): Dot[] {
  const dots: Dot[] = [];
  // Two orbits hugging the ring + one sparse outer ring. Counts kept small
  // (~46 total) — decorative, not a simulation.
  const orbits: Array<{ count: number; radius: number; jitter: number; rMin: number; rMax: number }> = [
    { count: 18, radius: RADIUS + 22, jitter: 7, rMin: 2, rMax: 3.5 },
    { count: 16, radius: RADIUS + 40, jitter: 9, rMin: 1.5, rMax: 3 },
    { count: 12, radius: RADIUS + 60, jitter: 11, rMin: 1.5, rMax: 2.5 },
  ];

  let seed = 0;
  // Tiny deterministic PRNG (mulberry32-ish) so the scatter is stable across SSR
  // and client renders — never Math.random (would mismatch on hydration).
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  orbits.forEach((orbit, oi) => {
    for (let i = 0; i < orbit.count; i++) {
      const angle = (i / orbit.count) * Math.PI * 2 + oi * 0.4;
      const rad = orbit.radius + (rand() - 0.5) * 2 * orbit.jitter;
      const cx = CENTER + Math.cos(angle) * rad;
      const cy = CENTER + Math.sin(angle) * rad;
      const r = orbit.rMin + rand() * (orbit.rMax - orbit.rMin);
      // ~1 in 5 is a charcoal-chip for depth; rest split cream-secondary/muted.
      const pick = rand();
      const fill: Dot["fill"] =
        pick < 0.2
          ? "--color-charcoal-chip"
          : pick < 0.6
            ? "--color-cream-secondary"
            : "--color-cream-muted";
      const opacity =
        fill === "--color-charcoal-chip" ? 0.55 : 0.25 + rand() * 0.3;
      dots.push({ cx, cy, r, fill, opacity });
    }
  });

  return dots;
}

const SETTLED_FIELD: Dot[] = buildSettledField();

export interface ComposedStillProps {
  /** The resolved virality score (0–100). Defaults to the canned HERO_SCORE. */
  score?: number;
  className?: string;
}

export function ComposedStill({ score = HERO_SCORE, className }: ComposedStillProps) {
  // score → arc: full circumference at 0, zero offset at 100.
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <figure
      role="img"
      aria-label={`A synthetic audience reacts to a video and resolves into a virality score of ${score} out of 100.`}
      // Dimension-lock: occupy the SAME box the canvas mounts into (no CLS,
      // Pitfall 3). `relative` so the client island can absolutely overlay this.
      className={cn(
        "relative m-0 flex h-full w-full items-center justify-center",
        className
      )}
      style={{ aspectRatio: "16 / 10" }}
    >
      {/* The resolved instrument: settled dot field + clean coral arc ring + the
          final score, overlaid centered on the stage. Rendered FIRST so its <svg>
          (carrying the track + progress circles) is the document's first <svg> —
          the phone Placeholder's Lucide glyphs are circle-less <svg>s. It is an
          absolute overlay, so DOM order has no layout effect. pointer-events-none
          so it never intercepts the phone/replay affordance. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
            aria-hidden="true"
          >
            {/* Settled crowd field — cream/charcoal, low alpha, behind the ring. */}
            <g>
              {SETTLED_FIELD.map((d, i) => (
                <circle
                  key={i}
                  cx={d.cx}
                  cy={d.cy}
                  r={d.r}
                  fill={`var(${d.fill})`}
                  opacity={d.opacity}
                />
              ))}
            </g>

            {/* Track — secondary tone-step, NOT white/10. */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="var(--color-surface-elevated)"
              strokeWidth={RING_STROKE}
            />

            {/* Progress — coral accent, rounded cap, NO glow filter / gradient.
                strokeDashoffset encodes the score (geometry, not hardcoded). */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>

          {/* Center number — STATIC final score (count-up belongs to the 02-02
              canvas). Coral (allowlist item 3), tabular-nums, --text-display 64px /
              600; "/100" suffix smaller in cream-muted. Coral-500 on the charcoal
              ring interior clears AA (UI-SPEC §Contrast). */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-baseline">
              <span className="font-semibold tabular-nums text-accent text-display leading-none">
                {score}
              </span>
              <span className="ml-1 text-lg font-medium text-foreground-muted">
                /100
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* In-scene source video (D-05): the labelled phone the crowd reacts to.
          Rendered after the instrument overlay so the ring <svg> stays first. */}
      <Placeholder
        variant="video"
        aspect="9/16"
        label="Your TikTok"
        className="h-full w-auto max-w-[200px] shrink-0"
      />
    </figure>
  );
}
