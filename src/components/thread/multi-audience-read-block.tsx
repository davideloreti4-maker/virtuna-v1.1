'use client';

/**
 * MultiAudienceReadBlock — the Read, in-thread static card (Plan 08-05/08-06).
 *
 * The moat payoff: a concept lands a real typed Read — verdict band, a one-line
 * interpretation, a Lever (the one thing to act on), a who-it's-NOT-for line, and a
 * collapsible per-audience reaction drill. 2 entries → a side-by-side compare
 * (wins-for-X / bombs-for-Y).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §2 — "The Read"):
 *  - ZERO legacy coral. The old `#FF7F50` `.read` panel + ✦/◐/△ grade glyphs (retired-
 *    system remnants) are GONE. Monochrome: band = a colored dot + the band word; the
 *    Lever (the payoff) leads with a NEUTRAL cream left-rule + bold.
 *  - Eyebrow kicker "The Read" + provenance meta. Warm-cream throughout.
 *
 * Honesty spine (Pitfall 5 / D-11): bands only (Strong/Mixed/Weak) + fraction + SIM-1
 * Flash provenance — NEVER a 0-100 score (the schema forbids it). STATIC CARD ONLY (P9
 * boundary): no live cloud, no scale toggle, no audience-scoped chat — so the real action
 * is Save (the living AudienceLens is the aspirational P9/GSI upgrade).
 */

import { useState } from 'react';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import { BAND_COLOR } from './band-block';
import { VerbatimWall } from './verbatim-wall';
import { SaveAffordance } from './save-affordance';
import { CaretToggle } from './caret-toggle';
import { TrustBadge } from '@/components/audience/trust-badge';
import { stripWrappingQuotes } from '@/lib/utils';

export interface MultiAudienceReadBlockProps {
  block: MultiAudienceReadBlock;
}

const VERDICT_STYLE: Record<'stop' | 'scroll', string> = {
  stop: 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20',
  scroll: 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20',
};

const VERDICT_LABEL: Record<'stop' | 'scroll', string> = {
  stop: 'stops',
  scroll: 'scrolls',
};

