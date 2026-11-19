/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { THEME_STORAGE_KEY } from '@/lib/theme/theme';
import { AppearanceSetting } from '../appearance-setting';

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('prefers-color-scheme: dark'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const painted = () => document.documentElement.getAttribute('data-theme');
const group = () => screen.getByRole('group', { name: 'Appearance' });
const option = (name: string) => within(group()).getByRole('button', { name });
const chosen = () =>
  within(group()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
  systemPrefersDark(false);
});

afterEach(() => vi.unstubAllGlobals());

describe('AppearanceSetting', () => {
  it('offers Light, Dark and Match system, with Light chosen at first', () => {
    render(<AppearanceSetting />);
    expect(within(group()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Light', 'Dark', 'Match system',
    ]);
    expect(chosen()).toEqual(['Light']);
  });

  it('Dark paints the app dark at once and is remembered', () => {
    render(<AppearanceSetting />);
    fireEvent.click(option('Dark'));
    expect(painted()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(chosen()).toEqual(['Dark']);
  });

  it('Match system follows the system, and remembers the choice rather than its result', () => {
    systemPrefersDark(true);
    render(<AppearanceSetting />);
    fireEvent.click(option('Match system'));
    expect(painted()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(chosen()).toEqual(['Match system']);
  });

  it('opens on the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<AppearanceSetting />);
    expect(chosen()).toEqual(['Dark']);
  });
});
