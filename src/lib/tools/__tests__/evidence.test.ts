/**
 * evidence.ts — the RUN EVIDENCE wire contract.
 *
 * Two properties are load-bearing and neither is obvious from the types:
 *
 *  1. TOTALITY. `parseRunEvidence` runs inside every skill stream's SSE read loop. A throw there
 *     kills the whole run at the glass — the cards, the receipt and the closing line — over a
 *     decorative thumbnail rail. So every malformed shape must return null, never throw.
 *  2. HONESTY. An item with no picture AND no handle is an empty box asserting that evidence
 *     exists. A payload whose items all fail that bar must produce NOTHING, not a labelled rail
 *     over blank tiles — the failure mode this whole feature exists to avoid.
 */
import { describe, it, expect } from 'vitest';
import {
  buildVideoEvidence,
  evidenceMetric,
  isSafeEvidenceUrl,
  normalizeHandle,
  parseRunEvidence,
  MAX_EVIDENCE_ITEMS,
} from '@/lib/tools/evidence';

const COVER = 'https://cdn.example/cover.jpg';

describe('parseRunEvidence — total on every malformed shape', () => {
  it('parses a well-formed payload', () => {
    const parsed = parseRunEvidence({
      headline: 'Drafting against 2 proven videos',
      items: [
        { kind: 'video', image: COVER, label: 'zachking', metric: '44× vs followers' },
        { kind: 'video', label: 'mrbeast' },
      ],
    });
    expect(parsed).toEqual({
      headline: 'Drafting against 2 proven videos',
      items: [
        { kind: 'video', image: COVER, label: 'zachking', metric: '44× vs followers' },
        { kind: 'video', label: 'mrbeast' },
      ],
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'evidence'],
    ['a number', 7],
    ['an array', [{ kind: 'video', label: 'x' }]],
    ['no headline', { items: [{ kind: 'video', label: 'x' }] }],
    ['a blank headline', { headline: '   ', items: [{ kind: 'video', label: 'x' }] }],
    ['no items', { headline: 'Drafting' }],
    ['items that are not an array', { headline: 'Drafting', items: 'nope' }],
    ['an empty item list', { headline: 'Drafting', items: [] }],
  ])('returns null for %s', (_label, input) => {
    expect(parseRunEvidence(input)).toBeNull();
  });

  it('drops an item with neither a picture nor a label — and the payload with it', () => {
    // The honesty bar: "3 proven videos" over three blank tiles is the fabrication this guards.
    expect(
      parseRunEvidence({
        headline: 'Drafting against 3 proven videos',
        items: [{ kind: 'video' }, { kind: 'video', metric: '2M views' }, { kind: 'video' }],
      }),
    ).toBeNull();
  });

  it('drops only the malformed items when others survive', () => {
    const parsed = parseRunEvidence({
      headline: 'Drafting',
      items: [
        { kind: 'video' }, // nothing to draw
        { kind: 'nonsense', label: 'x' }, // unknown kind
        null,
        'string',
        { kind: 'video', label: 'real' },
      ],
    });
    expect(parsed?.items).toEqual([{ kind: 'video', label: 'real' }]);
  });

  it('refuses a non-http image URL rather than rendering it', () => {
    const parsed = parseRunEvidence({
      headline: 'Drafting',
      items: [{ kind: 'video', image: 'javascript:alert(1)', label: 'creator' }],
    });
    // The item survives on its label; the hostile URL does not survive at all.
    expect(parsed?.items[0]).toEqual({ kind: 'video', label: 'creator' });
  });

  it('caps the rail so a wide payload cannot flood the wait', () => {
    const parsed = parseRunEvidence({
      headline: 'Drafting',
      items: Array.from({ length: 30 }, (_, i) => ({ kind: 'video', label: `creator${i}` })),
    });
    expect(parsed?.items).toHaveLength(MAX_EVIDENCE_ITEMS);
  });

  it('keeps a filmstrip payload with its slot plan', () => {
    const parsed = parseRunEvidence({
      headline: 'Reading your footage',
      slots: 8,
      items: [{ kind: 'frame', image: '/f/0.jpg', idx: 0 }],
    });
    expect(parsed?.slots).toBe(8);
    expect(parsed?.items[0]).toEqual({ kind: 'frame', image: '/f/0.jpg', idx: 0 });
  });

  it('ignores a nonsense slot count instead of drawing a negative strip', () => {
    for (const slots of [-3, 0, 2.5, 'eight']) {
      const parsed = parseRunEvidence({
        headline: 'Reading your footage',
        slots,
        items: [{ kind: 'frame', image: '/f/0.jpg' }],
      });
      expect(parsed?.slots).toBeUndefined();
    }
  });
});

describe('isSafeEvidenceUrl', () => {
  it.each([
    ['https', 'https://cdn.example/a.jpg', true],
    ['http', 'http://cdn.example/a.jpg', true],
    ['app-relative', '/images/a.png', true],
    // Scheme-relative is a REMOTE host wearing a leading slash — the naive `startsWith('/')`
    // check would have waved it through as app-relative.
    ['scheme-relative', '//evil.example/a.jpg', false],
    ['javascript:', 'javascript:alert(1)', false],
    ['data:', 'data:image/png;base64,AAAA', false],
    ['empty', '   ', false],
    ['not a string', 42, false],
  ])('%s → %s', (_l, value, expected) => {
    expect(isSafeEvidenceUrl(value)).toBe(expected);
  });
});

describe('normalizeHandle', () => {
  it('strips the @ the rail renders itself, so nobody sees "@@handle"', () => {
    expect(normalizeHandle('@zachking')).toBe('zachking');
    expect(normalizeHandle('zachking')).toBe('zachking');
    expect(normalizeHandle('  @@zachking  ')).toBe('zachking');
  });

  it('returns null for nothing usable', () => {
    expect(normalizeHandle(null)).toBeNull();
    expect(normalizeHandle('   ')).toBeNull();
    expect(normalizeHandle('@')).toBeNull();
  });
});

describe('evidenceMetric — one honest stat, never both, never invented', () => {
  const fmt = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n}`);

  it('prefers the multiplier, with its basis', () => {
    expect(
      evidenceMetric({ multiplier: 44.2, views: 2_000_000, baselineLabel: 'vs followers', formatCount: fmt }),
    ).toBe('44× vs followers');
  });

  it('keeps one decimal below 10× where the difference is meaningful', () => {
    expect(evidenceMetric({ multiplier: 3.44, baselineLabel: 'vs followers', formatCount: fmt })).toBe(
      '3.4× vs followers',
    );
  });

  it('omits a basis it does not have rather than implying one', () => {
    expect(evidenceMetric({ multiplier: 12, baselineLabel: null, formatCount: fmt })).toBe('12×');
  });

  it('falls back to views when there is no multiplier', () => {
    expect(evidenceMetric({ multiplier: null, views: 2_000_000, formatCount: fmt })).toBe('2M views');
  });

  it('returns null when the row carries no measured number at all', () => {
    expect(evidenceMetric({ multiplier: null, views: null, formatCount: fmt })).toBeNull();
    expect(evidenceMetric({ multiplier: 0, views: 0, formatCount: fmt })).toBeNull();
    expect(evidenceMetric({ multiplier: NaN, views: NaN, formatCount: fmt })).toBeNull();
  });
});

describe('buildVideoEvidence', () => {
  it('counts the rows that SURVIVED, not the rows it was handed', () => {
    // Three rows in, one drawable — the headline must say one, or the rail claims sources it
    // is not showing.
    const evidence = buildVideoEvidence(
      (n) => `Drafting against ${n} proven ${n === 1 ? 'video' : 'videos'}`,
      [
        { handle: null, image: null, metric: '2M views', href: null },
        { handle: '@real', image: COVER, metric: '44× vs followers', href: 'https://tiktok.com/x' },
        { handle: null, image: null, metric: null, href: null },
      ],
    );
    expect(evidence?.headline).toBe('Drafting against 1 proven video');
    expect(evidence?.items).toEqual([
      { kind: 'video', image: COVER, label: 'real', metric: '44× vs followers', href: 'https://tiktok.com/x' },
    ]);
  });

  it('returns null when nothing is drawable', () => {
    expect(
      buildVideoEvidence(
        (n) => `Drafting against ${n}`,
        [{ handle: null, image: null, metric: '2M views', href: null }],
      ),
    ).toBeNull();
  });
});
