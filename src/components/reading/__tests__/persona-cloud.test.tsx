/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { HeatmapPayload } from '@/lib/engine/types';

import { PersonaCloud } from '../persona-cloud';
import { makeReadingResult } from './fixtures/reading-fixture';

// The healthy fixture carries 4 heatmap personas; the cross_niche cohort's
// attention-mean is ~38 (< 40) so worstBadGroupKey tags it the coral worst
// cluster. No persona_simulation_results in the fixture → buildPersonaNodes /
// buildSegmentGroups fall back to the heatmap attention means.
const healthy = makeReadingResult();
const HEATMAP = healthy.heatmap as HeatmapPayload;

/** A null-personas variant: empty persona list → buildPersonaNodes returns []. */
function emptyHeatmap(): HeatmapPayload {
  return { ...HEATMAP, personas: [] } as HeatmapPayload;
}

describe('PersonaCloud — static dot-cloud, dots only (READ-04, D-02)', () => {
  it('4 personas → exactly 4 <circle> dots; worst cluster coral, others cream (not white)', () => {
    const { container } = render(
      <PersonaCloud heatmap={HEATMAP} simResults={undefined} />,
    );
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles).toHaveLength(4);

    const fills = circles.map((c) => c.getAttribute('fill') ?? '');
    // Exactly one accent (coral) dot = the worst-retention cluster.
    const accent = fills.filter((f) => f === 'var(--color-accent)');
    expect(accent).toHaveLength(1);

    // At least one non-accent dot is the cream rgba(236,231,222,…) form —
    // never pure white, never coral.
    const cream = fills.filter((f) => /rgba\(\s*236,\s*231,\s*222/.test(f));
    expect(cream.length).toBeGreaterThanOrEqual(1);
    for (const f of fills) {
      expect(f).not.toMatch(/rgba\(\s*255,\s*255,\s*255/); // never white
      expect(f).not.toBe('#fff');
      expect(f).not.toBe('white');
    }
  });

  it('dot radius increases with persona weight', () => {
    const { container } = render(
      <PersonaCloud heatmap={HEATMAP} simResults={undefined} />,
    );
    const radii = Array.from(container.querySelectorAll('circle')).map((c) =>
      parseFloat(c.getAttribute('r') ?? '0'),
    );
    // The cohort has a clear weight spread (loyalist heaviest → fyp/cross lighter),
    // so the largest dot must be strictly larger than the smallest.
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });

  it('does NOT render a watch% caption — "watch" text only inside the sr-only mirror', () => {
    const { container } = render(
      <PersonaCloud heatmap={HEATMAP} simResults={undefined} />,
    );
    // The visible figure (the SVG) must carry no "watch" caption.
    const svg = container.querySelector('svg');
    expect(svg?.textContent ?? '').not.toMatch(/watch/i);
    // The only place "watch-through" may appear is the sr-only <ul> mirror.
    const srOnly = container.querySelector('ul.sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent ?? '').toMatch(/watch-through/i);
  });

  it('empty personas → renders nothing (no svg, no empty box)', () => {
    const { container } = render(
      <PersonaCloud heatmap={emptyHeatmap()} simResults={undefined} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('null heatmap → renders nothing (guarded, no crash)', () => {
    const { container } = render(
      <PersonaCloud heatmap={null} simResults={undefined} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('a11y: SVG is role="img"; sr-only <ul> mirrors each persona watch-through; axe passes', async () => {
    const { container } = render(
      <PersonaCloud heatmap={HEATMAP} simResults={undefined} />,
    );
    const svg = screen.getByRole('img');
    expect(svg.tagName.toLowerCase()).toBe('svg');

    const items = container.querySelectorAll('ul.sr-only li');
    expect(items).toHaveLength(4); // one mirror line per persona
    expect(items[0]?.textContent ?? '').toMatch(/% watch-through/);

    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
