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

import type { ReactNode } from 'react';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import { BAND_COLOR } from './band-block';
import { VerbatimWall } from './verbatim-wall';
import { SaveAffordance } from './save-affordance';
import { TrustBadge } from '@/components/audience/trust-badge';

export interface MultiAudienceReadBlockProps {
  block: MultiAudienceReadBlock;
}

/** One audience's Read — verdict name + neutral interpret/lever + who-not-for. */
function AudienceRead({
  audience,
  showBand,
  trailing,
}: {
  audience: MultiAudienceReadBlock['props']['audiences'][number];
  /** Show the band WORD (colored) on the verdict row. TRUE only when there is no
   *  CompareVerdictRow above — so the band word appears exactly once (§0.5.6, band color
   *  is a data mark used once). In compare mode the header row is the band word's home. */
  showBand: boolean;
  /** One right-pinned meta item on the verdict row (the trust tier). The badge used to sit in
   *  a row of its own above — a near-empty band; it rides the row it qualifies now. */
  trailing?: ReactNode;
}) {
  const { name, band, fraction, interpretation, lever, whoNotFor } = audience;

  const bandColor = BAND_COLOR[band];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Verdict row — band dot + name + the band WORD (colored, once) + emitted fraction. The
          band word lives HERE so the interpretation below stays cream; in compare mode it rides
          the CompareVerdictRow instead (showBand=false) and never doubles. */}
      <div className="flex items-baseline gap-2 text-reading font-semibold text-foreground">
        <span className="h-[7px] w-[7px] shrink-0 self-center rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
        {name}
        {showBand && (
          <>
            <span className="text-foreground-muted/40" aria-hidden="true">·</span>
            <span style={{ color: bandColor }}>{band}</span>
          </>
        )}
        <span className="text-label font-normal text-foreground-muted">
          {showBand ? `· ${fraction}` : fraction}
        </span>
        {trailing != null && <span className="ml-auto shrink-0 self-center">{trailing}</span>}
      </div>

      {/* Interpretation — plain cream prose. The band word is stated once above (row or compare
          header); the sentence must not colorize it a second time (no "{band} Read." lead). */}
      <p className="text-reading leading-relaxed text-foreground">{interpretation}</p>

      {/* Lever — the one thing to act on. Neutral cream left-rule (NOT a coral panel). */}
      <p
        className="border-l-2 py-0.5 pl-3 text-reading leading-relaxed text-foreground-secondary"
        style={{ borderColor: 'var(--color-foreground-secondary)' }}
      >
        <b className="font-semibold text-foreground">Lever →</b> {lever}
      </p>

      {/* Who-it's-NOT-for — derived from low-disposition personas (D-10). Empty → nothing. */}
      {whoNotFor.length > 0 && (
        <p className="text-label text-foreground-muted">
          <span className="font-medium">Scrolls past:</span> {whoNotFor}
        </p>
      )}

      {/* The old "Audience reactions" accordion is GONE (2026-08-02): it drilled into the same
          per-persona quotes the VerbatimWall below already fans out, so the card carried its one
          dataset twice — a bordered box AND a quote wall. The wall (grouped, audience-tagged,
          lead quote pulled) is the stronger presentation, so it is the only one. */}
    </div>
  );
}

/**
 * Compact side-by-side verdict header for the 2-audience compare (D-08) — the at-a-glance
 * "wins for X, bombs for Y" row. Band stated ONCE per audience (a colored dot + the word).
 *
 * De-boxed 2026-07-22: was a nested `rounded-lg border bg-white/[0.02] px-3.5` box sitting
 * INSIDE the already-bordered Read card — a box-in-a-box while every sibling section runs
 * flat/flush. Now a flat summary header, flush with the card's px-4 content, divided from the
 * per-audience reads below by the same `border-b` hairline the card's other sections use.
 * Each audience is an inline-flex unit, so a narrow viewport wraps whole units (clean) rather
 * than breaking mid-audience.
 */
function CompareVerdictRow({
  audiences,
  trailing,
}: {
  audiences: MultiAudienceReadBlock['props']['audiences'];
  /** One right-pinned meta item (the trust tier) — rides this row instead of a row of its own. */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/[0.06] pb-4">
      {audiences.map((a, i) => (
        <span key={`${a.name}-${i}`} className="inline-flex items-center gap-2 text-reading">
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
          <span className="text-label text-foreground-muted">{a.fraction}</span>
        </span>
      ))}
      {trailing != null && <span className="ml-auto shrink-0">{trailing}</span>}
    </div>
  );
}

export function MultiAudienceReadBlockRenderer({ block }: MultiAudienceReadBlockProps) {
  const { audiences } = block.props;
  const isCompare = audiences.length > 1;

  // Human-readable Library label derived from the lead audience (LIB-03).
  const lead = audiences[0];
  const saveTitle = lead ? `${lead.name} — ${lead.band} Read` : 'Read';

  // Every persona who reacted, across audiences — the honest count for the provenance line.
  const totalReactions = audiences.reduce((n, a) => n + a.personas.length, 0);

  return (
    /* The Read is a CARD. It used to be a bare `flex flex-col` — the only skill output in the
       thread with no container — so its sections floated loose on the thread background while
       every neighbour sat in a bordered surface. That is most of why it read as unfinished. */
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={saveTitle}
    >
      <div className="flex flex-col gap-4 px-4 pb-3 pt-4">
        {/* The tier badge is a grounding signal, not chrome — but its own justify-end row was a
            near-empty band across the top of the card (the pattern the owner keeps flagging).
            It now rides the first content row: the verdict row (single) or the compare header. */}

        {/* Orphaned-pin fallback (P3): the thread's pinned audience no longer exists, so this
            Read scored General instead — said out loud, once, quietly. Never a silent swap. */}
        {block.props.fallback === 'audience-removed' && (
          <p className="text-label text-foreground-muted">
            Audience removed · scoring against General.
          </p>
        )}

        {/* 2-audience compare: the side-by-side verdict header (wins-for-X / bombs-for-Y). */}
        {isCompare && (
          <CompareVerdictRow
            audiences={audiences}
            trailing={<TrustBadge tier={block.props.tier ?? 'Directional'} />}
          />
        )}

        {/* Per-audience Read — interpretation + Lever + who-not-for. */}
        <div className="flex flex-col gap-5">
          {audiences.map((audience, i) => (
            <div
              key={`${audience.name}-${i}`}
              className={i > 0 ? 'border-t border-white/[0.06] pt-5' : undefined}
            >
              <AudienceRead
                audience={audience}
                showBand={!isCompare}
                trailing={
                  !isCompare && i === 0 ? (
                    <TrustBadge tier={block.props.tier ?? 'Directional'} />
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>

        {/* Verbatim focus-group quote wall — presentation over already-emitted quotes (D-11). */}
        <VerbatimWall audiences={audiences} />
      </div>

      {/* ACTIONS — the same bar every card ends on: provenance quiet on the left (plain words,
          not the model's internal name — the same jargon the Make faces shed), Save as the icon
          affordance on the right. The static Read's real action IS Save (P9 boundary). */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-2.5">
        <span className="text-caption text-foreground-muted/70">
          Simulated{totalReactions > 0 ? ` · ${totalReactions} reactions` : ' read'}
        </span>
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
