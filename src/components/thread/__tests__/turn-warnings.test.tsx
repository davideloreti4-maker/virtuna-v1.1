/** @vitest-environment happy-dom */
/**
 * Run-level degrade notices (the `warning` SSE channel), on the ONE turn renderer.
 *
 * THE ACCOMPLICE THIS GUARDS AGAINST: the hooks route has emitted a `warning` SSE event since
 * grounding shipped, and a route-side test asserted it was SENT — but nothing consumed it, so a
 * degraded run was indistinguishable from a clean one at the glass. These assert the RECEIVING
 * end: the notice renders verbatim when warnings are present, stays hidden on a clean run, and is
 * a status note (not the W2 error block — a degrade is not a failure; the cards are real).
 *
 * The "Find new outliers" cases that used to live here moved to outliers-offer-views.test.tsx,
 * which now covers hooks alongside ideas/script: under the unified <ThreadTurn> there is ONE copy
 * of that condition, so three separate per-view suites asserting it were three copies of one test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThreadTurn } from '@/components/thread/thread-turn';
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

function renderTurn(opts: { warnings: string[]; isStreaming?: boolean }) {
  return renderWithClient(
    <ThreadTurn
      userTurn="give me hooks"
      blocks={[HOOK_BLOCK]}
      live={{
        skill: 'hooks',
        isStreaming: opts.isStreaming ?? false,
        stages: [],
        followupText: null,
        warnings: opts.warnings,
        error: null,
        audienceLabel: 'General',
        platform: 'tiktok',
      }}
    />,
  );
}

beforeEach(() => {
  cleanup();
});

describe('ThreadTurn — degrade notices (warning SSE channel)', () => {
  it('renders each warning verbatim once the run has settled', () => {
    renderTurn({ warnings: [WARNING] });

    expect(screen.getByText(WARNING)).toBeTruthy();
    // A status note, not an alarm — a degrade is not a failure.
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('renders NOTHING for warnings on a clean run (empty array)', () => {
    renderTurn({ warnings: [] });

    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('suppresses the notice while still streaming (only shows once settled)', () => {
    renderTurn({ warnings: [WARNING], isStreaming: true });

    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('is distinct from the W2 error block — a degrade is not a failed run', () => {
    renderTurn({ warnings: [WARNING] });

    // The degrade notice is present…
    expect(screen.getByText(WARNING)).toBeTruthy();
    // …and the error block (role="alert", tap-to-retry) is not.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/couldn.t finish that run/i)).toBeNull();
  });
});
