/**
 * Discover's view in its address:
 * `/feed?tab=collections&niche=comedy&platform=tiktok&order=jump&q=meal`. Defaults are left out
 * (Videos, no niche, no platform, Most viewed, no search); the old `tab=outliers` reads as Videos;
 * anything the page does not know reads as its default. The address is the one source of the view:
 * the hub reads it and writes it with the History API, so Back from a video returns to the same grid.
 *
 * Also the other Discover addresses: a video's page, a collection's page, the pull page, a followed
 * creator's page and the new-audience page that builds their audience. Pure, and
 * in neither a server nor a client module (as `lib/library/library-view.ts`).
 */

import type { CollectionCategory } from "@/lib/discover/corpus-reads";

import { NICHE_KEY_PATTERN, nicheKeyOf } from "./niches";

export const DISCOVER_PATH = "/feed";

/** The longest search the address carries, in whole characters. */
export const DISCOVER_Q_MAX = 200;

export type DiscoverTab = "videos" | "collections" | "watchlist";
export type DiscoverOrder = "views" | "jump" | "newest";
export type DiscoverPlatform = "tiktok" | "instagram" | "youtube";

export interface DiscoverView {
  tab: DiscoverTab;
  /** A niche key (`nicheKeyOf`), or null for all. */
  niche: string | null;
  platform: DiscoverPlatform | null;
  order: DiscoverOrder;
  /** The settled search, trimmed and at most `DISCOVER_Q_MAX` characters; "" for none. */
  q: string;
}

export const DEFAULT_DISCOVER_VIEW: DiscoverView = { tab: "videos", niche: null, platform: null, order: "views", q: "" };

/** The chips, the orders and the platforms, in the order the screens show them. */
export const DISCOVER_TABS: readonly DiscoverTab[] = ["videos", "collections", "watchlist"];
export const DISCOVER_ORDERS: readonly DiscoverOrder[] = ["views", "jump", "newest"];
export const DISCOVER_PLATFORMS: readonly DiscoverPlatform[] = ["tiktok", "instagram", "youtube"];

/** The tab's old name in the address (the hub before the new look). */
const OLD_VIDEOS_TAB = "outliers";

/** A search as the address takes it: trimmed, cut at 200 whole characters (never half of one), and
 *  trimmed again where the cut left a space. */
export function discoverSearchText(q: string): string {
  return Array.from(q.trim()).slice(0, DISCOVER_Q_MAX).join("").trim();
}

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

const oneOf = <T extends string>(values: readonly T[], value: string): T | null =>
  (values as readonly string[]).includes(value) ? (value as T) : null;

/** A niche key the address can hold, or null. */
function addressNiche(raw: string | null): string | null {
  const key = nicheKeyOf(raw);
  return key !== null && NICHE_KEY_PATTERN.test(key) ? key : null;
}

/** The view an address's parameters ask for (Next's `searchParams`, or `Object.fromEntries` of `useSearchParams`). */
export function discoverViewOf(params: Params | undefined): DiscoverView {
  const tab = first(params?.tab);
  return {
    tab: tab === OLD_VIDEOS_TAB ? "videos" : (oneOf(DISCOVER_TABS, tab) ?? DEFAULT_DISCOVER_VIEW.tab),
    niche: addressNiche(first(params?.niche)),
    platform: oneOf(DISCOVER_PLATFORMS, first(params?.platform)),
    order: oneOf(DISCOVER_ORDERS, first(params?.order)) ?? DEFAULT_DISCOVER_VIEW.order,
    q: discoverSearchText(first(params?.q)),
  };
}

/** The address of a view: "/feed", "/feed?tab=watchlist", "/feed?niche=comedy&order=jump&q=meal". */
export function discoverHref(view: DiscoverView): string {
  const params = new URLSearchParams();
  if (view.tab !== DEFAULT_DISCOVER_VIEW.tab) params.set("tab", view.tab);
  const niche = addressNiche(view.niche);
  if (niche) params.set("niche", niche);
  if (view.platform) params.set("platform", view.platform);
  if (view.order !== DEFAULT_DISCOVER_VIEW.order) params.set("order", view.order);
  const q = discoverSearchText(view.q);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${DISCOVER_PATH}?${query}` : DISCOVER_PATH;
}

/** A library video's page. */
export function videoHref(id: string): string {
  return `${DISCOVER_PATH}/video/${encodeURIComponent(id)}`;
}

/** A collection's page. A slug is unique only within its shelf, so the shelf rides along. */
export function collectionHref({ slug, category }: { slug: string; category: CollectionCategory }): string {
  return `${DISCOVER_PATH}/collection/${encodeURIComponent(slug)}?shelf=${encodeURIComponent(category)}`;
}

/** The pull page for an input (a @handle, a link, or words). The address alone never starts a pull. */
export function pullHref(input: string): string {
  return `${DISCOVER_PATH}/discover?input=${encodeURIComponent(input)}`;
}

/** A handle as an address carries it: trimmed, without its "@", lower case. */
const bareHandle = (handle: string): string => handle.trim().replace(/^@+/, "").toLowerCase();

/** The creator an address names: decoded when it came encoded, trimmed, without "@", lower case; "" for none. */
export function creatorHandleOf(segment: string | null | undefined): string {
  let raw = segment ?? "";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // A stray "%": read as written.
  }
  return bareHandle(raw);
}

/** A followed creator's page. */
export function creatorHref(handle: string): string {
  return `/competitors/${encodeURIComponent(bareHandle(handle))}`;
}

/** The one segment under `/competitors` that is another page: the old comparison, a redirect under the new look. */
const COMPARE_SEGMENT = "compare";

/**
 * The page a profile handle names, as its address reads it (`creatorHandleOf`), or null when it names none:
 * nothing left of it ("@", blanks), or `compare`, whose address is the old comparison's. Ask this before
 * linking a creator to `creatorHref`.
 */
export function creatorPageHandle(profileHandle: string | null | undefined): string | null {
  const handle = creatorHandleOf(profileHandle);
  return handle && handle !== COMPARE_SEGMENT ? handle : null;
}

/** The new-audience page with the "Another creator" row chosen and its field filled. */
export function audienceFromHref(handle: string): string {
  return `/audience/new?door=handle&handle=${encodeURIComponent(bareHandle(handle))}`;
}

/** The Watchlist chip of Discover. */
export const WATCHLIST_HREF = discoverHref({ ...DEFAULT_DISCOVER_VIEW, tab: "watchlist" });
