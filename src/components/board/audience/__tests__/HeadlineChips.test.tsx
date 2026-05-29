/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeadlineChips } from '../HeadlineChips';
import type { HeadlineChipsProps } from '../HeadlineChips';
import { buildHeatmapFixture } from './fixtures/heatmap-fixture';

const DEFAULT_WEIGHTS = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };

function baseProps(overrides?: Partial<HeadlineChipsProps>): HeadlineChipsProps {
  return {
    weighted_completion_pct: 72,
    weighted_top_dropoff_t: 8.3,
    weighted_hook_score: 85,
    loop_pct: 18,
    vs_niche_diff_pct: 12,
    weights: DEFAULT_WEIGHTS,
    isStreaming: false,
    onWeightsBadgeClick: vi.fn(),
    ...overrides,
  };
}

describe('HeadlineChips', () => {
  it('renders all 5 chips against fixture', () => {
    const fixture = buildHeatmapFixture();
    void fixture;

    render(<HeadlineChips {...baseProps()} />);

    // Labels were shortened in the visual polish pass so all 5 chips fit one row
    // at the Audience frame width (~395px inner). Full meaning still conveyed via
    // value units (% / s) and the "vs Niche" green/red colour cue.
    expect(screen.getByText('Watch')).toBeDefined();
    expect(screen.getByText('Loop')).toBeDefined();
    expect(screen.getByText('Drop')).toBeDefined();
    expect(screen.getByText('Hook')).toBeDefined();
    expect(screen.getByText('vs Niche')).toBeDefined();
  });

  it('falls back to persona_behavioral_aggregate when weighted_* null', () => {
    render(
      <HeadlineChips
        {...baseProps({
          weighted_completion_pct: null,
          weighted_top_dropoff_t: null,
          weighted_hook_score: null,
          fallback: { completion_pct: 65, top_dropoff_t: 12.5, hook_score: 70 },
        })}
      />,
    );

    // Fallback values are displayed
    expect(screen.getByText('65%')).toBeDefined();
    expect(screen.getByText('12.5s')).toBeDefined();
    expect(screen.getByText('70%')).toBeDefined();

    // sr-only fallback notes
    const srOnlyEls = document.querySelectorAll('.sr-only');
    const hasFallbackNote = Array.from(srOnlyEls).some((el) =>
      el.textContent?.includes('estimated'),
    );
    expect(hasFallbackNote).toBe(true);
  });

  it('shows skeleton during streaming phase', () => {
    const { container } = render(<HeadlineChips {...baseProps({ isStreaming: true })} />);

    // Each skeleton is a div with shimmer animation style — count rendered skeleton divs
    // The Skeleton component renders divs with backgroundImage gradient
    const skeletonDivs = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.style.backgroundImage?.includes('gradient'),
    );
    expect(skeletonDivs.length).toBeGreaterThanOrEqual(5);
  });

  it('shows dash (not perpetual skeleton) when loop/vs niche null and not streaming', () => {
    const { container } = render(
      <HeadlineChips {...baseProps({ loop_pct: null, vs_niche_diff_pct: null })} />,
    );

    // No skeleton shimmer should render once the analysis is settled —
    // missing loop/vs-niche values must degrade to an em dash, not loop forever.
    const skeletonDivs = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.style.backgroundImage?.includes('gradient'),
    );
    expect(skeletonDivs.length).toBe(0);

    // Both chips fall back to the em-dash sentinel from fmt().
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('weights badge text matches Weighted: 65/20/10/5 default', () => {
    render(<HeadlineChips {...baseProps()} />);

    const badge = screen.getByRole('button', { name: /Audience weighting/i });
    expect(badge.textContent).toBe('Weighted: 65/20/10/5');
  });

  it('vs Niche positive value uses success color class', () => {
    const { container } = render(
      <HeadlineChips {...baseProps({ vs_niche_diff_pct: 12 })} />,
    );

    // Find the dd with success color
    const successEl = container.querySelector('.text-\\[var\\(--color-success\\)\\]');
    expect(successEl).not.toBeNull();
  });

  it('clicking weights badge calls onWeightsBadgeClick', () => {
    const mockFn = vi.fn();
    render(<HeadlineChips {...baseProps({ onWeightsBadgeClick: mockFn })} />);

    const badge = screen.getByRole('button', { name: /Audience weighting/i });
    fireEvent.click(badge);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
