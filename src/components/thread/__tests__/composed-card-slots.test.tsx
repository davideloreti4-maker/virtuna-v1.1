/** @vitest-environment happy-dom */
/**
 * SlotRenderer — the composer's ten body renderers (spec §4.2's slot vocabulary).
 *
 * What this file locks, beyond "it renders":
 *
 *  1. **A slot kind with no branch renders NOTHING, silently.** The exhaustiveness case walks the
 *     whole vocabulary with a minimal legal payload for each kind, so an 11th slot added to
 *     `SlotSchema` without a renderer fails here rather than shipping as an invisible hole in a
 *     card. `Slot` is a discriminated union, so TS catches most of it — but a `default:` or an
 *     early `return null` would slip past tsc and only this test would see it.
 *
 *  2. **A `proof_strip` never renders a placeholder for an id the corpus did not return** (D7).
 *     The model supplies row ids only; an id that resolves to nothing is simply absent. That is
 *     the structural version of "no handle → no receipt" (§0.5b) — a fabricated ref cannot reach
 *     the DOM because there is nothing to draw it from.
 *
 *  3. **A quote's attribution is not shouted.** `SECTION_LABEL` carries `uppercase`, which mangles
 *     the proper nouns an attribution is made of (`@corporate.bro` → `@CORPORATE.BRO`).
 *     `verbatim-wall.tsx` already learned this — its "who said it" line is explicitly "small,
 *     muted, sentence case (the old all-caps double tag wrapped into two shouting lines at card
 *     width)". An attribution is content, not a section label.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SlotRenderer } from '@/components/thread/composed-card-slots';
import type { Slot } from '@/lib/tools/composed-card-schema';
import type { HookProof } from '@/lib/tools/proof-schema';

afterEach(cleanup);

const NO_RECEIPTS = new Map<string, HookProof>();

const receipts = new Map<string, HookProof>([
  [
    'row-1',
    {
      handle: 'corporate.bro',
      videoUrl: null,
      coverUrl: null,
      hookTemplate: null,
      archetype: null,
      multiplier: 5.7,
      views: 1_400_000,
      baselineLabel: 'vs their usual views',
      fitLabel: null,
    },
  ],
]);

describe('SlotRenderer', () => {
  it('renders beats as label + text pairs', () => {
    render(
      <SlotRenderer
        slot={{
          kind: 'beats',
          items: [
            { label: 'Open', text: 'Name the failure.' },
            { label: 'Turn', text: 'Show the receipt.' },
          ],
        }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Name the failure.')).toBeTruthy();
    expect(screen.getByText('Turn')).toBeTruthy();
  });

  it('renders a proof_strip only for ids that resolved to a receipt', () => {
    render(
      <SlotRenderer slot={{ kind: 'proof_strip', receiptRefs: ['row-1', 'ghost-id'] }} receipts={receipts} />,
    );
    expect(screen.getByText(/corporate\.bro/)).toBeTruthy();
    expect(screen.queryByText(/ghost-id/)).toBeNull();
  });

  it('renders nothing when no receiptRef resolves', () => {
    const { container } = render(
      <SlotRenderer slot={{ kind: 'proof_strip', receiptRefs: ['ghost'] }} receipts={NO_RECEIPTS} />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders a comparison as one column per entry', () => {
    render(
      <SlotRenderer
        slot={{
          kind: 'comparison',
          columns: [
            { title: 'Talking head', points: ['Cheap'] },
            { title: 'Greenscreen', points: ['Higher retention'] },
          ],
        }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(screen.getByText('Talking head')).toBeTruthy();
    expect(screen.getByText('Greenscreen')).toBeTruthy();
    expect(screen.getByText('Higher retention')).toBeTruthy();
  });

  /**
   * stat_row's figures are SERVER numbers (owner ruling 2026-08-12). The model names a row and a
   * metric; it may not write the number. These assert that split at the pixel: the value comes
   * from the receipt map, and a stat whose ref does not resolve renders nothing rather than a
   * placeholder — the same rule proof_strip follows.
   */
  it('renders a stat_row from the RECEIPT, not from anything the model wrote', () => {
    render(
      <SlotRenderer
        slot={{
          kind: 'stat_row',
          stats: [
            { metric: 'views', label: 'views', receiptRef: 'row-1' },
            { metric: 'multiplier', label: 'vs usual', receiptRef: 'row-1' },
          ],
        }}
        receipts={receipts}
      />,
    );
    expect(screen.getByText('1.4M')).toBeTruthy();
    expect(screen.getByText('5.7×')).toBeTruthy();
    expect(screen.getByText('vs usual')).toBeTruthy();
  });

  it('drops a stat whose ref does not resolve, and the row entirely when none do', () => {
    const { container } = render(
      <SlotRenderer
        slot={{ kind: 'stat_row', stats: [{ metric: 'views', label: 'views', receiptRef: 'ghost' }] }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('drops a stat whose row has no measured multiplier (D9 — no basis, no number)', () => {
    const noBasis = new Map<string, HookProof>([
      ['row-2', { ...receipts.get('row-1')!, multiplier: null, baselineLabel: null }],
    ]);
    render(
      <SlotRenderer
        slot={{
          kind: 'stat_row',
          stats: [
            { metric: 'multiplier', label: 'vs usual', receiptRef: 'row-2' },
            { metric: 'views', label: 'views', receiptRef: 'row-2' },
          ],
        }}
        receipts={noBasis}
      />,
    );
    expect(screen.queryByText('vs usual')).toBeNull();
    expect(screen.getByText('1.4M')).toBeTruthy();
  });

  it('renders bullets as a list, one item per entry', () => {
    const { container } = render(
      <SlotRenderer slot={{ kind: 'bullets', items: ['Post it early.', 'Cut the intro.'] }} receipts={NO_RECEIPTS} />,
    );
    expect(container.querySelectorAll('li').length).toBe(2);
    expect(screen.getByText('Post it early.')).toBeTruthy();
  });

  it('renders a quote with its attribution — and does NOT shout the attribution', () => {
    render(
      <SlotRenderer
        slot={{ kind: 'quote', text: 'Nobody watches the win.', attribution: '@corporate.bro' }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(screen.getByText(/Nobody watches the win\./)).toBeTruthy();
    const attribution = screen.getByText('@corporate.bro');
    // An attribution is a proper noun. `uppercase` would render it @CORPORATE.BRO — the exact
    // all-caps shouting verbatim-wall.tsx removed from its own "who said it" line.
    expect(attribution.className).not.toMatch(/\buppercase\b/);
  });

  it('owns the typographic marks and does not double a model-quoted line (§0.5b)', () => {
    // Model text arrives with its own quotes about as often as not. §0.5b: "components own the
    // typographic marks; model text goes through stripWrappingQuotes() or you get ""doubled
    // quotes"". Eleven sites do this." This is the twelfth.
    const { container } = render(
      <SlotRenderer slot={{ kind: 'quote', text: '"Nobody watches the win."' }} receipts={NO_RECEIPTS} />,
    );
    const quoted = container.querySelector('blockquote');
    expect(quoted?.textContent).toBe('“Nobody watches the win.”');
  });

  it('renders a quote with no attribution without an empty caption', () => {
    const { container } = render(
      <SlotRenderer slot={{ kind: 'quote', text: 'Nobody watches the win.' }} receipts={NO_RECEIPTS} />,
    );
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('renders label_values as term/definition rows', () => {
    const { container } = render(
      <SlotRenderer
        slot={{ kind: 'label_values', rows: [{ label: 'Length', value: '30s' }, { label: 'Tone', value: 'Dry' }] }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(container.querySelectorAll('dt').length).toBe(2);
    expect(container.querySelectorAll('dd').length).toBe(2);
    expect(screen.getByText('Length')).toBeTruthy();
    expect(screen.getByText('30s')).toBeTruthy();
  });

  it('renders a script_timeline as an ordered list keeping the model order', () => {
    const { container } = render(
      <SlotRenderer
        slot={{
          kind: 'script_timeline',
          lines: [
            { t: '0:00', text: 'Name the cost.' },
            { t: '0:03', text: 'Show the receipt.' },
          ],
        }}
        receipts={NO_RECEIPTS}
      />,
    );
    expect(container.querySelector('ol')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text.indexOf('0:00')).toBeLessThan(text.indexOf('0:03'));
  });

  it('renders chips, one per item', () => {
    render(
      <SlotRenderer slot={{ kind: 'chips', items: ['founders', 'b2b', 'saas'] }} receipts={NO_RECEIPTS} />,
    );
    for (const chip of ['founders', 'b2b', 'saas']) expect(screen.getByText(chip)).toBeTruthy();
  });

  it('renders a note', () => {
    render(<SlotRenderer slot={{ kind: 'note', text: 'Works best under 30 seconds.' }} receipts={NO_RECEIPTS} />);
    expect(screen.getByText('Works best under 30 seconds.')).toBeTruthy();
  });

  it('has a branch for every slot kind in the vocabulary — an unrendered slot is an invisible hole', () => {
    // One minimal legal payload per kind. `proof_strip` and `stat_row` are the two kinds that
    // legitimately render nothing when their refs do not resolve, so both are given the row that does.
    const oneOfEach: Slot[] = [
      { kind: 'proof_strip', receiptRefs: ['row-1'] },
      { kind: 'beats', items: [{ label: 'Open', text: 'a' }, { label: 'Turn', text: 'b' }] },
      { kind: 'stat_row', stats: [{ metric: 'views', label: 'x', receiptRef: 'row-1' }] },
      { kind: 'bullets', items: ['a'] },
      { kind: 'quote', text: 'a' },
      { kind: 'label_values', rows: [{ label: 'a', value: 'b' }] },
      { kind: 'script_timeline', lines: [{ t: '0:00', text: 'a' }, { t: '0:03', text: 'b' }] },
      { kind: 'comparison', columns: [{ title: 'A', points: ['x'] }, { title: 'B', points: ['y'] }] },
      { kind: 'chips', items: ['a'] },
      { kind: 'note', text: 'a' },
    ];

    expect(oneOfEach.length).toBe(10); // the vocabulary is 10 (§4.2); `actions` is a card field (B2)

    for (const slot of oneOfEach) {
      const { container, unmount } = render(<SlotRenderer slot={slot} receipts={receipts} />);
      expect(container.textContent, `${slot.kind} rendered nothing`).not.toBe('');
      unmount();
    }
  });
});
