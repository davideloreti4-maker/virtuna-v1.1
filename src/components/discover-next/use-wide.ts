"use client";

import { useSyncExternalStore } from "react";

/**
 * From 768 (Tailwind's `md`): where Discover's sheets become centred dialogs, the filter a menu on its
 * button, and the pull page's Follow moves into the page's header. Read from the store `matchMedia`
 * keeps, so a part that mounts on a desk is right from its first commit (the shared `useMediaQuery`
 * answers false until after mount). False on the server.
 */
const WIDE = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(WIDE);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

const wideNow = () => window.matchMedia(WIDE).matches;
const wideOnServer = () => false;

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, wideNow, wideOnServer);
}
