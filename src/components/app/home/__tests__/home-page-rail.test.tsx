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
});
