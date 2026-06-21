'use client';

/**
 * BandBlock — renders a qualitative pull-band for Flash or Max output.
 *
 * Design constraints (THREAD-04 / ENGINE-03 / D-10 / D-11):
 *  - Shows band WORD (Strong / Mixed / Weak) + audience fraction ("6/10 stop").
 *  - NO 0-100 number anywhere in this renderer (honesty spine — text-mode Flash
 *    cannot back a precise forecast, D-02/D-11).
 *  - Carries a visible model tag (SIM-1 Flash / SIM-1 Max) for provenance (D-10).
 *  - Flash and Max use DISTINCT band styling so they are never visually identical (D-10).
 *
 * Zone colors are reused from score-gauge's CSS variables (--color-success /
 * --color-warning / --color-error) — we borrow the tokens, not the gauge component
 * (which hardcodes the 0-100 number we must suppress — Pitfall #1).
 */

import type { BandBlock } from '@/lib/tools/blocks';

export interface BandBlockProps {
  block: BandBlock;
}

// Zone color CSS variables (same tokens as score-gauge.tsx ZONE_VAR).
// Exported so the multi-audience-read renderer reuses the EXACT same band→color
// map (08-05 — verdict bands must never be re-rolled or coral-tinted).
export const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-success)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-error)',
};

// Model label display map (D-10 vocabulary mirrors the composer model-selector).
const MODEL_LABEL: Record<'sim1-flash' | 'sim1-max', string> = {
  'sim1-flash': 'SIM-1 Flash',
  'sim1-max': 'SIM-1 Max',
};

// Flash and Max use visually distinct containers (D-10).
// Flash: lighter border, smaller size — a quick read before shooting.
// Max: slightly more prominent — a verified prediction from a full analysis.
const MODEL_STYLE: Record<'sim1-flash' | 'sim1-max', string> = {
  'sim1-flash':
    'border border-white/[0.06] bg-white/[0.02] rounded-lg px-4 py-3',
  'sim1-max':
    'border border-white/[0.1] bg-white/[0.04] rounded-xl px-5 py-4',
};

export function BandBlockRenderer({ block }: BandBlockProps) {
  const { band, fraction, model } = block.props;
  const zoneColor = BAND_COLOR[band];
  const modelLabel = MODEL_LABEL[model];
  const containerStyle = MODEL_STYLE[model];

  return (
    <div className={containerStyle} aria-label={`${band} pull — ${fraction} — ${modelLabel}`}>
      {/* Band word — the dominant signal */}
      <div className="flex items-center gap-3">
        <span
          className="text-2xl font-semibold leading-none"
          style={{ color: zoneColor }}
        >
          {band}
        </span>
        <span className="text-sm text-muted leading-none">pull</span>
      </div>

      {/* Audience fraction — the supporting context */}
      <p className="mt-2 text-sm" style={{ color: zoneColor, opacity: 0.8 }}>
        {fraction}
      </p>

      {/* Model provenance tag (D-10) */}
      <p className="mt-2 text-xs text-muted/60">{modelLabel}</p>
    </div>
  );
}
