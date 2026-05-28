/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

  it('renders verdict-node container with aria-live="polite"', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    const node = screen.getByTestId('verdict-node');
    expect(node).toBeInTheDocument();
    expect(node.getAttribute('aria-live')).toBe('polite');
  });

  it('reserves verdict-collapsibles-slot for Plan 5.3 / 5.4', () => {
    renderWithQuery(<VerdictNode camera={{} as never} layout={{} as never} />);
    expect(screen.getByTestId('verdict-collapsibles-slot')).toBeInTheDocument();
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
