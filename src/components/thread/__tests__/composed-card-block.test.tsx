/** @vitest-environment happy-dom */
/**
 * ComposedCardRenderer — the composer's one card, and the only place THE CARD CONTRACT's spine
 * (docs/subsystems/ui-skill-cards.md §0.5) is enforced for every recipe at once.
 *
 * What this file locks:
 *
 *  1. **D8 — the RENDERER owns the order.** Every assertion below reads DOM order, never the props
 *     array. The composer exists because model-chosen order drifted 16 hand-built cards out of
 *     contract; "preserve author intent" is the failure, not the feature.
 *
 *  2. **The receipt sits ABOVE the why-teaser** (§0.5 rows 3 and 4). A `proof_strip` is a receipt
 *     wherever the model happened to put it in `body`, so the renderer hoists it out of the body
 *     into row 3 rather than sorting it to the front of row 5. Sorting alone would print the
 *     evidence BELOW the mechanism on every `teardown` — the one recipe that requires a proof_strip.
 *
 *  3. **B3 — button copy comes from the capability registry, never the model and never this
 *     component.** The model names an action key; `SKILL_CAPABILITIES[action].cardAction` supplies
 *     the words. That is the rule `request_input` already follows, and it is what stops a card
 *     spoofing a control.
 *
 *  4. **ONE disclosure, ONE action bar** (§0.5 rows 6 and 7) — asserted by count, so a second
 *     labelled section cannot appear by accident.
 *
 *  5. **ZERO accent.** The dosage is LOCKED (CLAUDE.md): a card that renders colour "to make it
 *     pop" is the drift this whole lane is undoing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComposedCardRenderer } from '@/components/thread/composed-card-block';
import { MessageBlocks } from '@/components/thread/message-blocks';
import type { ComposedCardBlock } from '@/lib/tools/composed-card-schema';
import { parseComposedCard } from '@/lib/tools/composed-card-schema';
import { validateBlock } from '@/lib/tools/block-registry';
import { SKILL_CAPABILITIES, SKILL_REQUESTABLE_ACTIONS } from '@/lib/tools/skill-capabilities';
import type { HookProof } from '@/lib/tools/proof-schema';

afterEach(cleanup);

/** A real receipt, shaped exactly as `materializeReceipts` returns one (D7). */
const PROOF: HookProof = {
  handle: 'corporate.bro',
  videoUrl: null,
  coverUrl: null,
  hookTemplate: null,
  archetype: null,
  multiplier: 5.7,
  views: 1_400_000,
  baselineLabel: 'vs their usual views',
  fitLabel: null,
};

/**
 * The model deliberately emits its slots OUT of spine order: `note` (small print) first, `beats`
 * (the structural payload) second. Nothing about this card is invalid — it is the exact shape the
 * spike measured models producing, and the renderer's job is to make the order not matter.
 */
const block: ComposedCardBlock = {
  type: 'composed-card',
  props: {
    recipe: 'format-set',
    eyebrow: 'FORMAT · 1 of 3',
    deliverable: { kind: 'claim', text: 'Film the failure, not the win.' },
    why: 'The failure is the only part nobody else can copy.',
    body: [
      { kind: 'note', text: 'Works best under 30 seconds.' },
      {
        kind: 'beats',
        items: [
          { label: 'Open', text: 'Name the failure.' },
          { label: 'Turn', text: 'Show the receipt.' },
        ],
      },
    ],
    actions: ['remix'],
  },
};

function textOf(container: HTMLElement): string {
  return container.textContent ?? '';
}

