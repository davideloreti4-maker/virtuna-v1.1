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
 *
 * Design law (§1.3 / §0.5 — this primitive is where the cards learn it):
 *  - Band color used ONCE: the dot + the word. The fraction is neutral cream, NEVER band-tinted.
 *  - The band word is NOT a hero. It is a label reporting a result, and §0.5.2 reserves the hero
 *    for the deliverable. This renderer led with a 24px colored band word, and Simulate
 *    (reaction-distribution) and Predict (prediction-gauge) both copied it as their hero — which
 *    is why a "low risk" primitive was the source of the drift on two other cards.
 *  - BAND_COLOR below is THE map. Import it; do not re-declare a local copy (two maps, one
 *    meaning, and they drift apart silently).
 */

import type { BandBlock } from '@/lib/tools/blocks';

export interface BandBlockProps {
  block: BandBlock;
}

// Zone color CSS variables (same tokens as score-gauge.tsx ZONE_VAR).
// Exported so the multi-audience-read renderer reuses the EXACT same band→color
// map (08-05 — verdict bands must never be re-rolled or coral-tinted).
//
// CALM PALETTE (owner 2026-07-22): unified onto the Test card's restrained system — the Test
// card felt calmer than the Make cards' bright bands, so every band surface now speaks its
// language. Strong = sage (--color-positive, the matte warm green, NOT the bright --color-success);
// Weak = the soft accent-TEXT coral (#ff8080, legible-on-dark, the same token the Test card's
// NOT-WORKING column uses — NOT the solid #FF6363 fill). Mixed stays amber (already matched Test).
// One map, applied once per card (the ProofUnit dot + word), recolors every band surface at once.
export const BAND_COLOR: Record<'Strong' | 'Mixed' | 'Weak', string> = {
  Strong: 'var(--color-positive)',
  Mixed: 'var(--color-warning)',
  Weak: 'var(--color-accent-text)',
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
      {/* Band row — the SAME idiom as <ProofUnit>: dot + word carry the band color ONCE, and the
          fraction sits beside them in neutral cream. This row is deliberately NOT a hero: the old
          `text-2xl` band word was a 24px colored LABEL standing in for a deliverable, and Simulate
          and Predict both copied it as their hero. §0.5.2 — the hero is the thing the user came
          for, "not a label, not a name, not a score". A band primitive has no deliverable of its
          own; it reports one. So it reads as a row, and the drift has no source to copy. */}
      <div className="flex items-center gap-2.5 text-[13px]">
        <span
          className="inline-flex shrink-0 items-center gap-1.5 font-semibold"
          style={{ color: zoneColor }}
        >
          <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: zoneColor }} />
          {band}
        </span>
        <span className="shrink-0 text-foreground-muted">pull</span>
        {/* Fraction stated ONCE, in neutral cream. It used to be band-colored at opacity 0.8 —
            the second application §1.3 forbids ("band color used ONCE, never double-applied"). */}
        <span className="shrink-0 font-semibold tabular-nums text-foreground">{fraction}</span>
      </div>

      {/* Provenance is a footnote, never a headline (§0.5.6). */}
      <p className="mt-2 text-xs text-foreground-muted">{modelLabel}</p>
    </div>
  );
}
