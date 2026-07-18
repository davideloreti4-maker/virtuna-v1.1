/** @vitest-environment happy-dom */
/**
 * ProofUnit "See the room →" resolves the tapped card by its LEDGER id, not concept text.
 *
 * THE BUG THIS LOCKS (family of #306): two cards with an IDENTICAL concept both opened the FIRST
 * room. openRoomForCard matched on `conceptText` alone; the disambiguating id (`data-card-id`,
 * which scroll-spy already keys on) was never handed to the tap. Here we mount two ProofUnits with
 * the same concept under DIFFERENT `AmbientCardIdContext` ids and assert the recorded open carries
 * each card's OWN id — a presence/first-match check would pass on the old code and miss this.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ProofUnit } from '../proof-unit';
import { OpenRoomContext, AmbientCardIdContext } from '@/lib/hook-test-context';
import type { OpenRoomForCardFn } from '@/lib/hook-test-context';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';

afterEach(cleanup);

const PERSONAS: FlatPersonaReaction[] = [
  { archetype: 'The Skeptic', verdict: 'scroll', quote: 'heard it before' },
  { archetype: 'The Aspirant', verdict: 'stop', quote: 'okay that got me' },
];

// One ProofUnit wired as the home-composer path (openRoomForCard present + personas non-empty),
// wrapped in the id context the real MessageBlocks provides.
function card(cardId: string, fraction: string, open: OpenRoomForCardFn) {
  return (
    <OpenRoomContext.Provider value={open}>
      <AmbientCardIdContext.Provider value={cardId}>
        <ProofUnit
          band="Strong"
          fraction={fraction}
          quote="a lead reaction"
          flatPersonas={PERSONAS}
          conceptText="The Infinite Coffee Loop"
          label={`open-${cardId}`}
        />
      </AmbientCardIdContext.Provider>
    </OpenRoomContext.Provider>
  );
}

describe('ProofUnit → openRoomForCard threads the card id (dup-concept safe)', () => {
  it('tapping the SECOND of two identical concepts passes ITS id, not the first', () => {
    const open = vi.fn((_c: string, _id?: string | null): boolean => true);
    render(card('idea-15', '3/10', open));
    render(card('idea-16', '8/10', open));

    fireEvent.click(screen.getByLabelText('open-idea-16'));
    expect(open).toHaveBeenCalledWith('The Infinite Coffee Loop', 'idea-16');

    fireEvent.click(screen.getByLabelText('open-idea-15'));
    expect(open).toHaveBeenCalledWith('The Infinite Coffee Loop', 'idea-15');
  });

  it('keyboard (Enter) opens with the card id too', () => {
    const open = vi.fn((_c: string, _id?: string | null): boolean => true);
    render(card('hook-2', '6/10', open));
    fireEvent.keyDown(screen.getByLabelText('open-hook-2'), { key: 'Enter' });
    expect(open).toHaveBeenCalledWith('The Infinite Coffee Loop', 'hook-2');
  });
});
