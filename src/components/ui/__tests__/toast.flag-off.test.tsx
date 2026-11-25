/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Flag off, the toast must render exactly as it did before the new look gave it its own panel.
//
// The snapshot was recorded BEFORE `toast.tsx` was touched: the container, each variant's panel
// (classes and inline style), its icon, its texts, its action, its close button and its progress
// bar, as the markup a browser gets. If it fails, the legacy toast changed: fix the component.
// Never update this snapshot with `-u`.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: false }));

import { ToastProvider, useToast, type ToastData } from '../toast';

const VARIANTS = ['default', 'success', 'error', 'warning', 'info'] as const;

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

/** The toast container's markup once `options` is shown (its first frame: the bar full). */
function markupOf(options: Omit<ToastData, 'id'>): string {
  render(
    <ToastProvider>
      <Show options={options} />
    </ToastProvider>,
  );
  act(() => {
    screen.getByTestId('show').click();
  });
  const container = document.querySelector('[aria-label="Notifications"]');
  expect(container).not.toBeNull();
  return container!.outerHTML;
}

describe('flag off: the toast keeps its legacy markup and inline style', () => {
  it.each(VARIANTS)('%s, a title alone', (variant) => {
    expect(markupOf({ variant, title: "Couldn't delete that chat." })).toMatchSnapshot();
  });

  it.each(VARIANTS)('%s, with a description and an action', (variant) => {
    expect(
      markupOf({ variant, title: 'Removed.', description: 'From your saved pieces.', action: { label: 'Undo', onClick: () => {} } }),
    ).toMatchSnapshot();
  });

  it('a toast that stays (no progress bar)', () => {
    expect(markupOf({ variant: 'default', title: 'Saved.', duration: 0 })).toMatchSnapshot();
  });
});
