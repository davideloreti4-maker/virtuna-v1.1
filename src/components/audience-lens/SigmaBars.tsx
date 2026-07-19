'use client';

/**
 * SigmaBars — Sapient's "RAW NETWORK ACTIVATION · z-scored" block, restyled to the Room's document
 * grammar: a hairline section with one kicker, not a box inside a box with its own duplicate
 * header. Seven networks, each a diverging bar from a centre baseline: how far THIS second sits
 * from the network's own mean over the clip, in σ. Above baseline fills cream (the same "the room
 * is with you" pole every other instrument here uses — sage left the Room with the dosage pass),
 * below fills muted. Renders nothing when the section is honestly empty (not grounded, or a clip
 * too flat to z-score) — see `network-sigma.ts`.
 */

import type { NetworkSigma } from '@/lib/brain/network-sigma';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** σ → half-bar width (%). Each σ ≈ 30% of the half-track, capped so ±1.6σ fills the side. */
const halfWidth = (z: number) => Math.min(48, Math.abs(z) * 30);

function SigmaRow({ s }: { s: NetworkSigma }) {
  const above = s.z >= 0;
  const w = halfWidth(s.z);
  return (
    <div className="flex items-center gap-2.5 py-[4px]">
      <span className="w-[104px] shrink-0 truncate text-[11px] leading-none text-[var(--color-foreground-secondary)]">
        {s.label}
      </span>
      <span className="relative h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <span aria-hidden className="absolute left-1/2 top-0 h-full w-px bg-[rgba(255,255,255,0.14)]" />
        <span
          className="absolute top-0 h-full rounded-full"
          style={
            above
              ? { left: '50%', width: `${w}%`, background: 'var(--color-cream-primary)', opacity: 0.55 }
              : { right: '50%', width: `${w}%`, background: 'var(--color-foreground-muted)', opacity: 0.6 }
          }
        />
      </span>
      <span className="w-[104px] shrink-0 text-right text-[10px] leading-none tabular-nums text-[var(--color-foreground-muted)]">
        <span className={above ? 'text-[var(--color-foreground-secondary)]' : undefined}>
          {above ? '+' : ''}
          {s.z.toFixed(2)}σ
        </span>{' '}
        · {s.band}
      </span>
    </div>
  );
}

export function SigmaBars({ sigmas, tSec, why }: { sigmas: NetworkSigma[]; tSec: number; why: string }) {
  if (sigmas.length === 0) return null;
  return (
    <section className="mt-4 border-t border-[var(--color-border)] pt-3" data-testid="brain-sigma-bars">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        <span>Raw network activation · z-scored</span>
        <span className="font-mono text-[8px] tracking-[0.1em] tabular-nums opacity-70">at t = {mmss(tSec)}</span>
      </p>
      <p className="mb-1 text-[10.5px] leading-[1.45] text-[var(--color-foreground-muted)]">
        Sigma (σ) is how far this second sits from the clip&rsquo;s own baseline — negative is below its
        usual level for this clip, positive above.
      </p>
      <div className="mt-1">
        {sigmas.map((s) => (
          <SigmaRow key={s.net} s={s} />
        ))}
      </div>
      {why && (
        <div className="mt-2 border-l border-[var(--color-border)] pl-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">Why this second</p>
          <p className="mt-1 text-[10.5px] leading-[1.5] text-[var(--color-foreground-secondary)]">{why}</p>
        </div>
      )}
    </section>
  );
}
