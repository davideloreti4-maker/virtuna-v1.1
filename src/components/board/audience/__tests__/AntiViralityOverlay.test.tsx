/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildHeatmapFixture, buildAntiViralityHeatmap } from './fixtures/heatmap-fixture';
import { AntiViralityOverlay } from '../AntiViralityOverlay';
import type { HeatmapPayload } from '../audience-types';

void buildAntiViralityHeatmap; // keep import for fixture validation

const mockOnFixChipTap = vi.fn();

/**
 * Creates a heatmap that triggers isTimelinePatternTriggered:
 * - Weighted curve drops ≥40% from segment 0 → segment 1 (both within first 5s)
 * - ≥70% of personas also drop ≥40% in that window
 */
function buildTimelinePatternHeatmap(): HeatmapPayload {
  const base = buildHeatmapFixture();
  // weighted_curve[0] = 1.0 (start), weighted_curve[1] = 0.5 → 50% drop ≥ 40%
  const weighted_curve = [...base.weighted_curve];
  weighted_curve[0] = 1.0;
  weighted_curve[1] = 0.5; // 50% drop at segment 1 (t_start=3, within first 5s)

  // Make all personas also drop ≥40% from segment 0 → segment 1
  const personas = base.personas.map((p) => {
    const attentions = [...p.attentions];
    attentions[0] = 1.0;
    attentions[1] = 0.4; // 60% drop ≥ 40%
    return { ...p, attentions };
  });

  return { ...base, personas, weighted_curve };
}

function renderOverlay(
  result: { confidence: number; heatmap: HeatmapPayload | null } | null,
  fixTextBySegment: Record<number, string> = {},
) {
  return render(
    <AntiViralityOverlay
      result={result}
      onFixChipTap={mockOnFixChipTap}
      fixTextBySegment={fixTextBySegment}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('AntiViralityOverlay', () => {
  it('renders nothing when result is null', () => {
    const { container } = renderOverlay(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when gated=false (high confidence, normal heatmap)', () => {
    const heatmap = buildHeatmapFixture();
    const { container } = renderOverlay({ confidence: 0.9, heatmap });
    expect(container.firstChild).toBeNull();
  });

  it('reason=confidence only: renders border + warning dot, no fix chips', () => {
    // confidence < 0.4 triggers confidence-only gate; normal heatmap has no timeline pattern
    const heatmap = buildHeatmapFixture();
    renderOverlay({ confidence: 0.3, heatmap });

    const overlay = document.querySelector('.anti-virality-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    // Border present
    expect(overlay.style.border).toMatch(/1px solid/);
    // Warning dot present
    const warningDot = screen.getByLabelText(/low confidence warning/i);
    expect(warningDot).toBeInTheDocument();
    // No fix chip buttons
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('reason=timeline_pattern: fix chips below filmstrip, no border', () => {
    const heatmap = buildTimelinePatternHeatmap();
    renderOverlay({ confidence: 0.9, heatmap });

    // Fix chip buttons should be present
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    // Border should NOT be applied (only timeline_pattern, no confidence gate)
    const overlay = document.querySelector('.anti-virality-overlay') as HTMLElement;
    // 'none' border — DOM may expand to 'none none none' shorthand
    expect(overlay.style.border).toMatch(/^none/);
  });

  it('reason=both: chips + border combined', () => {
    // confidence < 0.4 (confidence gate) + timeline_pattern heatmap
    const heatmap = buildTimelinePatternHeatmap();
    renderOverlay({ confidence: 0.3, heatmap });

    // Border should be present
    const overlay = document.querySelector('.anti-virality-overlay') as HTMLElement;
    expect(overlay.style.border).toMatch(/1px solid/);
    // Fix chip buttons should be present
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('fix-chip text uses fixTextBySegment lookup', () => {
    const heatmap = buildTimelinePatternHeatmap();
    // topDropoffSegmentIndices will find the worst drops — segment 1 should be the worst
    renderOverlay({ confidence: 0.9, heatmap }, { 1: 'add visual hook' });
    expect(screen.getByText(/add visual hook/i)).toBeInTheDocument();
  });

  it('clicking fix-chip calls onFixChipTap(segIdx, fixText)', () => {
    const heatmap = buildTimelinePatternHeatmap();
    renderOverlay({ confidence: 0.9, heatmap }, {});

    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);

    fireEvent.click(allButtons[0]!);
    expect(mockOnFixChipTap).toHaveBeenCalledTimes(1);
    const [calledSegIdx, calledFixText] = mockOnFixChipTap.mock.calls[0]!;
    expect(typeof calledSegIdx).toBe('number');
    expect(typeof calledFixText).toBe('string');
  });

  it('has role=status and aria-live=polite', () => {
    const heatmap = buildTimelinePatternHeatmap();
    renderOverlay({ confidence: 0.9, heatmap });
    const overlay = document.querySelector('.anti-virality-overlay');
    expect(overlay?.getAttribute('role')).toBe('status');
    expect(overlay?.getAttribute('aria-live')).toBe('polite');
  });
});