/** One audience's Read — verdict name + neutral interpret/lever + who-not-for + drill. */
function AudienceRead({
  audience,
  showBand,
}: {
  audience: MultiAudienceReadBlock['props']['audiences'][number];
  /** Show the band WORD (colored) on the verdict row. TRUE only when there is no
   *  CompareVerdictRow above — so the band word appears exactly once (§0.5.6, band color
   *  is a data mark used once). In compare mode the header row is the band word's home. */
  showBand: boolean;
}) {
  const { name, band, fraction, interpretation, lever, whoNotFor, personas } = audience;
  const [expanded, setExpanded] = useState(false);

  const bandColor = BAND_COLOR[band];
  const stopCount = personas.filter((p) => p.verdict === 'stop').length;
  const total = personas.length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Verdict row — band dot + name + the band WORD (colored, once) + emitted fraction. The
          band word lives HERE so the interpretation below stays cream; in compare mode it rides
          the CompareVerdictRow instead (showBand=false) and never doubles. */}
      <div className="flex items-baseline gap-2 text-[13.5px] font-semibold text-foreground">
        <span className="h-[7px] w-[7px] shrink-0 self-center rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
        {name}
        {showBand && (
          <>
            <span className="text-foreground-muted/40" aria-hidden="true">·</span>
            <span style={{ color: bandColor }}>{band}</span>
          </>
        )}
        <span className="text-[12px] font-normal text-foreground-muted">
          {showBand ? `· ${fraction}` : fraction}
        </span>
      </div>

      {/* Interpretation — plain cream prose. The band word is stated once above (row or compare
          header); the sentence must not colorize it a second time (no "{band} Read." lead). */}
      <p className="text-[13.5px] leading-relaxed text-foreground">{interpretation}</p>

      {/* Lever — the one thing to act on. Neutral cream left-rule (NOT a coral panel). */}
      <p
        className="border-l-2 py-0.5 pl-3 text-[13.5px] leading-relaxed text-foreground-secondary"
        style={{ borderColor: 'var(--color-foreground-secondary)' }}
      >
        <b className="font-semibold text-foreground">Lever →</b> {lever}
      </p>

      {/* Who-it's-NOT-for — derived from low-disposition personas (D-10). Empty → nothing. */}
      {whoNotFor.length > 0 && (
        <p className="text-[12px] text-foreground-muted">
          <span className="font-medium">Scrolls past:</span> {whoNotFor}
        </p>
      )}

      {/* Per-audience reaction drill — collapsible. */}
      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
          aria-expanded={expanded}
        >
          <span className="text-[13px] font-medium text-foreground">
            Audience reactions
            <span className="ml-2 font-normal text-foreground-muted">
              {stopCount}/{total} stop
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] text-foreground-muted" aria-hidden="true">
            <CaretToggle open={expanded} size={12} />
            {expanded ? 'Hide' : 'Show'}
          </span>
        </button>

        {expanded && (
          <ul className="divide-y divide-white/[0.04] border-t border-white/[0.06]" role="list">
            {personas.map((persona, i) => (
              <li key={`${persona.archetype}-${i}`} className="flex flex-col gap-1 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium capitalize text-foreground">
                    {persona.archetype.replace(/_/g, ' ')}
                  </span>
                  <span className={VERDICT_STYLE[persona.verdict]} aria-label={VERDICT_LABEL[persona.verdict]}>
                    {VERDICT_LABEL[persona.verdict]}
                  </span>
                </div>
                <p className="text-[12.5px] italic leading-snug text-foreground-muted">
                  &ldquo;{stripWrappingQuotes(persona.quote)}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Compact side-by-side verdict header for the 2-audience compare (D-08) — the at-a-glance
 * "wins for X, bombs for Y" row. Band stated ONCE per audience (a colored dot + the word).
 */
function CompareVerdictRow({
  audiences,
}: {
  audiences: MultiAudienceReadBlock['props']['audiences'];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      {audiences.map((a, i) => (
        <span key={`${a.name}-${i}`} className="inline-flex items-center gap-2 text-[13.5px]">
          {i > 0 && (
            <span className="mr-1 text-foreground-muted/40" aria-hidden="true">
              ·
            </span>
          )}
          <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: BAND_COLOR[a.band] }} aria-hidden="true" />
          <span className="font-semibold text-foreground">{a.name}</span>
          <span className="font-semibold" style={{ color: BAND_COLOR[a.band] }}>
            {a.band}
          </span>
          <span className="text-[12px] text-foreground-muted">{a.fraction}</span>
        </span>
      ))}
    </div>
  );
}

export function MultiAudienceReadBlockRenderer({ block }: MultiAudienceReadBlockProps) {
  const { audiences } = block.props;
  const isCompare = audiences.length > 1;

  // Human-readable Library label derived from the lead audience (LIB-03).
  const lead = audiences[0];
  const saveTitle = lead ? `${lead.name} — ${lead.band} Read` : 'Read';

  return (
    /* The Read is a CARD. It used to be a bare `flex flex-col` — the only skill output in the
       thread with no container — so its sections floated loose on the thread background while
       every neighbour sat in a bordered surface. That is most of why it read as unfinished. */
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={saveTitle}
    >
      <div className="flex flex-col gap-4 px-4 pb-3 pt-4">
        {/* Eyebrow — "The Read" kicker; the tier badge takes the right rail. The model tag is
            NOT repeated here: it already rides the action bar below, and the card was stating
            its own provenance twice. */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">
            <span className="h-[6px] w-[6px] rounded-full bg-[var(--color-foreground-muted)]" aria-hidden="true" />
            The Read
          </span>
          <TrustBadge tier={block.props.tier ?? 'Directional'} />
        </div>

        {/* Orphaned-pin fallback (P3): the thread's pinned audience no longer exists, so this
            Read scored General instead — said out loud, once, quietly. Never a silent swap. */}
        {block.props.fallback === 'audience-removed' && (
          <p className="text-[12px] text-foreground-muted">
            Audience removed · scoring against General.
          </p>
        )}

        {/* 2-audience compare: the side-by-side verdict header (wins-for-X / bombs-for-Y). */}
        {isCompare && <CompareVerdictRow audiences={audiences} />}

        {/* Per-audience Read — interpretation + Lever + who-not-for + reaction drill. */}
        <div className="flex flex-col gap-5">
          {audiences.map((audience, i) => (
            <div
              key={`${audience.name}-${i}`}
              className={i > 0 ? 'border-t border-white/[0.06] pt-5' : undefined}
            >
              <AudienceRead audience={audience} showBand={!isCompare} />
            </div>
          ))}
        </div>

        {/* Verbatim focus-group quote wall — presentation over already-emitted quotes (D-11). */}
        <VerbatimWall audiences={audiences} />
      </div>

      {/* ACTIONS — the same bar every card ends on: provenance quiet on the left, Save as the
          icon affordance on the right. The static Read's real action IS Save (P9 boundary), so
          it holds the primary slot's position rather than sitting in a row of its own.
          Tier falls back to "Directional" — the honest default, NEVER silently "Validated". */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        <span className="text-[11px] text-foreground-muted/70">· SIM-1 Flash</span>
        <SaveAffordance
          className="ml-auto"
          item_type="read"
          title={saveTitle}
          snapshot={block.props as Record<string, unknown>}
        />
      </div>
    </div>
  );
}
