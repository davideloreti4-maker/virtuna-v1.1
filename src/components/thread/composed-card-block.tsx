'use client';

/**
 * ComposedCardRenderer — the composer's ONE card, and the reason the composer exists.
 *
 * ─── D8: THE RENDERER OWNS THE ORDER ────────────────────────────────────────────────────────────
 * The model composes a SET of slots. It does not compose a LAYOUT. `docs/subsystems/ui-skill-cards.md`
 * §0.5 states the spine — eyebrow → hero → receipt → why-teaser → proof unit → ONE disclosure → ONE
 * action bar — and then: *"A card may omit a row it has no data for; it may not reorder them."*
 * §0.6 is the audit that followed: 5 of 16 hand-built cards 🔴 STRUCTURAL, and the stated cause is
 * *"cards drifted precisely because each was built alone with nothing to conform to."*
 *
 * So `props.body` is read as an unordered BAG. Nothing here preserves author intent, and that is the
 * feature: a composer that honoured model order would reproduce, per card, the exact drift the
 * sixteen hand-built cards produced per file. The spine is data (`SPINE_RANK`), the ordering is a
 * sort, and the guard on both is a DOM-order assertion in the test beside this file.
 *
 * ─── WHY `proof_strip` IS HOISTED, NOT MERELY SORTED ────────────────────────────────────────────
 * A `proof_strip` is a receipt, and the receipt is §0.5 row 3 — ABOVE the why-teaser at row 4. It
 * arrives inside `body` only because `body` is where the model composes; its meaning is a row of the
 * spine, not a body slot. Sorting it to the front of the body would still print the evidence BELOW
 * the mechanism on every `teardown` — the one recipe that REQUIRES a proof_strip. So the body is
 * partitioned first: receipts to row 3, everything else sorted into row 5.
 *
 * ─── B3: THE MODEL NAMES AN ACTION, NEVER ITS WORDS ─────────────────────────────────────────────
 * `props.actions` holds keys from `SKILL_REQUESTABLE_ACTIONS`; the button copy comes from
 * `SKILL_CAPABILITIES[action].cardAction`. No button text is written in this file and none is taken
 * from the model — the same rule `request_input` follows (*"the model only chooses WHICH action"*),
 * and what stops a card spoofing a control.
 *
 * ─── ZERO ACCENT ────────────────────────────────────────────────────────────────────────────────
 * The dosage is LOCKED (CLAUDE.md): monochrome by default, primary actions neutral via
 * <CardPrimaryAction>. There is no sanctioned accent use on this card, so it has none.
 *
 * ─── TWO SEAMS THIS FILE DOES NOT OWN ───────────────────────────────────────────────────────────
 * 1. **`receipts` arrives as a prop, and nothing in the thread passes it yet.** `message-blocks.tsx`
 *    invokes every renderer as `<Component block={block} />`, and `validateBlock` re-parses the block
 *    on render — a zod object, which STRIPS undeclared keys. So a receipt attached to `props` at emit
 *    time would not survive to here unless `ComposedCardBlockSchema` DECLARES a field for it, which
 *    today it does not (it has `receiptRef`, a row id, and nothing to resolve it into). Until it
 *    does, a composed card renders no receipt in a real thread. Kept as an explicit prop rather than
 *    faked: the renderer stays a pure function of its inputs and the gap stays visible.
 * 2. **`onAction` is unwired.** Nothing yet routes a card's forward step to the skill it names. The
 *    bar renders with `disabled` until a handler is supplied — the shape `hook-card-block.tsx` uses
 *    for its own unwired handoff (`disabled={!onWriteScript}`), so an unwired control LOOKS unwired
 *    instead of silently swallowing a tap.
 *
 * ─── NO <SaveAffordance> (a deliberate omission from §0.5 row 7) ────────────────────────────────
 * Save writes `saved_items.item_type`, whose CHECK constraint is
 * ('read','idea','hook','script','outlier','format','remix') — none of which means "a composed card".
 * `20260802120100_saved_items_integrity.sql` exists precisely because remix-card-block once saved as
 * `'hook'` "because no remix type existed, so the shelf labelled a [remix as a hook]". Mapping eight
 * recipes onto that list would repeat that bug, and a supabase CHECK violation is a write that
 * stores nothing and does not complain. Save returns when it has a type of its own.
 */

