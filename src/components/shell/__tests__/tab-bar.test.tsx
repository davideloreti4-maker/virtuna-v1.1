/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { TabBar } from '../tab-bar';

beforeEach(() => {
  pathname = '/home';
});

const bar = () => screen.getByRole('navigation', { name: 'Places' });
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent ?? '';

describe('TabBar', () => {
  it('holds five slots: two places, the new-chat button, two places', () => {
    render(<TabBar onNewChat={() => {}} />);
    const controls = Array.from(bar().querySelectorAll('a, button')).map(nameOf);
    expect(controls).toEqual(['Home', 'Discover', 'New chat', 'Library', 'Audience']);
  });

  it('links each tab to its place', () => {
    render(<TabBar onNewChat={() => {}} />);
    const href = (name: string) => within(bar()).getByRole('link', { name }).getAttribute('href');
    expect(href('Home')).toBe('/home');
    expect(href('Discover')).toBe('/feed');
    expect(href('Library')).toBe('/library');
    expect(href('Audience')).toBe('/audience');
  });

  it('marks the current place, and only that one', () => {
    pathname = '/feed/discover';
    render(<TabBar onNewChat={() => {}} />);
    const current = within(bar()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Discover']);
  });

  it('starts a new chat from the middle button', () => {
    const onNewChat = vi.fn();
    render(<TabBar onNewChat={onNewChat} />);
    fireEvent.click(within(bar()).getByRole('button', { name: 'New chat' }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('the new-chat button sits straight in the bar, its touch target 64 through its hit-area extension', () => {
    const onNewChat = vi.fn();
    render(<TabBar onNewChat={onNewChat} />);
    const button = within(bar()).getByRole('button', { name: 'New chat' });
    // A direct child of the bar: nothing un-clickable wraps it, so its own `::before`, 7px
    // past the 50px circle on every side, is the 64px touch target.
    expect(button.parentElement).toBe(bar());
    fireEvent.click(button);
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('is glass: a blur as an inline style, because Lightning CSS strips it from classes', () => {
    render(<TabBar onNewChat={() => {}} />);
    expect(bar().getAttribute('style') ?? '').toContain('blur(24px)');
  });
});
