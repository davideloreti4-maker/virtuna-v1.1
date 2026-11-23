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
import { useShellStore } from '@/stores/shell-store';

// The build-time flag, switchable per test (a getter, so the hook reads it at call time). Off by
// default: every case that does not set it is today's behaviour.
let newLook = false;
vi.mock('@/lib/flags/new-look', () => ({
  get NEW_LOOK_ENABLED() {
    return newLook;
  },
}));

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

/** A request the test settles by hand, so it can act while the request is still out. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const actions = () => renderHook(() => useThreadActions(), { wrapper }).result;

beforeEach(() => {
  push.mockReset();
  archive.mockReset();
  pathname = '/home';
  newLook = false;
  clearActiveThreadCookie();
  useBoardStore.setState({ activeThreadId: null });
  useShellStore.setState({ threadOpen: false, fieldFocusSignal: 0 });
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

  // Where the creator is decides at CLICK time, as in the legacy sidebar: the request can take a
  // while, and a place switched to meanwhile must not change what the delete does.
  it('deleting the open thread from /home clears the pointer, even if the creator leaves before the request returns', async () => {
    const request = deferred();
    archive.mockReturnValue(request.promise);
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });

    let done!: Promise<void>;
    act(() => {
      done = result.current.deleteThread('t1', true);
    });
    pathname = '/library';
    rerender();
    await act(async () => {
      request.resolve();
      await done;
    });

    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(getActiveThreadCookie()).toBeNull();
  });

  it('deleting the open thread while away from /home leaves the pointer, even if the creator arrives on /home before the request returns', async () => {
    const request = deferred();
    archive.mockReturnValue(request.promise);
    pathname = '/library';
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });

    let done!: Promise<void>;
    act(() => {
      done = result.current.deleteThread('t1', true);
    });
    pathname = '/home';
    rerender();
    await act(async () => {
      request.resolve();
      await done;
    });

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

  describe('newThread on a Home that is already blank', () => {
    const signal = () => useBoardStore.getState().activeThreadSignal;
    const focusSignal = () => useShellStore.getState().fieldFocusSignal;
    /** /home on a blank new chat: the sentinel, and no thread on screen. */
    const onBlankHome = () => {
      pathname = '/home';
      setActiveThreadCookie(NEW_THREAD_SENTINEL);
      useShellStore.setState({ threadOpen: false });
    };

    it('new look: it is this screen, so the cursor goes to the field; no reload, no navigation', () => {
      newLook = true;
      onBlankHome();
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before); // no switchThread: the composer does not wipe and reload
      expect(push).not.toHaveBeenCalled();
      expect(focusSignal()).toBe(1);
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    });

    it('new look, no pointer at all (a new device): a blank Home is this screen too', () => {
      newLook = true;
      pathname = '/home';
      clearActiveThreadCookie();
      useShellStore.setState({ threadOpen: false });
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before);
      expect(push).not.toHaveBeenCalled();
      expect(focusSignal()).toBe(1);
      // Final fix B1: Home can be showing because the chat's load failed, so "New chat" must still
      // mean a new chat: the pointer is set to the sentinel, and the next send makes one.
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    });

    it('new look, the sentinel but a thread on screen (a first send landing): it goes the old way', () => {
      newLook = true;
      onBlankHome();
      useShellStore.setState({ threadOpen: true });
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(focusSignal()).toBe(0);
    });

    it('new look, no pointer and a thread on screen (the newest chat opened): it leaves it, as today', () => {
      newLook = true;
      pathname = '/home';
      clearActiveThreadCookie();
      useShellStore.setState({ threadOpen: true });
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
      expect(focusSignal()).toBe(0);
    });

    it('new look, inside a thread (the pointer is a thread id): it leaves the thread, as today', () => {
      newLook = true;
      setActiveThreadCookie('t1');
      useBoardStore.setState({ activeThreadId: 't1' });
      useShellStore.setState({ threadOpen: true });
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
      expect(useBoardStore.getState().activeThreadId).toBeNull();
      expect(focusSignal()).toBe(0);
    });

    it('new look, the sentinel away from /home: it goes Home, as today', () => {
      newLook = true;
      onBlankHome();
      pathname = '/library';
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(focusSignal()).toBe(0);
    });

    it('flag off: no pointer on /home reloads as today', () => {
      pathname = '/home';
      clearActiveThreadCookie();
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(focusSignal()).toBe(0);
    });

    it('flag off: a blank Home reloads as today', () => {
      onBlankHome();
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(focusSignal()).toBe(0);
    });

    it('flag off: inside a thread it leaves the thread as today', () => {
      setActiveThreadCookie('t1');
      useBoardStore.setState({ activeThreadId: 't1' });
      useShellStore.setState({ threadOpen: true });
      const before = signal();
      const result = actions();

      act(() => result.current.newThread());

      expect(signal()).toBe(before + 1);
      expect(push).toHaveBeenCalledWith('/home');
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
      expect(focusSignal()).toBe(0);
    });
  });

  it('returns the same object across renders, so effects that depend on it do not rebind', () => {
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
