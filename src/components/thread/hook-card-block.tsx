'use client';

/**
 * HookCardRenderer — hook-line-forward hook card (D-05/D-08/D-11).
 *
 * lane/polish refined language (docs/subsystems/ui-skill-cards.md §1–§2):
 *  - Flat matte (no inset shine), warm-cream tokens, band color used once.
 *  - Rank + Copy ride the hero row (2026-08-02); the old header band was near-empty chrome.
 *  - Why-teaser (mechanism) surfaced on the face; seed + delivery on expand.
 *  - ONE shared <SimDoor> = the visible AudienceLens entry (2026-08-02: replaces the on-face
 *    ProofUnit — a projected card carries no verdict apparatus, only the door to measure it).
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
import { SimDoor } from './sim-door';
import { ProofReceipt, NoSourceNote } from './proof-receipt';
import { plausibleSeedHook } from '@/lib/tools/runners/output-guards';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, CardHero, CopyAffordance, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';

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

  // What the expand drawer actually holds — the toggle names it, and vanishes when it is empty.
  // N-2 (Stage A): the runner now rejects junk seeds, but persisted pre-fix rows still
  // carry the literal sourceIndex digits ("0", "1", "3") in this field — suppress any
  // seed that is not plausibly a spoken line rather than render it under a SEED LINE label.
  const hasSeed = seedHook !== hookLine && plausibleSeedHook(seedHook);
  const hasDelivery = Boolean(channel);

  return (
    <div className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      {/* F-14 — the card's name, as a real HEADING rather than an `aria-label`.
          This string was an `aria-label` on this same plain `<div>`, which assistive tech
          DROPS: `aria-label` needs a role to attach to, and a generic div has none. So the
          line below is not new copy — it is the copy that was already written here finally
          reaching the people it was written for, and it now also puts every card in the
          heading jump-list (`h2` per turn → `h3` per card, thread-shell.tsx).

          The numeral is dropped on a projected card — otherwise a screen reader is told
          "Hook #1" while the sighted card shows no rank, which is the same unmeasured claim
          served only to the people who cannot see that it was withdrawn. The hook line already
          identifies the card, so nothing is lost. (Found in browser verification, not by the
          suite.) */}
      <h3 className="sr-only">
        {projected ? `Hook: ${hookLine.slice(0, 60)}` : `Hook #${rank}: ${hookLine.slice(0, 60)}`}
      </h3>
      {/* FACE — always visible (D-11) */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* HERO ROW — rank gutter · the hook · Copy. This row IS the header contract's reference
            shape: the other four cards were refitted to it, and it now comes from <CardHero>
            rather than being hand-rolled here (2026-08-02). Rank and Copy used to sit alone in a
            header band above the hook — an almost-empty strip across the top of every card
            (owner-flagged). They are meta ABOUT the hook, so they ride the hook's own row. The
            archetype/rank EYEBROW stays retired (2026-07-21). */}
        {/* ⚠️ The `#N` is DROPPED on a projected card (2026-08-05, owner call). `rank` is assigned by
            sorting on `hook.personaStops` — the hook-writing model's estimate of its OWN hooks
            (hooks-runner.ts:609-625, "the WRITER'S self-estimate, not a measured room reaction").
            Printing "#1" states a ranking nothing measured, which is the same fabrication the board
            already stopped committing when it retired the queued row's `N/10`
            (AmbientOverview.tsx:46-48) and the sim door stopped printing band/fraction on a
            projected card (sim-door.tsx:118). The cards stay in that order — an order claims only
            "this is the sequence they came in"; a numeral claims a measurement. A MEASURED card
            (provenance absent ⇒ legacy/persisted, or a fired run) keeps its numeral. */}
        <CardHero
          gutter={!projected && typeof rank === 'number' && rank > 0 ? `#${rank}` : undefined}
          affordance={<CopyAffordance text={hookLine} aria-label="Copy hook to clipboard" />}
        >
          {hookLine}
        </CardHero>

        {/* Visual hook — the FIRST-FRAME technique that opens the video: the *execution* of the
            spoken line above, not a second hook. The technique name is a real first-frame
            technique (grounded taxonomy); the sub-line is what's literally on screen at 0s. A
            hook is spoken AND shot — the card carries both channels (owner 2026-07-22). The box
            is deliberate and owner-restored (2026-08-02): the shot is a SECOND deliverable, and
            the container is what separates it from the spoken line above.
            Absent → nothing renders (honesty spine; no fabricated shot). */}
        {visualHook && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <p className={SECTION_LABEL}>Visual</p>
              <span
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-caption font-medium text-foreground-secondary"
                title="First-frame technique"
              >
                {visualHook.technique}
              </span>
            </div>
            <p className="text-body leading-relaxed text-foreground-secondary">{visualHook.onScreen}</p>
          </div>
        )}

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
          <p className="text-reading leading-relaxed text-foreground-secondary">{mechanism}</p>
        </div>

        {/* Expand toggle — named for what it actually reveals (the old "Why & details" promised
            the mechanism, which already leads the face). Hidden entirely when there is nothing
            behind it: a toggle over an empty drawer is chrome. */}
        {(hasSeed || hasDelivery) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            // `tap-44`: measured 131×18 on a phone (F-19) — a bare text row with a caret, the
            // smallest target on the card. Hit area only; the row keeps its 18px rhythm.
            className="tap-44 flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse hook details' : 'Expand hook details'}
          >
            <CaretToggle open={expanded} />
            {hasSeed && hasDelivery ? 'Seed line & delivery' : hasSeed ? 'Seed line' : 'Delivery'}
          </button>
        )}
      </div>

      {/* EXPAND — seed + delivery (the mechanism already leads the face). */}
      {expanded && (hasSeed || hasDelivery) && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {hasSeed && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>Seed line</p>
              <p className="text-reading leading-relaxed text-foreground-secondary">{seedHook}</p>
            </div>
          )}
          {hasDelivery && (
            <div>
              <p className={`mb-1 ${SECTION_LABEL}`}>Delivery</p>
              <p className="text-reading capitalize leading-relaxed text-foreground-secondary">{channel}</p>
            </div>
          )}
        </div>
      )}

      {/* AUDIENCE BAND — who this hook was written for (a real slice of the calibrated audience)
          and the door that turns the aim into a measured reaction. Its own hairline zone: the
          foot now reads as audience-then-actions instead of three loose half-empty lines. */}
      <SimDoor
        projected={projected}
        target={target}
        band={band}
        fraction={fraction}
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
        label={projected ? 'Simulate this hook with your audience' : 'See how your audience reacted to this hook'}
      />

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
