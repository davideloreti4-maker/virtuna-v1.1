'use client';

/**
 * AttentionCurve — Sapient's "PREDICTED ATTENTION · SMOOTHED, SAME PLAYHEAD" block, charcoal on theme.
 *
 * A smoothed line of modeled attention across the clip, peak dots on the crests, a playhead line at the
 * current second, and a modeled "hold" number top-right (labelled MODELED so it never reads as the
 * room's real "N of 10 stopped"). See `attention-curve.ts`; renders nothing when empty (grounded-only).
 */

import type { AttentionCurve as Curve } from '@/lib/brain/attention-curve';

const W = 100;
const H = 30;
const PAD = 2;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const xOf = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
const yOf = (v: number) => H - PAD - (v / 100) * (H - PAD * 2);

export function AttentionCurve({ curve, tSec, durationS }: { curve: Curve; tSec: number; durationS: number }) {
  const { points, peaks, hold } = curve;
  if (points.length < 2) return null;

  const n = points.length;
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i, n).toFixed(2)} ${yOf(v).toFixed(2)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const playX = durationS > 0 ? Math.max(0, Math.min(W, (tSec / durationS) * W)) : 0;

  return (
    <section className="mt-2" data-testid="brain-attention-curve">
      <p className="mb-1 px-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        Predicted attention · smoothed, same playhead
      </p>
      <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] leading-tight text-foreground">Where attention holds across the clip</span>
          <span className="flex shrink-0 items-baseline gap-1">
            <span className="font-serif text-[22px] leading-none tracking-[-0.02em] tabular-nums text-foreground">{hold}</span>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-[var(--color-foreground-muted)]">modeled hold</span>
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-[76px] w-full" aria-hidden>
          <path d={area} fill="var(--sage, #8aa383)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--color-cream-primary)" strokeWidth={0.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={playX} y1={0} x2={playX} y2={H} stroke="var(--color-foreground-muted)" strokeWidth={0.4} strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
          {peaks.map((p) => (
            <circle key={p.i} cx={xOf(p.i, n)} cy={yOf(p.v)} r={1.1} fill="var(--color-foreground)" stroke="var(--color-surface-sunken)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {peaks.length > 0 && (
          <p className="mt-1.5 text-[9.5px] leading-[1.45] text-[var(--color-foreground-muted)]">
            Attention peaks near {peaks.map((p) => mmss(p.t)).join(', ')}. The dots mark those crests on the
            curve — modeled from your audience&rsquo;s real retention, not a measured attention span.
          </p>
        )}
      </div>
    </section>
  );
}
