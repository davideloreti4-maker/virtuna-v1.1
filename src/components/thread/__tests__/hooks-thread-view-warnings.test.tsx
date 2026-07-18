/** @vitest-environment happy-dom */
/**
 * HooksThreadView — run-level degrade notices (the `warning` SSE channel).
 *
 * THE ACCOMPLICE THIS GUARDS AGAINST: the hooks route has emitted a `warning` SSE event since
 * grounding shipped, and a route-side test asserted it was SENT — but nothing consumed it, so a
 * degraded run was indistinguishable from a clean one at the glass. These assert the RECEIVING
 * end: the notice renders verbatim when warnings are present, stays hidden on a clean run, and is
 * a status note (not the W2 error block — a degrade is not a failure; the cards are real).
 *
 * Run against pre-2026-07-17 HooksThreadView (no `warnings` prop) these FAIL — that is the point.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HooksThreadView } from '@/components/thread/hooks-thread-view';
import type { HookCardBlock } from '@/lib/tools/blocks';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const HOOK_BLOCK: HookCardBlock = {
  type: 'hook-card',
  props: {
    hookLine: 'Why protein timing is a myth',
    audienceArchetype: 'The Skeptic',
    mechanism: 'Challenges a held belief',
    seedHook: 'protein timing myth',
    rank: 1,
    band: 'Strong',
    fraction: '8/10 stop',
    scrollQuote: '"Wait, I thought…"',
    model: 'sim1-flash',
    channel: 'spoken',
  },
};

const WARNING =
  'Hook "Editing is a trap." targeted "The Beginner" but was assigned "The Pro" — reporting the model\'s target';

function baseProps() {
  return {
    persistedBlocks: [] as HookCardBlock[],
    streamingBlocks: [HOOK_BLOCK],
    statusMessage: null,
    stages: [],
    followupText: null,
    isStreaming: false,
    error: null as string | null,
    platform: 'tiktok',
    userTurn: 'give me hooks',
    audienceLabel: 'General',
  };
}

beforeEach(() => {
  cleanup();
});

describe('HooksThreadView — degrade notices (warning SSE channel)', () => {
  it('renders each warning verbatim once the run has settled', () => {
    renderWithClient(<HooksThreadView {...baseProps()} warnings={[WARNING]} />);

    expect(screen.getByText(WARNING)).toBeTruthy();
    // A status note, not an alarm — a degrade is not a failure.
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders NOTHING for warnings on a clean run (empty array)', () => {
    renderWithClient(<HooksThreadView {...baseProps()} warnings={[]} />);

    expect(screen.queryByText(/this run degraded/i)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('suppresses the notice while still streaming (only shows once settled)', () => {
    renderWithClient(
      <HooksThreadView {...baseProps()} isStreaming warnings={[WARNING]} />,
    );

    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('is distinct from the W2 error block — a degrade is not a failed run', () => {
    renderWithClient(<HooksThreadView {...baseProps()} warnings={[WARNING]} />);

    // The degrade notice is present…
    expect(screen.getByRole('status')).toBeTruthy();
    // …and the error block (role="alert", tap-to-retry) is not.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/couldn.t finish that run/i)).toBeNull();
  });
});

describe('HooksThreadView — Find new outliers (outliers SSE channel)', () => {
  // THE ACCOMPLICE THIS GUARDS AGAINST: the plumbing (allowScrape → gather → route `outliers`
  // event → hook.outliersAvailable) can all be green while the button that spends the money is
  // never actually rendered, or rendered where a scrape can't help. These assert the RECEIVING end:
  // the affordance appears exactly when the server offered it, fires the callback on tap, and stays
  // hidden otherwise. Run against pre-2026-07-17 HooksThreadView (no outliersAvailable prop) they FAIL.

  it('renders the Find-new-outliers CTA when the server offered it and the run has settled', () => {
    renderWithClient(
      <HooksThreadView {...baseProps()} warnings={[]} outliersAvailable onFindOutliers={() => {}} />,
    );

    expect(screen.getByRole('button', { name: /find new outliers/i })).toBeTruthy();
  });

  it('calls onFindOutliers exactly once on tap — the explicit spend, never on render', () => {
    const onFindOutliers = vi.fn();
    renderWithClient(
      <HooksThreadView {...baseProps()} warnings={[]} outliersAvailable onFindOutliers={onFindOutliers} />,
    );

    // Never fired on render (an accidental scrape-on-mount would bill the owner).
    expect(onFindOutliers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /find new outliers/i }));
    expect(onFindOutliers).toHaveBeenCalledTimes(1);
  });

  it('renders NOTHING when the server did not offer a scrape (outliersAvailable false)', () => {
    renderWithClient(
      <HooksThreadView {...baseProps()} warnings={[]} outliersAvailable={false} onFindOutliers={() => {}} />,
    );

    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('does not dangle a dead button when no callback is wired', () => {
    renderWithClient(<HooksThreadView {...baseProps()} warnings={[]} outliersAvailable />);

    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('suppresses the offer while still streaming (only shows once settled)', () => {
    renderWithClient(
      <HooksThreadView
        {...baseProps()}
        isStreaming
        warnings={[]}
        outliersAvailable
        onFindOutliers={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });
});
