/** @vitest-environment happy-dom */
/**
 * The open thread's title (thread answers step 1, Task 6): one derivation for the phone header
 * (NextShell) and the desktop thread header (the composer). The thread list is the network's;
 * it is stood in for, as in the shell's own tests. The board store is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';

const GYM: { id: string; title: string | null; updated_at: string; created_at: string; pinned_at: null } = {
  id: 't1',
  title: '  Three hooks for the gym video ',
  updated_at: '',
  created_at: '',
  pinned_at: null,
};
let threadList: (typeof GYM)[] | undefined = [GYM];
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: threadList, isLoading: threadList === undefined }),
}));

import { shownThreadTitle, useThreadTitle } from '../use-thread-title';

beforeEach(() => {
  threadList = [GYM];
  useBoardStore.setState({ activeThreadId: 't1' });
  useShellStore.setState({ threadBack: null, threadTitleHint: null, libraryScroll: null });
});

describe('useThreadTitle', () => {
  it("is the open thread's title, trimmed", () => {
    expect(renderHook(() => useThreadTitle()).result.current).toBe('Three hooks for the gym video');
  });

  it('a thread the list does not hold, or holds untitled, is "New chat"', () => {
    useBoardStore.setState({ activeThreadId: 't9' });
    expect(renderHook(() => useThreadTitle()).result.current).toBe('New chat');
    threadList = [{ ...GYM, title: '   ' }];
    useBoardStore.setState({ activeThreadId: 't1' });
    expect(renderHook(() => useThreadTitle()).result.current).toBe('New chat');
  });

  it('empty while the list loads (no "New chat" flash)', () => {
    threadList = undefined;
    expect(renderHook(() => useThreadTitle()).result.current).toBe('');
  });
});

// An untitled chat has one name: the one its Library or Recent row showed ("Video simulation"),
// handed over as the chat opened (`threadTitleHint`), until the chat has a title of its own.
describe('useThreadTitle: the name the row showed', () => {
  const VIDEO = { ...GYM, id: 'v1', title: null };
  const hint = (id: string, title = 'Video simulation') => useShellStore.setState({ threadTitleHint: { id, title } });

  it('an untitled chat opened from a row reading "Video simulation" is named the same', () => {
    threadList = [GYM, VIDEO];
    useBoardStore.setState({ activeThreadId: 'v1' });
    hint('v1');
    expect(renderHook(() => useThreadTitle()).result.current).toBe('Video simulation');
  });

  it('also while the list loads, and for a chat the list does not hold', () => {
    useBoardStore.setState({ activeThreadId: 'v1' });
    hint('v1');
    threadList = undefined;
    expect(renderHook(() => useThreadTitle()).result.current).toBe('Video simulation');
    threadList = [GYM];
    expect(renderHook(() => useThreadTitle()).result.current).toBe('Video simulation');
  });

  it('a chat with a title of its own ignores a name handed over for it', () => {
    hint('t1', 'Hooks');
    expect(renderHook(() => useThreadTitle()).result.current).toBe('Three hooks for the gym video');
  });

  it("another chat's name is never shown: the open chat is untitled, \"New chat\"", () => {
    threadList = [GYM, VIDEO];
    useBoardStore.setState({ activeThreadId: 'v1' });
    hint('v2');
    expect(renderHook(() => useThreadTitle()).result.current).toBe('New chat');
  });

  it('once the name is gone (an open from the sidebar or the palette clears it), "New chat" again', () => {
    threadList = [GYM, VIDEO];
    useBoardStore.setState({ activeThreadId: 'v1' });
    hint('v1');
    useShellStore.getState().setThreadBack(null);
    expect(renderHook(() => useThreadTitle()).result.current).toBe('New chat');
  });
});

describe('shownThreadTitle', () => {
  it('a title shorter than the stored cap is shown as stored', () => {
    expect(shownThreadTitle('Three hooks for the gym video')).toBe('Three hooks for the gym video');
  });

  it('a title that fills the cap was cut: back to its last whole word, and "…"', () => {
    // 48 characters, as `cleanThreadTitle` stores a longer ask.
    const stored = '3 hooks for a video about meal prep for busy stu';
    expect(stored).toHaveLength(48);
    expect(shownThreadTitle(stored)).toBe('3 hooks for a video about meal prep for busy…');
    expect(shownThreadTitle('need a script for this hook;i fed 10 million vir')).toBe('need a script for this hook;i fed 10 million…');
  });

  it('never ends on punctuation before the "…"', () => {
    expect(shownThreadTitle('give me three ideas for my channel, and then the')).toBe('give me three ideas for my channel, and then…');
    expect(shownThreadTitle('what makes an ending actually land on a short, x')).toBe('what makes an ending actually land on a short…');
  });

  it('one long token is kept and marked as cut', () => {
    const token = 'a'.repeat(48);
    expect(shownThreadTitle(token)).toBe(`${token}…`);
  });

  it('the hook hands the header the shown title', () => {
    threadList = [{ ...GYM, title: '3 hooks for a video about meal prep for busy stu' }];
    expect(renderHook(() => useThreadTitle()).result.current).toBe('3 hooks for a video about meal prep for busy…');
  });
});
