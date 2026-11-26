import { AudienceIcon, DiscoverIcon, EarnIcon, HomeIcon, LibraryIcon, YouIcon, type ShellIcon } from "./icons";

// The narrow-window default lives in a pure module the shell store can read at load; re-exported
// here so the shell keeps one place to import its config from.
export { SIDE_NAV_CHOICE_KEY, shouldStartCollapsed } from "@/lib/shell/side-nav-default";

/**
 * The one place list. The desktop sidebar and the phone's drawer both read it, so the two can
 * never disagree about what the app's places are (spec §6).
 */

export type PlaceId = "home" | "discover" | "library" | "audience";

export interface Place {
  id: PlaceId;
  label: string;
  /** Where the sidebar's or the drawer's row navigates. */
  href: string;
  icon: ShellIcon;
  /** Paths that light this place, redirect doors included. */
  prefixes: readonly string[];
  /** True on the place's own screen, which draws its own top row. A screen pushed under the place
   *  is not it: it gets the shell's band with Back. */
  isOwnScreen: (pathname: string) => boolean;
}

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const PLACES: readonly Place[] = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    icon: HomeIcon,
    prefixes: ["/home"],
    isOwnScreen: (p) => p === "/home",
  },
  {
    id: "discover",
    label: "Discover",
    // The hub lives at /feed; /discover, /competitors and /competitors/compare redirect into it, and
    // /competitors/<handle> is a page of its own, a followed creator's, pushed from the Watchlist. Every
    // path under these lights Discover: the hub and the pages it pushes.
    href: "/feed",
    icon: DiscoverIcon,
    prefixes: ["/feed", "/competitors", "/discover"],
    // Only the hub itself: its chips live in its address (`?tab=`), and a video, a collection and
    // the pull page are pages pushed on top of it, each with the band and Back.
    isOwnScreen: (p) => p === "/feed",
  },
  {
    id: "library",
    label: "Library",
    href: "/library",
    icon: LibraryIcon,
    prefixes: ["/library", "/saved"],
    isOwnScreen: (p) => p === "/library",
  },
  {
    id: "audience",
    label: "Audience",
    href: "/audience",
    icon: AudienceIcon,
    // Analytics was folded into Audience; /analytics and /grow redirect there.
    prefixes: ["/audience", "/analytics", "/grow"],
    isOwnScreen: (p) => p === "/audience",
  },
];

/**
 * The order of the places in the desktop sidebar and the phone's drawer. The reference puts Library
 * last there, next to the recent threads it holds.
 */
export const SIDE_NAV_ORDER: readonly PlaceId[] = ["home", "discover", "audience", "library"];

/**
 * You (plan 2026-11-24-you): a sidebar row after the places on desktop, not a place, so it is not in
 * PLACES. On a phone You is a row in the menu (the left drawer) and a pushed screen (the band with
 * Back; Back goes back to where it was opened, Home when there is no entry).
 */
export const YOU: { label: string; href: string; icon: ShellIcon } = { label: "You", href: "/you", icon: YouIcon };

/** Whether a path is You: its sidebar row is lit there. */
export function youActive(pathname: string): boolean {
  return under(pathname, YOU.href);
}

/**
 * Earn (plan 2026-11-24-earn): a sidebar row under You on desktop, not a place, as You is. On a phone it
 * is a row in the menu and on the You page, above Settings, and a pushed screen (the band with Back;
 * Back goes back to where it was opened, You when there is no entry).
 */
export const EARN: { label: string; href: string; icon: ShellIcon } = { label: "Earn", href: "/earn", icon: EarnIcon };

/** Whether a path is Earn: its sidebar row is lit there. */
export function earnActive(pathname: string): boolean {
  return under(pathname, EARN.href);
}

function placeFor(pathname: string): Place | undefined {
  return PLACES.find((place) => place.prefixes.some((prefix) => under(pathname, prefix)));
}

/** The place a path belongs to, or null outside the four places. */
export function activePlace(pathname: string): PlaceId | null {
  return placeFor(pathname)?.id ?? null;
}

/**
 * Whether the screen is one of the four places, which draws its own top row (the drawer's opener at
 * its left) and gets no band from the shell. A chat on /home is not: it is a pushed screen, with the
 * band (Back or the menu, its title, New chat).
 */
export function onPlaceScreen(pathname: string, threadOpen: boolean): boolean {
  const place = PLACES.find((candidate) => candidate.isOwnScreen(pathname));
  if (!place) return false;
  return !(place.id === "home" && threadOpen);
}

/** Where Back leads on a pushed phone screen: up to its place, Settings and Earn to You, else Home. */
export function backTarget(pathname: string): string {
  // Settings and Earn are rows on You's last card, so You is above them when there is no history to go
  // back in (a fresh tab, a pasted link); otherwise Back returns to where the menu opened them.
  if (under(pathname, "/settings") || under(pathname, EARN.href)) return YOU.href;
  const place = placeFor(pathname);
  return place && pathname !== place.href ? place.href : "/home";
}

/**
 * Whether Back on a phone screen goes back in history (and only to `backTarget` when there is no
 * entry to go back to).
 * - Discover's pushed pages, a video, a collection and the pull page. They are opened from the hub's
 *   grid, whose filter, order, search and scroll live in the hub's own history entry, so going back
 *   returns to the grid as it was left; pushing `/feed` would drop all of it.
 * - A followed creator's page, `/competitors/<handle>` (not `/competitors/compare`). It is opened from the
 *   Watchlist chip, whose search lives in the hub's history entry, so Back returns to the Watchlist as it
 *   was left.
 * - You, Earn and Settings, exactly. The phone's menu opens them from any place or chat, so Back
 *   returns there as it was left (Library where it was scrolled, the chat that was open); Settings
 *   opened from You still returns to You.
 */
export function backInHistory(pathname: string): boolean {
  return (
    /^\/feed\/(?:video|collection)\/[^/]+$/.test(pathname) ||
    pathname === "/feed/discover" ||
    /^\/competitors\/(?!compare$)[^/]+$/.test(pathname) ||
    pathname === YOU.href ||
    pathname === EARN.href ||
    pathname === "/settings"
  );
}

/** Desktop sidebar geometry (spec §6.2). */
export const SIDE_NAV_WIDTH = 248;
export const SIDE_NAV_RAIL = 56;
/** Threads listed under "Recent". */
export const RECENT_LIMIT = 6;

/**
 * The app-wide `:focus-visible` ring drawn inside the control instead of 2px outside it. Use it
 * on a control that sits in a scroll or overflow container (the sidebar and its Recent list),
 * where a ring outside would be clipped; elsewhere keep the default ring. The `!` is needed: the
 * app-wide rule is unlayered CSS and beats a plain utility.
 */
export const SHELL_FOCUS = "focus-visible:outline-offset-[-2px]!";
