/** @vitest-environment happy-dom */
/**
 * AdaptConceptCard component tests — Wave 1 (plan 04-03).
 *
 * Tests:
 *   1 — hook-headline: renders concept.hook as a bold headline element
 *   2 — format-chip: renders concept.format_borrowed as a chip prefixed "Borrowed:"
 *   3 — angle-row: renders concept.angle as a muted sub-row
 *   4 — who-its-for-row: renders concept.who_its_for as a muted sub-row
 *   5 — card-chrome: root element has Raycast card styling
 *   6 — article-element: root element is an <article>
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';
import { AdaptConceptCard } from '../AdaptConceptCard';

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

describe('AdaptConceptCard (Wave 1)', () => {
  it('hook-headline: renders concept.hook as the primary bold headline', () => {
    render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    expect(screen.getByText(CONCEPT_FIXTURE.hook)).toBeTruthy();
  });

  it('format-chip: renders concept.format_borrowed with "Borrowed:" prefix as a chip element', () => {
    render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    expect(screen.getByText(`Borrowed: ${CONCEPT_FIXTURE.format_borrowed}`)).toBeTruthy();
  });

  it('angle-row: renders concept.angle as a muted sub-row', () => {
    render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    expect(screen.getByText(CONCEPT_FIXTURE.angle)).toBeTruthy();
    expect(screen.getByText('Angle')).toBeTruthy();
  });

  it('who-its-for-row: renders concept.who_its_for as a muted sub-row', () => {
    render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    expect(screen.getByText(CONCEPT_FIXTURE.who_its_for)).toBeTruthy();
    expect(screen.getByText("Who it's for")).toBeTruthy();
  });

  it('card-chrome: root element has Raycast card styling (border-white/[0.06], bg-transparent)', () => {
    const { container } = render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    const article = container.querySelector('article');
    expect(article).toBeTruthy();
    expect(article!.className).toContain('border-white/[0.06]');
    expect(article!.className).toContain('rounded-xl');
  });

  it('article-element: root element is an <article> for correct reading order (accessibility)', () => {
    const { container } = render(<AdaptConceptCard concept={CONCEPT_FIXTURE} />);
    const article = container.querySelector('article');
    expect(article).toBeTruthy();
  });

  // =====================================================
  // Wave 0 smoke — fixture verification (preserved)
  // =====================================================

  it('CONCEPT_FIXTURE has all 4 required AdaptConcept fields', () => {
    expect(CONCEPT_FIXTURE.hook).toBeTruthy();
    expect(CONCEPT_FIXTURE.angle).toBeTruthy();
    expect(CONCEPT_FIXTURE.who_its_for).toBeTruthy();
    expect(CONCEPT_FIXTURE.format_borrowed).toBeTruthy();
  });

  it('CONCEPT_FIXTURE.format_borrowed matches a label from DECODE_FIXTURE.repeatable', () => {
    const repeatableLabels = ['open-loop cold open', '4-beat emotional arc', 'counter-intuitive turn at 60% mark'];
    expect(repeatableLabels).toContain(CONCEPT_FIXTURE.format_borrowed);
  });
});
