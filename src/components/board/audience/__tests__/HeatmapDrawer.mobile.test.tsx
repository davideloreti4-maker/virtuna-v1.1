/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import type { HeatmapDrawerProps } from '../audience-types';

// Mobile viewport — the heatmap must still expand INLINE (no Sheet/drawer).
// The board keeps all content inside its frames on every viewport.
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

  it('does NOT render a Sheet/drawer overlay on mobile when open', () => {
    render(<HeatmapDrawer {...makeProps({ isOpen: true })} />);
    // No Radix Sheet portal should exist — content stays in-frame.
    expect(document.body.querySelector('[data-slot="sheet-content"]')).toBeNull();
  });

  it('expands the heatmap grid inline (in-frame) when open', () => {
    const { container } = render(<HeatmapDrawer {...makeProps({ isOpen: true })} />);
    // The grid renders within the component container (not a portal).
    const grid = container.querySelector('#audience-heatmap-grid [role="grid"]');
    expect(grid).toBeTruthy();
  });
});
