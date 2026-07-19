'use client';

/**
 * SignalGrid — the nine MODELED brain signals, as an INDEX, not a dashboard.
 *
 * The first cut copied Sapient's cell 1:1 — a 36px extralight numeral, a mono-caps label, a graded
 * verdict word and an underline bar, ×9. Measured in the rail it ate ~700 of the card's 1,300px and
 * put NINE display numerals above the room's one real number, which inverted the card's honesty
 * hierarchy: the modeled texture shouted, the true votes whispered. BrainView's own architecture
 * note ("A FIGURE, NOT A DASHBOARD") named the failure years before this grid regrew it.
 *
 * So the signals now read as index rows — name · meter · value — at reading size, below the room's
 * real readout. The grading survives where it is a SIGNAL: a weak signal flags coral (the app's one
 * accent doing its one job); strong needs no colour, because a long bar already says it (good news
 * is not a colour in this system). Each row keeps its derivation on the hover title, and the single
 * "How to read these numbers" disclosure states — once — that every number is modeled and none is
 * benchmarked. See `brain-signals.ts` for the mapping and each signal's grade DIRECTION (a low
 * Hesitation is strong).
 */

import type { BrainSignal } from '@/lib/brain/brain-signals';

function SignalRow({ s }: { s: BrainSignal }) {
  const weak = s.tone === 'weak';
  return (
    <div className="flex items-center gap-2.5 py-[5px]" title={s.whyScore} data-signal-row>
      <span className="w-[104px] shrink-0 truncate text-[11.5px] leading-none text-[var(--color-foreground-secondary)]">
        {s.label}
      </span>
      <span className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, s.score))}%`,
            background: weak ? 'var(--color-accent)' : 'var(--color-cream-primary)',
            opacity: weak ? 0.9 : 0.55,
          }}
        />
      </span>
      <span className="w-[24px] shrink-0 text-right text-[11.5px] leading-none tabular-nums text-foreground">
        {s.score}
      </span>
      {/* The grade word only where it is a signal — weakness flags; strength is just a long bar. */}
      <span className="w-[44px] shrink-0 text-right font-mono text-[8px] uppercase tracking-[0.06em] leading-none text-[var(--color-accent-text)]">
        {weak ? s.word : ''}
      </span>
    </div>
  );
}

export function SignalGrid({ signals, title = 'Signal breakdown' }: { signals: BrainSignal[]; title?: string }) {
  if (signals.length === 0) return null;
  return (
    <section className="mt-4 border-t border-[var(--color-border)] pt-3" data-testid="brain-signal-grid">
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        <span>{title}</span>
        <span className="font-mono text-[8px] tracking-[0.12em] opacity-70">modeled</span>
      </p>
      <div className="flex flex-col">
        {signals.map((s) => (
          <SignalRow key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}
