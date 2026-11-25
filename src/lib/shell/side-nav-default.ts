/**
 * The desktop sidebar's narrow-window default (spec §6.2), in one place. Pure: no React, no
 * icons, so the shell store can read it at module load without pulling in the shell's parts.
 * `src/components/shell/nav-config.ts` re-exports the key and the rule for the shell.
 */

/**
 * localStorage key, set once the creator collapses or expands the sidebar themselves. Its own
 * key: sidebar-store's persisted blob is written by any change to that store (the ⌘K palette
 * too), so its presence does not mean the creator chose.
 */
export const SIDE_NAV_CHOICE_KEY = "maven-sidenav-chosen";

const AUTO_COLLAPSE_BELOW = 1100;

/** Below 1100px the sidebar starts as the rail, unless the creator already chose. */
export function shouldStartCollapsed(viewportWidth: number, hasStoredChoice: boolean): boolean {
  return !hasStoredChoice && viewportWidth < AUTO_COLLAPSE_BELOW;
}

/**
 * Whether the sidebar starts as the rail on this window, read from the window and storage now.
 * False on the server. Blocked storage counts as chosen: the sidebar is left as it is.
 */
export function initialAutoRail(): boolean {
  if (typeof window === "undefined") return false;
  let chosen = true;
  try {
    chosen = window.localStorage.getItem(SIDE_NAV_CHOICE_KEY) !== null;
  } catch {
    // Storage blocked: count it as chosen.
  }
  return shouldStartCollapsed(window.innerWidth, chosen);
}
