/**
 * readToCardReaction — the Read → CardReaction "Glance" producer (Seam 1).
 *
 * Locks the mapping in docs/SURFACE-SEAM-SPEC.md §1 row 1 + the honesty spine:
 *  - cardId ← contentId, stop passthrough.
 *  - tone banded off the /10 stop (≥6 loved, ≤4 bounced, else neutral) — the same threshold the
 *    Room's meterTone uses, so the glance dot agrees with the Room when the card opens.
 *  - lead = a REAL reaction verbatim: prefer a voice agreeing with the card tone, else the first
 *    non-empty verdict, else '' (never fabricated).
 *
 * Run: node ./node_modules/vitest/vitest.mjs run src/lib/room-contract/__tests__/read-to-card-reaction.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readToCardReaction } from '../read-to-card-reaction';
import type { Read, Reaction, Tone } from '../types';

function reaction(tone: Tone, verdict: string): Reaction {
  return { person: { id: 'p', name: 'P', segment: 's' }, tone, verdict };
}

function mkRead(over: Partial<Read> = {}): Read {
  return {
    contentId: 'card-x',
    stop: 7,
    split: { loved: 60, bounced: 30, neutral: 10 },
    weakSpot: 'w',
    fix: 'f',
    reactions: [reaction('loved', 'love it'), reaction('bounced', 'meh')],
    ...over,
  };
}

describe('readToCardReaction — passthrough + tone', () => {
  it('passes cardId ← contentId and stop through', () => {
    const cr = readToCardReaction(mkRead({ contentId: 'abc', stop: 8 }));
    expect(cr.cardId).toBe('abc');
    expect(cr.stop).toBe(8);
  });

  it('bands the tone off the /10 stop (meterTone thresholds)', () => {
    const cases: [number, Tone][] = [
      [10, 'loved'],
      [6, 'loved'],
      [5, 'neutral'],
      [4, 'bounced'],
      [0, 'bounced'],
    ];
    for (const [stop, tone] of cases) {
      expect(readToCardReaction(mkRead({ stop })).tone).toBe(tone);
    }
  });
});

describe('readToCardReaction — lead (real verbatim, tone-agreeing)', () => {
  it('prefers a lead whose voice agrees with the card tone', () => {
    const cr = readToCardReaction(
      mkRead({ stop: 8, reactions: [reaction('bounced', 'nope'), reaction('loved', 'this is great')] }),
    );
    expect(cr.tone).toBe('loved');
    expect(cr.lead).toBe('this is great'); // the loved voice wins over the earlier bounced one
  });

  it('falls back to the first real verbatim when no voice agrees with the tone', () => {
    const cr = readToCardReaction(mkRead({ stop: 9, reactions: [reaction('bounced', 'only a bounce here')] }));
    expect(cr.tone).toBe('loved');
    expect(cr.lead).toBe('only a bounce here');
  });

  it('never fabricates a lead — empty string when no reaction carried words', () => {
    const cr = readToCardReaction(
      mkRead({ reactions: [reaction('loved', ''), reaction('neutral', '   ')] }),
    );
    expect(cr.lead).toBe('');
  });

  it('yields an empty lead for a Read with no reactions (never throws)', () => {
    expect(readToCardReaction(mkRead({ reactions: [] })).lead).toBe('');
  });
});

describe('readToCardReaction — against a full contract Read', () => {
  it('derives the card face from a complete Read (the same shape the graft feeds)', () => {
    const cr = readToCardReaction(
      mkRead({
        contentId: 'idea-cancel',
        stop: 7,
        reactions: [
          reaction('loved', 'finally someone honest — saved it'),
          reaction('bounced', 'cancelling? instant unfollow'),
        ],
      }),
    );
    expect(cr.cardId).toBe('idea-cancel');
    expect(cr.stop).toBe(7);
    expect(cr.tone).toBe('loved'); // 7/10 → loved band
    expect(cr.lead).toBe('finally someone honest — saved it'); // first loved voice's verbatim
  });
});

describe('readToCardReaction — determinism', () => {
  it('is a pure function: identical input → deep-equal output', () => {
    const read = mkRead();
    expect(readToCardReaction(read)).toEqual(readToCardReaction(read));
  });
});
