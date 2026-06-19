'use client';

/**
 * MultiAudienceReadBlock — the Read, single-audience static card (Plan 08-05, W3).
 *
 * The moat payoff: a concept lands a real typed Read card with a grade glyph, a
 * one-line interpretation, a Lever, a who-it's-NOT-for line, and a collapsible
 * per-audience persona drill. Follows the LOCKED sketch 005 `.read` interpret+lever
 * spine (.planning/sketches/005-audience-scale) + UI-SPEC B1.
 *
 * STATIC CARD ONLY (P9 boundary): NO live cloud, NO scale toggle (Panel·10 ⇄
 * Population·1,000), NO audience-scoped chat. Those are Plan 09. This renders the
 * static-card landing point of every chain BEFORE filming.
 *
 * Honesty spine (Pitfall 5 / D-11): bands only (Strong/Mixed/Weak) + fraction +
 * SIM-1 Flash provenance — NEVER a 0-100 score (the schema already forbids it).
 *
 * Color discipline (UI-SPEC):
 *  - Verdict band words reuse the EXACT band-block BAND_COLOR map (success/warning/
 *    error) — NEVER coral. Coral is reserved for the Lever + the `.read`
 *    interpretation highlight ONLY.
 *
 * Array shape (D-09): the block carries an `audiences` array. This plan emits a
 * single entry; the renderer already maps over the array so Plan 08-06's 2-audience
 * compare is additive, not a rewrite.
 */

import { useState } from 'react';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';
import { BAND_COLOR } from './band-block';

export interface MultiAudienceReadBlockProps {
  block: MultiAudienceReadBlock;
}

type Band = 'Strong' | 'Mixed' | 'Weak';

// Grade glyph by band (sketch 005 `.read .gl`): ✦ Strong / ◐ Mixed / △ Weak.
const GRADE_GLYPH: Record<Band, string> = {
  Strong: '✦',
  Mixed: '◐',
  Weak: '△',
};

// Coral `.read` panel styling from sketch 005 (coral-bd / coral-bg / radius 12px).
// Applied via inline style (Lightning CSS strips some properties from classes;
// inline keeps the coral border/bg exact).
const READ_PANEL_STYLE: React.CSSProperties = {
  border: '1px solid rgba(255,127,80,0.30)',
  background: 'rgba(255,127,80,0.08)',
  borderRadius: 12,
};

const VERDICT_STYLE: Record<'stop' | 'scroll', string> = {
  stop: 'text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20',
  scroll:
    'text-xs font-medium px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20',
};

const VERDICT_LABEL: Record<'stop' | 'scroll', string> = {
  stop: 'stops',
  scroll: 'scrolls',
};

/** One audience's Read — verdict row + coral Read panel + who-not-for + persona drill. */
function AudienceRead({
  audience,
}: {
  audience: MultiAudienceReadBlock['props']['audiences'][number];
}) {
  const { name, band, fraction, interpretation, lever, whoNotFor, personas } = audience;
  const [expanded, setExpanded] = useState(false);

  const bandColor = BAND_COLOR[band];
  const glyph = GRADE_GLYPH[band];
  const stopCount = personas.filter((p) => p.verdict === 'stop').length;
  const total = personas.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Verdict row — {Audience}: {band} {n}/10. Band colored by BAND_COLOR (never coral). */}
      <div className="flex items-baseline gap-2 text-[15px]">
        <span className="font-semibold text-foreground">{name}:</span>
        <span className="font-semibold" style={{ color: bandColor }}>
          {band}
        </span>
        <span className="text-sm text-muted">{fraction}</span>
      </div>

      {/* The Read — coral-bordered interpret + lever panel (sketch 005 .read). */}
      <div className="flex gap-3 p-3.5" style={READ_PANEL_STYLE}>
        <span className="text-[15px] leading-tight" aria-hidden="true">
          {glyph}
        </span>
        <div className="text-[13px] leading-relaxed">
          {/* Interpretation — coral highlight reserved for this + the Lever.
              Uses the canonical --color-accent (coral-500) token via text-accent. */}
          <span className="font-semibold text-accent">{band} Read.</span>{' '}
          <span className="text-foreground">{interpretation}</span>
          {/* Lever — the one thing to act on. */}
          <span className="mt-1.5 block text-xs text-muted">
            <b className="font-semibold text-foreground">Lever →</b> {lever}
          </span>
        </div>
      </div>

      {/* Who-it's-NOT-for — derived from low-disposition personas (D-10). */}
      {/* Empty whoNotFor (all-hot panel) → render nothing (no fabricated segment). */}
      {whoNotFor.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-medium text-muted">Scrolls past:</span> {whoNotFor}
        </p>
      )}

      {/* Per-audience persona drill — collapsible (reuses {archetype,verdict,quote}). */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
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

        {expanded && (
          <ul
            className="border-t border-white/[0.06] divide-y divide-white/[0.04]"
            role="list"
          >
            {personas.map((persona, i) => (
              <li key={`${persona.archetype}-${i}`} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {persona.archetype.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={VERDICT_STYLE[persona.verdict]}
                    aria-label={VERDICT_LABEL[persona.verdict]}
                  >
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
    </div>
  );
}

export function MultiAudienceReadBlockRenderer({ block }: MultiAudienceReadBlockProps) {
  const { audiences } = block.props;

  return (
    <div className="flex flex-col gap-5">
      {audiences.map((audience, i) => (
        <AudienceRead key={`${audience.name}-${i}`} audience={audience} />
      ))}
      {/* Provenance — SIM-1 Flash. No 0-100 number anywhere (honesty spine). */}
      <p className="text-xs text-muted/60">SIM-1 Flash</p>
    </div>
  );
}
