/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDE_NAV_CHOICE_KEY, initialAutoRail } from '../side-nav-default';

// Real storage and a real window; only the width is set, and storage is swapped for a throwing one
// where a test needs the blocked case.
const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  setWidth(realWidth);
  vi.unstubAllGlobals();
});

describe('initialAutoRail: the sidebar default known before the first render', () => {
  it('is the rail on a 1000px window when the creator never chose', () => {
    setWidth(1000);
    expect(initialAutoRail()).toBe(true);
  });

  it('is not the rail on a 1000px window once the creator chose', () => {
    setWidth(1000);
    localStorage.setItem(SIDE_NAV_CHOICE_KEY, '1');
    expect(initialAutoRail()).toBe(false);
  });

  it('is not the rail on a 1440px window', () => {
    setWidth(1440);
    expect(initialAutoRail()).toBe(false);
  });

  it('counts blocked storage as chosen, so a narrow window keeps the full sidebar', () => {
    setWidth(1000);
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked });
    expect(initialAutoRail()).toBe(false);
  });
});
