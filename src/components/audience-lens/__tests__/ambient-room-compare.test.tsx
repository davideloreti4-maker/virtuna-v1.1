/** @vitest-environment happy-dom */
/**
 * AmbientRoom — the `⤺ all N` ranked view-all ("How the room ranked your N") vs a typed ask.
 *
 * A typed thought carries no card id, so it reaches the Room as `focusId === undefined`. The
 * thought must land on ITS OWN read — never under a lingering ranked list — so it closes the
 * compare view. The `⤺ all N` toggle needs only the batch (NOT a current card focus), so it
 * stays reachable from the thought read: that is the creator's back path to the batch after an
 * ad-hoc ask (before, an ask was a one-way door out of the ranked view).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { AmbientRoom } from '../AmbientRoom';

afterEach(cleanup);

const SIBLINGS = [
  { id: 'h1', conceptText: 'Hook one', fraction: '8/10 stop' },
  { id: 'h2', conceptText: 'Hook two', fraction: '3/10 stop' },
];

const flatPersonas = [
  { archetype: 'the_skeptic', verdict: 'stop' as const, quote: 'got me' },
  { archetype: 'the_loyalist', verdict: 'scroll' as const, quote: 'meh' },
];

// NOT `embedded`: the embedded (video-Read) variant hides the focus header — and with it the
// stepper + `⤺ all N` toggle — by design. These tests exercise the dock/panel presentation,
// where the header row is the surface under test.
function renderRoom(focusId: string | undefined) {
  return (
    <AmbientRoom
      reducedMotion
      conceptText="Hook one"
      fraction="8/10 stop"
      flatPersonas={flatPersonas}
      focusId={focusId}
      siblings={SIBLINGS}
      kindLabel="Hook"
      initialCompareOpen
    />
  );
}

const rankedList = () => screen.queryByText(/How the room ranked your 2 hooks/i);
const viewAllButton = () => screen.queryByRole('button', { name: /View all 2 hooks ranked/i });

describe('AmbientRoom — ranked list vs a typed ask', () => {
  it('shows the ranked list for a card focus with >1 sibling', () => {
    render(renderRoom('h1'));
    expect(rankedList()).not.toBeNull();
  });

  it('hides the ranked list while a typed thought (no card id) is in focus', () => {
    const { rerender } = render(renderRoom('h1'));
    expect(rankedList()).not.toBeNull();
    rerender(renderRoom(undefined)); // the ask lands — thought becomes the subject
    expect(rankedList()).toBeNull();
  });

  it('keeps `⤺ all N` reachable from the thought read — the back path to the batch', () => {
    const { rerender } = render(renderRoom('h1'));
    rerender(renderRoom(undefined)); // typed ask — drill view of the thought
    const back = viewAllButton();
    expect(back).not.toBeNull();
    fireEvent.click(back!);
    expect(rankedList()).not.toBeNull(); // one tap back to "how the room ranked your N"
  });

  it('lands on the CARD read (not the ranked list) when focus returns to the same card', () => {
    const { rerender } = render(renderRoom('h1'));
    rerender(renderRoom(undefined)); // typed ask closes the compare view
    rerender(renderRoom('h1')); // tap back onto the same card → that card's people
    expect(rankedList()).toBeNull();
    expect(viewAllButton()).not.toBeNull(); // the list stays one tap away
  });

  it('still drills into a DIFFERENT card (a real re-target closes the ranked list)', () => {
    const { rerender } = render(renderRoom('h1'));
    rerender(renderRoom('h2')); // tapping another sibling = a genuine re-target
    expect(rankedList()).toBeNull();
  });
});
