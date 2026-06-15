/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The poster reads usePermalinkFilmstrips() (useQuery) and the gauge reads
// usePrefersReducedMotion — mock both so the hero mounts without a provider.
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({}),
}));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

import { ReadingHero } from '../reading-hero';

describe('ReadingHero — scorecard stat honesty (hero v6)', () => {
  it('renders the gauge + all three stats when every value is derivable', () => {
    render(<ReadingHero score={60} watch={54} dropT={8} finishRate={31} heatmap={null} />);

    expect(screen.getByRole('img', { name: /Score 60 of 100/ })).toBeInTheDocument();

    expect(screen.getByTestId('reading-watch')).toHaveTextContent('54%');
    expect(screen.getByText('Watch-through')).toBeInTheDocument();
    expect(screen.getByText('0:08')).toBeInTheDocument();
    expect(screen.getByText('Biggest drop')).toBeInTheDocument();
    expect(screen.getByTestId('reading-finish')).toHaveTextContent('31%');
    expect(screen.getByText('Finish rate')).toBeInTheDocument();
  });

  it('omits each stat whose value is null — never a fabricated 0 (D-13)', () => {
    render(<ReadingHero score={60} watch={null} dropT={null} finishRate={null} heatmap={null} />);

    // The gauge (a real, scored read) still renders.
    expect(screen.getByRole('img', { name: /Score 60 of 100/ })).toBeInTheDocument();

    // No stat row, no stat label, no fabricated "0%".
    expect(screen.queryByTestId('reading-watch')).toBeNull();
    expect(screen.queryByText('Watch-through')).toBeNull();
    expect(screen.queryByText('Biggest drop')).toBeNull();
    expect(screen.queryByText('Finish rate')).toBeNull();
    expect(screen.getByTestId('reading-hero').textContent ?? '').not.toMatch(/0%/);
  });

  it('shows the "Partial read" note only when partial', () => {
    const { rerender } = render(
      <ReadingHero score={60} watch={54} dropT={8} finishRate={31} heatmap={null} />,
    );
    expect(screen.queryByTestId('reading-partial')).toBeNull();

    rerender(<ReadingHero score={60} watch={54} dropT={8} finishRate={31} heatmap={null} partial />);
    expect(screen.getByTestId('reading-partial')).toHaveTextContent(/Partial read/i);
  });
});
