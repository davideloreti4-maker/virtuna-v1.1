'use client';

/**
 * ReactionDistributionBlockRenderer — the Simulate result card (SIMU-02).
 *
 * Branches the WHOLE layout on `subjectKind` (F-02 / D-02 — the honesty line):
 *   - person → a SINGLE read (verdict + reasoning + one quote). NO fraction, NO crowd, NO
 *     glyph grid — a single human has no honest distribution (Pitfall 2).
 *   - panel  → band WORD + fraction (from aggregateFlash, never re-rolled) + clustered themes
 *     + a collapsible per-persona reactions drill.
 *
 * Renders validated props ONLY (D-14). Bands/words only — ZERO 0-100 number (the `.strict()`
 * schema enforces it; the UI must not invent a meter or gauge). Introduces NO coral literal
 * (reskin-matte guard stays green): band tones come from the sanctioned BAND_COLOR map.
 *
 * Visual polish (final flat-warm token pass, spacing) is a separate `/gsd-ui-phase` task —
 * this renderer ships functional-but-plain.
 */

import { useState } from 'react';
import type { ReactionDistributionBlock } from '@/lib/tools/blocks';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';

// Sanctioned band tones (data colors, NOT the terracotta accent) — reuse the band-block map.
const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

export interface ReactionDistributionBlockRendererProps {
  block: ReactionDistributionBlock;
}

export function ReactionDistributionBlockRenderer({
  block,
}: ReactionDistributionBlockRendererProps) {
  const { audienceName, subjectKind, read, band, fraction, themes, reactions, model } =
    block.props;

  const modelLabel = model === 'sim1-max' ? 'SIM-1 Max' : 'SIM-1 Flash';
  const [drillOpen, setDrillOpen] = useState(false);

  const stopCount = reactions?.filter((r) => r.verdict === 'stop').length ?? 0;
  const total = reactions?.length ?? 0;

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      aria-label={`Reaction from ${audienceName}`}
    >
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {/* Provenance header (shared) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            {audienceName}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-foreground-muted">{modelLabel}</span>
            <TrustBadge tier="Directional" />
          </div>
        </div>

        {/* ── PERSON variant — single read, NO fraction (Pitfall 2) ───────────── */}
        {subjectKind === 'person' && read && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-semibold text-foreground leading-snug">
              {audienceName} is likely to be {read.verdict}
            </h3>
            <p className="text-sm text-foreground-secondary leading-relaxed">{read.reasoning}</p>
            <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
              &ldquo;{read.quote}&rdquo;
            </blockquote>
          </div>
        )}

        {/* ── PANEL variant — band + fraction + themes + drill ────────────────── */}
        {subjectKind === 'panel' && (
          <div className="flex flex-col gap-3">
            {/* Band word + fraction */}
            <div className="flex items-baseline gap-2">
              {band && (
                <span className="text-2xl font-semibold leading-none" style={{ color: BAND_COLOR[band] }}>
                  {band}
                </span>
              )}
              {fraction && <span className="text-sm text-foreground-muted">{fraction}</span>}
            </div>

            {/* Clustered themes — the panel's proof unit */}
            {themes && themes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {themes.map((theme, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                    <blockquote className="border-l-2 border-white/[0.12] pl-3 text-sm italic text-foreground/70 leading-relaxed">
                      &ldquo;{theme.quote}&rdquo;
                    </blockquote>
                  </li>
                ))}
              </ul>
            )}

            {/* Per-persona drill — collapsible */}
            {reactions && reactions.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setDrillOpen((v) => !v)}
                  className="flex items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
                  aria-expanded={drillOpen}
                >
                  <span className="text-xs text-foreground-muted">
                    Audience reactions — {stopCount}/{total} react
                  </span>
                  <span className="text-xs text-foreground-muted">{drillOpen ? '↑ Hide' : '↓ Show'}</span>
                </button>
                {drillOpen && (
                  <ul className="flex flex-col gap-2">
                    {reactions.map((r, i) => (
                      <li key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground capitalize">
                            {r.archetype}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              color:
                                r.verdict === 'stop'
                                  ? 'var(--color-success)'
                                  : 'var(--color-foreground-muted)',
                              backgroundColor: 'var(--color-surface-elevated)',
                            }}
                          >
                            {r.verdict}
                          </span>
                        </div>
                        <blockquote className="text-sm italic text-foreground/70 leading-relaxed">
                          &ldquo;{r.quote}&rdquo;
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — Save */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-4">
        <SaveAffordance item_type="read" title={audienceName} snapshot={block.props} />
      </div>
    </div>
  );
}
