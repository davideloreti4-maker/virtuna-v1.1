/** @vitest-environment happy-dom */
/**
 * HomeStarter — THE STARTER CONTRACT lock.
 *
 * The empty home used to carry FOUR empty states in THREE idioms (Make's grid, Ask's
 * prose block, Explore's own card, Account's centered Button). This suite locks the one
 * shape that replaced them, and it inherits the locks that used to live in
 * `explore-thread-view.test.tsx` — the LOCKED Explore copy, the tracked-accounts honesty
 * degrade, never-auto-fire (D-05/D-07), and tap→pull — because the cards moved here.
 *
 * The load-bearing invariants:
 *  - ONE card anatomy: every card in every set is the same <StarterCard>. No skill gets
 *    a second card component. (Asserted structurally: same class spine across sets.)
 *  - NOTHING auto-fires on render. Not the Explore pull, not the Account read (which
 *    costs a Reading), not a prefill.
 *  - Account is offered AT ALL — it has no other entry (canSubmit is false for it), so
 *    a missing Account card is an unreachable skill, not a cosmetic bug.
 *  - Explore's competitors card degrades honestly instead of fabricating a feed (D-02).
 *  - Ask prefills the field and NEVER submits.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HomeStarter } from '../home-starter';
import type { HomeStarterProps } from '../home-starter';
import type { ToolId } from '../composer-controls';

afterEach(cleanup);

function props(overrides: Partial<HomeStarterProps> = {}): HomeStarterProps {
  return {
    tool: 'idea' as ToolId,
    onSelectTool: vi.fn(),
    onExplore: vi.fn(),
    onAccountRun: vi.fn(),
    onPrefill: vi.fn(),
    hasTrackedAccounts: false,
    ...overrides,
  };
}

// ── The default set ───────────────────────────────────────────────────────────

describe('HomeStarter — the DEFAULT set', () => {
  it('renders the 6 creator quick actions for a Make skill', () => {
    render(<HomeStarter {...props({ tool: 'idea' })} />);

    for (const name of [
      'Get content ideas',
      'Write scroll-stopping hooks',
      'Script a video',
      'Remix a viral video',
      'Test a video',
      'Read my recent posts',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('arms the matching skill on tap, and only on tap', () => {
    const onSelectTool = vi.fn();
    render(<HomeStarter {...props({ tool: 'idea', onSelectTool })} />);

    expect(onSelectTool).not.toHaveBeenCalled(); // never on render

    fireEvent.click(screen.getByRole('button', { name: 'Write scroll-stopping hooks' }));
    expect(onSelectTool).toHaveBeenCalledTimes(1);
    expect(onSelectTool).toHaveBeenCalledWith('hooks');
  });

  it('falls back to the default set for every skill with no idle offer (never a bare screen)', () => {
    for (const tool of ['idea', 'hooks', 'script', 'remix', 'test'] as ToolId[]) {
      cleanup();
      render(<HomeStarter {...props({ tool })} />);
      expect(
        screen.getByRole('button', { name: 'Get content ideas' }),
      ).toBeInTheDocument();
    }
  });
});

// ── Ask ───────────────────────────────────────────────────────────────────────

describe('HomeStarter — Ask (was a prose block)', () => {
  it('offers sendable questions instead of a paragraph', () => {
    render(<HomeStarter {...props({ tool: 'chat' })} />);

    expect(
      screen.getByRole('button', { name: 'What should I post this week?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'What is my audience tired of?' }),
    ).toBeInTheDocument();
  });

  it('prefills the field with the question on tap — and NEVER submits (D-05)', () => {
    const onPrefill = vi.fn();
    render(<HomeStarter {...props({ tool: 'chat', onPrefill })} />);

    expect(onPrefill).not.toHaveBeenCalled(); // never on render

    fireEvent.click(screen.getByRole('button', { name: 'What should I post this week?' }));
    expect(onPrefill).toHaveBeenCalledTimes(1);
    expect(onPrefill).toHaveBeenCalledWith('What should I post this week?');
  });
});

// ── Explore (ported from explore-thread-view.test.tsx) ─────────────────────────

describe('HomeStarter — Explore (EXPLORE-04 / D-07, ported)', () => {
  it('renders all 3 LOCKED-copy starting points', () => {
    render(<HomeStarter {...props({ tool: 'explore' })} />);

    expect(
      screen.getByRole('button', { name: 'Top performers in my niche today' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'What competitors shipped' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Surprise me' })).toBeInTheDocument();
  });

  it('degrades the competitors card to the disabled "Track an account first" state (honesty, D-02)', () => {
    render(<HomeStarter {...props({ tool: 'explore', hasTrackedAccounts: false })} />);

    const card = screen.getByRole('button', { name: 'What competitors shipped' });
    expect(card).toBeDisabled();
    // The dead card SAYS why it is dead. Cards carry no sub-line otherwise (the starter
    // is prose-free) — but a card that cannot fire and cannot explain itself reads as
    // broken rather than honest, so this one line survives exactly here.
    expect(screen.getByText('Track an account first')).toBeInTheDocument();
  });

  it('enables the competitors card — and drops the reason line, which only a dead card carries', () => {
    render(<HomeStarter {...props({ tool: 'explore', hasTrackedAccounts: true })} />);

    expect(screen.getByRole('button', { name: 'What competitors shipped' })).toBeEnabled();
    expect(screen.queryByText('Track an account first')).not.toBeInTheDocument();
  });

  it('fires tracked:true on tap — the client NEVER sends handles (CR-01/CR-02)', () => {
    const onExplore = vi.fn();
    render(<HomeStarter {...props({ tool: 'explore', onExplore, hasTrackedAccounts: true })} />);

    fireEvent.click(screen.getByRole('button', { name: 'What competitors shipped' }));
    expect(onExplore).toHaveBeenCalledTimes(1);
    const params = onExplore.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.tracked).toBe(true);
    expect(params.timeWindow).toBe('week');
    // SECURITY: the route resolves the session user's tracked accounts itself.
    expect(params.accounts).toBeUndefined();
  });

  it('NEVER auto-fires a pull on render (D-07 — only on tap)', () => {
    const onExplore = vi.fn();
    render(<HomeStarter {...props({ tool: 'explore', onExplore, hasTrackedAccounts: true })} />);

    expect(onExplore).not.toHaveBeenCalled();
  });

  it('runs the matching preset pull when an enabled card is tapped', () => {
    const onExplore = vi.fn();
    render(
      <HomeStarter
        {...props({
          tool: 'explore',
          onExplore,
          hasTrackedAccounts: true,
          audienceNiche: 'fitness',
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Top performers in my niche today' }));
    expect(onExplore).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeWindow: 'today', niche: 'fitness' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    expect(onExplore).toHaveBeenCalledTimes(2);
    expect(onExplore).toHaveBeenLastCalledWith(
      expect.objectContaining({ serendipity: 1 }),
    );
  });

  it('does NOT fire a pull when the degraded (disabled) card is tapped', () => {
    const onExplore = vi.fn();
    render(<HomeStarter {...props({ tool: 'explore', onExplore, hasTrackedAccounts: false })} />);

    fireEvent.click(screen.getByRole('button', { name: 'What competitors shipped' }));
    expect(onExplore).not.toHaveBeenCalled();
  });

  it('omits the niche entirely when there is no audience (honest un-niched pull, never "")', () => {
    const onExplore = vi.fn();
    render(<HomeStarter {...props({ tool: 'explore', onExplore, audienceNiche: '   ' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Top performers in my niche today' }));
    const params = onExplore.mock.calls[0]![0] as Record<string, unknown>;
    expect(params.niche).toBeUndefined();
  });
});

// ── Account ───────────────────────────────────────────────────────────────────

describe('HomeStarter — Account (its ONLY entry)', () => {
  it('offers the one-tap read — without this card the skill is unreachable (canSubmit is false)', () => {
    render(<HomeStarter {...props({ tool: 'account' })} />);

    expect(
      screen.getByRole('button', { name: 'Read my recent posts' }),
    ).toBeInTheDocument();
  });

  it('NEVER auto-runs the read on render — it costs a Reading (D-05)', () => {
    const onAccountRun = vi.fn();
    render(<HomeStarter {...props({ tool: 'account', onAccountRun })} />);

    expect(onAccountRun).not.toHaveBeenCalled();
  });

  it('runs the read on an explicit tap', () => {
    const onAccountRun = vi.fn();
    render(<HomeStarter {...props({ tool: 'account', onAccountRun })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Read my recent posts' }));
    expect(onAccountRun).toHaveBeenCalledTimes(1);
  });
});

// ── The contract itself ───────────────────────────────────────────────────────

describe('HomeStarter — NO PROSE (rule 2)', () => {
  /**
   * The starter carries no lede above the grid and no sub-line under a title. Both existed
   * and both were cut. This is the guard against them creeping back one skill at a time —
   * which is exactly how the four-empty-states drift happened the first time.
   */
  it.each(['idea', 'chat', 'explore', 'account'] as const)(
    'the %s set renders cards only — no lede paragraph',
    (tool) => {
      const { container } = render(
        <HomeStarter {...props({ tool: tool as ToolId, hasTrackedAccounts: true })} />,
      );
      expect(container.querySelector('p')).toBeNull();
    },
  );

  it('an ENABLED card renders its title and nothing else', () => {
    render(<HomeStarter {...props({ tool: 'idea' })} />);

    const card = screen.getByRole('button', { name: 'Get content ideas' });
    expect(card.textContent).toBe('Get content ideas');
  });

  it('a DISABLED card is the one exception — title + why it cannot fire', () => {
    render(<HomeStarter {...props({ tool: 'explore', hasTrackedAccounts: false })} />);

    const card = screen.getByRole('button', { name: 'What competitors shipped' });
    expect(card.textContent).toBe('What competitors shippedTrack an account first');
  });
});

describe('HomeStarter — ONE card anatomy across every set', () => {
  /**
   * The whole point of the contract: a card is a card is a card. Explore's old bespoke
   * card put the icon ABOVE the text with no fill at 16/14px; the home grid put it LEFT
   * on a filled surface at 14/12.5px. If a future skill grows its own card again, the
   * class spine diverges and this fails.
   */
  const SPINE = ['rounded-[12px]', 'bg-surface-sunken', 'items-start', 'px-4', 'py-4'];

  it.each([
    ['idea', 'Get content ideas'],
    ['chat', 'What should I post this week?'],
    ['explore', 'Top performers in my niche today'],
    ['account', 'Read my recent posts'],
  ] as const)('%s cards share the one anatomy', (tool, cardName) => {
    render(<HomeStarter {...props({ tool: tool as ToolId, hasTrackedAccounts: true })} />);

    const card = screen.getByRole('button', { name: cardName });
    for (const cls of SPINE) {
      expect(card.className).toContain(cls);
    }
  });
});
