'use client';

/**
 * SignalHeatmap — Sapient's "KPI ACTIVATION · PER SECOND" block, charcoal on theme.
 *
 * Nine signals × one cell per second, each cell the signal's raw activation (0..100) shaded on a
 * WEAK→STRONG ramp (dark → sage in charcoal, the equivalent of Sapient's gray→green on white). A
 * playhead column marks the current second. See `signal-timeline.ts`; renders nothing when empty
 * (not grounded — a per-second timeline is only real for a real clip).
 */

import { useState } from 'react';
import type { SignalTimeline } from '@/lib/brain/signal-timeline';

/** value 0..100 → cell background. Dark at weak, sage at strong — the charcoal read of gray→green. */
function cellBg(v: number): string {
  const a = 0.06 + 0.82 * (v / 100);
  return `rgba(138, 163, 131, ${a.toFixed(3)})`;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function SignalHeatmap({ timeline, tSec }: { timeline: SignalTimeline; tSec: number }) {
  const [open, setOpen] = useState(false);
  const { seconds, rows } = timeline;
  if (rows.length === 0 || seconds.length === 0) return null;

  const cols = seconds.length;
  const duration = seconds[cols - 1] ?? 1;
  // which column the playhead is on
  const playCol = Math.max(0, Math.min(cols - 1, Math.round((tSec / Math.max(1, duration)) * (cols - 1))));
  // sparse time ticks along the top (~every 15s)
  const tickEvery = Math.max(1, Math.round(15 / Math.max(1, duration / cols)));

  return (
    <section className="mt-2" data-testid="brain-signal-heatmap">
      <p className="mb-1 px-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)]">
        Activation per second · every decoded signal
      </p>
      <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-foreground-secondary)]">
            Signal activation · per second
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-foreground-muted)] tabular-nums">
            {mmss(duration)} · 9 signals
          </span>
        </div>

        {/* time axis */}
        <div className="mt-2 flex pl-[84px]">
          <div className="relative flex-1">
            {seconds.map((s, i) =>
              i % tickEvery === 0 ? (
                <span
                  key={i}
                  className="absolute font-mono text-[7px] uppercase tracking-[0.06em] text-[var(--color-foreground-muted)] tabular-nums"
                  style={{ left: `${(i / cols) * 100}%` }}
                >
                  {s}s
                </span>
              ) : null,
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-[2px]">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-0">
              <span className="w-[84px] shrink-0 pr-2 font-mono text-[8px] uppercase tracking-[0.04em] leading-none text-[var(--color-foreground-secondary)]">
                {row.label}
              </span>
              <div className="flex flex-1 gap-[1px]">
                {row.values.map((v, i) => (
                  <span
                    key={i}
                    className="h-[13px] flex-1 rounded-[1px]"
                    style={{
                      background: cellBg(v),
                      outline: i === playCol ? '1px solid var(--color-cream-primary)' : undefined,
                      outlineOffset: '-1px',
                    }}
                    title={`${row.label} · ${seconds[i]}s · ${v}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* legend + affordance */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-[var(--color-foreground-muted)]">
            weak
            <span
              className="h-[5px] w-16 rounded-full"
              style={{ background: 'linear-gradient(90deg, rgba(138,163,131,0.06), rgba(138,163,131,0.88))' }}
            />
            strong
          </span>
          <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-[var(--color-foreground-muted)]">each cell = 1 sec</span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--color-foreground-muted)] transition-colors hover:text-[var(--color-foreground-secondary)]"
        >
          Why these numbers {open ? '↑' : '→'}
        </button>
        {open && (
          <p className="mt-1.5 text-[9px] leading-[1.5] text-[var(--color-foreground-muted)]">
            Each row is one of the nine signals, modeled from our seven networks and sampled once per
            second across the clip. The shade is that signal&rsquo;s raw activation, not a benchmark against
            real outcomes — there is no such corpus.
          </p>
        )}
      </div>
    </section>
  );
}
