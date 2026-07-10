/** @vitest-environment happy-dom */
/**
 * AmbientRoom — the `⤺ all N` ranked view-all ("How the room ranked your N") survives a typed ask.
 *
 * A typed thought carries no card id, so it reaches the Room as `focusId === undefined`. That is a
 * transient subject, not a re-target: the ranked list correctly hides while the thought is in focus
 * (the stepper needs a card id), but it must come BACK when focus returns to the same card. Treating
 * the thought as a focus CHANGE cleared `compareOpen` on the way out and again on the way back, so
 * the list could only be recovered by a manual re-tap of the compare toggle.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
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

function renderRoom(focusId: string | undefined) {
  return (
    <AmbientRoom
      embedded
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

  it('restores the ranked list when focus returns to the SAME card after an ask', () => {
    const { rerender } = render(renderRoom('h1'));
    rerender(renderRoom(undefined)); // typed ask
    rerender(renderRoom('h1')); // tap back onto the same card
    expect(rankedList()).not.toBeNull();
  });

  it('still drills into a DIFFERENT card (a real re-target closes the ranked list)', () => {
    const { rerender } = render(renderRoom('h1'));
    rerender(renderRoom('h2')); // tapping another sibling = a genuine re-target
    expect(rankedList()).toBeNull();
  });
});
