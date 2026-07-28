/** @vitest-environment happy-dom */
/**
 * The shared "Find new outliers" affordance (outliers SSE channel), on the ONE turn renderer.
 *
 * WHAT THIS USED TO GUARD, AND WHY IT SHRANK: hooks got the OutliersOffer first; ideas and script
 * each then carried their OWN copy of the render condition
 * (`!isStreaming && outliersAvailable && onFindOutliers`) and their own prop wiring, so a
 * regression in either was invisible to the hooks test. That accomplice is now gone by
 * construction — there is exactly one <ThreadTurn>, so there is exactly one copy of the condition.
 *
 * The cases stay parameterized by skill anyway. The condition is shared now, but the SKILL is
 * still an input to it, and a future change that made the offer skill-conditional (a plausible
 * product call — only grounded skills can scrape) must not slip through silently.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThreadTurn } from '@/components/thread/thread-turn';
import { IDEA_BLOCKS, SCRIPT_BLOCKS, HOOK_BLOCKS } from '@/app/(app)/dev/cards/fixtures';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const CASES = [
  { name: 'Ideas', skill: 'ideas' as const, blocks: IDEA_BLOCKS },
  { name: 'Hooks', skill: 'hooks' as const, blocks: HOOK_BLOCKS },
  { name: 'Script', skill: 'script' as const, blocks: SCRIPT_BLOCKS },
];

function renderTurn(
  skill: 'ideas' | 'hooks' | 'script',
  blocks: unknown[],
  props: { outliersAvailable?: boolean; onFindOutliers?: () => void; isStreaming?: boolean },
) {
  return renderWithClient(
    <ThreadTurn
      userTurn="run it"
      blocks={blocks}
      live={{
        skill,
        isStreaming: props.isStreaming ?? false,
        stages: [],
        followupText: null,
        warnings: [],
        error: null,
        outliersAvailable: props.outliersAvailable,
        onFindOutliers: props.onFindOutliers,
        audienceLabel: 'General',
        platform: 'tiktok',
      }}
    />,
  );
}

beforeEach(() => {
  cleanup();
});

describe.each(CASES)('$name turn — Find new outliers', ({ skill, blocks }) => {
  it('renders the CTA when the server offered it and the run has settled', () => {
    renderTurn(skill, blocks, { outliersAvailable: true, onFindOutliers: () => {} });
    expect(screen.getByRole('button', { name: /find new outliers/i })).toBeTruthy();
  });

  it('calls onFindOutliers exactly once on tap — never on render', () => {
    const onFindOutliers = vi.fn();
    renderTurn(skill, blocks, { outliersAvailable: true, onFindOutliers });
    expect(onFindOutliers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /find new outliers/i }));
    expect(onFindOutliers).toHaveBeenCalledTimes(1);
  });

  it('renders NOTHING when the server did not offer a scrape', () => {
    renderTurn(skill, blocks, { outliersAvailable: false, onFindOutliers: () => {} });
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('does not dangle a dead button when no callback is wired', () => {
    renderTurn(skill, blocks, { outliersAvailable: true });
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });

  it('suppresses the offer while still streaming', () => {
    renderTurn(skill, blocks, {
      outliersAvailable: true,
      onFindOutliers: () => {},
      isStreaming: true,
    });
    expect(screen.queryByRole('button', { name: /find new outliers/i })).toBeNull();
  });
});
