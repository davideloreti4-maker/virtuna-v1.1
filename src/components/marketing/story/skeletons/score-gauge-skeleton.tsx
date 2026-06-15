import { cn } from "@/lib/utils";

/**
 * ScoreGaugeSkeleton — static-SVG shape hint of the Numen Simulation score
 * gauge (03-04 GAP-1, derived from the canonical numen-rework reading IA:
 * `reading/score-gauge.tsx`). It is pure set-dressing — NO real data, NO engine
 * hook, NO import from the retired product UI. It depicts the SHAPE so the
 * marketing showcase reads as "this is the real product, screenshot pending".
 *
 * Composition (03-RESEARCH Pitfall 4 item 2):
 *  - a ~270deg stroked arc (a track ring + a filled sweep), drawn via a single
 *    <circle> per layer with `stroke-dasharray` — no animation, no glow.
 *  - a centered score NUMBER fixed at 87 (>= BAND_THRESHOLDS.STRONG = 70 honesty
 *    floor) + the band word "Strong".
 *
 * Flat-warm tokens only: track = border/cream-muted, sweep = cream-secondary.
 * Coral is kept precious (A6) and is NOT used here.
 *
 * Pure RSC — no client directive. role="img" + aria-label so the decorative SVG
 * exposes one accessible name and its internals stay out of the a11y tree.
 */

// 270deg arc geometry, re-derived locally (never imported from the product):
//   r = 52, circumference C = 2*pi*r ≈ 326.7. A 270deg sweep = 3/4 of C.
//   The ring is rotated -225deg so the 270deg gap sits symmetrically at the
//   bottom (open arc, like the real gauge). The sweep length is C * (score/100)
//   of the 270deg visible track.
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R; // full circle
const ARC_FRACTION = 0.75; // 270deg of 360deg
const ARC_LEN = CIRCUMFERENCE * ARC_FRACTION;
const SCORE = 87; // fixed sample, >= 70 honesty floor (03-RESEARCH Pitfall 4)
const SWEEP_LEN = ARC_LEN * (SCORE / 100);

export function ScoreGaugeSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Virality score (sample)"
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <div className="relative">
        <svg
          viewBox="0 0 128 128"
          width="128"
          height="128"
          aria-hidden="true"
          className="overflow-visible"
        >
          {/* group rotated so the 270deg open arc sits at the bottom */}
          <g transform="rotate(135 64 64)">
            {/* track — the unfilled 270deg ring (cream-muted, hairline) */}
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              className="stroke-foreground-muted/25"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${ARC_LEN} ${CIRCUMFERENCE}`}
            />
            {/* filled sweep — cream-secondary, the score portion of the track */}
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              className="stroke-foreground-secondary"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${SWEEP_LEN} ${CIRCUMFERENCE}`}
            />
          </g>
        </svg>
        {/* centered score number — sits over the arc */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold leading-none text-foreground">
            {SCORE}
          </span>
        </div>
      </div>
      {/* band word — the honest verdict (>= 70 = Strong) */}
      <span className="text-sm font-medium text-foreground-secondary">
        Strong
      </span>
    </div>
  );
}
