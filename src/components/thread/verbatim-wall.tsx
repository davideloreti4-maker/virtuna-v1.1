'use client';

/**
 * VerbatimWall — the focus-group quote wall (Plan 08-06, W4 / D-11).
 *
 * Pure PRESENTATION over already-emitted per-persona quotes — NO new model call,
 * NO fabrication (D-11). The multi-audience-read block already carries each audience's
 * personas ({archetype, verdict, quote}); this component fans those quotes into a
 * focus-group wall:
 *   - grouped by stop/scroll verdict → "Stopped the scroll" / "Scrolled past"
 *   - each quote TAGGED with its audience (so a 2-audience compare reads as one room)
 *   - the sharpest (longest, most substantive) quote in each group pulled as a LEAD
 *
 * Styling: reuses the RemixCardRenderer blockquote VERBATIM — italic 14px with a 2px
 * left border (border-l-2 border-white/[0.12]) — per UI-SPEC Typography ("reuse verbatim
 * for the verbatim quote wall").
 *
 * Color discipline (UI-SPEC): section labels use semantic success (stopped) / muted
 * (scrolled). Coral is NEVER used here — it stays reserved for the Lever + interpretation
 * in the parent Read panel.
 *
 * STATIC ONLY (P9 boundary): no live cloud, no scale toggle, no chat.
 */

import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import { stripWrappingQuotes } from '@/lib/utils';

type Audiences = MultiAudienceReadBlock['props']['audiences'];

/** One quote, flattened out of its audience for the focus-group wall. */
interface WallQuote {
  quote: string;
  archetype: string;
  audienceName: string;
  verdict: 'stop' | 'scroll';
}

/** Flatten every audience's personas into audience-tagged quotes for one verdict group. */
function collectQuotes(audiences: Audiences, verdict: 'stop' | 'scroll'): WallQuote[] {
  const quotes: WallQuote[] = [];
  for (const audience of audiences) {
    for (const persona of audience.personas) {
      if (persona.verdict === verdict) {
        quotes.push({
          quote: persona.quote,
          archetype: persona.archetype,
          audienceName: audience.name,
          verdict,
        });
      }
    }
  }
  // Sharpest first: the longest (most substantive) quote leads the group. Stable sort
  // so equal-length quotes preserve their audience order — deterministic, no model call.
  return quotes.sort((a, b) => b.quote.length - a.quote.length);
}

/** One quote row — reuses the remix-card italic blockquote (2px left border) verbatim. */
function QuoteRow({ q, isLead }: { q: WallQuote; isLead: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <blockquote
        className={
          isLead
            ? 'border-l-2 border-white/[0.12] pl-3 text-sm text-foreground italic leading-snug font-medium'
            : 'border-l-2 border-white/[0.12] pl-3 text-sm text-foreground/80 italic leading-snug'
        }
      >
        &ldquo;{stripWrappingQuotes(q.quote)}&rdquo;
      </blockquote>
      {/* Audience + archetype tag — small, muted, never coral. */}
      <p className="pl-3 text-[10px] uppercase tracking-wide text-muted/60">
        {q.audienceName} · {q.archetype.replace(/_/g, ' ')}
      </p>
    </div>
  );
}

/** One verdict group — section label + its quotes (lead first). */
function VerdictGroup({
  label,
  labelClass,
  quotes,
}: {
  label: string;
  labelClass: string;
  quotes: WallQuote[];
}) {
  if (quotes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
        {label}
        <span className="ml-2 font-normal text-muted/60">{quotes.length}</span>
      </p>
      <div className="flex flex-col gap-3">
        {quotes.map((q, i) => (
          <QuoteRow key={`${q.audienceName}-${q.archetype}-${i}`} q={q} isLead={i === 0} />
        ))}
      </div>
    </div>
  );
}

export interface VerbatimWallProps {
  audiences: Audiences;
}

/**
 * The verbatim focus-group quote wall: two verdict groups (Stopped the scroll /
 * Scrolled past), each quote audience-tagged, sharpest pulled as the lead.
 *
 * Consumes already-emitted persona quotes — NO new generation (D-11).
 */
export function VerbatimWall({ audiences }: VerbatimWallProps) {
  const stopped = collectQuotes(audiences, 'stop');
  const scrolled = collectQuotes(audiences, 'scroll');

  // Nothing to show (no personas anywhere) → render nothing (no fabricated wall).
  if (stopped.length === 0 && scrolled.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/60">
        The room
      </p>
      <VerdictGroup label="Stopped the scroll" labelClass="text-success" quotes={stopped} />
      <VerdictGroup label="Scrolled past" labelClass="text-muted" quotes={scrolled} />
    </div>
  );
}
