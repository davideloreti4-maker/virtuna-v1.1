import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  /** Whether the sidebar panel is visible (mobile: drawer open, desktop: shown vs hidden) */
  isOpen: boolean;
  /** Whether the sidebar is in icon-only collapsed mode (desktop, ⌘\ toggle) */
  isCollapsed: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  /** Toggle icon-only collapsed mode (desktop ⌘\ shortcut) */
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  /**
   * Whether the ⌘K command palette is open.
   *
   * It lives here — with the rest of the app chrome — because the two components
   * that drive it can't talk to each other directly: the trigger is the sidebar's
   * Search row, but the palette itself MUST mount outside the <nav>. The nav
   * animates with `translate-x`, and a transformed ancestor makes `position: fixed`
   * resolve against that ancestor instead of the viewport, which would trap the
   * palette inside a 220px column.
   */
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: false,
      isCollapsed: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (v: boolean) => set({ isCollapsed: v }),
      commandOpen: false,
      setCommandOpen: (v: boolean) => set({ commandOpen: v }),
    }),
    {
      name: 'virtuna-sidebar',
      // WR-02: persist ONLY the desktop collapse preference. `isOpen` is
      // session/viewport UI state (mobile drawer open/closed) — persisting it
      // made the mobile drawer + backdrop render OPEN on every fresh load,
      // covering the composer. It must rehydrate from the in-memory default
      // (closed) each session, never from localStorage.
      partialize: (s) => ({ isCollapsed: s.isCollapsed }),
      // Defense-in-depth: zustand's default merge shallow-copies the persisted
      // blob over the initial state, so a STALE blob written before this fix
      // (which did persist `isOpen`) could still rehydrate an open drawer.
      // Explicitly drop any persisted `isOpen` so the default (false) always wins.
      merge: (persisted, current) => {
        const { isOpen: _drop, ...rest } = (persisted ?? {}) as Partial<SidebarState>;
        return { ...current, ...rest };
      },
    }
  )
);
