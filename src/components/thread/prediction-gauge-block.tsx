'use client';

/**
 * PredictionGaugeBlockRenderer — the honest Predict forecast card (PRED-02, 06-04).
 *
 * The ONE sanctioned, deliberately fuzzy gauge (06-UI-SPEC Surface 1). The cousin of
 * reaction-distribution-block: same matte 12px shell, same provenance header, same
 * collapsible drill, same SaveAffordance footer. The honesty line is the FEATHERED
 * SPAN — a band, never a pointer (F-02): no dial, no tick, no center dot, no marker;
 * it fades to transparent at BOTH ends so it reads "somewhere in here," not "exactly
 * here." The card is fully readable WITHOUT color: the band WORD + the `~min–max%`
 * caption + the confidence WORD carry 100% of the meaning (F-03 / Accessibility).
 *
 * The `range` is the SINGLE numeric (panel-derived); the `.strict()` schema forbids a
 * smuggled point-score. Confidence is colored (success/warning/error), the band word is
 * NOT (a likelihood has no good/bad valence) — zero accent, matte only (F-03).
 *
 * Bundle-leak-safe (Pitfall 4): imports the block TYPE only — NEVER the runner / route /
 * engine. TrustBadge + SaveAffordance are already client-safe.
 *
 * The schema is re-exported here so the Wave-0 test (and any renderer-local guard) can
 * import the validation surface alongside the component from one module.
 */

import { useState } from 'react';
import type { PredictionGaugeBlock } from '@/lib/tools/blocks';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CaretToggle } from './caret-toggle';
import { stripWrappingQuotes } from '@/lib/utils';

export { PredictionGaugeBlockSchema } from '@/lib/tools/blocks';

// Confidence semantic tones — the data trio (NOT the terracotta accent). Encodes
// confidence on the span + pill only; the band word stays cream (F-03).
const CONFIDENCE_COLOR: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'var(--color-success)',
  Medium: 'var(--color-warning)',
  Low: 'var(--color-error)',
};

// The four likelihood zones, low→high (the only orientation the span needs).
const ZONE_LABELS = ['Unlikely', 'Toss-up', 'Lean', 'Likely'] as const;

// Per-analyst ordinal lean → qualitative WORD (never a number — F-01).
const LEAN_WORD: Record<
  'strongly_no' | 'lean_no' | 'toss_up' | 'lean_yes' | 'strongly_yes',
  string
