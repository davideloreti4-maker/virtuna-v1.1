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
import { Copy, Check } from '@phosphor-icons/react';
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
    visualHook,
    band,
    fraction,
    scored,
    scrollQuote,
    channel,
    proof,
    grounded,
    target,
    population,
    provenance,
  } = block.props;

  // New Qwen call system (2026-07-22): a "projected" card's band/fraction/quote are the WRITER'S
  // generation-time estimate — no persona SIM ran. It must NOT claim a measured room reaction
  // ("looking is not measuring"): the proof unit reads in the conditional ("would react") and the
  // provenance tag says "projected", not "SIM-1 Flash". "See the room →" is the measure-it door.
  // Absent provenance ⇒ a legacy/persisted MEASURED card → unchanged wording (back-compat).
  const projected = provenance === 'projected';

  // hooks→script handoff (CHAIN_HANDOFFS hooks→script — "Write script →", the forward chain).
  // The prop override takes precedence if explicitly passed.
  const onWriteScriptFromCtx = useOnWriteScriptHook();
  const onWriteScript = onWriteScriptProp ?? (onWriteScriptFromCtx
    ? () => onWriteScriptFromCtx(hookLine, audienceArchetype)
    : undefined);

  const [expanded, setExpanded] = useState(false);

  // Copy — a hook is a line you USE, so the card offers the one-tap copy that text-on-a-card
  // never did (owner 2026-07-22). Clipboard is guarded (absent in the happy-dom test env).
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(hookLine).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }

  return (
    <div
      className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Hook #${rank}: ${hookLine.slice(0, 60)}`}
    >
      {/* FACE — always visible (D-11) */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* Asset header — the rank (scannability at a glance) on the left, a Copy affordance on
            the right. The hook reads as a deliverable you can lift, not generic text-on-a-card
            (owner 2026-07-22 — the four Make cards looked the same + buried each skill's value).
            The archetype/rank EYEBROW stays retired (2026-07-21); this is a lean asset header. */}
        <div className="flex items-center justify-between gap-3">
          {typeof rank === 'number' && rank > 0 ? (
            <span className="text-[12px] font-semibold tabular-nums text-foreground-muted">#{rank}</span>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy hook to clipboard"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-foreground-muted transition-colors hover:text-foreground-secondary"
          >
            {copied ? (
              <>
                <Check size={13} weight="bold" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={13} aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Hook line — the hero deliverable, set in the EDITORIAL SERIF (Newsreader, the brand's
            voice-moment face) at 21px. The serif + size gives the card a crafted focal point
            instead of another block of Inter — the fix for "still looks bland" (owner 2026-07-22).
            This is a genuine hero/voice-moment, the one place the design system sanctions serif. */}
        <p className="font-serif text-[21px] font-medium leading-[1.3] tracking-[-0.005em] text-foreground">
          {hookLine}
        </p>

        {/* Visual hook — the FIRST-FRAME technique that opens the video: the *execution* of the
            spoken line above, not a second hook. The technique name is a real first-frame
            technique (grounded taxonomy); the sub-line is what's literally on screen at 0s. A
            hook is spoken AND shot — the card now carries both channels (owner 2026-07-22).
            Absent → nothing renders (honesty spine; no fabricated shot). */}
        {visualHook && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <p className={SECTION_LABEL}>Visual</p>
              <span
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-foreground-secondary"
                title="First-frame technique"
              >
                {visualHook.technique}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground-secondary">{visualHook.onScreen}</p>
          </div>
        )}

        {/* Per-persona generation: the aim + the aimed-at reader's own verdict (the receipt).
            Absent on General/uncalibrated runs, and on a calibrated run whose writer named nobody
            we assigned — an honest silence, never a personalised label over a generic hook. */}
        {target && <TargetReaction target={target} />}

        {/* Proof receipt (§11f) — the real outlier this hook's structure was drawn from. Only
            present on grounded runs where a real source was attributed (honesty spine). When the
            run HAD sources and this hook cited none, say so rather than leaving a receipt-shaped
            hole beside a sibling that has one (2026-07-14). */}
        {proof ? <ProofReceipt proof={proof} /> : grounded ? <NoSourceNote /> : null}

        {/* Why it works — the hook's MECHANISM, promoted from a clamped teaser to a labeled
            payload. This is the value the hook uniquely carries; it used to be a two-line muted
            teaser that read the same as every sibling card's why-line. Full reasoning now. */}
        <div>
          <p className={`mb-1 ${SECTION_LABEL}`}>Why it works</p>
          <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{mechanism}</p>
        </div>

        {/* Proof unit — the single audience-reaction block + visible Lens entry. */}
        <ProofUnit
          framed={false}
          band={band}
          fraction={fraction}
          scored={scored ?? true}
          projected={projected}
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
          label={projected ? 'See how the room would react to this hook' : 'See how the room reacted to this hook'}
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
          {/* Provenance — honest about whether the /10 was MEASURED (SIM-1 Flash panel) or is a
              generation-time PROJECTION. A projected card has run no persona SIM, so it must not
              wear the SIM-1 Flash badge (a measurement claim). */}
          <span className="text-foreground-muted/70">{projected ? '· projected' : '· SIM-1 Flash'}</span>
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
          Write the script →
        </CardPrimaryAction>

        {/* Save (Act→State) — save this hook to the shelf (snapshot = block props). */}
        <SaveAffordance className="ml-auto" item_type="hook" title={hookLine} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}
