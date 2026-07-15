/**
 * SignalGrid — Sapient's "THE NINE BREAKDOWN SIGNALS" block, 1:1 on layout, charcoal on theme.
 *
 * Their cell: a big thin numeral, a mono ALL-CAPS label, a coloured verdict word, a thin underline
 * bar. We copy that exactly. What we ADD is the honesty line under each cell (GAP-4) — because our
 * numbers are modeled and theirs read as measured, and the disclaimer earns its keep by being visible.
 *
 * The colour of the word is the one place modeled ≠ measured shows through: a real-vote signal gets a
 * verdict colour (terracotta = weak, sage = strong), a modeled signal gets the neutral cream 'level'
 * tone — because a model output can honestly report a LEVEL but not a good/bad grade. See
 * `brain-signals.ts` and `room-readout.ts` §5 for why that distinction is load-bearing.
 */

import type { BrainSignal, SignalTone } from '@/lib/brain/brain-signals';

const WORD_COLOR: Record<SignalTone, string> = {
  weak: 'var(--color-accent)',
  strong: 'var(--sage, #8aa383)',
  okay: 'var(--color-foreground-muted)',
  level: 'var(--color-foreground-secondary)',
};

function SignalCell({ s }: { s: BrainSignal }) {
  const barColor = s.tone === 'weak' ? 'var(--color-accent)' : s.tone === 'strong' ? 'var(--sage, #8aa383)' : 'var(--color-cream-primary)';
  return (
    <div className="flex flex-col px-2.5 py-2.5">
      <span className="font-light text-[26px] leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {s.score}
      </span>
      <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.09em] leading-none text-[var(--color-foreground-secondary)]">
        {s.label}
      </span>
      <span
        className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] leading-none"
        style={{ color: WORD_COLOR[s.tone] }}
      >
        {s.word}
      </span>
      {/* the underline bar — the score as a fill, exactly the reference's move */}
      <span className="mt-2 flex h-[2px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <span
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, Math.min(100, s.score))}%`, background: barColor, opacity: 0.85 }}
        />
      </span>
      {/* GAP-4 — every claim says what it is NOT */}
      <span className="mt-1.5 font-mono text-[7.5px] uppercase tracking-[0.06em] leading-[1.35] text-[var(--color-foreground-muted)]">
        {s.notMeasured}
      </span>
    </div>
  );
}

export function SignalGrid({ signals, title = 'The breakdown signals' }: { signals: BrainSignal[]; title?: string }) {
  if (signals.length === 0) return null;
  return (
    <section className="mt-2" data-testid="brain-signal-grid">
      <p className="mb-1.5 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        {title} · modeled + real votes
      </p>
      <div className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] [&>*]:border-[var(--color-border)] [&>*]:border-t [&>*]:border-l [&>*:nth-child(-n+3)]:border-t-0 [&>*:nth-child(3n+1)]:border-l-0">
        {signals.map((s) => (
          <SignalCell key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}
