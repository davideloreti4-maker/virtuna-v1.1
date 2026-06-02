/** @vitest-environment happy-dom */
/**
 * Wave 0 test scaffolds for AdaptConceptCard component.
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — hook-headline: renders concept.hook as a bold headline element
 *   2 — format-chip: renders concept.format_borrowed as a chip prefixed "Borrowed:"
 *   3 — muted-rows: renders concept.angle + concept.who_its_for as 2 muted sub-rows
 *   (D-09 card anatomy)
 */

import { describe, it, expect } from 'vitest';
// render + screen imported here for Wave 1 component tests (plan 04-02)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';

// =====================================================
// Fixture
// =====================================================

const CONCEPT_FIXTURE: AdaptConcept = {
  hook: 'Teach a format technique in 30 seconds using the open-loop cold open',
  angle: 'Lead with the counter-intuitive answer before the problem statement',
  who_its_for: 'Fitness creators who want higher completion rates',
  format_borrowed: 'open-loop cold open',
};

// =====================================================
// Tests
// =====================================================

describe('AdaptConceptCard (Wave 0)', () => {
  it.todo(
    // Wave 0 — implemented in plan 04-02
    'hook-headline: renders concept.hook as the primary bold headline',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'format-chip: renders concept.format_borrowed with "Borrowed:" prefix as a chip element',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'angle-row: renders concept.angle as a muted sub-row',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'who-its-for-row: renders concept.who_its_for as a muted sub-row',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'card-chrome: root element has Raycast card styling (border-white/[0.06], bg-transparent)',
  );

  it.todo(
    // Wave 0 — implemented in plan 04-02
    'article-element: root element is an <article> for correct reading order (accessibility)',
  );

  // =====================================================
  // Wave 0 smoke — fixture verification
  // =====================================================

  it('CONCEPT_FIXTURE has all 4 required AdaptConcept fields', () => {
    expect(CONCEPT_FIXTURE.hook).toBeTruthy();
    expect(CONCEPT_FIXTURE.angle).toBeTruthy();
    expect(CONCEPT_FIXTURE.who_its_for).toBeTruthy();
    expect(CONCEPT_FIXTURE.format_borrowed).toBeTruthy();
  });

  it('CONCEPT_FIXTURE.format_borrowed matches a label from DECODE_FIXTURE.repeatable', () => {
    // The card should display a repeatable-lane label, never a luck label
    // This smoke checks the fixture is coherent
    const repeatableLabels = ['open-loop cold open', '4-beat emotional arc', 'counter-intuitive turn at 60% mark'];
    expect(repeatableLabels).toContain(CONCEPT_FIXTURE.format_borrowed);
  });
});
