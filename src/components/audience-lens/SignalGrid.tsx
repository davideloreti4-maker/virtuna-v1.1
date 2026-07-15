'use client';

/**
 * SignalGrid — Sapient's "THE NINE BREAKDOWN SIGNALS" block, 1:1 on layout, charcoal on theme.
 *
 * Their cell: a big thin numeral, a mono ALL-CAPS label, a coloured graded verdict (WEAKNESS / OKAY /
 * STRONG), a thin underline bar. We copy that exactly. What we ADD — because our seven network numbers
 * are MODELED and theirs read as measured — is (1) a small MODELED / REAL tag that is always visible,
 * so the grade never reads as a scan, and (2) a per-cell WHY THIS SCORE affordance holding the honest
 * disclosure (how the number is derived, how it is banded, what it is NOT). The disclosure lives BEHIND
 * the affordance so the cell itself stays airy, as Sapient's does.
 *
 * The colour of the verdict is the same for a modeled and a real cell (terracotta = weakness, sage =
 * strong, muted cream = okay); the modeled ≠ measured distinction is carried by the tag + WHY panel,
 * not by dulling the grade. See `brain-signals.ts` and `room-readout.ts` §5 for why the disclosure is
 * load-bearing — we are allowed to grade a modeled signal only because we say, in the cell, exactly how.
 */

import { useState } from 'react';
import type { BrainSignal, SignalTone } from '@/lib/brain/brain-signals';

const WORD_COLOR: Record<SignalTone, string> = {
  weak: 'var(--color-accent)',
  strong: 'var(--sage, #8aa383)',
  okay: 'var(--color-foreground-muted)',
  absent: 'var(--color-foreground-muted)',
};

function SignalCell({ s }: { s: BrainSignal }) {
  const [open, setOpen] = useState(false);
  const absent = s.tone === 'absent' || s.score == null;
  const barColor =
    s.tone === 'weak' ? 'var(--color-accent)' : s.tone === 'strong' ? 'var(--sage, #8aa383)' : 'var(--color-cream-primary)';

  return (
    <div className="relative flex flex-col px-3.5 py-3.5">
      {/* Always-visible honesty mark — the one place modeled ≠ measured shows before you tap WHY. */}
      <span className="absolute right-3 top-3.5 font-mono text-[7px] uppercase tracking-[0.16em] text-[var(--color-foreground-muted)]">
        {s.real ? 'real' : 'modeled'}
      </span>

      {/* The big thin numeral — Sapient's move exactly. */}
      <span className="font-extralight text-[36px] leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {absent ? '—' : s.score}
      </span>

      <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] leading-none text-[var(--color-foreground-secondary)]">
        {s.label}
      </span>
      <span
        className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.13em] leading-none"
        style={{ color: WORD_COLOR[s.tone] }}
      >
        {s.word}
      </span>

      {/* the underline bar — the score as a fill, exactly the reference's move; hidden when absent */}
      {!absent && (
        <span className="mt-3 flex h-[2px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <span
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, Math.min(100, s.score ?? 0))}%`, background: barColor, opacity: 0.85 }}
          />
        </span>
      )}

      {/* WHY THIS SCORE — the disclaimer moved behind an affordance, so the cell breathes (GAP-4 / §4.1) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2.5 self-start font-mono text-[8px] uppercase tracking-[0.12em] leading-none text-[var(--color-foreground-muted)] transition-colors hover:text-[var(--color-foreground-secondary)]"
      >
        Why this score {open ? '↑' : '→'}
      </button>
      {open && (
        <p className="mt-1.5 text-[9px] leading-[1.45] text-[var(--color-foreground-muted)]">{s.whyScore}</p>
      )}
    </div>
  );
}

export function SignalGrid({ signals, title = 'The nine breakdown signals' }: { signals: BrainSignal[]; title?: string }) {
  if (signals.length === 0) return null;
  return (
    <section className="mt-2" data-testid="brain-signal-grid">
      <p className="mb-1.5 px-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-foreground-muted)]">
        {title}
      </p>
      <div className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] [&>*]:border-[var(--color-border)] [&>*]:border-t [&>*]:border-l [&>*:nth-child(-n+3)]:border-t-0 [&>*:nth-child(3n+1)]:border-l-0">
        {signals.map((s) => (
          <SignalCell key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}