import { useState } from 'react';
import type { ComposedCardBlock, Slot, SlotKind, ActionId } from '@/lib/tools/composed-card-schema';
import type { HookProof } from '@/lib/tools/proof-schema';
import { SKILL_CAPABILITIES } from '@/lib/tools/skill-capabilities';
import { stripWrappingQuotes } from '@/lib/utils';
import { CardEyebrow, CardHero, CopyAffordance, CardPrimaryAction, CardActionBar } from './card-primitives';
import { CaretToggle } from './caret-toggle';
import { ProofReceipt } from './proof-receipt';
import { SlotRenderer } from './composed-card-slots';

/**
 * THE SPINE, as data. Rank order for §0.5 row 5 (the body), lowest first.
 *
 * A `Record<SlotKind, number>` and not the `SlotKind[]` + `indexOf` the plan proposed, for one
 * reason worth the extra characters: an array leaves a missing kind at `indexOf === -1`, which sorts
 * it FIRST — a new slot would silently jump the queue ahead of the beats. The record is exhaustive
 * by the type system, so an 11th slot kind fails `tsc` until someone decides where in the spine it
 * belongs. Same lockstep the BLOCK_REGISTRY / BLOCK_COMPONENTS pair relies on.
 *
 * The order, and why:
 *   proof_strip     — never reaches this sort; it is hoisted to row 3 (see the header). Ranked
 *                     anyway so the record stays total and a future un-hoist is not a silent -1.
 *   stat_row        — measured context for the claim, and the closest thing the body has to
 *                     evidence. §0.6 flags "hero = a number" as structural drift, so it sits BELOW
 *                     the hero, never as it.
 *   beats           — the structural payload of every `-set` recipe. This is the thing the card is.
 *   script_timeline — the same role for `script`.
 *   comparison      — the same role for `comparison`.
 *   bullets         — supporting prose, after the structure it supports.
 *   label_values    — a field list is a spec sheet: reference, read after the argument.
 *   quote           — evidence quoted in support, not the deliverable.
 *   chips           — a tag row. Meta about the card, not content of it.
 *   note            — small print, always last. A caveat that leads is a card apologising first.
 * Only a handful of these pairs ever co-occur (a recipe's `legalSlots` is narrow), and each pair
 * that does is decided above.
 */
const SPINE_RANK: Record<SlotKind, number> = {
  proof_strip: 0,
  stat_row: 1,
  beats: 2,
  script_timeline: 3,
  comparison: 4,
  bullets: 5,
  label_values: 6,
  quote: 7,
  chips: 8,
  note: 9,
};

/**
 * Split the model's bag of slots into the two spine rows they belong to, and order row 5.
 *
 * The sort is stable (ES2019 guarantees it), so slots of the SAME kind keep the order the model
 * wrote them in — two `beats` blocks are a sequence the model authored, and there is no contract
 * rule to reorder them by. D8 is about rows of the spine, not about shuffling peers.
 */
function partitionSpine(slots: Slot[]): { receipts: Slot[]; body: Slot[] } {
  return {
    receipts: slots.filter((s) => s.kind === 'proof_strip'),
    body: slots
      .filter((s) => s.kind !== 'proof_strip')
      .sort((a, b) => SPINE_RANK[a.kind] - SPINE_RANK[b.kind]),
  };
}

export interface ComposedCardRendererProps {
  block: ComposedCardBlock;
  /**
   * Server-materialized receipts, keyed by teardown row id (D7). The model supplies ids; only this
   * map can turn one into a handle and a number, which is what makes a fabricated handle
   * unreachable. Absent ⇒ no receipts render. See seam 1 in the header — nothing wires this yet.
   */
  receipts?: Map<string, HookProof>;
  /**
   * The forward-chain handler. Given an action key the model named, run it. Absent ⇒ the bar renders
   * disabled. See seam 2 in the header.
   */
  onAction?: (action: ActionId) => void;
}

