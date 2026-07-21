'use client';

/**
 * HookCardRenderer — hook-line-forward hook card (D-05/D-08/D-11).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte (no inset shine), warm-cream tokens, band color used once.
 *  - Eyebrow archetype kicker (band-colored dot) ABOVE the hero hook → hook reads first.
 *  - Why-teaser (mechanism) surfaced on the face; seed + delivery on expand.
 *  - ONE shared <ProofUnit> = the visible AudienceLens entry ("See the room →").
 *  - ONE forward action = the cream primary "Write script →" (§1.7) + Save icon. There is NO
 *    "Test full →" here (removed 2026-06-27): a hook is only an opener, and its handoff sent
 *    the same lone line already Flash-read — "full" referred to nothing. Deep-testing the
 *    *full script* on SIM-1 Max is the Script card's terminal step, where "full" is honest.
 *  - The dead "If this could flop →" branch is GONE — predictedFailureMode is always null
 *    (the rubric-critic that fed it was removed in S5), so it never rendered.
 *
 * THREAD-04 / D-11: the model emits validated HookCardBlock props only; THIS component owns
 * layout. No model-generated markup, no dynamic component selection.
 */

import { useState } from 'react';
import type { HookCardBlock } from '@/lib/tools/blocks';
import { useOnWriteScriptHook } from '@/lib/hook-test-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { ProofUnit } from './proof-unit';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';
import { TargetReaction } from './target-reaction';

export interface HookCardRendererProps {
  block: HookCardBlock;
  /** Optional override for the hooks→script handoff (CHAIN_HANDOFFS hooks→script).
   *  When absent, the callback is read from HookWriteScriptContext. */
  onWriteScript?: () => void;
}

export function HookCardRenderer({ block, onWriteScript: onWriteScriptProp }: HookCardRendererProps) {
  const {
    hookLine,
    audienceArchetype,
    mechanism,
    seedHook,
    rank,
    band,
    fraction,
    scored,
    scrollQuote,
    channel,
    proof,
    grounded,
    target,
    population,
  } = block.props;

  // hooks→script handoff (CHAIN_HANDOFFS hooks→script — "Write script →", the forward chain).
  // The prop override takes precedence if explicitly passed.
  const onWriteScriptFromCtx = useOnWriteScriptHook();
  const onWriteScript = onWriteScriptProp ?? (onWriteScriptFromCtx
    ? () => onWriteScriptFromCtx(hookLine, audienceArchetype)
    : undefined);

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Hook #${rank}: ${hookLine.slice(0, 60)}`}
    >
      {/* FACE — always visible (D-11) */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* The hook line IS the opener — the archetype kicker + rank eyebrow was removed 2026-07-21
            (the run capsule above already names the skill; the streamed order conveys rank; who it
            was written for now reads from the TargetReaction receipt below). */}

        {/* Hook line — the hero */}
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
          {hookLine}
        </p>

        {/* Per-persona generation: the aim + the aimed-at reader's own verdict (the receipt).
            Absent on General/uncalibrated runs, and on a calibrated run whose writer named nobody
            we assigned — an honest silence, never a personalised label over a generic hook. */}
        {target && <TargetReaction target={target} />}

        {/* Proof receipt (§11f) — the real outlier this hook's structure was drawn from. Only
            present on grounded runs where a real source was attributed (honesty spine). When the
            run HAD sources and this hook cited none, say so rather than leaving a receipt-shaped
            hole beside a sibling that has one (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Why-teaser — the mechanism surfaced on the face (full reasoning, clamped). */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground-secondary">
          <span className="text-foreground-muted">Why it works — </span>
          {mechanism}
        </p>

        {/* Proof unit — the single audience-reaction block + visible Lens entry. */}
        <ProofUnit
          framed={false}
          band={band}
          fraction={fraction}
          scored={scored ?? true}
          quote={scrollQuote}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={hookLine}
          population={population}
          rewrite={buildCardRewrite({
            skill: 'hooks',
            fraction,
            scrollQuote,
            conceptText: hookLine,
            platform: 'tiktok',
          })}
          label="See how the room reacted to this hook"
        />

        {/* Expand toggle — clearer affordance, with the provenance demoted onto this line. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse hook details' : 'Expand hook details'}
        >
          <CaretToggle open={expanded} />
          {expanded ? 'Hide details' : 'Why & details'}
          <span className="text-foreground-muted/70">· SIM-1 Flash</span>
        </button>
      </div>

      {/* EXPAND — seed + delivery (the mechanism already leads the face). */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {seedHook !== hookLine && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>Seed hook</p>
              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{seedHook}</p>
            </div>
          )}
          {channel && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>Delivery</p>
              <p className="text-[13.5px] capitalize leading-relaxed text-foreground-secondary">{channel}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions — one cream primary (forward chain) + Save icon (§0.5.7, via the primitives). */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onWriteScript}
          disabled={!onWriteScript}
          aria-label="Write a full script from this hook"
          title={onWriteScript ? 'Write a full script anchored on this hook' : 'Write script handoff not wired'}
        >
          Write script →
        </CardPrimaryAction>

        {/* Save (Act→State) — save this hook to the shelf (snapshot = block props). */}
        <SaveAffordance className="ml-auto" item_type="hook" title={hookLine} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}
