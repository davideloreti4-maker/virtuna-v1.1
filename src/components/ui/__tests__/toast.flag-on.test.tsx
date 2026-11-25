/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

// The flag is a build-time constant; this file is the flag-on build. The legacy toast painted a
// near-black panel inline under `text-foreground`: ink on black in the new look's light theme.
vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));

import { ToastProvider, useToast, type ToastData, type ToastVariant } from '../toast';

/** A button that shows `options` as a toast: the app's own `useToast`, called as a page calls it. */
function Show({ options }: { options: Omit<ToastData, 'id'> }) {
  const { toast } = useToast();
  return (
    <button type="button" data-testid="show" onClick={() => toast(options)}>
      show
    </button>
  );
}

afterEach(() => {
  cleanup();
});

function renderToast(options: Omit<ToastData, 'id'>) {
  render(
    <ToastProvider>
      <Show options={options} />
    </ToastProvider>,
  );
  act(() => {
    screen.getByTestId('show').click();
  });
  const container = document.querySelector<HTMLElement>('[aria-label="Notifications"]')!;
  const panel = screen.getByRole('alert');
  return { container, panel };
}

const classesOf = (el: Element) => el.getAttribute('class')?.split(/\s+/) ?? [];
const VARIANTS: ToastVariant[] = ['default', 'success', 'error', 'warning', 'info'];

describe('flag on: the toast is the new look floating panel', () => {
  it.each(VARIANTS)('%s: no hard-coded dark background, no inline glass; the surface, radius and float shadow tokens', (variant) => {
    const { panel } = renderToast({ variant, title: "Couldn't delete that chat." });
    expect(panel.style.backgroundColor).toBe('');
    expect(panel.style.boxShadow).toBe('');
    expect(panel.getAttribute('style') ?? '').not.toMatch(/rgba?\(|#[0-9a-f]{3,8}\b|backdrop/i);
    const classes = classesOf(panel);
    expect(classes).toEqual(expect.arrayContaining(['bg-surface', 'rounded-3xl', 'shadow-[var(--shadow-float)]', 'text-foreground']));
    // Never the legacy utility (it carries the legacy value), never a tinted panel or a border colour.
    expect(classes).not.toContain('shadow-float');
    expect(classes).not.toContain('shadow-lg');
    expect(classes.filter((c) => /^(bg|border)-(success|error|warning|info)/.test(c) || c.startsWith('border-white'))).toEqual([]);
    // Every colour in the panel's markup is a token: no literal, no palette name.
    expect(panel.outerHTML).not.toMatch(/rgba?\(|bg-white|text-white|bg-black/);
  });

  it('the title reads in ink, a description in the secondary ink', () => {
    const { panel } = renderToast({ variant: 'error', title: "Couldn't rename that chat.", description: 'Try again in a moment.' });
    expect(classesOf(screen.getByText("Couldn't rename that chat."))).toContain('text-foreground');
    expect(classesOf(screen.getByText('Try again in a moment.'))).toContain('text-foreground-secondary');
    expect(panel.textContent).toContain("Couldn't rename that chat.");
  });

  it('monochrome: the error toast keeps one small red icon; every other variant draws its icon in ink', () => {
    const { panel } = renderToast({ variant: 'error', title: "Couldn't pin that chat." });
    const icons = panel.querySelectorAll('svg');
    // The icon and the close button's cross.
    expect(icons).toHaveLength(2);
    expect(classesOf(icons[0]!.parentElement!)).toContain('text-error');
    cleanup();
    for (const variant of ['success', 'warning', 'info'] as const) {
      const { panel: other } = renderToast({ variant, title: 'Done.' });
      expect(classesOf(other.querySelector('svg')!.parentElement!)).toContain('text-foreground-secondary');
      expect(other.innerHTML).not.toMatch(/text-(success|warning|info|error)\b/);
      cleanup();
    }
    const { panel: plain } = renderToast({ variant: 'default', title: 'Saved.' });
    // Only the close button's cross.
    expect(plain.querySelectorAll('svg')).toHaveLength(1);
  });

  it.each(VARIANTS)('%s: the progress line is ink at a low opacity, never a colour', (variant) => {
    const { panel } = renderToast({ variant, title: 'Removed.' });
    const fill = panel.querySelector<HTMLElement>('[data-part="toast-progress"]');
    expect(fill).not.toBeNull();
    expect(classesOf(fill!)).toContain('bg-foreground/20');
    expect(classesOf(fill!).filter((c) => /^bg-(success|error|warning|info|foreground-secondary)$/.test(c))).toEqual([]);
  });

  it('the close button is 44 to tap and dismisses the toast', async () => {
    vi.useFakeTimers();
    try {
      const { panel } = renderToast({ variant: 'error', title: "Couldn't delete that chat." });
      const close = screen.getByRole('button', { name: 'Dismiss toast' });
      expect(classesOf(close)).toContain('tap-44');
      expect(panel.contains(close)).toBe(true);
      fireEvent.click(close);
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('on the phone it sits under the top safe area and is never wider than the screen minus the 16 px gutters', () => {
    const { container } = renderToast({ variant: 'default', title: 'Saved.' });
    const classes = classesOf(container);
    expect(classes).toEqual(expect.arrayContaining(['fixed', 'right-4', 'top-[calc(env(safe-area-inset-top)+16px)]', 'max-w-[calc(100vw-2rem)]']));
    expect(classes).not.toContain('top-4');
  });
});
