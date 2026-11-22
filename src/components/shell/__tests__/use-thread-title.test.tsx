/** @vitest-environment happy-dom */
/**
 * The open thread's title (thread answers step 1, Task 6): one derivation for the phone header
 * (NextShell) and the desktop thread header (the composer). The thread list is the network's;
 * it is stood in for, as in the shell's own tests. The board store is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBoardStore } from '@/stores/board-store';

const GYM = { id: 't1', title: '  Three hooks for the gym video ', updated_at: '', created_at: '', pinned_at: null };
let threadList: (typeof GYM)[] | undefined = [GYM];
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: threadList, isLoading: threadList === undefined }),
}));

import { useThreadTitle } from '../use-thread-title';

beforeEach(() => {
  threadList = [GYM];
  useBoardStore.setState({ activeThreadId: 't1' });
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
