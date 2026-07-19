'use client';

/**
 * HowToRead — the one place the panel says, plainly, that every number on it is modeled and none
 * is benchmarked. A DISCLOSURE, not a control: it used to be a full-width boxed expander in mono
 * caps — the loudest button on the card, for a disclaimer. A disclaimer earns its credibility by
 * being clear, not by shouting; the honesty FOOT (mono caps, always visible) still carries the
 * hard claim on every render. This sits under the numbers it explains, at reading volume.
 */

import { useState } from 'react';

export function HowToRead() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-3" data-testid="brain-how-to-read">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[10.5px] text-[var(--color-foreground-muted)] transition-colors hover:text-[var(--color-foreground-secondary)]"
      >
        How to read these numbers
        <span aria-hidden className="text-[10px] leading-none">{open ? '↑' : '›'}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 border-l border-[var(--color-border)] pl-3 text-[10.5px] leading-[1.55] text-[var(--color-foreground-muted)]">
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
            own baseline, in standard deviations. <span className="text-[var(--color-foreground-secondary)]">The room</span>{' '}
            is the one thing here that is <span className="text-[var(--color-foreground-secondary)]">not</span>{' '}
            modeled — it is a real count of how your ten personas voted.
          </p>
        </div>
      )}
    </section>
  );
}
