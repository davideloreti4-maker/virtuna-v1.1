/**
 * buildAmbientDescriptors — the ambient room's card LEDGER (which rendered cards the room reacts
 * to, and what the stepper calls them).
 *
 * Thread-unification Phase 4: the ledger is now a SINGLE flat array — the thread's on-screen blocks
 * in DOM order, `[...persistedChatTurns.flatMap(t => t.blocks), ...activeStreamCards]` — the SAME
 * array PersistedThreadStream + the active live view render. So a descriptor's positional id
 * `${kind}-${idx}` matches the `data-card-id` scroll-spy anchor MessageBlocks stamps at that index.
 * The "which cards are on screen" decision (the honesty spine) now lives in the CALLER's construction
 * of this array — only rendered persisted history + the mounted view's live cards go in.
 *
 * The prior bug the shape guards against: kind is a property of the BLOCK, never of the chip — a
 * chat-dispatched idea card is an Idea even while the chip reads "chat".
 */
import { describe, it, expect } from 'vitest';
import { buildAmbientDescriptors, toAmbientDescriptor, resolveFocusDescriptor } from '../ambient-descriptors';
import type { AmbientCardDescriptor } from '@/components/app/home/use-ambient-focus';

// A scored card block, shaped exactly as the streams/route emit it (type + props).
const card = (type: string, title: string, fraction = '7/10 stop') => ({
  type,
  props: { title, hookLine: title, fraction, scrollQuote: `q-${title}` },
});
const md = (text: string) => ({ type: 'markdown', props: { text } });

describe('buildAmbientDescriptors — the flat unified ledger', () => {
  it('a flat ledger yields a descriptor per reactable card, named by the BLOCK', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors([
      card('idea-card', 'Morning routine'),
      card('idea-card', 'Cold plunge'),
    ]);
    expect(descriptors).toHaveLength(2);
    expect(descriptors.map((d) => d.conceptText)).toEqual(['Morning routine', 'Cold plunge']);
    expect(kindLabel).toBe('Idea'); // named by the block type, never the chip
  });

  it('a mixed-kind batch is named "Card" and keeps unique ids across kinds', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors([
      card('idea-card', 'A'),
      card('hook-card', 'B'),
      card('script-card', 'C'),
    ]);
    expect(kindLabel).toBe('Card');
    expect(descriptors.map((d) => d.id)).toEqual(['idea-0', 'hook-1', 'script-2']);
  });

  it('ALIGNMENT: non-card blocks consume an index so ids match the rendered DOM anchors', () => {
    // The ledger is the SAME flat array MessageBlocks renders, and MessageBlocks indexes over EVERY
    // block (markdown included). A markdown block yields no descriptor but MUST still consume its index,
    // or every later card's id would be off-by-one from its `data-card-id` anchor (the #306 failure).
    const { descriptors } = buildAmbientDescriptors([
      md('you asked for hooks'), // idx 0 — user/co-pilot prose, not reactable
      card('hook-card', 'Hook one'), // idx 1
      card('hook-card', 'Hook two'), // idx 2
      md('want a script?'), // idx 3 — co-pilot line
      card('idea-card', 'An idea'), // idx 4
    ]);
    expect(descriptors.map((d) => d.id)).toEqual(['hook-1', 'hook-2', 'idea-4']);
    expect(descriptors.map((d) => d.conceptText)).toEqual(['Hook one', 'Hook two', 'An idea']);
  });

  it('a persisted-history + live-tail ledger indexes the live cards after the persisted ones', () => {
    // Composer builds [...persistedFlat, ...activeStreamCards]; the live cards' ids continue the
    // count, matching the live view's ambientBaseIndex = persisted block count.
    const persistedFlat = [md('q'), card('hook-card', 'Persisted hook')];
    const liveCards = [card('idea-card', 'Live idea 1'), card('idea-card', 'Live idea 2')];
    const { descriptors } = buildAmbientDescriptors([...persistedFlat, ...liveCards]);
    expect(descriptors.map((d) => d.id)).toEqual(['hook-1', 'idea-2', 'idea-3']);
  });

  it('an empty ledger, or prose only, is the honest idle ledger', () => {
    expect(buildAmbientDescriptors([]).descriptors).toEqual([]);
    expect(buildAmbientDescriptors([]).kindLabel).toBe('Concept');
    const proseOnly = buildAmbientDescriptors([md('here are some thoughts')]);
    expect(proseOnly.descriptors).toEqual([]);
    expect(proseOnly.kindLabel).toBe('Concept');
  });

  it('a uniform batch keeps the byte-identical scheme (hook-0, hook-1) + its label', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors([
      card('hook-card', 'A'),
      card('hook-card', 'B'),
    ]);
    expect(descriptors.map((d) => d.id)).toEqual(['hook-0', 'hook-1']);
    expect(kindLabel).toBe('Hook');
  });
});