> = {
  strongly_no: 'strongly no',
  lean_no: 'leans no',
  toss_up: 'toss-up',
  lean_yes: 'leans yes',
  strongly_yes: 'strongly yes',
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export interface PredictionGaugeBlockRendererProps {
  block: PredictionGaugeBlock;
}

export function PredictionGaugeBlockRenderer({ block }: PredictionGaugeBlockRendererProps) {
  const {
    audienceName,
    scenario,
    band,
    range,
    confidence,
    factors,
    panel,
    assumptions,
    successCriterion,
    caveat,
  } = block.props;

  const [drillOpen, setDrillOpen] = useState(false);

  const confidenceColor = CONFIDENCE_COLOR[confidence];

  // The caption: a band "~min–max%", or a single "~v%" when unanimous — tilde, en-dash,
  // NO decimal, NEVER a bare oracle number.
  const isPoint = range.min === range.max;
  const rangeCaption = isPoint ? `~${range.min}%` : `~${range.min}–${range.max}%`;

  // The feathered span (F-01): on a unanimous panel, widen to a minimum ~10% feather
  // centered on the value — a band, never a tick.
  const featherMin = isPoint ? clamp(range.min - 5) : range.min;
  const featherMax = isPoint ? clamp(range.max + 5) : range.max;

  const ariaLabel = `${band}, roughly ${range.min} to ${range.max} percent, ${confidence.toLowerCase()} confidence — a directional panel forecast`;

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-transparent overflow-hidden"
      aria-label={ariaLabel}
    >
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        {/* 1 — Provenance header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            {audienceName}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-foreground-muted">SIM-1 Flash</span>
            <TrustBadge tier="Directional" />
          </div>
        </div>

        {/* 2 — Scenario lead */}
        <p className="text-sm text-foreground-secondary leading-relaxed line-clamp-2">
          On: {scenario}
        </p>

        {/* 3 — THE GAUGE: band word + range caption + confidence pill, then feathered rail */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold leading-none text-foreground">{band}</span>
            <span className="text-xs text-foreground-muted tabular-nums">{rangeCaption}</span>
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{
                color: confidenceColor,
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              Confidence: {confidence}
            </span>
          </div>

          {/* The likelihood rail with a feathered span — NO pointer, NO tick, NO dot (F-02) */}
          <div className="mt-1">
            <div className="relative h-2 rounded-full bg-white/[0.06]">
              {/* Faint zone separators at 25/50/75% */}
              {[25, 50, 75].map((pos) => (
                <span
                  key={pos}
                  aria-hidden
                  className="absolute top-0 bottom-0 w-px bg-white/[0.06]"
                  style={{ left: `${pos}%` }}
                />
              ))}
              {/* The feathered span — fades to transparent at BOTH ends ("somewhere in here") */}
              <span
                aria-hidden
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: `${featherMin}%`,
                  right: `${100 - featherMax}%`,
                  background: `linear-gradient(90deg, transparent, ${confidenceColor} 18%, ${confidenceColor} 82%, transparent)`,
                  opacity: 0.28,
                }}
              />
            </div>
            {/* Zone labels — the only orientation the span needs */}
            <div className="mt-1 flex justify-between">
              {ZONE_LABELS.map((label) => (
                <span key={label} className="text-[10px] text-foreground-muted">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4 — Factors (the receipts) — every factor names its analyst (F-05) */}
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
            What&rsquo;s driving this
          </h4>
          <ul className="flex flex-col gap-2">
            {factors.map((f, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{f.driver}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-[var(--color-surface-elevated)] text-foreground-secondary">
                    {f.analystArchetype}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color:
                        f.direction === 'for'
                          ? 'var(--color-success)'
                          : 'var(--color-foreground-muted)',
                    }}
                  >
                    {f.direction}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 5 — Panel composition drill (who reasoned) — collapsible, default collapsed */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setDrillOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
            aria-expanded={drillOpen}
          >
            <span className="text-xs text-foreground-muted">The panel — {panel.length} analysts</span>
            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
              <CaretToggle open={drillOpen} size={12} />
              {drillOpen ? 'Hide' : 'Show'}
            </span>
          </button>
          {drillOpen && (
            <ul className="flex flex-col gap-2">
              {panel.map((p, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {p.archetype}
                    </span>
                    <span className="text-xs text-foreground-muted">{LEAN_WORD[p.lean]}</span>
                  </div>
                  <blockquote className="text-sm italic text-foreground/70 leading-relaxed">
                    &ldquo;{stripWrappingQuotes(p.reasoning)}&rdquo;
                  </blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 6 — Assumptions */}
        {(assumptions.length > 0 || successCriterion) && (
          <div className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2">
            <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              Assumptions
            </h4>
            {assumptions.length > 0 && (
              <ul className="flex flex-col gap-1">
                {assumptions.map((a, i) => (
                  <li key={i} className="text-sm text-foreground-secondary leading-relaxed">
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {successCriterion && (
              <p className="text-xs text-foreground-muted">Judged against: {successCriterion}</p>
            )}
          </div>
        )}

        {/* 7 — Always-on Directional caveat (F-04) */}
        <p className="text-xs text-foreground-muted leading-relaxed">{caveat}</p>
      </div>

      {/* 8 — Footer: Save */}
      <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-4">
        <SaveAffordance item_type="read" title={audienceName} snapshot={block.props} />
      </div>
    </div>
  );
}
