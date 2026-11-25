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
  useShellStore.setState({ threadOpen: false, fieldFocusSignal: 0, threadBack: null, threadTitleHint: null, libraryScroll: null });
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

    let done!: Promise<boolean>;
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

  // A chat that is gone must never open a different chat: deleted away from /home (Library, or the
  // sidebar beside another screen), the chat the pointer names leaves a new chat in its place, so
  // Home neither opens the newest other chat nor announces a deletion the creator just made.
  it('deleting the chat the pointer names while away from /home makes the pointer a new chat, even if the creator arrives on /home before the request returns', async () => {
    const request = deferred();
    archive.mockReturnValue(request.promise);
    pathname = '/library';
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });
    const signal = useBoardStore.getState().activeThreadSignal;

    let done!: Promise<boolean>;
    act(() => {
      done = result.current.deleteThread('t1', true);
    });
    // Not yet: only once the delete went through.
    expect(getActiveThreadCookie()).toBe('t1');
    pathname = '/home';
    rerender();
    await act(async () => {
      request.resolve();
      await done;
    });

    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    // Where the creator was at the click counts: not the /home case (no reload of the open chat).
    expect(useBoardStore.getState().activeThreadSignal).toBe(signal);
    expect(push).not.toHaveBeenCalled();
  });

  it('deleting from Library a chat the pointer names, whatever the board points at: the pointer is a new chat', async () => {
    archive.mockResolvedValue(undefined);
    pathname = '/library';
    setActiveThreadCookie('t1');
    const result = actions();

    await act(() => result.current.deleteThread('t1', false));

    expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
  });

  it('deleting from Library a chat the pointer does not name leaves the pointer and the board alone', async () => {
    archive.mockResolvedValue(undefined);
    pathname = '/library';
    setActiveThreadCookie('t1');
    useBoardStore.setState({ activeThreadId: 't1' });
    const result = actions();

    await act(() => result.current.deleteThread('t2', false));

    expect(getActiveThreadCookie()).toBe('t1');
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
  });

  it('a refused delete from Library leaves the pointer on the chat, which still exists', async () => {
    archive.mockRejectedValue(new Error('500'));
    pathname = '/library';
    setActiveThreadCookie('t1');
    const result = actions();

    await act(() => result.current.deleteThread('t1', false));

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
    // New-look shell code: the product says "chat" (Library plan, Task 6, fix round 1).
    expect(screen.getByText("Couldn't delete that chat.")).toBeInTheDocument();
  });

  // Library plan, Task 6: Library's rows put a refused delete back, so the caller needs to know.
  it('deleteThread resolves true once the thread is deleted, false when the delete was refused', async () => {
    pathname = '/library';
    const result = actions();

    archive.mockResolvedValue(undefined);
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.deleteThread('t1', false);
    });
    expect(outcome).toBe(true);

    archive.mockRejectedValue(new Error('500'));
    await act(async () => {
      outcome = await result.current.deleteThread('t2', false);
    });
    expect(outcome).toBe(false);
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

  // Library plan 2026-11-23, Task 4: on the phone, Back in a chat opened from Library returns to
  // Library. The marker (`threadBack`) is written by `openThread` itself, in the same call that
  // clears it for every other caller: there is no order of calls in which a Library open is
  // cleared after it was set, or another open inherits Library's marker.
  describe('where Back in the thread goes (threadBack)', () => {
    beforeEach(() => {
      useShellStore.setState({ threadBack: null });
    });

    it("openThread with a row's name and Library's scroll writes them with the marker, for that chat, before the navigation", () => {
      let atPush: unknown;
      push.mockImplementation(() => {
        const { threadBack, threadTitleHint, libraryScroll } = useShellStore.getState();
        atPush = { threadBack, threadTitleHint, libraryScroll };
      });
      const result = actions();
      act(() => result.current.openThread('v1', { back: '/library', title: 'Video simulation', scroll: { href: '/library?filter=simulated', top: 640 } }));
      expect(atPush).toEqual({
        threadBack: '/library',
        threadTitleHint: { id: 'v1', title: 'Video simulation' },
        libraryScroll: { href: '/library?filter=simulated', top: 640 },
      });
    });

    it('an open without them (the sidebar) drops the name and the scroll left by an earlier open', () => {
      useShellStore.setState({ threadBack: '/library', threadTitleHint: { id: 'v1', title: 'Video simulation' }, libraryScroll: { href: '/library', top: 640 } });
      const result = actions();
      act(() => result.current.openThread('t2'));
      expect(useShellStore.getState().threadTitleHint).toBeNull();
      expect(useShellStore.getState().libraryScroll).toBeNull();
    });

    it('newThread drops the name and the scroll too', () => {
      useShellStore.setState({ threadBack: '/library', threadTitleHint: { id: 'v1', title: 'Video simulation' }, libraryScroll: { href: '/library', top: 640 } });
      setActiveThreadCookie('v1');
      const result = actions();
      act(() => result.current.newThread());
      expect(useShellStore.getState().threadTitleHint).toBeNull();
      expect(useShellStore.getState().libraryScroll).toBeNull();
    });

    it('openThread from anywhere else clears it: Back in that chat starts a new chat, as today', () => {
      useShellStore.setState({ threadBack: '/library' });
      const result = actions();

      act(() => result.current.openThread('t2'));

      expect(useShellStore.getState().threadBack).toBeNull();
      expect(getActiveThreadCookie()).toBe('t2');
    });

    it('openThread with a place to go back to sets it, and it is in place before the navigation starts', () => {
      pathname = '/library';
      let atPush: string | null | undefined;
      push.mockImplementation(() => {
        atPush = useShellStore.getState().threadBack;
      });
      const result = actions();

      act(() => result.current.openThread('t2', { back: '/library' }));

      expect(useShellStore.getState().threadBack).toBe('/library');
      expect(atPush).toBe('/library');
      expect(getActiveThreadCookie()).toBe('t2');
      expect(push).toHaveBeenCalledWith('/home');
    });

    it('a later open without one replaces Library\'s marker, and a later Library open sets it again', () => {
      const result = actions();

      act(() => result.current.openThread('t1', { back: '/library' }));
      act(() => result.current.openThread('t2'));
      expect(useShellStore.getState().threadBack).toBeNull();

      act(() => result.current.openThread('t3', { back: '/library' }));
      expect(useShellStore.getState().threadBack).toBe('/library');
    });

    it('newThread clears it', () => {
      useShellStore.setState({ threadBack: '/library' });
      setActiveThreadCookie('t1');
      const result = actions();

      act(() => result.current.newThread());

      expect(useShellStore.getState().threadBack).toBeNull();
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    });

    it('newThread on a blank Home (the cursor only, no navigation) clears it too', () => {
      newLook = true;
      pathname = '/home';
      setActiveThreadCookie(NEW_THREAD_SENTINEL);
      useShellStore.setState({ threadOpen: false, threadBack: '/library' });
      const result = actions();

      act(() => result.current.newThread());

      expect(push).not.toHaveBeenCalled();
      expect(useShellStore.getState().threadBack).toBeNull();
    });
  });

  it('returns the same object across renders, so effects that depend on it do not rebind', () => {
    const { result, rerender } = renderHook(() => useThreadActions(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  describe('newThreadAt: a new chat that opens at a launch address', () => {
    const SIMULATE = '/home?v=Test';
    const signal = () => useBoardStore.getState().activeThreadSignal;

    it("from inside a chat: the pointer is the new-chat sentinel, no thread is active, the board is switched, no way back is recorded; then the address", () => {
      newLook = true;
      pathname = '/audience';
      setActiveThreadCookie('t1');
      useBoardStore.setState({ activeThreadId: 't1' });
      useShellStore.getState().setThreadBack('/library');
      const before = signal();
      const result = actions();

      act(() => result.current.newThreadAt(SIMULATE));

      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
      expect(useBoardStore.getState().activeThreadId).toBeNull();
      expect(signal()).not.toBe(before);
      expect(useShellStore.getState().threadBack).toBeNull();
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith(SIMULATE);
    });

    it('on a Home that is already blank it still goes to the address (the address carries what to arm)', () => {
      newLook = true;
      pathname = '/home';
      setActiveThreadCookie(NEW_THREAD_SENTINEL);
      const result = actions();

      act(() => result.current.newThreadAt(SIMULATE));

      expect(push).toHaveBeenCalledWith(SIMULATE);
      expect(getActiveThreadCookie()).toBe(NEW_THREAD_SENTINEL);
    });

    it('newThread is unchanged: it takes no address and still goes to /home', () => {
      setActiveThreadCookie('t1');
      const result = actions();
      expect(result.current.newThread).toHaveLength(0);

      act(() => result.current.newThread());

      expect(push).toHaveBeenCalledWith('/home');
    });
  });
});
