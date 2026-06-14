'use client';

import { bandTone, type ScoreTone } from '@/components/board/verdict/verdict-derive';
import { bandFromScore } from '@/components/board/verdict/verdict-constants';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// Hero score gauge (READ-02, D-01 user override of the bare number).
//
// A flat STROKED arc — track + zone-colored fill — NOT a glow/halo/filled pie.
// The fill zone color is the SSOT `bandTone(score)` (≥70 green / 40–69 amber /
// <40 red — CORRECTION #2: amber owns the WHOLE 40–69 band). The score number is
// the one dominant figure, with the band word ("Strong"/"Mid"/"Weak") below.
//
// Phase-4 contract: `score` is a PROP. Phase 4 mounts this same component fed from
// the live stream; the stroke-dasharray CSS transition glides the fill 0→score as
// the prop updates. Do NOT internalize a data subscription here. Motion is gated on
// usePrefersReducedMotion (snap to final when reduced). Matte: no glow, no halo.

/** Zone color tokens, keyed by bandTone. `neutral` falls back to amber (bandTone
 *  never returns it today, but the union includes it). */
const ZONE_VAR: Record<ScoreTone, string> = {
  good: 'var(--color-success)',
  warn: 'var(--color-warning)',
  crit: 'var(--color-error)',
  neutral: 'var(--color-warning)',
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** WR-02: align the gauge's user-facing band word with the app-wide vocabulary.
 *  bandFromScore returns "Low" for <40, but Deeper read / the score-zone language
 *  use "Weak" for the same bucket. Remap "Low"→"Weak" here so a single viewport
 *  never shows two words for one concept. Arc/zone logic is untouched (WR-03). */
const GAUGE_BAND_LABEL: Record<string, string> = {
  Strong: 'Strong',
  Mid: 'Mid',
  Low: 'Weak',
};

export interface ScoreGaugeProps {
  /** 0–100 overall score. Stays a prop (Phase-4 drives it from the stream). */
  score: number;
  /** Diameter in px. ~120 desktop / ~96 mobile (UI-SPEC). */
  size?: number;
  /** Track + fill stroke width in px (UI-SPEC: 8). */
  stroke?: number;
}

export function ScoreGauge({ score, size = 120, stroke = 8 }: ScoreGaugeProps) {
  const reduced = usePrefersReducedMotion();

  // WR-03: clamp + finite-guard the DISPLAYED score ONCE, then reuse it for the
  // arc fill, the centered number, the band derivation, AND the aria-label — so a
  // malformed prop (105, -3, NaN) can never show "Score 105 of 100" / "NaN" while
  // the arc silently clamps. `overall_score` is typed number with no range promise
  // at this boundary, so the component normalizes defensively (honesty contract).
  const shown = Math.round(clamp(Number.isFinite(score) ? score : 0, 0, 100));

  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const sweep = 0.75; // 270° dial — gap at the bottom (start rotated −225°)
  const arcLen = circumference * sweep;
  const pct = shown / 100;
  const dash = arcLen * pct;

  const color = ZONE_VAR[bandTone(shown)];
  // WR-02: remap "Low"→"Weak" for the user-facing word (zone logic untouched).
  const band = GAUGE_BAND_LABEL[bandFromScore(shown)] ?? bandFromScore(shown);

  return (
    <div
      role="img"
      aria-label={`Score ${shown} of 100, ${band}`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Rotate so the 270° opening sits at the dial bottom.
        className="-rotate-[225deg]"
        aria-hidden="true"
      >
        {/* track — 6% hairline, the unfilled remainder of the dial */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--color-border)"
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
        />
        {/* fill — zone color; Phase 4 animates `dash` 0→value via the transition */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={reduced ? undefined : { transition: 'stroke-dasharray 700ms var(--ease-out-cubic)' }}
        />
      </svg>

      {/* number + band word, centered over the dial */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold leading-none tabular-nums text-foreground">
          {shown}
        </span>
        <span
          className="mt-1 text-base font-medium leading-tight"
          style={{ color }}
        >
          {band}
        </span>
      </div>
    </div>
  );
}
