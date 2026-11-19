"use client";

import { useCallback } from "react";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { SIDE_NAV_CHOICE_KEY } from "./nav-config";

/**
 * Whether the desktop sidebar shows as the rail, and the creator's toggle (button and ⌘\).
 *
 * Two sources: the creator's own choice (sidebar-store's persisted `isCollapsed`) and the app's
 * narrow-window default (shell-store's `autoRail`, not persisted). Toggling is always a choice:
 * it drops the default, saves the new state and records that the creator chose. The
 * narrow-window check itself runs in SideNav, on mount.
 */
export function useSideNavCollapse(): { collapsed: boolean; toggle: () => void } {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const autoRail = useShellStore((s) => s.autoRail);

  const toggle = useCallback(() => {
    // Read at call time, so two quick presses of ⌘\ never act on a stale render.
    const next = !(useSidebarStore.getState().isCollapsed || useShellStore.getState().autoRail);
    useShellStore.getState().setAutoRail(false);
    useSidebarStore.getState().setCollapsed(next);
    try {
      window.localStorage.setItem(SIDE_NAV_CHOICE_KEY, "1");
    } catch {
      // Storage blocked: the choice still holds for this visit.
    }
  }, []);

  return { collapsed: isCollapsed || autoRail, toggle };
}
