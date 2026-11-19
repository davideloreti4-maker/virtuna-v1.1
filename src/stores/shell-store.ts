import { create } from 'zustand';

interface ShellState {
  /**
   * True while /home shows a thread (not the blank arrival). Published by HomePageLayout, read
   * by the new app shell, which hides the phone tab bar inside a thread. A thread is not a route,
   * so the shell cannot derive this from the URL. Not persisted.
   */
  threadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
  /**
   * True when the desktop sidebar shows as the rail only because the window is narrow and the
   * creator has never chosen. The app's default, not a choice, so it is not persisted: the
   * sidebar store's saved `isCollapsed` holds the creator's own choice only.
   */
  autoRail: boolean;
  setAutoRail: (v: boolean) => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  threadOpen: false,
  setThreadOpen: (open) => set({ threadOpen: open }),
  autoRail: false,
  setAutoRail: (v) => set({ autoRail: v }),
}));
