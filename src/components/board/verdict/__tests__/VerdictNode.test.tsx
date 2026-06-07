/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { fixtures } from './fixtures/prediction-result';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } }));
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(),
}));
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { boardState: string }) => unknown) => selector({ boardState: 'complete' }),
}));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }));

import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { logger } from '@/lib/logger';
import { VerdictNode } from '../VerdictNode';
import { deriveVerdictSummary } from '../verdict-constants';

describe('deriveVerdictSummary', () => {
  it('picks the highest factor as driver and the lowest (<6) as risk', () => {
    const s = deriveVerdictSummary(fixtures.complete.factors);
    // fixtures: visual-hook 8 (top), cta 3 (bottom)
    expect(s.driver).toEqual({ name: 'Visual hook', rationale: 'Strong cold open' });
    expect(s.risk).toEqual({ name: 'CTA', tip: 'Add explicit follow request' });
  });

  it('returns null risk when every factor scores ≥6', () => {
    const s = deriveVerdictSummary([
      { id: 'a', name: 'A', score: 9, max_score: 10, rationale: 'r', improvement_tip: 't' },
      { id: 'b', name: 'B', score: 7, max_score: 10, rationale: 'r', improvement_tip: 't' },
    ]);
    expect(s.driver?.name).toBe('A');
    expect(s.risk).toBeNull();
  });

  it('returns both null when no factors', () => {
    expect(deriveVerdictSummary([])).toEqual({ driver: null, risk: null });
  });
});

// Wrap with QueryClientProvider since VerdictNode now renders VsHistoryCollapsible
// which calls useComparisons (TanStack Query hook). (Rule 1 auto-fix - Plan 5.4)
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

function renderWithQuery(ui: React.ReactElement) {
  return render(ui, { wrapper: makeWrapper() });
}

describe('VerdictNode - shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ history: [], niche: null }), { status: 200 }),
    );
    (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue({
      result: fixtures.complete,
      phase: 'complete',
      analysisId: 'test-shell-analysis-id',
    });
  });

  it('renders the verdict-node shell with a single sr-only polite live region', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    const node = screen.getByTestId('verdict-node');
    expect(node).toBeInTheDocument();
    // Root no longer carries aria-live (killed the 3-overlapping-region storm);
    // the sole polite announcer is the dedicated sr-only span.
    expect(node.getAttribute('aria-live')).toBeNull();
    expect(screen.getByTestId('verdict-aria-live').getAttribute('aria-live')).toBe('polite');
  });

  it('renders the verdict score hero, and the distribution histogram under its tab', async () => {
    const user = userEvent.setup();
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    // Hero number is always visible.
    expect(screen.getByTestId('verdict-score')).toHaveTextContent('78');
    // Distribution histogram now lives behind the Distribution tab (progressive
    // disclosure — redesign v2). Activate the tab to mount it.
    await user.click(screen.getByRole('tab', { name: 'Distribution' }));
    expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
    expect(screen.getByTestId('band-label')).toBeInTheDocument();
  });

  it('renders committed factor bars in the default Breakdown tab', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    const bars = screen.getByTestId('factor-bars');
    // strongest + weakest factors from fixtures.complete both render as bars
    expect(bars).toHaveTextContent('Visual hook');
    expect(bars).toHaveTextContent('CTA');
  });

  it('renders the 4 behavioral-percentile stat tiles in the hero row', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    const row = screen.getByTestId('stat-tile-row');
    expect(row).toHaveTextContent('Share');
    expect(row).toHaveTextContent('Completion');
    expect(row).toHaveTextContent('Comment');
    expect(row).toHaveTextContent('Save');
    // Share percentile from fixtures.complete = "80th"
    expect(row).toHaveTextContent('80');
  });

  it('announces "Verdict ready: {N}th percentile, confidence HIGH" after 500ms with fixtures.complete', async () => {
    vi.useFakeTimers();
    try {
      renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId('verdict-aria-live')).toHaveTextContent(
        'Verdict ready: 78th percentile, confidence HIGH',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('fires verdict_node_rendered telemetry once on first complete', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    expect(logger.info).toHaveBeenCalledWith(
      'verdict_node_rendered',
      expect.objectContaining({
        score: 78,
        confidence_label: 'HIGH',
        anti_virality_gated: false,
      }),
    );
  });
});

// T1.3: the projected-views ("engagement-range") block was CUT from the board —
// it was a formula off the score (followers × (score/100)² × 0.20), not a measured
// view model. The board must never render it.
describe('VerdictNode - T1.3 projected-views block removed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ history: [], niche: null }), { status: 200 }),
    );
  });

  function mockResult(result: unknown) {
    (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue({
      result, phase: 'complete', analysisId: 'r11-test',
    });
  }

  it('never renders the engagement-range block, even with a populated predicted_engagement', () => {
    mockResult({
      ...fixtures.complete,
      predicted_engagement: { lo: 8000, hi: 42000, confidence: 0.75, basis: 'follower-tier × quality read' },
    });
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    expect(screen.queryByTestId('engagement-range')).toBeNull();
    expect(screen.queryByText('Projected views')).toBeNull();
  });

  it('never renders it from a persisted variants.engagement_range either', () => {
    mockResult({
      ...fixtures.complete,
      predicted_engagement: null,
      variants: { engagement_range: { lo: 1200000, hi: 3000000, confidence: 0.3, basis: 'follower-tier × quality read' } },
    });
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    expect(screen.queryByTestId('engagement-range')).toBeNull();
  });
});
