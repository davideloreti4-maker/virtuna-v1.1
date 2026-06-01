/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('@phosphor-icons/react', () => ({
  Clock: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-clock" aria-hidden {...rest} />,
  Info: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-info" {...rest} />,
}));

import { OptimalPostCard } from '../OptimalPostCard';
import { logger } from '@/lib/logger';

const baseWindow = {
  day_of_week: 'Tue' as const,
  hour_range: [18, 21] as [number, number],
  timezone: 'UTC' as const,
  reasoning: 'Your niche peaks Tue 18:00-21:00 UTC (n=12 videos)',
  source: 'niche' as const,
};

function Wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('OptimalPostCard', () => {
  it('renders skeleton when window is null (server backfills real data; null is a transient edge)', () => {
    const { container } = render(<Wrap><OptimalPostCard window={null} override={null} analysisId="aid-1" /></Wrap>);
    expect(container.querySelector('[data-testid="actions-optimal-post-card"]')).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders day, hour-range, reasoning, source pill when window provided', () => {
    render(<Wrap><OptimalPostCard window={baseWindow} override={null} analysisId="aid-1" /></Wrap>);
    expect(screen.getByText('When to post')).toBeTruthy();
    expect(screen.getByText(baseWindow.reasoning)).toBeTruthy();
    // Source pill renders niche label by default
    expect(screen.getByText('from your niche')).toBeTruthy();
  });

  it('shows source=creator pill when override is present', () => {
    render(<Wrap>
      <OptimalPostCard
        window={baseWindow}
        override={{ day_of_week: 'Thu', hour_range: [20, 23] }}
        analysisId="aid-1"
      />
    </Wrap>);
    expect(screen.getByText('yours')).toBeTruthy();
  });

  it('fires OPTIMAL_POST_TZ_CONVERTED once on first render with window', () => {
    render(<Wrap><OptimalPostCard window={baseWindow} override={null} analysisId="aid-1" /></Wrap>);
    expect(logger.info).toHaveBeenCalledWith(
      'optimal_post_tz_converted',
      expect.objectContaining({ analysis_id: 'aid-1', source_tz: 'UTC' }),
    );
  });
});
