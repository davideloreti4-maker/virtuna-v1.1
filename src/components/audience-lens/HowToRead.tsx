'use client';

/**
 * HowToRead — Sapient's "HOW TO READ THESE NUMBERS" row, above the grid. A single full-width
 * expander that explains, honestly, what the numbers on this panel are and are not. It is where the
 * panel earns the right to show grades on a modeled signal: it says, once and plainly, that every
 * number here is modeled and none is benchmarked against real outcomes.
 */

import { useState } from 'react';

export function HowToRead() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-2" data-testid="brain-how-to-read">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-border-hover)]"
      >
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--color-foreground-secondary)]">
          How to read these numbers
        </span>
        <span className="font-mono text-[11px] leading-none text-[var(--color-foreground-muted)]">{open ? '↑' : '›'}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-2.5 text-[10px] leading-[1.5] text-[var(--color-foreground-muted)]">
          <p>
            Every number on this panel is <span className="text-[var(--color-foreground-secondary)]">modeled</span> — predicted
            from the room&rsquo;s real votes (and, for a real clip, its measured retention), then run through the
            canonical haemodynamic response. None of it is a brain scan, and none is benchmarked against real
            outcomes: there is no such corpus.
          </p>
          <p>
            <span className="text-[var(--color-foreground-secondary)]">The nine signals</span> are graded weakness &lt;40 ·
            okay 40&ndash;64 · strong &ge;65 in each signal&rsquo;s own direction (for Hesitation/Risk, low is strong). Each is
            a reading of the modeled cortical networks, not a measured outcome.
          </p>
          <p>
            <span className="text-[var(--color-foreground-secondary)]">σ</span> is how far a second sits from the clip&rsquo;s
            own baseline, in standard deviations. <span className="text-[var(--color-foreground-secondary)]">The room</span>,
            at the bottom, is the one thing here that is <span className="text-[var(--color-foreground-secondary)]">not</span>{' '}
            modeled — it is a real count of how your ten personas voted.
          </p>
        </div>
      )}
    </section>
  );
}
