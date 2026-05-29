/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import * as vitestAxeMatchers from 'vitest-axe/matchers';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import type { HeatmapDrawerProps } from '../audience-types';

// Register vitest-axe matchers
expect.extend(vitestAxeMatchers);

// Desktop mode for a11y tests
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

import { HeatmapDrawer } from '../HeatmapDrawer';

function makeOpenProps(overrides?: Partial<HeatmapDrawerProps>): HeatmapDrawerProps {
  const heatmap = buildHeatmapFixture();
  const rowStates: Record<string, 'complete'> = {};
  heatmap.personas.forEach((p) => { rowStates[p.id] = 'complete'; });
  return {
    heatmap,
    rowStates,
    totalDurationSec: 30,
    isOpen: true,
    onOpenChange: vi.fn(),
    onCellTap: vi.fn(),
    onRowLabelTap: vi.fn(),
    ...overrides,
  };
}

describe('HeatmapDrawer (a11y)', () => {
  it('passes axe-core when isOpen=true with 10 personas', async () => {
    const { container } = render(<HeatmapDrawer {...makeOpenProps()} />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher
    expect(results).toHaveNoViolations();
  });

  it('grid root has role=grid, aria-rowcount=10, aria-colcount=N', () => {
    const { container } = render(<HeatmapDrawer {...makeOpenProps()} />);
    const grid = container.querySelector('[role="grid"]') as HTMLElement;
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('aria-rowcount')).toBe('10');
    // N = number of segments in fixture (10)
    expect(grid.getAttribute('aria-colcount')).toBe('10');
    expect(grid.getAttribute('aria-label')).toBe('Persona attention heatmap');
  });

  it('each persona row has aria-rowindex', () => {
    const { container } = render(<HeatmapDrawer {...makeOpenProps()} />);
    // aria-rowindex is on role="row" elements (PersonaRow roots)
    const rowElements = container.querySelectorAll('[role="row"][aria-rowindex]');
    expect(rowElements.length).toBe(10);
    // Check that rowindices are 1..10
    const indices = Array.from(rowElements).map((el) =>
      parseInt(el.getAttribute('aria-rowindex') ?? '0', 10),
    );
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

});
