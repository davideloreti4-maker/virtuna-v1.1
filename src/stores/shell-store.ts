import { create } from 'zustand';
import { initialAutoRail } from '@/lib/shell/side-nav-default';

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
  // Known before the first render, not set by an effect after it: the sidebar's first frame must
  // already be the rail, or it is drawn at 248 and slides to 56. An effect runs too late: on some
  // pages other code reads layout in the same commit (Radix Presence on /settings, the thread
  // autoscroll on /home), which fixes 248 as the transition's start before any re-render.
  // Safe: false on the server, and the new shell renders only on the client, inside AuthGuard
  // after the session check, so no server-rendered markup depends on this value.
  autoRail: initialAutoRail(),
  setAutoRail: (v) => set({ autoRail: v }),
}));
