"use client";

import { useId } from "react";

/**
 * The video card's still-watching line, small and still (spec §4.5; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axCurve`). Not the result page's `Curve`: no
 * playhead, no readout, nothing to drag. Drawn from the same stored points (`audience.points`,
 * 100% at 0:00 and one point at the end of each scene).
 *
 * As drawn: a smooth line that never overshoots its points (monotone cubic, the drawing's `mono`),
 * 3 inside the top and bottom; the area under it on 4% of the ink; a base line and a short tick at
 * each scene border in the hairline colour; the line in ink, 2 wide. The scene the sentence names
 * gets the card's one coral: a band behind it in `--color-accent` at 13% (8% in dark), and the line
 * in coral (2.6 wide) inside the band. Without a named scene there is no coral at all.
 */

export interface CurveBand {
  /** Seconds. */
  t0: number;
  t1: number;
}

const f = (n: number) => n.toFixed(2);

/** A smooth line through the points that never overshoots them (monotone cubic, the drawing's `mono`). */
function monotonePath(xs: readonly number[], ys: readonly number[]): string {
  const n = xs.length;
  let p = `M${f(xs[0]!)} ${f(ys[0]!)}`;
  if (n < 2) return p;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1]! - xs[i]!;
    d[i] = dx === 0 ? 0 : (ys[i + 1]! - ys[i]!) / dx;
  }
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = (3 * a * d[i]!) / h;
      m[i + 1] = (3 * b * d[i]!) / h;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1]! - xs[i]!) / 3;
    p += `C${f(xs[i]! + h)} ${f(ys[i]! + m[i]! * h)} ${f(xs[i + 1]! - h)} ${f(ys[i + 1]! - m[i + 1]! * h)} ${f(xs[i + 1]!)} ${f(ys[i + 1]!)}`;
  }
  return p;
}

export function MiniCurve({
  points,
  clipS,
  band,
  width,
  height,
}: {
  /** `[seconds, percent still watching]`. */
  points: readonly (readonly [number, number])[];
  /** The clip's length in seconds. */
  clipS: number;
  /** The named scene, or null. */
  band: CurveBand | null;
  width: number;
  height: number;
}) {
  const clipId = useId();
  if (points.length < 2 || !(clipS > 0) || !(width > 0) || !(height > 6)) return null;

  const x = (t: number) => (Math.max(0, Math.min(clipS, t)) / clipS) * width;
  const y = (pct: number) => 3 + (1 - Math.max(0, Math.min(100, pct)) / 100) * (height - 6);
  const line = monotonePath(
    points.map(([t]) => x(t)),
    points.map(([, pct]) => y(pct)),
  );
  const base = height - 1;
  // Scene borders: every point but the first (0:00) and the last (the end of the clip).
  const ticks = points.slice(1, -1).map(([t]) => x(t));
  const b = band && band.t1 > band.t0 ? { x0: x(band.t0), x1: x(band.t1) } : null;

  return (
    <svg
      data-part="curve"
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-visible"
    >
      {b && (
        <defs>
          <clipPath id={clipId}>
            <rect x={f(b.x0)} y={-4} width={f(b.x1 - b.x0)} height={height + 8} />
          </clipPath>
        </defs>
      )}
      {b && (
        <rect
          data-part="band"
          x={f(b.x0)}
          y={0}
          width={f(b.x1 - b.x0)}
          height={base}
          fill="var(--color-accent)"
          className="opacity-[0.13] dark:opacity-[0.08]"
        />
      )}
      <path data-part="fill" d={`${line}L${f(width)} ${base}L0 ${base}Z`} className="fill-foreground/4" />
      <path d={`M0 ${height - 0.5}H${f(width)}`} stroke="var(--color-border)" />
      {ticks.map((tx, i) => (
        <path key={i} data-part="tick" d={`M${f(tx)} ${height - 6}V${base}`} stroke="var(--color-border)" strokeWidth={1.5} />
      ))}
      <path data-part="line" d={line} fill="none" stroke="var(--color-foreground)" strokeWidth={2} strokeLinecap="round" />
      {b && (
        <path
          data-part="loss"
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.6}
          strokeLinecap="round"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  );
}
