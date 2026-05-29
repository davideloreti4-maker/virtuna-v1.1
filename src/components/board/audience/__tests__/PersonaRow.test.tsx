/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';
import { CELL_FILL_STAGGER_MS } from '../audience-constants';
import type { PersonaRowProps } from '../audience-types';

import { PersonaRow } from '../PersonaRow';

// Build a minimal segments array from fixture
const { segments } = buildHeatmapFixture();
const attentions = segments.map((_, i) => i * 0.07 + 0.1); // all in [0.05, 0.80]

function makeProps(overrides?: Partial<PersonaRowProps>): PersonaRowProps {
  return {
    personaId: 'persona_0',
    slotType: 'fyp',
    archetypeLabel: 'FYP',
    segments: segments,
    attentions: attentions,
    swipePredictedAt: null,
    totalDurationSec: 30,
    rowState: 'complete',
    onCellTap: vi.fn(),
    onRowLabelTap: vi.fn(),
    ...overrides,
  };
}

describe('PersonaRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Skeleton when rowState=skeleton', () => {
    const { container } = render(<PersonaRow {...makeProps({ rowState: 'skeleton' })} />);
    // axe-required: role="row" must contain at least one gridcell child even when
    // the row is still a loading skeleton. Single placeholder gridcell wraps the Skeleton.
    const cells = container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(1);
    const row = container.querySelector('[role="row"]');
    expect(row).toBeTruthy();
  });

  it('renders N cells when segments + attentions provided', () => {
    render(<PersonaRow {...makeProps()} />);
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(segments.length);
  });

  it('applies CELL_FILL_STAGGER_MS × idx transition-delay per cell', () => {
    const { container } = render(<PersonaRow {...makeProps({ rowState: 'filling' })} />);
    const cells = container.querySelectorAll('[role="gridcell"]');
    const cellAtIdx5 = cells[5] as HTMLElement;
    // transitionDelay should be CELL_FILL_STAGGER_MS * 5 = 90ms
    expect(cellAtIdx5.style.transitionDelay).toBe(`${CELL_FILL_STAGGER_MS * 5}ms`);
  });

  it('cell background uses rgba(255,127,80, attention) when filling', () => {
    // attention at index 0: 0 * 0.07 + 0.1 = 0.1, clamped stays 0.1
    const { container } = render(<PersonaRow {...makeProps({ rowState: 'filling' })} />);
    const cells = container.querySelectorAll('[role="gridcell"]');
    const firstCell = cells[0] as HTMLElement;
    expect(firstCell.style.background).toMatch(/rgba\(255,\s*127,\s*80/);
  });

  it('swipe marker renders at column matching swipePredictedAt', () => {
    // segments[1] covers t_start=3, t_end=6; swipePredictedAt=4.5 → inside segment idx 1
    const { container } = render(
      <PersonaRow
        {...makeProps({ swipePredictedAt: 4.5, rowState: 'complete' })}
      />,
    );
    const cells = container.querySelectorAll('[role="gridcell"]');
    // Cell at index 1 should contain the swipe marker span
    const cellWithMarker = cells[1] as HTMLElement;
    const markerSpan = cellWithMarker.querySelector('[aria-hidden="true"]');
    expect(markerSpan).toBeTruthy();
    // Other cells should NOT have the marker
    const cellWithoutMarker = cells[0] as HTMLElement;
    expect(cellWithoutMarker.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('row label button calls onRowLabelTap when clicked', () => {
    const onRowLabelTap = vi.fn();
    render(<PersonaRow {...makeProps({ onRowLabelTap })} />);
    const labelBtn = screen.getByRole('button', { name: /full reasoning/i });
    fireEvent.click(labelBtn);
    expect(onRowLabelTap).toHaveBeenCalledTimes(1);
  });

  it('cell button calls onCellTap with segment idx when clicked', () => {
    const onCellTap = vi.fn();
    render(<PersonaRow {...makeProps({ onCellTap })} />);
    const cells = screen.getAllByRole('gridcell');
    fireEvent.click(cells[2]!);
    // segment idx = segments[2].idx
    expect(onCellTap).toHaveBeenCalledWith(segments[2]!.idx);
  });

  it('rowState=streaming opacity on label is 0.6', () => {
    const { container } = render(<PersonaRow {...makeProps({ rowState: 'streaming' })} />);
    const labelBtn = container.querySelector('button[aria-label*="full reasoning"]') as HTMLElement;
    expect(labelBtn.style.opacity).toBe('0.6');
  });

  it('cells have aria-label with attention percentage and timing', () => {
    render(<PersonaRow {...makeProps({ rowState: 'complete' })} />);
    const cells = screen.getAllByRole('gridcell');
    // First cell: attention = 0.1 → 10%, segment 0: 0s to 3s
    expect(cells[0]!.getAttribute('aria-label')).toMatch(/10%.*segment.*0/i);
  });
});
