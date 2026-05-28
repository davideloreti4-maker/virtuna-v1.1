/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));

import { OptimalPostSourcePill } from '../OptimalPostSourcePill';
import { logger } from '@/lib/logger';

beforeEach(() => vi.clearAllMocks());

describe('OptimalPostSourcePill', () => {
  it('renders "from your niche" for source=niche', () => {
    render(<OptimalPostSourcePill source="niche" analysisId="aid-1" reasoningString="Your niche peaks Tue 18:00-21:00 UTC (n=12 videos)" />);
    expect(screen.getByText('from your niche')).toBeTruthy();
  });

  it('renders "default" for source=fallback', () => {
    render(<OptimalPostSourcePill source="fallback" analysisId="aid-1" />);
    expect(screen.getByText('default')).toBeTruthy();
  });

  it('renders "yours" for source=creator', () => {
    render(<OptimalPostSourcePill source="creator" analysisId="aid-1" />);
    expect(screen.getByText('yours')).toBeTruthy();
  });

  it('extracts N from reasoning string for niche tooltip', () => {
    render(<OptimalPostSourcePill source="niche" analysisId="aid-1" reasoningString="Your niche peaks Tue (n=42 videos)" />);
    const infoBtn = screen.getByRole('button', { name: 'View data source' });
    fireEvent.focus(infoBtn);
    expect(screen.getByRole('tooltip').textContent).toContain('42 videos');
  });

  it('falls back gracefully when N is missing', () => {
    render(<OptimalPostSourcePill source="niche" analysisId="aid-1" reasoningString="bare prose without count" />);
    fireEvent.focus(screen.getByRole('button', { name: 'View data source' }));
    expect(screen.getByRole('tooltip').textContent).toContain('videos in your niche');
  });

  it('fires OPTIMAL_POST_SOURCE_EXPLAINED on first tooltip open', () => {
    render(<OptimalPostSourcePill source="niche" analysisId="aid-1" reasoningString="Your niche peaks Tue (n=12 videos)" />);
    fireEvent.focus(screen.getByRole('button', { name: 'View data source' }));
    expect(logger.info).toHaveBeenCalledWith(
      'optimal_post_source_explained',
      expect.objectContaining({ analysis_id: 'aid-1', source: 'niche' }),
    );
  });
});
