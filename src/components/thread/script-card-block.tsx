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
import { ProofUnit } from './proof-unit';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar } from './card-primitives';
import { CaretToggle } from './caret-toggle';

export interface ScriptCardRendererProps {
  block: ScriptCardBlock;
  /** Optional: wired by Plan 06-05 to route script→Test handoff.
   *  When absent, reads from ScriptTestContext; falls back to stub if neither present. */
  onTest?: () => void;
}

export function ScriptCardRenderer({ block, onTest: onTestProp }: ScriptCardRendererProps) {
  const { beats, openingBeatSeed, band, fraction, scrollQuote, proof, grounded, population } = block.props;

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
        {/* The "Opener stops the scroll" kicker eyebrow was removed 2026-07-21 (generic restatement;
            the run capsule above already names the skill). The opener's stop-rate is carried by the
            ProofUnit below, and the beat count reads from the Script section. */}

        {/* Proof receipt (§11f fan-out) — the real outlier this script's structure was drawn
            from. Only present on grounded runs where a real source was attributed. A script has
            no sibling to look half-rendered against, but the absence is the same fact and the
            primitive is shared, so it states it too (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Proof unit — opener-only (the fraction is scoped to the opening beat). Variant-A
            "quiet" de-box: borderless reaction row so the framed receipt above is the card's one
            inner frame (2026-07-18). */}
        <ProofUnit
          band={band}
          fraction={fraction}
          quote={scrollQuote}
          suffix="opener only"
          framed={false}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={openingBeatSeed || (beats[0]?.content ?? '')}
          population={population}
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

      {/* BEATS — Variant-A "quiet" de-box (2026-07-18): borderless rows separated by hairlines,
          aligned to the card edge. Was five bordered boxes-within-the-card (spec-sheet density);
          whitespace + hairlines carry the rhythm now. Retention reasoning inline on expand. */}
      <div className="flex flex-col border-t border-white/[0.06] px-4">
        {beats.map((beat, index) => {
          const isExpanded = expandedBeats.has(index);
          return (
            <div
              key={index}
              className="flex flex-col gap-1.5 border-b border-white/[0.06] py-3.5 last:border-b-0"
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

      {/* Actions — one cream primary (forward chain "Test full →") + Save icon (§0.5.7). */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onTest}
          disabled={!onTest}
          aria-label="Test the full script on the deeper SIM-1 Max pipeline"
          title={onTest ? 'Test the full script (beyond the opener) on SIM-1 Max' : 'Test full script wiring lands in Plan 06-05'}
        >
          Test full script →
        </CardPrimaryAction>

        <SaveAffordance
          className="ml-auto"
          item_type="script"
          title={openingBeatSeed ?? beats[0]?.content}
          snapshot={block.props}
        />
      </CardActionBar>
    </div>
  );
}
