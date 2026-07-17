/** @vitest-environment happy-dom */
/**
 * The scroll-spy's ANCHORS — the guard that the room watches the cards that actually exist.
 *
 * WHY THIS FILE EXISTS. `use-ambient-focus.test.ts` is fully green over a feature that has never
 * worked: it calls `focusByScroll(id)` DIRECTLY, so it proves the decision core and never once asks
 * whether anything in the product calls it. Nothing did. `useAmbientFocus` roots its
 * IntersectionObserver on `[data-ambient-card]`, and those were synthetic `sr-only` markers stacked
 * 1x1 at the top of the scroll region — five zero-height boxes above the focus line, while the real
 * cards scrolled past unobserved. The band sat pinned to the last descriptor forever.
 * See [[green-test-is-the-accomplice]]: read what a test asserts, never its name.
 *
 * THE PROPERTY LOCKED HERE is the one a shadow copy cannot satisfy:
 *
 *   every node the observer watches IS a real card — it carries that card's own text — and its
 *   `data-card-id` resolves to the LEDGER descriptor whose concept is that same text.
 *
 * The second half is what makes this more than a presence check. Ledger ids are positional
 * (`hook-0`, `hook-1` = index into `buildAmbientDescriptors`' source array), while the tool views
 * render this run's cards ABOVE the earlier ones under an "Earlier" divider — the reverse grouping.
 * So a renderer that tags cards with its own local index produces ids that point at the WRONG
 * descriptor, and the room would confidently show you another card's reaction. Asserting
 * id -> descriptor -> concept === the node's own text is what catches that, and a presence-only
 * assertion never would.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatThreadView } from '../chat-thread-view';
import { HooksThreadView } from '../hooks-thread-view';
import { buildAmbientDescriptors } from '@/components/app/home/ambient-descriptors';
import type { HookCardBlock } from '@/lib/tools/blocks';

afterEach(cleanup);

// Card renderers mount the Saved shelf (useQueryClient) — any render including a card needs this.
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** A hook card whose hookLine is the concept the ledger will key on.
 *  Must satisfy HookCardBlockSchema in full — an invalid block renders as <UnsupportedBlock>, which
 *  would make every assertion below fail for the wrong reason (no card, rather than no anchor). */
function hookCard(hookLine: string, rank: number) {
  return {
    type: 'hook-card',
    props: {
      hookLine,
      audienceArchetype: 'The Skeptic',
      mechanism: 'breaks the expected pattern in the first beat',
      seedHook: hookLine,
      rank,
      band: 'Strong',
      fraction: '4/10',
      scrollQuote: `quote for ${hookLine}`,
      model: 'sim1-flash',
      scored: true,
      channel: 'spoken',
    },
  };
}

const IDEA_CARD = {
  type: 'idea-card',
  props: {
    title: 'The 5am myth',
    angle: 'contrarian',
    whyItFits: 'your audience distrusts hustle culture',
    mechanism: 'pattern-break',
    seedHook: 'Everyone lied about 5am',
    needsTake: false,
    topic: 'morning routines',
    take: '',
    format: null,
    band: 'Strong',
    fraction: '4/5',
    scored: true,
    scrollQuote: 'Everyone lied to you about 5am',
    model: 'sim1-flash',
  },
};

const MARKDOWN_BLOCK = { type: 'markdown', props: { text: 'Here is what I think.' } };

/** The nodes the IntersectionObserver would observe, in DOM order. */
function anchors(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-ambient-card]'));
}

const chatBase = {
  persistedBlocks: [],
  streamingBlocks: [],
  isStreaming: false,
  coldStart: false,
  nudgeShown: false,
  error: null,
};

const hooksBase = {
  statusMessage: null,
  stages: [],
  followupText: null,
  isStreaming: false,
  error: null,
  platform: 'tiktok',
};