describe('ComposedCardRenderer', () => {
  it('renders a card the real validator accepts (the fixture is not wishful)', () => {
    // A renderer test built on a card `parseComposedCard` would reject proves nothing about what
    // ships — the emit boundary would never let this block through.
    expect(parseComposedCard(block).ok).toBe(true);
  });

  it('renders the deliverable as the hero', () => {
    render(<ComposedCardRenderer block={block} />);
    expect(screen.getByText('Film the failure, not the win.')).toBeTruthy();
  });

  it('sorts slots into spine order regardless of model order (D8)', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    const text = textOf(container);
    expect(text.indexOf('Name the failure.')).toBeLessThan(text.indexOf('Works best under 30 seconds.'));
  });

  it('renders the eyebrow above the hero', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    const text = textOf(container);
    expect(text.indexOf('FORMAT')).toBeLessThan(text.indexOf('Film the failure'));
  });

  it('hoists a proof_strip above the why-teaser — the receipt is §0.5 row 3, the why is row 4', () => {
    // The model put its proof_strip LAST. Sorting the body alone would still leave the receipt
    // below the mechanism; the spine says evidence first.
    const withProof: ComposedCardBlock = {
      ...block,
      props: {
        ...block.props,
        body: [...block.props.body, { kind: 'proof_strip', receiptRefs: ['row-1'] }],
        receipts: { 'row-1': PROOF },
      },
    };
    const { container } = render(<ComposedCardRenderer block={withProof} />);
    const text = textOf(container);
    expect(text).toContain('corporate.bro');
    expect(text.indexOf('corporate.bro')).toBeLessThan(
      text.indexOf('The failure is the only part nobody else can copy.'),
    );
  });

  it('resolves the card-level receiptRef, and never prints the same receipt twice', () => {
    const withBoth: ComposedCardBlock = {
      ...block,
      props: {
        ...block.props,
        receiptRef: 'row-1',
        body: [...block.props.body, { kind: 'proof_strip', receiptRefs: ['row-1'] }],
        receipts: { 'row-1': PROOF },
      },
    };
    const { container } = render(<ComposedCardRenderer block={withBoth} />);
    expect(container.textContent?.match(/corporate\.bro/g)?.length).toBe(1);
  });

  it('carries a server-attached receipt through emit → persist → rehydrate → render', () => {
    // THE test for Task 5b, and the shape of it is the point. Every hop the real receipt makes is
    // here, because the defect this closes lived in a hop, not in a component:
    //
    //   1. parseComposedCard — the model-facing door. It STRIPS receipts (D7), so the card that
    //      leaves here has none, exactly as a real emit does.
    //   2. the server attaches materializeReceipts' output (Task 7's job, hand-done here).
    //   3. JSON round-trip — `messages.body` is JSON. A `Map` dies at this line, as `{}`.
    //   4. validateBlock — re-run ON RENDER (message-blocks.tsx:122). This is a zod object parse
    //      and zod strips undeclared keys; before `props.receipts` was declared it deleted the
    //      receipt here, silently, and a `teardown` rendered asserting proof it never showed.
    //
    // Handing the renderer a receipt directly would pass while all of that stayed broken — which is
    // precisely how the defect got past the previous task's own suite.
    const fromModel = {
      type: 'composed-card',
      props: {
        recipe: 'teardown',
        deliverable: { kind: 'claim', text: 'Film the failure.' },
        body: [
          { kind: 'proof_strip', receiptRefs: ['row-1'] },
          { kind: 'beats', items: [{ label: 'Open', text: 'a' }, { label: 'Turn', text: 'b' }] },
        ],
      },
    };

    const emitted = parseComposedCard(fromModel);
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) return;
    expect(emitted.block.props.receipts).toBeUndefined();

    const persisted: unknown = JSON.parse(
      JSON.stringify({
        ...emitted.block,
        props: { ...emitted.block.props, receipts: { 'row-1': PROOF } },
      }),
    );

    const validated = validateBlock(persisted);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    render(<ComposedCardRenderer block={validated.block as ComposedCardBlock} />);
    expect(screen.getByText(/corporate\.bro/)).toBeTruthy();
  });

  it('shows the receipt through <MessageBlocks> — the real call site, not a reconstruction', () => {
    // The test above rebuilds the chain by hand, which means it also rebuilds my ASSUMPTION about
    // what the thread does. This one hands the persisted body to the component the thread actually
    // mounts and lets it call validateBlock itself. If `<Component block={block} />` ever stops
    // being enough to carry a receipt, this fails and the hand-built chain would not.
    const persisted = JSON.parse(
      JSON.stringify({
        type: 'composed-card',
        props: {
          recipe: 'teardown',
          deliverable: { kind: 'claim', text: 'Film the failure.' },
          body: [
            { kind: 'proof_strip', receiptRefs: ['row-1'] },
            { kind: 'beats', items: [{ label: 'Open', text: 'a' }, { label: 'Turn', text: 'b' }] },
          ],
          receipts: { 'row-1': PROOF },
        },
      }),
    );

    const { container } = render(<MessageBlocks body={[persisted]} />);
    expect(textOf(container)).toContain('corporate.bro');
    // And it is the card, not the "we could not render this" placeholder.
    expect(textOf(container)).toContain('Film the failure.');
  });

  it('renders no receipt when the server attached none — never a placeholder', () => {
    // The other half of D7: an id the corpus could not resolve yields no entry, and the card must
    // print nothing rather than an empty tile that reads as a proof.
    const unresolved: ComposedCardBlock = {
      ...block,
      props: {
        ...block.props,
        body: [...block.props.body, { kind: 'proof_strip', receiptRefs: ['ghost-id'] }],
        receipts: {},
      },
    };
    const { container } = render(<ComposedCardRenderer block={unresolved} />);
    expect(textOf(container)).not.toContain('ghost-id');
  });

  it('renders exactly one action bar', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    expect(container.querySelectorAll("[data-testid='composed-card-actions']").length).toBe(1);
  });

  it('omits the action bar entirely when the model named none', () => {
    const noActions = { ...block, props: { ...block.props, actions: undefined } };
    const { container } = render(<ComposedCardRenderer block={noActions} />);
    expect(container.querySelectorAll("[data-testid='composed-card-actions']").length).toBe(0);
  });

  it('takes its button copy from SKILL_CAPABILITIES, not from the model (B3)', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    expect(textOf(container)).toContain(SKILL_CAPABILITIES.remix.cardAction);
  });

  it('every action the model may name has deterministic button copy', () => {
    // A card offering an action with no registry copy would render an unlabelled control — the
    // failure `chat-reachability.test.ts` already guards for the request_input field.
    for (const action of SKILL_REQUESTABLE_ACTIONS) {
      expect(SKILL_CAPABILITIES[action].cardAction.length, action).toBeGreaterThan(3);
    }
  });

  it('renders ONE disclosure, and keeps its slots behind it until it is opened (§0.5 row 6)', () => {
    const withDisclosure: ComposedCardBlock = {
      ...block,
      props: {
        ...block.props,
        disclosure: [{ kind: 'note', text: 'Measured across 40 posts in this niche.' }],
      },
    };
    const { container } = render(<ComposedCardRenderer block={withDisclosure} />);
    const toggles = container.querySelectorAll("[data-testid='composed-card-disclosure']");
    expect(toggles.length).toBe(1);
    expect(screen.queryByText('Measured across 40 posts in this niche.')).toBeNull();
    fireEvent.click(toggles[0]!);
    expect(screen.getByText('Measured across 40 posts in this niche.')).toBeTruthy();
  });

  it('has no disclosure toggle when there is nothing behind it', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    expect(container.querySelectorAll("[data-testid='composed-card-disclosure']").length).toBe(0);
  });

  it('strips the model’s own wrapping quotes off the hero (§0.5b)', () => {
    const quoted: ComposedCardBlock = {
      ...block,
      props: { ...block.props, deliverable: { kind: 'claim', text: '"Film the failure."' } },
    };
    const { container } = render(<ComposedCardRenderer block={quoted} />);
    expect(textOf(container)).not.toContain('"Film the failure."');
    expect(screen.getByText('Film the failure.')).toBeTruthy();
  });

  it('paints ZERO accent — the dosage is LOCKED', () => {
    const { container } = render(<ComposedCardRenderer block={block} />);
    const html = container.innerHTML;
    for (const banned of ['FF6363', 'ff6363', 'color-accent', 'text-accent', 'bg-accent']) {
      expect(html, banned).not.toContain(banned);
    }
  });
});
