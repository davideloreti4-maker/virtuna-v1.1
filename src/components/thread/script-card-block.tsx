'use client';

/**
 * ScriptCardRenderer — beat-structured script card (D-02/D-05/THREAD-04).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte, warm-cream, band color used once.
 *  - Eyebrow kicker "Opener stops the scroll" + beat-count meta.
 *  - ONE shared <ProofUnit> labelled "opener only" (honesty spine — the fraction describes
 *    the opening beat's scroll-stop, NOT full-watch retention).
 *  - Beats = quiet bordered rows; retention reasoning inline on expand (no per-beat color).
 *  - ONE cream primary = the chain's terminal step "Test full script →" (§1.7) — deep-tests
 *    the WHOLE script on SIM-1 Max vs the opener-only Flash read shown above; Save = icon.
 *    ("full script", not "full video" — the uploaded-video read is the separate /analyze Read.)
 *
 * THREAD-04: the model emits validated ScriptCardBlock props only; THIS component owns layout.
 */

import { useState } from 'react';
import type { ScriptCardBlock } from '@/lib/tools/blocks';
import { useOnTestScript } from '@/lib/script-test-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { BAND_COLOR } from './band-block';
import { ProofUnit } from './proof-unit';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CaretToggle } from './caret-toggle';

export interface ScriptCardRendererProps {
  block: ScriptCardBlock;
  /** Optional: wired by Plan 06-05 to route script→Test handoff.
   *  When absent, reads from ScriptTestContext; falls back to stub if neither present. */
  onTest?: () => void;
}

export function ScriptCardRenderer({ block, onTest: onTestProp }: ScriptCardRendererProps) {
  const { beats, openingBeatSeed, band, fraction, scrollQuote, proof, grounded } = block.props;

  // Read ScriptTestContext — enables ScriptThreadView to provide the handler without
  // prop-drilling through MessageBlocks (mirrors HookCardRenderer + HookTestContext).
  const onTestCtx = useOnTestScript();

  // Resolve: explicit prop > context > null (stub)
  const onTest = onTestProp ?? (onTestCtx
    ? () => {
        const openerLine = openingBeatSeed || (beats[0]?.content ?? '');
        const brief = beats.map((b) => `[${b.label}] ${b.content}`).join(' / ').slice(0, 400);
        onTestCtx(openerLine, brief);
      }
    : undefined);

  const [expandedBeats, setExpandedBeats] = useState<Set<number>>(new Set([0]));
  const bandColor = BAND_COLOR[band];

  function toggleBeat(index: number) {
    setExpandedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label="Script card"
    >
      {/* FACE — opener signal (Pitfall 5: opener-only honesty spine). */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Eyebrow — "Opener stops the scroll" kicker + beat-count meta. */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-foreground-muted">
            <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
            Opener stops the scroll
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
            {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
            <span className="text-foreground-muted/70"> · SIM-1 Flash</span>
          </span>
        </div>

        {/* Proof receipt (§11f fan-out) — the real outlier this script's structure was drawn
            from. Only present on grounded runs where a real source was attributed. A script has
            no sibling to look half-rendered against, but the absence is the same fact and the
            primitive is shared, so it states it too (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Proof unit — opener-only (the fraction is scoped to the opening beat). */}
        <ProofUnit
          band={band}
          fraction={fraction}
          quote={scrollQuote}
          suffix="opener only"
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={openingBeatSeed || (beats[0]?.content ?? '')}
          rewrite={buildCardRewrite({
            skill: 'script',
            fraction,
            scrollQuote,
            conceptText: openingBeatSeed || (beats[0]?.content ?? ''),
            platform: 'tiktok',
          })}
          label="See how the room reacted to this opener"
        />
      </div>

      {/* BEATS — quiet bordered rows; retention reasoning inline on expand. */}
      <div className="flex flex-col gap-2 border-t border-white/[0.06] px-4 py-3">
        {beats.map((beat, index) => {
          const isExpanded = expandedBeats.has(index);
          return (
            <div
              key={index}
              className="flex flex-col gap-1.5 rounded-md border border-white/[0.06] px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-foreground">
                    {beat.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-foreground-muted" aria-label={`Timing: ${beat.timing}`}>
                    {beat.timing}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBeat(index)}
                  className="text-[12px] text-foreground-muted transition-colors hover:text-foreground-secondary"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${beat.label} reasoning` : `Expand ${beat.label} reasoning`}
                >
                  <CaretToggle open={isExpanded} />
                </button>
              </div>

              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{beat.content}</p>

              {isExpanded && (
                <p className="text-[12px] leading-relaxed text-foreground-muted">
                  ↳ {beat.retentionMarker}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions — one cream primary (forward chain "Test full →") + Save icon. */}
      <div className="flex items-center gap-3.5 border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onTest}
          disabled={!onTest}
          className="rounded-[8px] bg-[var(--color-action)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40"
          aria-label="Test the full script on the deeper SIM-1 Max pipeline"
          title={onTest ? 'Test the full script (beyond the opener) on SIM-1 Max' : 'Test full script wiring lands in Plan 06-05'}
        >
          Test full script →
        </button>

        <SaveAffordance
          className="ml-auto"
          item_type="script"
          title={openingBeatSeed ?? beats[0]?.content}
          snapshot={block.props}
        />
      </div>
    </div>
  );
}
