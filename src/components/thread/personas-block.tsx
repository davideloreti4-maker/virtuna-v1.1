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

export interface PersonasBlockProps {
  block: PersonasBlock;
}

const VERDICT_STYLE: Record<'stop' | 'scroll', string> = {
  stop: 'text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20',
  scroll: 'text-xs font-medium px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20',
};

const VERDICT_LABEL: Record<'stop' | 'scroll', string> = {
  stop: 'stops',
  scroll: 'scrolls',
};

export function PersonasBlockRenderer({ block }: PersonasBlockProps) {
  const { personas } = block.props;
  const [expanded, setExpanded] = useState(false);

  const stopCount = personas.filter((p) => p.verdict === 'stop').length;
  const total = personas.length;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header row — summary + expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-foreground">
          Audience reactions
          <span className="ml-2 text-sm text-muted font-normal">
            {stopCount}/{total} stop
          </span>
        </span>
        <span className="text-muted text-xs" aria-hidden="true">
          {expanded ? '↑ Hide' : '↓ Show'}
        </span>
      </button>

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
