/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  getActiveThreadCookie,
  setActiveThreadCookie,
} from '@/lib/threads/active-thread-cookie';
import { useBoardStore } from '@/stores/board-store';

// Mocked: the router and the network. Real: the board store, the cookie, the toasts.
const push = vi.fn();
// One object, as the real App Router returns: a fresh one per render would defeat the memo.
const router = { push, replace: vi.fn() };
let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

const archive = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useArchiveThread: () => ({ mutateAsync: archive }),
}));

import { useThreadActions } from '../use-thread-actions';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const actions = () => renderHook(() => useThreadActions(), { wrapper }).result;

beforeEach(() => {
  push.mockReset();
  archive.mockReset();
  pathname = '/home';
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
});

describe('useThreadActions', () => {
  it('newThread leaves the open thread and lands on the blank Home', () => {
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    act(() => result.current.newThread());

    expect(useBoardStore.getState().activeThreadId).toBeNull();
    // The sentinel, not an empty cookie: without it /home re-opens the newest thread.
    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('openThread points the app at the thread and goes Home, where threads render', () => {
    pathname = '/library';
    const result = actions();

    act(() => result.current.openThread('t2'));

    expect(useBoardStore.getState().activeThreadId).toBe('t2');
    expect(getActiveThreadCookie()).toBe('t2');
    expect(push).toHaveBeenCalledWith('/home');
  });

  it('deleting the open thread clears the pointer', async () => {
    archive.mockResolvedValue(undefined);
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t1', true));

    expect(archive).toHaveBeenCalledWith('t1');
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(getActiveThreadCookie()).toBeNull();
  });

  it('deleting another thread leaves the open one alone', async () => {
    archive.mockResolvedValue(undefined);
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t9', false));

    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
  });

  it('a failed delete says so and keeps the creator on the thread, which still exists', async () => {
    archive.mockRejectedValue(new Error('500'));
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t1', true));

    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
    expect(screen.getByText("Couldn't delete that thread.")).toBeInTheDocument();
  });

  it('returns the same object across renders, so effects that depend on it do not rebind', () => {
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
