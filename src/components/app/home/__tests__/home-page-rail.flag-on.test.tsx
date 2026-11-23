/** @vitest-environment happy-dom */
/**
 * HomePageLayout under the new look (thread answers step 1, Task 6): the audience side panel is
 * gone. No right column in a thread or on Home, the composer is handed no portal host, and
 * the work column still fills the row (it centres its own content), so no empty column is left.
 *
 * The flag-off rail is held by home-page-rail.test.tsx. The composer is stubbed, as there, so the
 * layout's contract is tested without the composer's streams. The open chat is a blank new chat (the
 * active-thread cookie holds the sentinel) unless a test says otherwise: with any other pointer /home
 * starts on the chat's load (Home plan 2026-11-23, Task 5), which the stub never ends.
 */
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from '@/lib/threads/active-thread-cookie';
import { useShellStore } from '@/stores/shell-store';

vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));
vi.mock('@/lib/flags/ambient-v2', () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock('@/lib/flags/concept-v8', () => ({ CONCEPT_V8_ENABLED: true }));

vi.mock('../composer', () => ({
  Composer: ({
    className,
    onThreadChange,
    railHost,
  }: {
    className?: string;
    onThreadChange?: (v: boolean) => void;
    railHost?: HTMLElement | null;
  }) => (
    <button
      data-testid="composer-stub"
      data-has-rail={railHost ? 'yes' : 'no'}
      data-class={className ?? ''}
      onClick={() => onThreadChange?.(true)}
    >
      stub
    </button>
  ),
}));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('../home-greeting', () => ({ HomeGreeting: () => <div data-testid="greeting-stub" /> }));

import { HomePageLayout } from '../home-page-layout';

beforeEach(() => {
  setActiveThreadCookie(NEW_THREAD_SENTINEL);
  useShellStore.setState({ threadOpen: false });
});
afterEach(() => {
  cleanup();
  clearActiveThreadCookie();
});

const railAside = () => document.querySelector('aside[aria-label="Your audience"]');
const workColumn = () => screen.getByTestId('composer-stub').parentElement as HTMLElement;

describe('HomePageLayout, flag on: no audience side panel', () => {
  it('a thread: no rail <aside>, the composer gets no portal host, and its column fills the row', () => {
    render(<HomePageLayout />);
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    expect(railAside()).toBeNull();
    expect(screen.queryByRole('separator', { name: /resize the audience rail/i })).toBeNull();
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('no');
    const classes = workColumn().className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['flex-1', 'min-w-0', 'min-h-0']));
    expect(classes).not.toContain('max-w-[760px]');
  });

  // Home plan 2026-11-23, Task 4: an empty /home is Home, which lays itself out (its top row in
  // the phone's band, a fixed start on desktop), so the page does not centre it.
  it('Home: no rail <aside>, no centring, and the work column and the composer fill the page', () => {
    render(<HomePageLayout />);
    expect(railAside()).toBeNull();
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('no');
    const root = workColumn().parentElement as HTMLElement;
    const rootClasses = root.className.split(/\s+/);
    expect(rootClasses).toEqual(expect.arrayContaining(['min-h-full', 'flex-col']));
    expect(rootClasses).not.toContain('justify-center');
    expect(rootClasses).not.toContain('items-center');
    expect(rootClasses.some((c) => c.startsWith('xl:'))).toBe(false);
    const columnClasses = workColumn().className.split(/\s+/);
    expect(columnClasses).toContain('flex-1');
    expect(columnClasses).not.toContain('max-w-[760px]');
    expect(screen.getByTestId('composer-stub').getAttribute('data-class')?.split(/\s+/)).toContain('flex-1');
  });
});

// Home plan 2026-11-23, Task 5: the phone tab bar reads the shell store's `threadOpen`. A reload into
// a chat must hide it from the first paint, never show it for a frame.
describe('HomePageLayout, flag on: a reload into a chat hides the tab bar from the first frame', () => {
  /** What the shell store says once the first commit's layout effects have run: the first paint. */
  function FirstPaintProbe({ seen }: { seen: boolean[] }) {
    useLayoutEffect(() => {
      seen.push(useShellStore.getState().threadOpen);
    }, [seen]);
    return null;
  }

  it('the pointer is a thread id: a thread is open at the first paint', () => {
    setActiveThreadCookie('t1');
    const seen: boolean[] = [];
    render(
      <>
        <HomePageLayout />
        <FirstPaintProbe seen={seen} />
      </>,
    );
    expect(seen).toEqual([true]);
    expect(useShellStore.getState().threadOpen).toBe(true);
  });

  it('a blank new chat (the sentinel): no thread open, and Home is laid out', () => {
    const seen: boolean[] = [];
    render(
      <>
        <HomePageLayout />
        <FirstPaintProbe seen={seen} />
      </>,
    );
    expect(seen).toEqual([false]);
    expect(useShellStore.getState().threadOpen).toBe(false);
  });
});