export function ComposedCardRenderer({ block, receipts, onAction }: ComposedCardRendererProps) {
  const { eyebrow, deliverable, receiptRef, why, body, disclosure, actions } = block.props;
  const [expanded, setExpanded] = useState(false);

  const resolved = receipts ?? new Map<string, HookProof>();
  const { receipts: receiptSlots, body: spineBody } = partitionSpine(body);

  // §0.5 row 3, assembled from BOTH inputs the card can carry a receipt through: the card-level
  // `receiptRef` and any hoisted `proof_strip`. They can name the same row, and printing one source
  // twice reads as two independent proofs — so the card-level ref yields only when no proof_strip
  // already claims it.
  const stripRefs = new Set(
    receiptSlots.flatMap((s) => (s.kind === 'proof_strip' ? s.receiptRefs : [])),
  );
  const cardProof = receiptRef && !stripRefs.has(receiptRef) ? resolved.get(receiptRef) : undefined;
  const hasReceiptRow = Boolean(cardProof) || receiptSlots.length > 0;

  // A liftable line is what the creator came for, so the hero ships with copy. The model's own
  // wrapping quotes come off first (§0.5b — the component owns the typographic marks; eleven sites
  // already do this) and the CLIPBOARD gets the same string the card shows.
  const heroText = stripWrappingQuotes(deliverable.text);

  // The forward steps, resolved to registry copy. An action with no capability entry is dropped
  // rather than rendered as an empty button — impossible today (the schema's refinement checks
  // membership) but the bar must not be able to draw a nameless control if that ever loosens.
  const resolvedActions = (actions ?? []).filter((a) => Boolean(SKILL_CAPABILITIES[a]));

  return (
    <div
      className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`${block.props.recipe}: ${heroText.slice(0, 60)}`}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* 1 — EYEBROW. The quiet kicker: what this card IS, or its place in a set. Never
            provenance (§0.5.1), and the model cannot put a number here it did not measure because
            the field is free text the composer's own recipe copy fills. */}
        {eyebrow && <CardEyebrow kicker={eyebrow} />}

        {/* 2 — HERO. The typed deliverable (D6). A `line` is a usable sentence, a `claim` is the
            argument, a `name` is a title — the recipe decided which, so this row never has to guess
            whether it is showing a label or the payoff. That guess IS the Profile Read bug §0.5
            names ("its payoff sitting third at body weight"). */}
        <CardHero
          as={deliverable.kind === 'name' ? 'h3' : 'p'}
          affordance={<CopyAffordance text={heroText} aria-label="Copy this line to clipboard" />}
        >
          {heroText}
        </CardHero>

        {/* 3 — RECEIPT. Hoisted out of `body`; see the header. Nothing renders when no ref resolved:
            an unresolvable id is simply absent, never a placeholder tile (§0.5b, D7). */}
        {hasReceiptRow && (
          <div className="flex flex-col gap-2">
            {cardProof && <ProofReceipt proof={cardProof} />}
            {receiptSlots.map((slot, i) => (
              <SlotRenderer key={`receipt-${i}`} slot={slot} receipts={resolved} />
            ))}
          </div>
        )}

        {/* 4 — WHY-TEASER. ONE clamped line of the mechanism (§0.5 row 4), and deliberately unlabelled:
            a "WHY IT WORKS" label here would be the first rung of the ALL-CAPS ladder §0.5 names as
            the failure mode, on a card whose body slots already carry labels of their own. */}
        {why && <p className="line-clamp-1 text-body text-foreground-secondary">{why}</p>}

        {/* 5 — BODY, in spine order. The model's order is discarded (D8). */}
        {spineBody.map((slot, i) => (
          <SlotRenderer key={`slot-${i}`} slot={slot} receipts={resolved} />
        ))}

        {/* 6 — THE ONE DISCLOSURE (§0.5 row 6). Labelled "Details", not the contract's literal
            "Why & details": the why-teaser is already on the face two rows up, so promising a "why"
            behind the caret promises something the card has already given. hook-card-block.tsx made
            exactly this correction for exactly this reason ("the old 'Why & details' promised the
            mechanism, which already leads the face") and §0.6 marks that card ✅ THE BAR.
            Absent when empty — a toggle over an empty drawer is chrome. */}
        {disclosure && disclosure.length > 0 && (
          <button
            type="button"
            data-testid="composed-card-disclosure"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse card details' : 'Expand card details'}
          >
            <CaretToggle open={expanded} />
            Details
          </button>
        )}
      </div>

      {expanded && disclosure && disclosure.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {disclosure.map((slot, i) => (
            <SlotRenderer key={`disclosure-${i}`} slot={slot} receipts={resolved} />
          ))}
        </div>
      )}

      {/* 7 — THE ONE ACTION BAR (§0.5 row 7). Neutral <CardPrimaryAction>, never accent. The words
          come from SKILL_CAPABILITIES; this file writes none (B3). Omitted entirely when the model
          named no action — an empty bar is chrome. */}
      {resolvedActions.length > 0 && (
        <CardActionBar data-testid="composed-card-actions">
          {resolvedActions.map((action) => (
            <CardPrimaryAction
              key={action}
              onClick={onAction ? () => onAction(action) : undefined}
              disabled={!onAction}
              title={onAction ? SKILL_CAPABILITIES[action].label : 'Not wired yet'}
            >
              {SKILL_CAPABILITIES[action].cardAction}
            </CardPrimaryAction>
          ))}
        </CardActionBar>
      )}
    </div>
  );
}
