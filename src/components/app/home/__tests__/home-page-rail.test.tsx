/** @vitest-environment happy-dom */
/**
 * HomePageLayout — the P2 (A2a) desktop audience RAIL wiring.
 *
 * The audience is a property of the thread, so in thread mode HomePageLayout renders a right-rail
 * <aside> and hands its inner host to the composer via `railHost` (the composer portals its room
 * there ≥xl). These guards lock the LAYOUT contract independent of the heavy composer:
 *  - thread mode → the rail <aside> exists AND the composer receives a non-null railHost.
 *  - empty home  → no rail, and railHost is null (the composer keeps the room in its dock).
 *
 * Both fail against pre-A2a HomePageLayout (no <aside>, no railHost prop). The composer is stubbed
 * so the test drives thread mode deterministically without its streams/supabase/router deps.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

// Stub the composer: a button flips thread mode on demand, and it reports whether it was handed a
// non-null railHost (the whole point of the wiring).
vi.mock('../composer', () => ({
  Composer: ({
    onThreadChange,
    railHost,
  }: {
    onThreadChange?: (v: boolean) => void;
    railHost?: HTMLElement | null;
  }) => (
    <button
      data-testid="composer-stub"
      data-has-rail={railHost ? 'yes' : 'no'}
      onClick={() => onThreadChange?.(true)}
    >
      stub
    </button>
  ),
}));

vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));

// The greeting pulls the profile query (needs a QueryClient) — irrelevant to the rail wiring, stub it.
vi.mock('../home-greeting', () => ({ HomeGreeting: () => <div data-testid="greeting-stub" /> }));

import { HomePageLayout } from '../home-page-layout';

afterEach(() => cleanup());

const railAside = () =>
  document.querySelector('aside[aria-label="Your audience"]');

describe('HomePageLayout — A2a audience rail wiring', () => {
  it('empty home: no rail <aside>, and the composer gets a null railHost (room stays in the dock)', () => {
    render(<HomePageLayout />);
    expect(railAside()).toBeNull();
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('no');
  });

  it('thread mode: renders the rail <aside> AND hands the composer a non-null railHost', () => {
    render(<HomePageLayout />);
    // Enter thread mode (the stub composer reports hasThread=true).
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    // The rail slot exists…
    const aside = railAside();
    expect(aside).not.toBeNull();
    // …and the composer received the portal host (the ref-callback → state → re-render fired).
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('yes');
  });

  it('the rail is desktop-only — hidden below xl (xl:flex)', () => {
    render(<HomePageLayout />);
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    const aside = railAside();
    // Tailwind `hidden xl:flex` — the base state is display:none until the xl media query.
    expect(aside?.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(aside?.className).toMatch(/xl:flex/);
  });

  it('the rail is resizable: keyboard on the separator moves the width, clamps at the rails, persists, and Home resets', () => {
    // A WIDTH dial, not the vetoed collapse (2026-08-12): the floor keeps complete frames.
    render(<HomePageLayout />);
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    const aside = railAside() as HTMLElement;
    const handle = screen.getByRole('separator', { name: /resize the audience rail/i });
    expect(aside.style.width).toBe('400px');

    // ← widens (the rail grows leftward), and the width persists for the next mount.
    act(() => {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    });
    expect(aside.style.width).toBe('416px');
    expect(localStorage.getItem('virtuna:rail-width')).toBe('416');

    // Clamped at the ceiling — 20 more steps stop at 560, never past it. (One act() per press:
    // batching them all into one act would run every handler against the same stale render.)
    for (let i = 0; i < 20; i++) {
      act(() => {
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      });
    }
    expect(aside.style.width).toBe('560px');

    // → narrows, clamped at the floor.
    for (let i = 0; i < 30; i++) {
      act(() => {
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
      });
    }
    expect(aside.style.width).toBe('320px');

    // Home resets to the default and persists it.
    act(() => {
      fireEvent.keyDown(handle, { key: 'Home' });
    });
    expect(aside.style.width).toBe('400px');
    expect(localStorage.getItem('virtuna:rail-width')).toBe('400');
  });

  it('a persisted rail width is restored on mount (clamped to the rails)', async () => {
    localStorage.setItem('virtuna:rail-width', '9999');
    render(<HomePageLayout />);
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    const aside = railAside() as HTMLElement;
    // The restore effect clamps a stored value that outgrew the rails.
    expect(aside.style.width).toBe('560px');
    localStorage.removeItem('virtuna:rail-width');
  });

  it('offers the composer NO pin channel — nothing but thread mode can mount the column (2026-08-09 rail ruling)', () => {
    // The v8 Phase-3 pinned report died with the owner ruling: the report is an event
    // (sheet/overlay), never page furniture. The layout must expose no way to dock it —
    // outside thread mode the aside simply does not exist.
    render(<HomePageLayout />);
    expect(railAside()).toBeNull();
    expect(screen.queryByTestId('pin-stub')).toBeNull();
  });
});
