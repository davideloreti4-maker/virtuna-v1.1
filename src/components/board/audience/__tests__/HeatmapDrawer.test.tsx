/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import type { HeatmapDrawerProps } from '../audience-types';

// Mock useIsMobile to desktop by default
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

import { HeatmapDrawer } from '../HeatmapDrawer';

function makeProps(overrides?: Partial<HeatmapDrawerProps>): HeatmapDrawerProps {
  return {
    heatmap: null,
    rowStates: {},
    totalDurationSec: 30,
    isOpen: false,
    onOpenChange: vi.fn(),
    onCellTap: vi.fn(),
    onRowLabelTap: vi.fn(),
    ...overrides,
  };
}

describe('HeatmapDrawer (desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Show personas affordance when heatmap=null', () => {
    render(<HeatmapDrawer {...makeProps()} />);
    expect(screen.getByRole('button', { name: /show personas/i })).toBeTruthy();
  });

  it('renders 10 rows when heatmap has 10 personas', () => {
    const heatmap = buildHeatmapFixture();
    const rowStates: Record<string, 'complete'> = {};
    heatmap.personas.forEach((p) => { rowStates[p.id] = 'complete'; });
    const { container } = render(
      <HeatmapDrawer
        {...makeProps({ heatmap, rowStates, isOpen: true })}
      />,
    );
    // Each row has role="row"
    const rows = container.querySelectorAll('[role="row"]');
    // 10 persona rows
    expect(rows.length).toBe(10);
  });

  it('renders skeleton rows for missing personas (Pass 2 < 10/10)', () => {
    const heatmap = buildHeatmapFixture();
    // Only provide 7 personas with row state, leaving 3 as skeleton
    const rowStates: Record<string, 'complete'> = {};
    heatmap.personas.slice(0, 7).forEach((p) => { rowStates[p.id] = 'complete'; });
    // Slice heatmap to only 7 personas
    const partialHeatmap = { ...heatmap, personas: heatmap.personas.slice(0, 7) };
    const { container } = render(
      <HeatmapDrawer
        {...makeProps({ heatmap: partialHeatmap, rowStates, isOpen: true })}
      />,
    );
    const rows = container.querySelectorAll('[role="row"]');
    // Still 10 total rows
    expect(rows.length).toBe(10);
    // At least 3 should be skeleton (contain Skeleton shimmer)
    const skeletonRows = Array.from(rows).filter((row) =>
      row.getAttribute('data-row-state') === undefined ||
      // Rows that wrap Skeleton won't have data-row-state
      !row.getAttribute('data-row-state'),
    );
    expect(skeletonRows.length).toBeGreaterThanOrEqual(3);
  });

  it('grid-template-columns proportional to segment durations', () => {
    const heatmap = buildHeatmapFixture();
    const rowStates: Record<string, 'complete'> = {};
    heatmap.personas.forEach((p) => { rowStates[p.id] = 'complete'; });
    const { container } = render(
      <HeatmapDrawer
        {...makeProps({ heatmap, rowStates, isOpen: true, totalDurationSec: 30 })}
      />,
    );
    const grid = container.querySelector('[role="grid"]') as HTMLElement;
    expect(grid).toBeTruthy();
    // gridTemplateColumns should contain 'fr' fractions
    expect(grid.style.gridTemplateColumns).toContain('fr');
  });

  it('affordance toggles isOpen via onOpenChange when clicked', () => {
    const onOpenChange = vi.fn();
    render(<HeatmapDrawer {...makeProps({ isOpen: false, onOpenChange })} />);
    const btn = screen.getByRole('button', { name: /show personas/i });
    fireEvent.click(btn);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('color-blind mode toggle button is present when drawer is open', () => {
    const heatmap = buildHeatmapFixture();
    const rowStates: Record<string, 'complete'> = {};
    heatmap.personas.forEach((p) => { rowStates[p.id] = 'complete'; });
    render(
      <HeatmapDrawer
        {...makeProps({ heatmap, rowStates, isOpen: true })}
      />,
    );
    // Look for the color-blind toggle button (aria-pressed attribute marks it)
    const cbBtn = screen.getByRole('button', { name: /color-blind/i });
    expect(cbBtn).toBeTruthy();
  });

  it('desktop: grid-template-rows transitions from 0fr to 1fr when open', () => {
    const heatmap = buildHeatmapFixture();
    const rowStates: Record<string, 'complete'> = {};
    heatmap.personas.forEach((p) => { rowStates[p.id] = 'complete'; });
    const { container, rerender } = render(
      <HeatmapDrawer {...makeProps({ heatmap, rowStates, isOpen: false })} />,
    );
    // When closed: gridTemplateRows = '0fr'
    const expandWrapper = container.querySelector('.grid.overflow-hidden') as HTMLElement;
    expect(expandWrapper).toBeTruthy();
    expect(expandWrapper.style.gridTemplateRows).toBe('0fr');

    rerender(
      <HeatmapDrawer {...makeProps({ heatmap, rowStates, isOpen: true })} />,
    );
    expect(expandWrapper.style.gridTemplateRows).toBe('1fr');
  });
});