describe('resolveFocusDescriptor — a tap opens the card that was tapped (dup-concept safe)', () => {
  // Two cards, IDENTICAL concept text, DIFFERENT ledger ids — the #306 family shape
  // ("The Infinite Coffee Loop" landing on idea-15 and idea-16).
  const desc = (id: string, conceptText: string, fraction: string): AmbientCardDescriptor => ({
    id,
    conceptText,
    fraction,
    scrollQuote: `q-${id}`,
    personas: undefined,
    population: undefined,
  });
  const dupes: AmbientCardDescriptor[] = [
    desc('idea-15', 'The Infinite Coffee Loop', '3/10'),
    desc('idea-16', 'The Infinite Coffee Loop', '8/10'),
  ];

  it('THE BUG (#306 family): tapping the SECOND dup opens its OWN room, not the first', () => {
    // Old code matched conceptText alone → always the first (3/10). The id is what disambiguates.
    const hit = resolveFocusDescriptor(dupes, 'The Infinite Coffee Loop', 'idea-16');
    expect(hit?.id).toBe('idea-16');
    expect(hit?.fraction).toBe('8/10');
  });

  it('the first dup still resolves to the first when its own id is passed', () => {
    const hit = resolveFocusDescriptor(dupes, 'The Infinite Coffee Loop', 'idea-15');
    expect(hit?.id).toBe('idea-15');
    expect(hit?.fraction).toBe('3/10');
  });

  it('no id in context (off-composer surfaces) falls back to concept text — the first match', () => {
    const hit = resolveFocusDescriptor(dupes, 'The Infinite Coffee Loop');
    expect(hit?.id).toBe('idea-15');
  });

  it('a stale id that matches nothing degrades to the concept-text match (never a hard miss)', () => {
    const hit = resolveFocusDescriptor(dupes, 'The Infinite Coffee Loop', 'idea-999');
    expect(hit?.id).toBe('idea-15');
  });

  it('returns null when nothing matches by id OR concept', () => {
    expect(resolveFocusDescriptor(dupes, 'Some other concept', 'hook-3')).toBeNull();
  });
});

describe('toAmbientDescriptor — only a scored card is reactable', () => {
  it('reads the card’s already-emitted reaction (never re-runs a model)', () => {
    const d = toAmbientDescriptor(card('hook-card', 'Hook A', '6/10 stop'), 0);
    expect(d).toEqual({
      id: 'hook-0',
      kind: 'hook',
      conceptText: 'Hook A',
      fraction: '6/10 stop',
      scrollQuote: 'q-Hook A',
      personas: undefined,
      population: undefined,
    });
  });

  it('drops a non-card block', () => {
    expect(toAmbientDescriptor({ type: 'markdown', props: { text: 'hi' } }, 0)).toBeNull();
    expect(toAmbientDescriptor({ type: 'band', props: { fraction: '7/10' } }, 0)).toBeNull();
  });

  it('drops a card with no fraction — an unscored card has no reaction to show', () => {
    expect(toAmbientDescriptor({ type: 'idea-card', props: { title: 'A' } }, 0)).toBeNull();
  });

  it('drops a malformed block instead of throwing', () => {
    expect(toAmbientDescriptor(null, 0)).toBeNull();
    expect(toAmbientDescriptor({ type: 'idea-card' }, 0)).toBeNull();
  });

  it('threads personas + population through when the card carries them', () => {
    const personas = [{ archetype: 'lurker', stopped: true }];
    const population = { n: 1000, stopped: 700 };
    const d = toAmbientDescriptor(
      { type: 'idea-card', props: { title: 'A', fraction: '7/10', scrollQuote: 'q', personas, population } },
      3,
    );
    expect(d?.personas).toBe(personas);
    expect(d?.population).toBe(population);
  });
});
