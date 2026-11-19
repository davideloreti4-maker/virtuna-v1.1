/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemeChoice,
  readThemeChoice,
  resolveTheme,
} from '../theme';

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('prefers-color-scheme: dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** A browser that refuses storage (private mode, blocked cookies): every call throws. */
function blockStorage() {
  const blocked = () => {
    throw new Error('blocked');
  };
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked });
}

/** Runs the script exactly as the browser does from <head>. */
const runHeadScript = () => new Function(THEME_INIT_SCRIPT)();
const painted = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  localStorage.clear();
  // The server always renders light; the script corrects it before first paint.
  document.documentElement.setAttribute('data-theme', 'light');
  systemPrefersDark(false);
});

// Restores the real localStorage and matchMedia before the next test's beforeEach.
afterEach(() => vi.unstubAllGlobals());

describe('resolveTheme', () => {
  it('returns an explicit choice as it is', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system only when asked to', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('readThemeChoice', () => {
  it('is light when nothing is stored (owner ruling: light is the default)', () => {
    expect(readThemeChoice()).toBe('light');
  });

  it('ignores a value it does not know', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemeChoice()).toBe('light');
  });

  it('returns the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(readThemeChoice()).toBe('system');
  });
});

describe('the head script (runs before first paint)', () => {
  it('leaves light in place when nothing is stored, even on a dark system', () => {
    systemPrefersDark(true);
    runHeadScript();
    expect(painted()).toBe('light');
  });

  it('paints a stored dark choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runHeadScript();
    expect(painted()).toBe('dark');
  });

  it('follows the system when the choice is "system"', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    systemPrefersDark(true);
    runHeadScript();
    expect(painted()).toBe('dark');
  });

  it('does not throw and keeps light when storage is blocked', () => {
    blockStorage();
    expect(runHeadScript).not.toThrow();
    expect(painted()).toBe('light');
  });
});

describe('applyThemeChoice', () => {
  it('stores the choice and paints it', () => {
    expect(applyThemeChoice('dark')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(painted()).toBe('dark');
  });

  it('stores "system" itself, and paints what the system says', () => {
    systemPrefersDark(true);
    expect(applyThemeChoice('system')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('still paints when storage is blocked', () => {
    blockStorage();
    expect(applyThemeChoice('dark')).toBe('dark');
    expect(painted()).toBe('dark');
  });
});
