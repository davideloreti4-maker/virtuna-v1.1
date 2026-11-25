/**
 * library-view.ts — the Library's view in its address (plan 2026-11-23-library):
 * `/library?filter=simulated&q=meal`. `filter` is left out for All and `q` when the search is empty;
 * a chip the page does not know reads as All. The address is the one source of the chip and the
 * search: the screen reads it (`useSearchParams`) and writes it with the History API, so Back from a
 * chat returns to the Library as it was left, and a navigation to another Library address is
 * followed.
 *
 * Pure, and in neither a server nor a client module: the one place that parses and builds the
 * address.
 */

export const LIBRARY_PATH = "/library";

/**
 * The longest search text the address carries, in characters: the server's cut
 * (`LIBRARY_SEARCH_MAX` in `library-page.ts`, a server module this one cannot import). A longer
 * paste would only make an address too long to load.
 */
export const LIBRARY_Q_MAX = 80;

/** The chip: All, Drafts, Simulated, Posted (after posting, plan 2026-11-24-after-posting) or Saved. */
export type LibraryFilter = "all" | "drafts" | "simulated" | "posted" | "saved";

export interface LibraryView {
  filter: LibraryFilter;
  /** The settled search text, trimmed and at most `LIBRARY_Q_MAX` characters; "" for none. */
  q: string;
}

/** A search text as the address and the server take it: trimmed, cut at 80 whole characters
 *  (never half of one), and trimmed again where the cut left a space. */
export function librarySearchText(q: string): string {
  return Array.from(q.trim()).slice(0, LIBRARY_Q_MAX).join("").trim();
}

const FILTERS: readonly LibraryFilter[] = ["all", "drafts", "simulated", "posted", "saved"];

export const DEFAULT_LIBRARY_VIEW: LibraryView = { filter: "all", q: "" };

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

/** The view an address's parameters ask for (Next's `searchParams`). */
export function libraryViewOf(params: Params | undefined): LibraryView {
  const filter = first(params?.filter);
  return {
    filter: (FILTERS as readonly string[]).includes(filter) ? (filter as LibraryFilter) : "all",
    q: librarySearchText(first(params?.q)),
  };
}

/** The address of a view: "/library", "/library?filter=simulated", "/library?filter=drafts&q=meal". */
export function libraryHref(view: LibraryView): string {
  const params = new URLSearchParams();
  if (view.filter !== "all") params.set("filter", view.filter);
  const q = librarySearchText(view.q);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${LIBRARY_PATH}?${query}` : LIBRARY_PATH;
}
