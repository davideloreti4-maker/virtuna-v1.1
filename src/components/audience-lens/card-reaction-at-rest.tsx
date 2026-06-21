'use client';

/**
 * CardReactionAtRest — the per-card "reaction at rest" readout (Surface 3, D-01/D-03).
 *
 * Promotes the quiet "tap to see the room" cue into a VISIBLE resting-state reaction:
 * the real `{stop}/{total} stop` fraction + a thin cream-vs-muted sentiment ribbon. It is
 * rendered INSIDE the existing `<LensTrigger>` on each generated skill card (idea/hook/
 * script/remix), immediately above the card's lead verbatim quote — no sibling element, no
 * 4-way duplication. The verbatim quote and the secondary chip stay in the card.
 *
 * Honesty spine (the load-bearing contract):
 *  - Parses the fraction with the SAME regex contract as `parseFraction` in
 *    flat-card-reactions.ts (`/(\d+)\s*\/\s*(\d+)/`, total > 0, stop <= total).
 *  - When the fraction does NOT parse (unparseable / empty / no signal), it `return null`s —
 *    renders NOTHING. This mirrors `cardScrollQuoteReactions([])` → the LensTrigger collapse:
 *    silence is the honest degrade, never a "0/0" or a placeholder.
 *
 * Color law (THEME-06 / UI-SPEC §Color): a positive/neutral reaction reads CREAM
 * (`--color-foreground`), never coral. The muted track is `--color-foreground-muted`. Coral
 * (`var(--color-accent)`, NEVER the legacy hardcoded hex) is reserved for a worst-cluster
 * signal only — out of scope for v1, so this ribbon stays cream. The static readout carries no
 * motion (the "alive" dot pulse lives on the persistent presence, not the per-card ribbon).
 */

export interface CardReactionAtRestProps {
  /** The card's already-emitted stop fraction, e.g. "6/10 stop". */
  fraction: string;
}

/** Parse "6/10 stop" → { stop: 6, total: 10 }. Returns null on any unexpected shape.
 *  Byte-identical contract to flat-card-reactions.ts `parseFraction` (the honest-degrade gate). */
function parseFraction(fraction: string): { stop: number; total: number } | null {
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const stop = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(stop) || !Number.isFinite(total) || total <= 0 || stop > total) {
    return null;
  }
  return { stop, total };
}

export function CardReactionAtRest({ fraction }: CardReactionAtRestProps) {
  const parsed = parseFraction(fraction);
  // Honest degrade: no parseable signal → render nothing (no ribbon, no "0/0").
  if (!parsed) return null;

  const { stop, total } = parsed;
  const fillPct = `${(stop / total) * 100}%`;

  return (
    <div className="flex flex-col gap-1.5" aria-label={`${stop} of ${total} stopped`}>
      {/* Row 1 — the real stop fraction (13px / medium / cream / tabular-nums). */}
      <span
        className="text-[13px] font-medium tabular-nums text-foreground"
        aria-hidden="true"
      >
        {stop}/{total} stop
      </span>

      {/* Row 2 — thin sentiment ribbon: cream fill over a muted track. A positive read
          is CREAM, never coral (coral would falsely read as alarm — UI-SPEC §Color). */}
      <div
        className="h-[3px] w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-foreground-muted)' }}
      >
        <div
          data-testid="reaction-ribbon-fill"
          className="h-full rounded-full"
          style={{ width: fillPct, backgroundColor: 'var(--color-foreground)' }}
        />
      </div>
    </div>
  );
}
