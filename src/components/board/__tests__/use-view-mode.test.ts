/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Control the viewport breakpoint without a real matchMedia.
let mockIsMobile = false;
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mockIsMobile,
}));

import { useViewMode } from '../use-view-mode';

const STORAGE_KEY = 'virtuna-board-view-mode';

// happy-dom's localStorage isn't reliably present here (the hook guards with
// try/catch), so back it with a fresh Map-based stub each test.
beforeEach(() => {
  mockIsMobile = false;
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

describe('useViewMode', () => {
  it('defaults to board on desktop and cards on phones', async () => {
    const desktop = renderHook(() => useViewMode());
    expect(desktop.result.current.mode).toBe('board');

    mockIsMobile = true;
    const mobile = renderHook(() => useViewMode());
    await waitFor(() => expect(mobile.result.current.mode).toBe('cards'));
  });

  it('pins the mode via setOverride regardless of viewport, and persists it', async () => {
    mockIsMobile = true; // viewport would default to cards
    const { result } = renderHook(() => useViewMode());
    await waitFor(() => expect(result.current.mode).toBe('cards'));

    act(() => result.current.setOverride('board'));
    expect(result.current.mode).toBe('board'); // override beats the viewport default
    expect(localStorage.getItem(STORAGE_KEY)).toBe('board');

    act(() => result.current.setOverride(null));
    expect(result.current.mode).toBe('cards'); // back to viewport default
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('toggle flips the effective mode and persists the choice', () => {
    const { result } = renderHook(() => useViewMode()); // desktop → board
    expect(result.current.mode).toBe('board');

    act(() => result.current.toggle());
    expect(result.current.mode).toBe('cards');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cards');

    act(() => result.current.toggle());
    expect(result.current.mode).toBe('board');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('board');
  });

  it('hydrates a persisted override on mount', async () => {
    localStorage.setItem(STORAGE_KEY, 'cards'); // desktop user previously pinned cards
    const { result } = renderHook(() => useViewMode());
    await waitFor(() => expect(result.current.mode).toBe('cards'));
    expect(result.current.override).toBe('cards');
  });
});
