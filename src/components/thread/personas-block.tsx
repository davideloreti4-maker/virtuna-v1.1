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
  const lensHeader = (
    <span className="px-4 py-3 text-sm font-medium text-foreground">
      Audience reactions
      <span className="ml-2 text-sm text-muted font-normal">
        {stopCount}/{total} stop
      </span>
      <span className="ml-2 text-xs text-muted/60">· see the room →</span>
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
          className="px-4 py-3 text-muted text-xs hover:text-foreground transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide reactions' : 'Show reactions'}
        >
          {expanded ? '↑ Hide' : '↓ Show'}
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
              <p className="text-sm text-muted italic leading-snug">
                &ldquo;{persona.quote}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
