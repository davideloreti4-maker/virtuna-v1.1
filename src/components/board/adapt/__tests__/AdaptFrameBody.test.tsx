/** @vitest-environment happy-dom */
/**
 * Wave 0 test scaffolds for AdaptFrameBody component.
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — niche-prompt: empty niche (both primary and sub null) shows inline NichePicker
 *   2 — cards-render: populated niche + variants.remix.adapt present renders 3 concept cards
 *   3 — rehydrate-no-regen: variants.remix.adapt on permalink renders cards with NO fetch call (Pitfall 3, D-05)
 *   4 — independent-failure: adapt generation failure shows Adapt error state while Decode unaffected (D-06)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';
import { DECODE_FIXTURE } from '@/lib/engine/remix/decode.fixture';

// =====================================================
// Module mocks — all hooks are mocked so we can test rendering paths
// =====================================================

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(() => ({ result: null, status: 'idle' })),
}));

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null })),
}));

vi.mock('@/hooks/queries/use-creator-profile', () => ({
  useCreatorProfile: vi.fn(() => ({ data: null })),
  useUpdateCreatorProfile: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/lib/niches/taxonomy', () => ({
  getPrimaryLabel: vi.fn((slug: string) => slug),
  getSubLabel: vi.fn((_primary: string, sub: string) => sub),
}));

// =====================================================
// Fixtures
// =====================================================

const THREE_CONCEPTS: AdaptConcept[] = [
  {
    hook: 'Concept 1 hook for niche',
    angle: 'Angle 1 borrowing the open-loop structure',
    who_its_for: 'Fitness creators',
    format_borrowed: 'open-loop cold open',
  },
  {
    hook: 'Concept 2 hook for niche',
    angle: 'Angle 2 applying 4-beat emotional arc',
    who_its_for: 'Fitness creators doing product reviews',
    format_borrowed: '4-beat emotional arc',
  },
  {
    hook: 'Concept 3 hook for niche',
    angle: 'Angle 3 using counter-intuitive turn',
    who_its_for: 'Fitness creators targeting beginners',
    format_borrowed: 'counter-intuitive turn at 60% mark',
  },
];

// =====================================================
// Tests
// =====================================================

describe('AdaptFrameBody (Wave 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'niche-prompt: when niche_primary and niche_sub are both null, renders inline NichePicker (D-11)',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'cards-render: when niche is populated and variants.remix.adapt has 3 concepts, renders 3 AdaptConceptCard elements',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'rehydrate-no-regen: when variants.remix.adapt is already populated on a permalink, renders cards without POSTing to /api/remix/adapt (Pitfall 3, D-05)',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'independent-failure: when adapt generation returns null/fails, shows Adapt error state and does NOT affect Decode content (D-06, Pitfall 4)',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'no-regen-guard: adaptFiredRef prevents double-firing the adapt call in the same session',
  );

  // =====================================================
  // Wave 0 smoke — fixture + import verification
  // =====================================================

  it('THREE_CONCEPTS has exactly 3 items with all required fields', () => {
    expect(THREE_CONCEPTS).toHaveLength(3);
    for (const c of THREE_CONCEPTS) {
      expect(c.hook).toBeTruthy();
      expect(c.angle).toBeTruthy();
      expect(c.who_its_for).toBeTruthy();
      expect(c.format_borrowed).toBeTruthy();
    }
  });

  it('DECODE_FIXTURE is importable from the contract path (seam health check)', () => {
    // If this fails, the fixture import path is broken — Wave 1 tests would also fail
    expect(DECODE_FIXTURE.repeatable).toHaveLength(3);
    expect(DECODE_FIXTURE.luck).toHaveLength(2);
  });

  it('THREE_CONCEPTS format_borrowed labels match DECODE_FIXTURE.repeatable labels', () => {
    // Cards should only borrow format from the repeatable lane, never luck lane labels
    const repeatableLabels = DECODE_FIXTURE.repeatable.map((i) => i.label);
    const luckLabels = DECODE_FIXTURE.luck.map((i) => i.label);
    for (const concept of THREE_CONCEPTS) {
      expect(repeatableLabels).toContain(concept.format_borrowed);
      expect(luckLabels).not.toContain(concept.format_borrowed);
    }
  });
});
