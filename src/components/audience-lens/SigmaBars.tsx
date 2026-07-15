'use client';

/**
 * SigmaBars — Sapient's "RAW NETWORK ACTIVATION · 7 NETWORKS, Z-SCORED" block, charcoal on theme.
 *
 * Seven networks, each a diverging bar from a centre baseline: how far THIS second sits from the
 * network's own mean over the clip, in σ. Above baseline fills sage (rightward), below fills muted
 * (leftward), and the value + a plain-language band sit at the right — exactly Sapient's row. A
 * "WHY THIS SECOND" prose box reads the standout. See `network-sigma.ts`; this renders nothing when
 * the section is honestly empty (not grounded, or a clip too flat to z-score).
 */

import type { NetworkSigma } from '@/lib/brain/network-sigma';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** σ → half-bar width (%). Each σ ≈ 30% of the half-track, capped so ±1.6σ fills the side. */
const halfWidth = (z: number) => Math.min(48, Math.abs(z) * 30);

function SigmaRow({ s }: { s: NetworkSigma }) {
  const above = s.z >= 0;
  const w = halfWidth(s.z);
  const valueColor = s.band === 'about normal' ? 'var(--color-foreground-muted)' : above ? 'var(--sage, #8aa383)' : 'var(--color-foreground-secondary)';
  return (
    <div className="flex items-center gap-2.5 py-[3px]">
      <span className="w-[92px] shrink-0 font-mono text-[8.5px] uppercase tracking-[0.06em] leading-none text-[var(--color-foreground-secondary)]">
        {s.label}
      </span>
      <span className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <span aria-hidden className="absolute left-1/2 top-0 h-full w-px bg-[rgba(255,255,255,0.14)]" />
        <span
          className="absolute top-0 h-full rounded-full"
          style={
            above
              ? { left: '50%', width: `${w}%`, background: 'var(--sage, #8aa383)', opacity: 0.85 }
              : { right: '50%', width: `${w}%`, background: 'var(--color-foreground-muted)', opacity: 0.7 }
          }
        />
      </span>
      <span className="w-[104px] shrink-0 text-right font-mono text-[8.5px] tracking-[0.05em] leading-none tabular-nums" style={{ color: valueColor }}>
        {above ? '+' : ''}
        {s.z.toFixed(2)}σ <span className="uppercase">· {s.band}</span>
      </span>
    </div>
  );
}

export function SigmaBars({ sigmas, tSec, why }: { sigmas: NetworkSigma[]; tSec: number; why: string }) {
  if (sigmas.length === 0) return null;
  return (
    <section className="mt-2" data-testid="brain-sigma-bars">
      <p className="mb-1 px-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        Raw network activation · this second, synced to the playhead
      </p>
      <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-foreground-secondary)]">
            Raw network activation · 7 networks, z-scored
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-foreground-muted)] tabular-nums">
            at t = {mmss(tSec)}
          </span>
        </div>
        <p className="mt-1.5 text-[9.5px] leading-[1.45] text-[var(--color-foreground-muted)]">
          Sigma (σ) is how far this second sits from the clip&rsquo;s own baseline. Negative is below its usual
          level for this clip; positive is above; zero is right at baseline.
        </p>
        <div className="mt-2">
          {sigmas.map((s) => (
            <SigmaRow key={s.net} s={s} />
          ))}
        </div>
        {why && (
          <div className="mt-2.5 rounded-[8px] border border-[var(--color-border)] px-2.5 py-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">Why this second</p>
            <p className="mt-1 text-[10px] leading-[1.5] text-[var(--color-foreground-secondary)]">{why}</p>
          </div>
        )}
      </div>
    </section>
  );
}