describe('ambient scroll-spy anchors — the observer watches the real cards', () => {
  // PRECONDITION, not a nicety. The first draft of this guard used an invalid hook-card fixture, so
  // every card rendered as <UnsupportedBlock> and all four tests failed with "0 anchors" — the exact
  // symptom of the bug they were written to catch, for entirely the wrong reason. A guard that fails
  // for the wrong reason proves nothing. This asserts the cards are really on screen first.
  it('PRECONDITION: the fixtures render as real cards (not UnsupportedBlock)', () => {
    const { container } = renderWithClient(
      <HooksThreadView
        {...hooksBase}
        persistedBlocks={[hookCard('An earlier hook', 1)] as unknown as HookCardBlock[]}
        streamingBlocks={[hookCard('A fresh hook', 1)] as unknown as HookCardBlock[]}
      />,
    );
    expect(container.textContent).toContain('A fresh hook');
    expect(container.textContent).toContain('An earlier hook');
  });

  it('tags each rendered chat card with the ledger id for that card', () => {
    const cards = [hookCard('Stop posting at 9am', 1), hookCard('Your hook is the whole video', 2)];
    const { descriptors } = buildAmbientDescriptors({
      activeTool: 'chat',
      hook: [],
      idea: [],
      script: [],
      remix: [],
      chat: cards,
    });

    const { container } = renderWithClient(
      <ChatThreadView {...chatBase} streamingCardBlocks={cards} />,
    );

    const found = anchors(container);
    expect(found).toHaveLength(cards.length);
    expect(found.map((n) => n.dataset.cardId)).toEqual(descriptors.map((d) => d.id));
  });

  it('anchors are the cards themselves — each carries its own card text, not an empty shadow marker', () => {
    const cards = [hookCard('Stop posting at 9am', 1), hookCard('Your hook is the whole video', 2)];
    const { container } = renderWithClient(
      <ChatThreadView {...chatBase} streamingCardBlocks={cards} />,
    );

    const found = anchors(container);
    expect(found).toHaveLength(2);
    for (const node of found) {
      // An sr-only 1x1 marker has no content. A real card wrapper contains the card's own text.
      expect(node.textContent?.trim()).not.toBe('');
    }
    expect(found[0]!.textContent).toContain('Stop posting at 9am');
    expect(found[1]!.textContent).toContain('Your hook is the whole video');
  });

  it('does NOT tag blocks that carry no reaction for the room to read (markdown, prose)', () => {
    const { container } = renderWithClient(
      <ChatThreadView {...chatBase} streamingCardBlocks={[MARKDOWN_BLOCK, IDEA_CARD]} />,
    );

    const found = anchors(container);
    // Only the idea card is reactable; the markdown block must not become an anchor.
    expect(found).toHaveLength(1);
    expect(found[0]!.dataset.cardId).toBe('idea-1');
  });

  it("THE OFF-BY-OFFSET LOCK: every anchor's id resolves to the descriptor whose concept is that anchor's own text — even though this run's cards render ABOVE the earlier ones", () => {
    // The reversal that makes local indices wrong: the ledger is [...persisted, ...streaming],
    // the DOM is [streaming..., "Earlier", ...persisted].
    const persisted = [hookCard('An earlier hook', 1), hookCard('Another earlier hook', 2)];
    const streaming = [hookCard('A fresh hook', 1), hookCard('A second fresh hook', 2)];

    const { descriptors } = buildAmbientDescriptors({
      activeTool: 'hooks',
      hook: [...persisted, ...streaming],
      idea: [],
      script: [],
      remix: [],
      chat: [],
    });
    const conceptById = new Map(descriptors.map((d) => [d.id, d.conceptText]));

    const { container } = renderWithClient(
      <HooksThreadView
        {...hooksBase}
        persistedBlocks={persisted as unknown as HookCardBlock[]}
        streamingBlocks={streaming as unknown as HookCardBlock[]}
      />,
    );

    const found = anchors(container);
    expect(found).toHaveLength(4);

    // The room must read THIS card's reaction — so the id on a card has to point at the descriptor
    // built from that same card. A renderer using its own local index passes the count check above
    // and fails right here.
    for (const node of found) {
      const id = node.dataset.cardId!;
      const concept = conceptById.get(id);
      expect(concept, `anchor id "${id}" is not in the ledger`).toBeDefined();
      expect(node.textContent, `anchor "${id}" carries another card's reaction`).toContain(concept!);
    }

    // And the ids are the real ledger ids, in DOM order: fresh cards (ledger 2,3) render first.
    expect(found.map((n) => n.dataset.cardId)).toEqual(['hook-2', 'hook-3', 'hook-0', 'hook-1']);
  });
});
