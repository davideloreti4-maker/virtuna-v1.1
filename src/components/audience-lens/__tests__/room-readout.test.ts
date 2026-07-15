import { describe, it, expect } from 'vitest';
import { buildRoomReadout } from '../room-readout';
import type { PersonaNode } from '@/components/board/_kit';

/**
 * The fixtures are shaped like the REAL thing the flat (text) path emits: `buildFlatPersonaNodes`
 * derives watchThrough BINARY from the verdict (stop → 1, scroll → 0) and never invents a
 * continuous attention number. A fixture with smooth 0.6/0.4 watch-throughs could not occur on a
 * hook card, and a fixture that cannot occur is not a test (the lesson that cost this card a
 * silently-blank map with a green suite).
 */
const node = (p: Partial<PersonaNode> & { id: string }): PersonaNode => ({
  label: p.id,
  weight: 0.5,
  watchThrough: 0,
  ...p,
});

const room = (): PersonaNode[] => [
  node({ id: 'a', label: 'Core fan', segment: 'Core', watchThrough: 1, quote: 'Finally someone said it.' }),
  node({ id: 'b', label: 'Core fan 2', segment: 'Core', watchThrough: 1, quote: 'Saving this.' }),
  node({ id: 'c', label: 'Core fan 3', segment: 'Core', watchThrough: 1 }),
  node({ id: 'd', label: 'New viewer', segment: 'New', watchThrough: 0, quote: 'No idea who this is.', tone: 'accent' }),
  node({ id: 'e', label: 'New viewer 2', segment: 'New', watchThrough: 0, quote: 'Scrolled.' }),
  node({ id: 'f', label: 'New viewer 3', segment: 'New', watchThrough: 0 }),
];

describe('buildRoomReadout', () => {
  it('counts the real votes and never invents a room', () => {
    expect(buildRoomReadout([])).toBeNull();
    const r = buildRoomReadout(room())!;
    expect(r.hold).toEqual({ stopped: 3, total: 6, pct: 50 });
  });

  it("defers to the focus's own aggregate so the card cannot disagree with the Room it sits in", () => {
    const r = buildRoomReadout(room(), { stopCount: 6, total: 10 })!;
    expect(r.hold).toEqual({ stopped: 6, total: 10, pct: 60 });
  });

  it('splits by segment, worst-first — the segment you are losing leads', () => {
    const r = buildRoomReadout(room())!;
    expect(r.segments.map((s) => s.label)).toEqual(['New', 'Core']);
    expect(r.segments[0]).toEqual({ label: 'New', stopped: 0, total: 3 });
    expect(r.segments[1]).toEqual({ label: 'Core', stopped: 3, total: 3 });
  });

  it('names the divergence — held the core, lost the new', () => {
    const r = buildRoomReadout(room())!;
    expect(r.divergence?.held.label).toBe('Core');
    expect(r.divergence?.lost.label).toBe('New');
  });

  it('refuses to build a divergence out of ONE persona — a 0/1 segment is a coin, not a finding', () => {
    // Caught by rendering it at 1:1: the card announced "it holds new viewers and loses cross-niche"
    // off a cross-niche segment of exactly one persona. Every test was green; the source read fine.
    const thin = [
      node({ id: 'a', segment: 'Core', watchThrough: 1 }),
      node({ id: 'b', segment: 'Core', watchThrough: 1 }),
      node({ id: 'c', segment: 'Cross-niche', watchThrough: 0 }), // n = 1
    ];
    const r = buildRoomReadout(thin)!;
    expect(r.segments.find((s) => s.label === 'Cross-niche')).toEqual({
      label: 'Cross-niche',
      stopped: 0,
      total: 1,
    }); // it is still REPORTED — it is real; it just cannot carry the verdict
    expect(r.divergence).toBeNull();
  });

  it('claims NO divergence when the room merely agrees to be lukewarm', () => {
    // Every segment lands in the middle — nobody held, nobody walked. Inventing a divergence here
    // would be the exact failure this card keeps making: a confident story over a flat signal.
    const flat = [
      node({ id: 'a', segment: 'Core', watchThrough: 1 }),
      node({ id: 'b', segment: 'Core', watchThrough: 0 }),
      node({ id: 'c', segment: 'New', watchThrough: 1 }),
      node({ id: 'd', segment: 'New', watchThrough: 0 }),
    ];
    expect(buildRoomReadout(flat)!.divergence).toBeNull();
  });

  it('quotes a real scroller and a real stopper — verbatim, attributed', () => {
    const r = buildRoomReadout(room())!;
    // The 'accent' node (the cluster the Room already paints as the problem) wins the objection.
    expect(r.objection).toEqual({ quote: 'No idea who this is.', who: 'New viewer' });
    expect(r.endorsement?.who).toBe('Core fan');
  });

  it('returns null receipts rather than a fabricated one when nobody spoke', () => {
    const silent = [
      node({ id: 'a', segment: 'Core', watchThrough: 1 }),
      node({ id: 'b', segment: 'New', watchThrough: 0 }),
    ];
    const r = buildRoomReadout(silent)!;
    expect(r.objection).toBeNull();
    expect(r.endorsement).toBeNull();
  });

  it('never fabricates a segment row for a node that carries no segment', () => {
    const r = buildRoomReadout([node({ id: 'a', watchThrough: 1 }), node({ id: 'b', watchThrough: 0 })])!;
    expect(r.segments).toEqual([]);
    expect(r.hold.stopped).toBe(1);
  });
});
