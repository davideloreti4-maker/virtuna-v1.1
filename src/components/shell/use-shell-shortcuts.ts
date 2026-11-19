"use client";

import { useEffect } from "react";
import { useSideNavCollapse } from "./use-side-nav-collapse";
import type { ThreadActions } from "./use-thread-actions";

/**
 * The two chrome shortcuts the legacy Sidebar registers itself: ⌘\ collapses the sidebar,
 * ⌘N starts a new chat. (⌘K belongs to the command palette, which listens on its own.)
 */
export function useShellShortcuts(actions: Pick<ThreadActions, "newThread">): void {
  const { toggle } = useSideNavCollapse();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "\\") {
        e.preventDefault();
        toggle();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        actions.newThread();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, actions]);
}
