import { AudienceIcon, DiscoverIcon, HomeIcon, LibraryIcon, type ShellIcon } from "./icons";

// The narrow-window default lives in a pure module the shell store can read at load; re-exported
// here so the shell keeps one place to import its config from.
export { SIDE_NAV_CHOICE_KEY, shouldStartCollapsed } from "@/lib/shell/side-nav-default";

/**
 * The one place list. The phone tab bar and the desktop sidebar both read it, so the two can
 * never disagree about what the app's places are (spec §6).
 */

export type PlaceId = "home" | "discover" | "library" | "audience";

export interface Place {
  id: PlaceId;
  label: string;
  /** Where the tab or the sidebar row navigates. */
  href: string;
  icon: ShellIcon;
  /** Paths that light this place, redirect doors included. */
  prefixes: readonly string[];
  /** True where the phone tab bar shows. A pushed screen under a place hides it. */
  showsBar: (pathname: string) => boolean;
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
    showsBar: (p) => p === "/home",
  },
  {
    id: "discover",
    label: "Discover",
    // The hub lives at /feed; /discover and /competitors only redirect into it.
    href: "/feed",
    icon: DiscoverIcon,
    prefixes: ["/feed", "/competitors", "/discover"],
    // The hub's own tabs are sub-paths of /feed and are still the place itself.
    showsBar: (p) => under(p, "/feed"),
  },
  {
    id: "library",
    label: "Library",
    href: "/library",
    icon: LibraryIcon,
    prefixes: ["/library", "/saved"],
    showsBar: (p) => p === "/library",
  },
  {
    id: "audience",
    label: "Audience",
    href: "/audience",
    icon: AudienceIcon,
    // Analytics was folded into Audience; /analytics and /grow redirect there.
    prefixes: ["/audience", "/analytics", "/grow"],
    showsBar: (p) => p === "/audience",
  },
];

/**
 * The order of the places in the desktop sidebar. The reference puts Library last there, next to
 * the recent threads it holds; the phone tab bar keeps the order of PLACES.
 */
export const SIDE_NAV_ORDER: readonly PlaceId[] = ["home", "discover", "audience", "library"];

function placeFor(pathname: string): Place | undefined {
  return PLACES.find((place) => place.prefixes.some((prefix) => under(pathname, prefix)));
}

/** The place a path belongs to, or null outside the four places. */
export function activePlace(pathname: string): PlaceId | null {
  return placeFor(pathname)?.id ?? null;
}

/**
 * Whether the phone tab bar shows. On the four places only, and never inside a thread: there the
 * message field is docked, and a docked field is never stacked on a tab bar (owner, 2026-11-18).
 */
export function tabBarVisible(pathname: string, threadOpen: boolean): boolean {
  const place = PLACES.find((candidate) => candidate.showsBar(pathname));
  if (!place) return false;
  return !(place.id === "home" && threadOpen);
}

/** Where Back leads on a phone screen that has no tab bar: up to its place, else Home. */
export function backTarget(pathname: string): string {
  const place = placeFor(pathname);
  return place && pathname !== place.href ? place.href : "/home";
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
