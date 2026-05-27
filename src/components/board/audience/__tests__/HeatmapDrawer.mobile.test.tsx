/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import type { HeatmapDrawerProps } from '../audience-types';

// Mock useIsMobile to return true (mobile viewport)
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => true),
}));

import { HeatmapDrawer } from '../HeatmapDrawer';

function makeProps(overrides?: Partial<HeatmapDrawerProps>): HeatmapDrawerProps {
  return {
    heatmap: buildHeatmapFixture(),
    rowStates: {},
    totalDurationSec: 30,
    isOpen: false,
    onOpenChange: vi.fn(),
    onCellTap: vi.fn(),
    onRowLabelTap: vi.fn(),
    ...overrides,
  };
}

describe('HeatmapDrawer (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Radix Sheet with side=bottom on mobile when open', () => {
    render(<HeatmapDrawer {...makeProps({ isOpen: true })} />);
    // Radix Dialog (Sheet) renders into a Portal at document.body — not inside container
    const sheetContent = document.body.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    // The sheet-content div should have the bottom slide-in/out class
    expect(sheetContent?.className).toMatch(/slide-in-from-bottom|slide-out-to-bottom/);
  });

  it('SheetContent has max-h-[70dvh] class', () => {
    render(<HeatmapDrawer {...makeProps({ isOpen: true })} />);
    // Sheet renders via Portal into document.body
    const sheetContent = document.body.querySelector('[data-slot="sheet-content"]');
    expect(sheetContent).toBeTruthy();
    expect(sheetContent?.className).toContain('max-h-[70dvh]');
  });
});
