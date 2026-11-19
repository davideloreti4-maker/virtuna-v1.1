/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { THEME_STORAGE_KEY } from '../theme';
import { useThemeSync } from '../use-theme';

// The OS colour-scheme query is the I/O boundary here: a stand-in that records its `change`
// listeners and whose `matches` the test flips. The hook, the theme module and storage are real.
const listeners = new Set<() => void>();
let systemDark = false;

function stubSystemTheme() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return systemDark && query.includes('prefers-color-scheme: dark');
    },
    media: query,
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'change') listeners.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      if (type === 'change') listeners.delete(fn);
    },
  }));
}

/** The OS switches its colour scheme. */
function osSwitchesTo(dark: boolean) {
  systemDark = dark;
  act(() => {
    listeners.forEach((fn) => fn());
  });
}

/** Another tab stored a choice: the browser fires `storage` here, never in the tab that wrote. */
function otherTabStores(choice: string) {
  localStorage.setItem(THEME_STORAGE_KEY, choice);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: choice }));
  });
}

const painted = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  listeners.clear();
  systemDark = false;
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
  stubSystemTheme();
});

afterEach(() => vi.unstubAllGlobals());

describe('useThemeSync', () => {
  it('with "Match system", repaints when the OS switches to dark and back', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    renderHook(() => useThemeSync());

    osSwitchesTo(true);
    expect(painted()).toBe('dark');

    osSwitchesTo(false);
    expect(painted()).toBe('light');
  });

  it('with "Light" chosen, an OS switch to dark leaves it light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderHook(() => useThemeSync());

    osSwitchesTo(true);
    expect(painted()).toBe('light');
  });

  it('repaints dark when another tab stores "dark"', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderHook(() => useThemeSync());

    otherTabStores('dark');
    expect(painted()).toBe('dark');
  });

  it('stops listening once unmounted', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    const { unmount } = renderHook(() => useThemeSync());
    expect(listeners.size).toBe(1);

    unmount();
    expect(listeners.size).toBe(0);

    // Neither source reaches the page any more.
    osSwitchesTo(true);
    otherTabStores('dark');
    expect(painted()).toBe('light');
  });
});
