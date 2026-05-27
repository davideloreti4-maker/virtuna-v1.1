/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Filmstrip } from '../Filmstrip';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

describe('Filmstrip', () => {
  it('renders one cell per segment with proportional width', () => {
    const fixture = buildHeatmapFixture();
    // fixture has 10 segments each 3s wide, total=30s
    const { container } = render(
      <Filmstrip
        segments={fixture.segments}
        filmstrips={{}}
        totalDurationSec={30}
      />,
    );

    const cells = container.querySelectorAll('[role="img"]');
    expect(cells.length).toBe(10);

    // First cell width = (3/30)*100 = 10%
    const firstCell = cells[0] as HTMLElement;
    expect(firstCell.style.width).toBe('10%');
  });

  it('shows coral band placeholder when keyframe missing', () => {
    const fixture = buildHeatmapFixture();
    const { container } = render(
      <Filmstrip segments={fixture.segments} filmstrips={{}} totalDurationSec={30} />,
    );

    // All placeholder divs should have the coral rgba background
    // happy-dom normalizes rgba(255,127,80,0.20) → rgba(255, 127, 80, 0.20)
    const placeholders = Array.from(container.querySelectorAll('div')).filter((el) =>
      el.style.background?.includes('255') && el.style.background?.includes('127') && el.style.background?.includes('80'),
    );
    expect(placeholders.length).toBeGreaterThanOrEqual(1);

    // First placeholder should have opacity 1 (no keyframe)
    const firstPlaceholder = placeholders[0] as HTMLElement;
    expect(firstPlaceholder.style.opacity).toBe('1');
  });

  it('swaps to <img> when filmstrips[idx] present', () => {
    const fixture = buildHeatmapFixture();
    render(
      <Filmstrip
        segments={fixture.segments}
        filmstrips={{ 2: 'https://example.com/k2.jpg' }}
        totalDurationSec={30}
      />,
    );

    const img = screen.getByRole('img', { name: /Segment 2/i }) as HTMLElement;
    // The cell div has role="img" — find the actual <img> tag within it
    const imgEl = img.querySelector('img');
    expect(imgEl).not.toBeNull();
    expect(imgEl?.getAttribute('src')).toBe('https://example.com/k2.jpg');

    // Placeholder for segment 2 should have opacity 0
    // happy-dom normalizes rgba(255,127,80,...) → rgba(255, 127, 80, ...)
    const placeholderDiv = Array.from(img.querySelectorAll('div')).find((el) =>
      el.style.background?.includes('255') &&
      el.style.background?.includes('127') &&
      el.style.background?.includes('80'),
    ) as HTMLElement;
    expect(placeholderDiv?.style.opacity).toBe('0');
  });

  it('renders ⚠ chip when segment in antiViralitySegmentIndices', () => {
    const fixture = buildHeatmapFixture();
    render(
      <Filmstrip
        segments={fixture.segments}
        filmstrips={{}}
        totalDurationSec={30}
        antiViralitySegmentIndices={[3]}
      />,
    );

    // Find the cell for segment 3
    const seg3Cell = screen.getByRole('img', { name: /Segment 3/i });

    // Find the warning element within this cell
    const warnEl = seg3Cell.querySelector('[aria-label*="critical drop"]');
    expect(warnEl).not.toBeNull();
    expect(warnEl?.textContent).toContain('⚠');
  });

  it('empty state renders 10 cells when segments=null', () => {
    const { container } = render(
      <Filmstrip segments={null} filmstrips={{}} totalDurationSec={30} />,
    );

    const cells = container.querySelectorAll('[role="img"]');
    expect(cells.length).toBe(10);
  });

  it('horizontal scroll container has overflow-x-auto', () => {
    const { container } = render(
      <Filmstrip segments={null} filmstrips={{}} totalDurationSec={30} />,
    );

    const figure = container.querySelector('figure');
    expect(figure?.className).toContain('overflow-x-auto');
  });
});
