/** @vitest-environment happy-dom */
/**
 * ExploreThreadView — behaviour lock (Phase 11, Plan 06, Task 1 — EXPLORE-04/02).
 *
 * Locks the idle-ownership + honesty contract so it cannot silently regress:
 *  - IDLE renders the heading + the 3 LOCKED-copy quick-action cards (D-07/EXPLORE-04).
 *  - Card 2 ("What competitors shipped") DEGRADES to the quiet disabled
 *    "Track an account first" sub-state when hasTrackedAccounts=false — never a
 *    fabricated competitor feed (honesty spine D-02).
 *  - The quick-action cards NEVER auto-fire on render — onQuickAction is called ONLY
 *    on an explicit tap (D-07).
 *  - A tap on an enabled card runs the matching preset pull.
 *  - The grid carries NO fabricated persona quote / reaction (D-02 — the real reaction
 *    is lazy, on the reused remix-card's LensTrigger downstream).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExploreThreadView } from './explore-thread-view';
import type { ExploreThreadViewProps } from './explore-thread-view';

afterEach(cleanup);

function baseProps(overrides: Partial<ExploreThreadViewProps> = {}): ExploreThreadViewProps {
  return {
    persistedBlocks: [],
    streamingBlocks: [],
    stages: [],
    isStreaming: false,
    error: null,
    platform: 'tiktok',
    audience: null,
    hasTrackedAccounts: false,
    onQuickAction: vi.fn(),
    ...overrides,
  };
}

describe('ExploreThreadView — idle quick-actions (EXPLORE-04 / D-07)', () => {
  it('renders the idle heading + all 3 LOCKED-copy quick-action cards', () => {
    render(<ExploreThreadView {...baseProps()} />);

    expect(
      screen.getByText('Find what your audience would actually bite on.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Top performers in my niche today' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'What competitors shipped' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Surprise me' }),
    ).toBeInTheDocument();
  });

  it('degrades card 2 to the disabled "Track an account first" sub-state with no tracked accounts (honesty, D-02)', () => {
    render(<ExploreThreadView {...baseProps({ hasTrackedAccounts: false })} />);

    const card2 = screen.getByRole('button', { name: 'What competitors shipped' });
    expect(card2).toBeDisabled();
    expect(screen.getByText('Track an account first')).toBeInTheDocument();
    // Never the fabricated "feed" sub-copy when there are no tracked accounts.
    expect(
      screen.queryByText('Recent posts from accounts you track'),
    ).not.toBeInTheDocument();
  });

  it('enables card 2 with its real sub-line when tracked accounts exist', () => {
    render(<ExploreThreadView {...baseProps({ hasTrackedAccounts: true })} />);

    const card2 = screen.getByRole('button', { name: 'What competitors shipped' });
    expect(card2).toBeEnabled();
    expect(
      screen.getByText('Recent posts from accounts you track'),
    ).toBeInTheDocument();
  });

  it('card 2 fires the tracked:true signal on tap (CR-02 — route resolves handles server-side, none sent from client)', () => {
    const onQuickAction = vi.fn();
    render(
      <ExploreThreadView
        {...baseProps({ onQuickAction, hasTrackedAccounts: true })}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'What competitors shipped' }),
    );
    expect(onQuickAction).toHaveBeenCalledTimes(1);
    const params = onQuickAction.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.tracked).toBe(true);
    expect(params.timeWindow).toBe('week');
    // SECURITY (CR-01): the client NEVER sends account handles — the route resolves the
    // session user's tracked accounts itself. The payload carries no handle/accounts.
    expect(params.accounts).toBeUndefined();
  });

  it('NEVER auto-fires onQuickAction on render (D-07 — only on tap)', () => {
    const onQuickAction = vi.fn();
    render(<ExploreThreadView {...baseProps({ onQuickAction, hasTrackedAccounts: true })} />);

    // No card was tapped → no preset pull may have fired.
    expect(onQuickAction).not.toHaveBeenCalled();
  });

  it('runs the matching preset pull only when an enabled card is tapped', () => {
    const onQuickAction = vi.fn();
    render(<ExploreThreadView {...baseProps({ onQuickAction, hasTrackedAccounts: true })} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Top performers in my niche today' }),
    );
    expect(onQuickAction).toHaveBeenCalledTimes(1);
    expect(onQuickAction).toHaveBeenCalledWith(
      expect.objectContaining({ timeWindow: 'today' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    expect(onQuickAction).toHaveBeenCalledTimes(2);
    expect(onQuickAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ serendipity: 1 }),
    );
  });

  it('does NOT fire a pull when the degraded (disabled) card 2 is tapped', () => {
    const onQuickAction = vi.fn();
    render(<ExploreThreadView {...baseProps({ onQuickAction, hasTrackedAccounts: false })} />);

    fireEvent.click(screen.getByRole('button', { name: 'What competitors shipped' }));
    expect(onQuickAction).not.toHaveBeenCalled();
  });
});

describe('ExploreThreadView — honesty spine (D-02)', () => {
  it('renders no fabricated persona quote / blockquote on the idle grid', () => {
    const { container } = render(<ExploreThreadView {...baseProps()} />);
    // The real reaction is lazy (the reused remix-card LensTrigger downstream) —
    // this view must add NO reaction UI to the grid.
    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('shows the no-fake-% loading lead line while streaming, not a quick-action grid', () => {
    render(
      <ExploreThreadView
        {...baseProps({
          isStreaming: true,
          stages: [{ name: 'Pulling outliers', status: 'active' }],
        })}
      />,
    );

    expect(
      screen.getByText(/Pulling outliers and scoring them for your audience/),
    ).toBeInTheDocument();
    // Idle quick-actions are gone once a pull is in flight.
    expect(
      screen.queryByRole('button', { name: 'Top performers in my niche today' }),
    ).not.toBeInTheDocument();
  });
});

describe('ExploreThreadView — error state', () => {
  it('renders the SkillRunError with a tap-to-retry when error is set and not streaming', () => {
    const onRetry = vi.fn();
    render(
      <ExploreThreadView
        {...baseProps({ error: 'Couldn\'t reach that source.', onRetry })}
      />,
    );

    expect(screen.getByText('Couldn’t reach that source.')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry the Explore pull' });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The error state replaces idle — no quick-action cards.
    expect(
      screen.queryByRole('button', { name: 'Surprise me' }),
    ).not.toBeInTheDocument();
  });
});
