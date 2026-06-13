/** @vitest-environment happy-dom */
/**
 * Sidebar collapse behavior (SHELL-05 / SHELL-07, D-14..D-16).
 *
 * London-style: the persisted sidebar-store and the viewport hook are mocked so
 * each test drives a single rendering branch deterministically.
 *  - Cmd/Ctrl-\ keydown toggles the persisted collapse (calls toggleCollapsed).
 *  - Desktop + isCollapsed → icon rail (narrower than the 220px expanded width).
 *  - Desktop + expanded → full 220px nav.
 *  - Mobile (useIsMobile true) → never the collapsed rail; the slide-in drawer.
 *
 * Written first (Task 1) — RED against the current sidebar (hardcoded
 * effectiveCollapsed = false + no keybind); Task 3 makes it green.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── shared mocks (hoisted) ───────────────────────────────────────────
const toggleCollapsed = vi.fn();
const close = vi.fn();

const storeState = {
  isOpen: true,
  close,
  isCollapsed: false,
  toggleCollapsed,
};
let mobile = false;

vi.mock('@/stores/sidebar-store', () => ({
  useSidebarStore: () => storeState,
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mobile,
}));

vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  // reduced-motion ON keeps the render deterministic (no transitions to assert)
  usePrefersReducedMotion: () => true,
}));

vi.mock('@/hooks/queries', () => ({
  useAnalysisHistory: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/use-social-accounts', () => ({
  useSocialAccounts: () => ({
    accounts: [],
    activeAccount: null,
    isLoading: false,
    switchAccount: vi.fn(),
    addAccount: vi.fn(),
    removeAccount: vi.fn(),
  }),
}));

vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { triggerNewAnalysis: () => void }) => unknown) =>
    selector({ triggerNewAnalysis: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

import { Sidebar } from '../Sidebar';

beforeEach(() => {
  toggleCollapsed.mockClear();
  close.mockClear();
  storeState.isCollapsed = false;
  storeState.isOpen = true;
  mobile = false;
  cleanup();
});

describe('Sidebar collapse — keybind', () => {
  it('Cmd-\\ keydown toggles the persisted collapse (calls toggleCollapsed)', () => {
    render(<Sidebar />);
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(toggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('Ctrl-\\ keydown toggles collapse too (cross-platform)', () => {
    render(<Sidebar />);
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    expect(toggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('a plain \\ keystroke (no modifier) does NOT toggle', () => {
    render(<Sidebar />);
    fireEvent.keyDown(window, { key: '\\' });
    expect(toggleCollapsed).not.toHaveBeenCalled();
  });
});

describe('Sidebar collapse — rendering branches', () => {
  it('desktop + collapsed renders an icon rail narrower than the 220px expanded width', () => {
    storeState.isCollapsed = true;
    mobile = false;
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: /app navigation/i });
    // Expanded width class must NOT be present once collapsed to the rail.
    expect(nav.className).not.toContain('w-[220px]');
    // The "Simulations" section label is hidden in the collapsed rail.
    expect(screen.queryByText('Simulations')).toBeNull();
  });

  it('desktop + expanded renders the full 220px nav with the Simulations label', () => {
    storeState.isCollapsed = false;
    mobile = false;
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: /app navigation/i });
    expect(nav.className).toContain('w-[220px]');
    expect(screen.getByText('Simulations')).toBeInTheDocument();
  });

  it('mobile is the full-width drawer, never the collapsed rail (even when isCollapsed is true)', () => {
    storeState.isCollapsed = true; // desktop pref is collapsed…
    mobile = true; // …but on mobile it must be ignored (drawer, not rail)
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: /app navigation/i });
    // On mobile the drawer keeps the full expanded width (it slides in/out, not a rail).
    expect(nav.className).toContain('w-[220px]');
    // Drawer content (the Simulations label) renders — it is not the icon-only rail.
    expect(screen.getByText('Simulations')).toBeInTheDocument();
  });
});
