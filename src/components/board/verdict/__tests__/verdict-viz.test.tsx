/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Factor } from '@/lib/engine/types';
import { ScoreDistribution, type NicheCohort } from '../ScoreDistribution';
import { FactorBars } from '../FactorBars';

const range = { lo: 69, hi: 85 };

describe('ScoreDistribution — mode resolution from real data', () => {
  it('renders the field (dot-histogram) for a rich cohort with a histogram', () => {
    const niche: NicheCohort = { median: 50, p75: 65, count: 142, histogram: [3, 5, 9, 15, 22, 28, 24, 18, 11, 7] };
    render(<ScoreDistribution score={77} niche={niche} range={range} showRangeText />);
    expect(screen.getByTestId('score-distribution').getAttribute('data-mode')).toBe('field');
    expect(screen.getByTestId('score-field')).toBeInTheDocument();
  });

  it('degrades to the lane for a thin cohort (no usable histogram)', () => {
    const niche: NicheCohort = { median: 50, p75: 65, count: 11, histogram: [] };
    render(<ScoreDistribution score={77} niche={niche} range={range} showRangeText />);
    expect(screen.getByTestId('score-distribution').getAttribute('data-mode')).toBe('lane');
    expect(screen.getByTestId('score-lane')).toBeInTheDocument();
  });

  it('falls back to absolute "your score" when there is no niche', () => {
    render(<ScoreDistribution score={77} niche={null} range={range} showRangeText />);
    expect(screen.getByTestId('score-distribution').getAttribute('data-mode')).toBe('absolute');
    expect(screen.getByTestId('you-chip')).toHaveTextContent('your score');
  });

  it('does not assume a histogram exists for a large cohort without one', () => {
    const niche: NicheCohort = { median: 50, p75: 65, count: 200, histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    render(<ScoreDistribution score={77} niche={niche} range={range} showRangeText />);
    expect(screen.getByTestId('score-distribution').getAttribute('data-mode')).toBe('lane');
  });
});

describe('FactorBars — reclaims factors[].score (0-10)', () => {
  const factors: Factor[] = [
    { id: 'f4', name: 'Share Trigger', score: 6, max_score: 10, rationale: '', improvement_tip: '' },
    { id: 'f1', name: 'Completion Pull', score: 8, max_score: 10, rationale: '', improvement_tip: '' },
    { id: 'f5', name: 'Rewatch Potential', score: 4, max_score: 10, rationale: '', improvement_tip: '' },
  ];

  it('renders one bar per factor, sorted strongest → weakest', () => {
    render(<FactorBars factors={factors} />);
    const bars = screen.getAllByTestId('factor-bar');
    expect(bars).toHaveLength(3);
    expect(bars[0]!).toHaveTextContent('Completion Pull');
    expect(bars[0]!).toHaveTextContent('8');
    expect(bars[2]!).toHaveTextContent('Rewatch Potential');
  });

  it('tags the strongest factor "keep" and colors the weakest score coral', () => {
    render(<FactorBars factors={factors} />);
    const bars = screen.getAllByTestId('factor-bar');
    expect(bars[0]!).toHaveTextContent('keep');
    // weakest (<6) score cell uses the coral accent class
    expect(bars[2]!.querySelector('.text-accent')).not.toBeNull();
  });

  it('renders nothing for an empty factor list', () => {
    const { container } = render(<FactorBars factors={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
