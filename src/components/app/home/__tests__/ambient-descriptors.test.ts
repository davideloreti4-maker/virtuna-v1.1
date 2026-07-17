/**
 * buildAmbientDescriptors — the ambient room's card LEDGER (which rendered cards the room reacts
 * to, and what the stepper calls them).
 *
 * THE BUG THIS LOCKS: the ledger used to be keyed on the composer CHIP —
 *
 *   if (activeTool === "hooks")  return pick(...);
 *   ...
 *   return [];                              // ← chat landed here
 *
 * — while DEFAULT_TOOL is "chat" and chat-as-agent (CHAT_AGENT_DISPATCH, default-ON) dispatches
 * REAL idea/hook/script cards inline from a chat thread. The chip stays "chat" the whole time, so
 * the product's DEFAULT path generated scored cards the audience never reacted to: the moat sat
 * silent on the main road. Kind is a property of the BLOCK, never of the chip.
 *
 * The honesty spine cuts both ways, so both directions are locked here:
 *  - a card the creator CAN see must move the room (the chat regression),
 *  - a card they CANNOT see must never move it (only the mounted view's blocks count).
 */
import { describe, it, expect } from 'vitest';
import { buildAmbientDescriptors, toAmbientDescriptor } from '../ambient-descriptors';

// A scored card block, shaped exactly as the streams/route emit it (type + props).
const card = (type: string, title: string, fraction = '7/10 stop') => ({
  type,
  props: { title, hookLine: title, fraction, scrollQuote: `q-${title}` },
});

const EMPTY = { hook: [], idea: [], script: [], remix: [], chat: [] };

describe('buildAmbientDescriptors — the ledger is keyed on the blocks, not the chip', () => {
  it('REGRESSION: a chat-as-agent dispatch (chip="chat") yields descriptors for its inline cards', () => {
    const { descriptors } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'chat',
      chat: [card('idea-card', 'Morning routine'), card('idea-card', 'Cold plunge')],
    });
    // The old chip-keyed ledger returned [] here — the room went silent next to two real cards.
    expect(descriptors).toHaveLength(2);
    expect(descriptors.map((d) => d.conceptText)).toEqual(['Morning routine', 'Cold plunge']);
  });

  it('REGRESSION: a chat dispatch is named by the BLOCK, not the chip ("Idea", never "Concept")', () => {
    const { kindLabel } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'chat',
      chat: [card('idea-card', 'Morning routine')],
    });
    expect(kindLabel).toBe('Idea');
  });

  it('a mixed-kind chat batch is named "Card" and keeps unique ids across kinds', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'chat',
      chat: [card('idea-card', 'A'), card('hook-card', 'B'), card('script-card', 'C')],
    });
    expect(kindLabel).toBe('Card');
    // Indexed across the LEDGER (not per-kind), so a mixed batch cannot collide.
    expect(descriptors.map((d) => d.id)).toEqual(['idea-0', 'hook-1', 'script-2']);
  });

  it('a plain chat turn (prose only, no cards) is the honest idle ledger', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'chat',
      chat: [{ type: 'markdown', props: { text: 'here are some thoughts' } }],
    });
    expect(descriptors).toEqual([]);
    expect(kindLabel).toBe('Concept');
  });

  it('the mounted view wins: cards from an UNMOUNTED tool never move the room', () => {
    // Ideas were generated, then the creator switched the chip to hooks → the ideas view is
    // unmounted. The room must not react to cards that are no longer on screen.
    const { descriptors } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'hooks',
      idea: [card('idea-card', 'Off-screen idea')],
      hook: [card('hook-card', 'On-screen hook')],
    });
    expect(descriptors.map((d) => d.conceptText)).toEqual(['On-screen hook']);
  });

  it('the per-tool ids stay byte-identical to the shipped scheme (hook-0, hook-1)', () => {
    const { descriptors, kindLabel } = buildAmbientDescriptors({
      ...EMPTY,
      activeTool: 'hooks',
      hook: [card('hook-card', 'A'), card('hook-card', 'B')],
    });
    expect(descriptors.map((d) => d.id)).toEqual(['hook-0', 'hook-1']);
    expect(kindLabel).toBe('Hook');
  });

  it('a tool with no reactable view (test/explore/account) is the idle ledger', () => {
    for (const activeTool of ['test', 'explore', 'account']) {
      const { descriptors, kindLabel } = buildAmbientDescriptors({
        ...EMPTY,
        activeTool,
        chat: [card('idea-card', 'not mine')],
      });
      expect(descriptors).toEqual([]);
      expect(kindLabel).toBe('Concept');
    }
  });
});

describe('toAmbientDescriptor — only a scored card is reactable', () => {
  it('reads the card’s already-emitted reaction (never re-runs a model)', () => {
    const d = toAmbientDescriptor(card('hook-card', 'Hook A', '6/10 stop'), 0);
    expect(d).toEqual({
      id: 'hook-0',
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
