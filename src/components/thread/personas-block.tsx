'use client';

/**
 * PersonasBlock — Flash-specific persona expand/list renderer.
 *
 * Renders {archetype, verdict, quote} persona shapes (D-03).
 * Does NOT import PersonaCloud (which consumes video-shaped HeatmapPayload —
 * A5 adapter decision from RESEARCH.md; the Flash quote shape doesn't fit PersonaCloud).
 *
 * Layout: a collapsible list of persona rows, each showing:
 *  - archetype name
 *  - verdict badge (stop/scroll)
 *  - first-person quote (the audience texture D-03 mentions sells the moat)
 */

import { useState } from 'react';
import type { PersonasBlock } from '@/lib/tools/blocks';
import { LensTrigger } from '@/components/audience-lens/LensTrigger';
import { CaretToggle } from './caret-toggle';
import { stripWrappingQuotes } from '@/lib/utils';

export interface PersonasBlockProps {
  block: PersonasBlock;
  /**
   * The concept text these personas reacted to (the text Read surface). When present, the
   * block mounts the reusable AudienceLens inline (cascade mode, D-06) — without it the
   * block renders byte-identical to before (no concept to chat/rewrite about).
   */
  conceptText?: string;
}

const VERDICT_STYLE: Record<'stop' | 'scroll', string> = {
  stop: 'text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20',
  scroll: 'text-xs font-medium px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20',
};

const VERDICT_LABEL: Record<'stop' | 'scroll', string> = {
  stop: 'stops',
  scroll: 'scrolls',
};

export function PersonasBlockRenderer({ block, conceptText }: PersonasBlockProps) {
  const { personas } = block.props;
  const [expanded, setExpanded] = useState(false);

  const stopCount = personas.filter((p) => p.verdict === 'stop').length;
  const total = personas.length;

  // The text Read surface mounts the single reusable AudienceLens inline (D-04), opened in
  // cascade mode (flat Shape-B, no timeline — D-06). The PersonasBlock IS already the
  // {archetype, verdict, quote} shape buildFlatPersonaNodes consumes, so it maps 1:1.
  // lane/polish (§1.4): the cue is now a VISIBLE Lens entry — avatars + "See the room →".
  const lensHeader = (
    <span className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
      Audience reactions
      <span className="font-normal text-foreground-muted">
        {stopCount}/{total} stopped
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-foreground-secondary">
        <span className="flex" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[15px] w-[15px] rounded-full border border-surface-thread bg-white/[0.10]"
              style={{ marginLeft: i === 0 ? 0 : -5 }}
            />
          ))}
        </span>
        See the room →
      </span>
    </span>
  );

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header row — summary + expand toggle. When a concept is present, the summary cue
          opens the Lens; the chevron still toggles the inline list. */}
      <div className="flex items-center justify-between">
        {conceptText ? (
          <LensTrigger
            flatPersonas={personas}
            conceptText={conceptText}
            label="See how the room reacted"
          >
            {lensHeader}
          </LensTrigger>
        ) : (
          lensHeader
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-4 py-3 text-xs text-foreground-muted transition-colors hover:text-foreground"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide reactions' : 'Show reactions'}
        >
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <CaretToggle open={expanded} size={12} />
            {expanded ? 'Hide' : 'Show'}
          </span>
        </button>
      </div>

      {/* Persona rows — visible when expanded */}
      {expanded && (
        <ul className="border-t border-white/[0.06] divide-y divide-white/[0.04]" role="list">
          {personas.map((persona) => (
            <li
              key={persona.archetype}
              className="px-4 py-3 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground capitalize">
                  {persona.archetype.replace(/_/g, ' ')}
                </span>
                <span className={VERDICT_STYLE[persona.verdict]} aria-label={VERDICT_LABEL[persona.verdict]}>
                  {VERDICT_LABEL[persona.verdict]}
                </span>
              </div>
              <p className="text-sm italic leading-snug text-foreground-muted">
                &ldquo;{stripWrappingQuotes(persona.quote)}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
