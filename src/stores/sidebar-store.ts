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
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isCollapsed: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (v: boolean) => set({ isCollapsed: v }),
    }),
    {
      name: 'virtuna-sidebar',
    }
  )
);
