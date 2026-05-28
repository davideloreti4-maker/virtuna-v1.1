/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { VsHistoryCollapsible } from '../VsHistoryCollapsible';
import { comparisonsFixtures } from './fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { event: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));

const mockOpenInputDrawer = vi.fn();
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { openInputDrawer: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ openInputDrawer: mockOpenInputDrawer }),
}));

import { logger } from '@/lib/logger';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(React.createElement(QueryClientProvider, { client }, ui));
}

describe('VsHistoryCollapsible', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockOpenInputDrawer.mockReset();
  });

  it('renders summary text "vs my history"', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.full), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-1" currentScore={78} />);
    expect(screen.getByText('vs my history')).toBeInTheDocument();
  });

  it('renders empty state when history.length < 3', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.partial), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-2" currentScore={78} />);
    await waitFor(() => expect(screen.queryByTestId('vs-history-empty')).toBeInTheDocument());
    expect(screen.getByTestId('vs-history-empty')).toHaveTextContent('Need 3+ prior analyses');
    expect(screen.getByTestId('vs-history-empty')).toHaveTextContent('2/3 complete');
  });

  it('renders "Run another analysis" CTA link when history.length < 3', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.partial), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-cta" currentScore={78} />);
    await waitFor(() => expect(screen.queryByTestId('vs-history-run-another')).toBeInTheDocument());
    expect(screen.getByTestId('vs-history-run-another')).toHaveTextContent('Run another analysis');
  });

  it('"Run another analysis" click calls openInputDrawer', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.partial), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-cta2" currentScore={78} />);
    await waitFor(() => expect(screen.queryByTestId('vs-history-run-another')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('vs-history-run-another'));
    expect(mockOpenInputDrawer).toHaveBeenCalledTimes(1);
  });

  it('renders last-10 BarChart when history.length >= 3', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.full), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-3" currentScore={78} />);
    await waitFor(() => expect(screen.queryByTestId('vs-history-last-10')).toBeInTheDocument());
  });

  it('renders niche-coming-soon caption when niche is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.full), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-4" currentScore={78} />);
    await waitFor(() => expect(screen.queryByTestId('vs-history-niche-coming-soon')).toBeInTheDocument());
    expect(screen.getByTestId('vs-history-niche-coming-soon')).toHaveTextContent('Niche comparison coming soon');
  });

  it('renders niche chart when niche is non-null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.fullWithNiche), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-5" currentScore={78} />);
    await waitFor(() => {
      const niche = screen.queryByTestId('vs-history-niche');
      expect(niche).toBeInTheDocument();
    });
    expect(screen.queryByTestId('vs-history-niche-coming-soon')).toBeNull();
  });

  it('fires verdict_history_expanded telemetry on toggle open', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(comparisonsFixtures.full), { status: 200 }),
    );
    wrap(<VsHistoryCollapsible analysisId="a-6" currentScore={82} />);
    const details = screen.getByTestId('vs-history-collapsible') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle', { bubbles: false }));
    expect(logger.info).toHaveBeenCalledWith(
      'verdict_history_expanded',
      expect.objectContaining({ score: 82 }),
    );
  });
});
