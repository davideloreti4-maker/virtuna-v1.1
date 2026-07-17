/** @vitest-environment happy-dom */
/**
 * Ideas & Script thread views — the shared "Find new outliers" affordance (outliers SSE channel).
 *
 * THE ACCOMPLICE THIS GUARDS AGAINST: hooks got the OutliersOffer first; ideas and script each
 * carry their OWN copy of the render condition (`!isStreaming && outliersAvailable && onFindOutliers`)
 * and their own prop wiring. The hooks test can't see a regression in either of those. These assert
 * the RECEIVING end for both views: the affordance appears when the server offered it, fires the
 * callback on tap (the explicit spend — never on render), and stays hidden otherwise.
 *
 * Run against a view without the outliersAvailable prop these FAIL — that is the point.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdeasThreadView } from '@/components/thread/ideas-thread-view';
import { ScriptThreadView } from '@/components/thread/script-thread-view';
import { IDEA_BLOCKS, SCRIPT_BLOCKS } from '@/app/(app)/dev/cards/fixtures';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// Each view rendered with one settled result card, parameterized by its offer props.
const CASES = [
  {
    name: 'Ideas',
    render: (props: { outliersAvailable?: boolean; onFindOutliers?: () => void; isStreaming?: boolean }) => (
      <IdeasThreadView
        persistedBlocks={[]}
        streamingBlocks={IDEA_BLOCKS}
        statusMessage={null}
        stages={[]}
        followupText={null}
        isStreaming={props.isStreaming ?? false}
        error={null}
        platform="tiktok"
        userTurn="give me ideas"
        audienceLabel="General"
        outliersAvailable={props.outliersAvailable}
        onFindOutliers={props.onFindOutliers}
      />
    ),
  },
  {
    name: 'Script',
    render: (props: { outliersAvailable?: boolean; onFindOutliers?: () => void; isStreaming?: boolean }) => (
      <ScriptThreadView
        persistedBlocks={[]}
        streamingBlocks={SCRIPT_BLOCKS}
        stages={[]}
        followupText={null}
        isStreaming={props.isStreaming ?? false}
        error={null}
        platform="tiktok"
        inputHookLine="Stop editing your videos."
        userTurn="write a script"
        audienceLabel="General"
        outliersAvailable={props.outliersAvailable}
        onFindOutliers={props.onFindOutliers}
      />
    ),
  },
] as const;

beforeEach(() => {
  cleanup();
});

describe.each(CASES)('$name thread view — Find new outliers', ({ render: renderView }) => {
  it('renders the CTA when the server offered it and the run has settled', () => {
    renderWithClient(renderView({ outliersAvailable: true, onFindOutliers: () => {} }));
    expect(screen.getByRole('button', { name: /find new outliers/i })).toBeTruthy();
  });

  it('calls onFindOutliers exactly once on tap — never on render', () => {
    const onFindOutliers = vi.fn();
    renderWithClient(renderView({ outliersAvailable: true, onFindOutliers }));
    expect(onFindOutliers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /find new outliers/i }));
    expect(onFindOutliers).toHaveBeenCalledTimes(1);
  });

  it('renders NOTHING when the server did not offer a scrape', () => {
    renderWithClient(renderView({ outliersAvailable: false, onFindOutliers: () => {} }));
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('does not dangle a dead button when no callback is wired', () => {
    renderWithClient(renderView({ outliersAvailable: true }));
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('suppresses the offer while still streaming', () => {
    renderWithClient(renderView({ outliersAvailable: true, onFindOutliers: () => {}, isStreaming: true }));
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });
});
