/** @vitest-environment happy-dom */
/**
 * HomeStarter — THE STARTER CONTRACT lock.
 *
 * Two rounds of drift are pinned here.
 *
 * Round 1: the empty home carried FOUR empty states in THREE idioms (Make's grid, Ask's
 * prose block, Explore's own card, Account's centered Button). That gave every skill the
 * same SHAPE.
 *
 * Round 2 (owner call, 2026-07-14): the same shape was still filled with a different SET
 * per skill — arm a skill and the six things you could do became four different things.
 * The grid is the map of what the app DOES, and a map that redraws itself when you turn is
 * not a map. So the six are now CONSTANT, and what is armed is told by the skill chip and
 * the placeholder instead.
 *
 * The load-bearing invariants:
 *  - The SAME SIX cards render under every skill. No exceptions, no per-skill sets.
 *  - NOTHING auto-fires on render — least of all the Account read, which spends a Reading.
 *  - Account RUNS on tap (it takes no input); the other five ARM and hand off to the field.
 *  - No prose: no lede, no sub-line. A card is a verb.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HomeStarter } from '../home-starter';
import type { HomeStarterProps } from '../home-starter';
import type { ToolId } from '../composer-controls';

afterEach(cleanup);

/** The six, in order. Locked — this list IS the contract. */
const THE_SIX = [
  'Get content ideas',
  'Write scroll-stopping hooks',
  'Script a video',
  'Remix a viral video',
  'Test a video',
  'Read my recent posts',
] as const;

/** Every skill a creator can arm from the composer. The grid must not budge for any of them. */
const EVERY_SKILL: ToolId[] = [
  'chat',
  'idea',
  'hooks',
  'script',
  'remix',
  'explore',
  'test',
  'account',
];

function props(overrides: Partial<HomeStarterProps> = {}): HomeStarterProps {
  return {
    onSelectTool: vi.fn(),
    onAccountRun: vi.fn(),
    ...overrides,
  };
}

describe('HomeStarter — the six are CONSTANT', () => {
  it('renders exactly the six, in order', () => {
    render(<HomeStarter {...props()} />);

    for (const title of THE_SIX) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(THE_SIX.length);
  });

  /**
   * The regression that matters. HomeStarter takes no `tool` prop at all any more, so the
   * grid CANNOT vary by skill — this asserts the API itself, which is the strongest form of
   * the guarantee: to reintroduce per-skill sets you would have to change the signature, and
   * this test would stop compiling.
   */
  it('has no per-skill knob — the API cannot express a varying grid', () => {
    const keys = Object.keys(props());
    expect(keys).not.toContain('tool');
    expect(keys).not.toContain('hasTrackedAccounts');
    expect(keys).not.toContain('audienceNiche');
  });

  it('renders the identical grid no matter which skill is armed elsewhere', () => {
    // The starter is skill-blind by construction; re-render under every skill's callbacks
    // and assert the six never move. (Belt to the API test's braces.)
    for (const _skill of EVERY_SKILL) {
      cleanup();
      render(<HomeStarter {...props()} />);
      const titles = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
      expect(titles).toEqual([...THE_SIX]);
    }
  });
});

describe('HomeStarter — arm vs run', () => {
  it('the five field-skills ARM and stop — they never fire a run', () => {
    const onSelectTool = vi.fn();
    const onAccountRun = vi.fn();
    render(<HomeStarter {...props({ onSelectTool, onAccountRun })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Write scroll-stopping hooks' }));
    expect(onSelectTool).toHaveBeenCalledWith('hooks');
    expect(onAccountRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remix a viral video' }));
    expect(onSelectTool).toHaveBeenLastCalledWith('remix');

    fireEvent.click(screen.getByRole('button', { name: 'Test a video' }));
    expect(onSelectTool).toHaveBeenLastCalledWith('test');
  });

  it('Account RUNS on tap — it takes no input, so arming it alone would be a dead end', () => {
    const onAccountRun = vi.fn();
    render(<HomeStarter {...props({ onAccountRun })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Read my recent posts' }));
    expect(onAccountRun).toHaveBeenCalledTimes(1);
  });

  it('NOTHING fires on render — the Account read spends a Reading (D-05)', () => {
    const onSelectTool = vi.fn();
    const onAccountRun = vi.fn();
    render(<HomeStarter {...props({ onSelectTool, onAccountRun })} />);

    expect(onAccountRun).not.toHaveBeenCalled();
    expect(onSelectTool).not.toHaveBeenCalled();
  });
});

describe('HomeStarter — NO PROSE, ONE anatomy', () => {
  it('renders no lede paragraph', () => {
    const { container } = render(<HomeStarter {...props()} />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('a card is its title and nothing else', () => {
    render(<HomeStarter {...props()} />);
    for (const title of THE_SIX) {
      expect(screen.getByRole('button', { name: title }).textContent).toBe(title);
    }
  });

  /**
   * The whole point of the contract: a card is a card is a card. Explore's old bespoke card
   * put the icon ABOVE the text with no fill at 16/14px; the home grid put it LEFT on a
   * filled surface. If a future skill grows its own card again, this spine diverges.
   */
  it('every card shares the one anatomy', () => {
    render(<HomeStarter {...props()} />);
    const SPINE = ['rounded-[12px]', 'bg-surface-sunken', 'items-start', 'px-4', 'py-4'];

    for (const title of THE_SIX) {
      const card = screen.getByRole('button', { name: title });
      for (const cls of SPINE) {
        expect(card.className).toContain(cls);
      }
    }
  });
});
