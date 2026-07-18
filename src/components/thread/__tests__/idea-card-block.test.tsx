/** @vitest-environment happy-dom */
/**
 * Phase 14-04 — the surface lane (KCQ-09 + KCQ-04) on the fixed idea-card renderer.
 *
 * KCQ-09 (Task 1): the existing `whyItFits` grounding line is surfaced as inline
 *   plain-language "Made for you" micro-copy on the card FACE — derived from the
 *   prop (not hardcoded), and the scroll-quote still LEADS the card (D-03: above
 *   the band fraction).
 *
 * lane/polish §2: the `predictedFailureMode` flop branch is REMOVED — the rubric-critic
 *   that populated it (S5) is gone, so the field is always null and the "If this could
 *   flop →" affordance never rendered. The card no longer carries the branch at all; these
 *   tests now guard that it stays absent even if a rehydrated card carries a stale value.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import { OpenRoomContext } from '@/lib/hook-test-context';
import { toAmbientDescriptor } from '@/components/app/home/ambient-descriptors';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

// IdeaCardRenderer mounts SaveAffordance (useSaveItem → useQueryClient), so every
// render must sit under a QueryClientProvider (Phase 10 Saved-shelf integration).
function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const WHY_IT_FITS = 'you post for time-pressed lifters who want the mechanism, not hype';
const SCROLL_QUOTE = 'Wait — I have been timing this completely wrong';
const FLOP_REASON = 'reads as a listicle the niche has seen a hundred times';

function makeBlock(overrides: Partial<IdeaCardBlock['props']> = {}): IdeaCardBlock {
  return {
    type: 'idea-card',
    props: {
      title: 'The protein-timing myth',
      angle: 'Most timing advice is cargo-culted from bodybuilding magazines',
      whyItFits: WHY_IT_FITS,
      mechanism: 'Challenges a load-bearing belief with a concrete counter-fact',
      seedHook: 'protein timing is mostly a myth',
      needsTake: false,
      topic: 'nutrition timing',
      take: 'the 30-minute window is overstated',
      format: 'talking head',
      band: 'Strong',
      fraction: '7/10 stop',
      scrollQuote: SCROLL_QUOTE,
      model: 'sim1-flash',
      predictedFailureMode: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  cleanup();
});

describe('IdeaCardRenderer — KCQ-09 made-for-you rationale (Task 1)', () => {
  it('renders the whyItFits grounding line inline on the face (derived from the prop, not hardcoded)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    // The rationale text is the exact whyItFits prop value.
    expect(screen.getByText(new RegExp(WHY_IT_FITS, 'i'))).toBeTruthy();
  });

  it('frames the rationale as plain-language "Made for you" micro-copy (not a source citation/pill)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    expect(screen.getByText(/made for you/i)).toBeTruthy();
  });

  it('derives the rationale from the prop — a different whyItFits renders different text', () => {
    const alt = 'you sell to skeptical engineers who distrust marketing language';
    renderWithClient(<IdeaCardRenderer block={makeBlock({ whyItFits: alt })} />);
    expect(screen.getByText(new RegExp(alt, 'i'))).toBeTruthy();
    expect(screen.queryByText(new RegExp(WHY_IT_FITS, 'i'))).toBeNull();
  });

  it('leads with the single proof unit — scroll-quote + visible Lens entry, fraction stated once (§1.3/§1.4)', () => {
    const { container } = renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    // The scroll-quote renders inside the single proof unit.
    expect(screen.getByText(new RegExp(SCROLL_QUOTE, 'i'))).toBeTruthy();
    // The proof unit IS the now-visible AudienceLens entry (§1.4) — "See the room →".
    expect(screen.getByText(/see the room/i)).toBeTruthy();
    // The fraction is stated ONCE (§1.3) — the old duplicated band chip is gone. Count on
    // textContent (the rendered number + "stopped" sit in sibling elements, so the raw
    // fraction string spans a tag boundary in innerHTML).
    const text = container.textContent ?? '';
    const occurrences = text.split('7/10').length - 1;
    expect(occurrences).toBe(1);
  });

  // The room LOOKS a card up by conceptText (composer's openRoomForCard →
  // `descriptors.find(x => x.conceptText === conceptText)`), and the ledger keys an idea on
  // its title ALONE (ambient-descriptors `hookLine ?? title ?? …`). This card once fired
  // `title\n\nangle`, which never equals the title-only key ⇒ the tap was a silent no-op on
  // idea cards (verified live: click fired, panel never bloomed). This locks the CTA to the
  // SSOT the room resolves against — one fact, one source. Fails against the old `title\n\nangle`.
  it('"See the room →" fires openRoomForCard with the SAME key the ledger keys this idea on', () => {
    const block = makeBlock();
    const calls: string[] = [];
    const spy = (conceptText: string) => {
      calls.push(conceptText);
      return true;
    };
    renderWithClient(
      <OpenRoomContext.Provider value={spy}>
        <IdeaCardRenderer block={block} />
      </OpenRoomContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /see how the room reacted to this idea/i }));

    // The key the room will look this card up by — derived from the SAME function the ledger uses.
    const ledgerKey = toAmbientDescriptor(block, 0)!.conceptText;
    expect(ledgerKey).toBe(block.props.title); // guards the ledger's own contract for ideas
    expect(calls).toEqual([ledgerKey]); // the CTA must fire EXACTLY that key, not title\n\nangle
  });
});

describe('IdeaCardRenderer — flop branch removed (lane/polish §2)', () => {
  it('renders NO flop affordance when predictedFailureMode is null', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: null })} />);
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    expect(screen.queryByRole('button', { name: /reveal why this idea might miss/i })).toBeNull();
    expect(screen.queryByText(/if this could flop/i)).toBeNull();
  });

  it('renders NO flop affordance when predictedFailureMode is absent (older rehydrated card)', () => {
    const block = makeBlock();
    delete (block.props as { predictedFailureMode?: string | null }).predictedFailureMode;
    renderWithClient(<IdeaCardRenderer block={block} />);
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    expect(screen.queryByText(/if this could flop/i)).toBeNull();
  });

  it('renders NO flop affordance even when a stale predictedFailureMode value is present (dead branch)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: FLOP_REASON })} />);
    // The branch was removed entirely (§2) — expanding the disclosure never surfaces it,
    // and the stale value is never rendered anywhere on the card.
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    expect(screen.queryByText(/if this could flop/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /reveal why this idea might miss/i })).toBeNull();
    expect(screen.queryByText(FLOP_REASON)).toBeNull();
  });
});
