"use client";

import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";

import { PostedSheet } from "@/components/posted-next/posted-sheet";
import { buildRowVM } from "@/components/saved/saved-item-vm";
import { MenuButton } from "@/components/shell/menu-button";
import { useThreadActions } from "@/components/shell/use-thread-actions";
import { shownThreadTitle } from "@/components/shell/use-thread-title";
import { useToast } from "@/components/ui/toast";
import { libraryKeys, useLibraryChats } from "@/hooks/queries/use-library";
import { useRefreshPosted, useRemovePosted, type PostedPiece } from "@/hooks/queries/use-posted";
import { useSavedItemRemoval, useSavedItems } from "@/hooks/queries/use-saved-items";
import { usePinThread, useRenameThread, useThreadList, type ThreadSummary } from "@/hooks/queries/use-threads";
import { videoHref } from "@/lib/discover-next/discover-view";
import { libraryVideoIdOf } from "@/lib/discover-next/saved-ref";
import { webAddress } from "@/lib/discover-next/video-words";
import type { PieceKind } from "@/lib/library/chat-summary";
import { insideLabel } from "@/lib/library/piece-words";
import type { LibraryChat, LibraryPage } from "@/lib/library/library-page";
import { LIBRARY_PATH, libraryHref, librarySearchText, libraryViewOf, type LibraryView } from "@/lib/library/library-view";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cleanThreadTitle } from "@/lib/threads/title";
import { whenLabel } from "@/lib/time-ago";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

// A chat as its row: one mapping, shared with Home's Recent.
import { rowOf, titleOf } from "./chat-row-data";
import { LibraryScreen, focusAfterRow, type ChatRowData, type LibraryFilter, type SavedRowData } from "./library-screen";
import { RowMenu } from "./row-menu";

/**
 * Library with its data (plan 2026-11-23-library; spec §3, §5): the creator's chats a page at a
 * time (`useLibraryChats`), filtered by the chip, searched on the server, opened as the sidebar
 * opens them; and under the fourth chip the pieces they saved. Nothing here spends credits: its
 * requests are reads, the saved list's free remove, and a chat's rename, pin and delete.
 *
 * - The chip filters what is loaded. While the chip has fewer than a screenful (12) and older pages
 *   exist, older pages come on their own, at most four after each thing the creator does (a chip, a
 *   search, a Show more that brought nothing, an address that changed from outside); then "Show
 *   more" asks for one page a tap. A page can hold fewer than 30 chats, even none, and still have a
 *   next (empty chats are left out on the server), so this holds for All too, and an empty line is
 *   shown only once no older page exists.
 * - The search asks the server 250 ms after the last key; clearing returns to every chat at once,
 *   from the cache. While a search loads, the rows before stay, marked busy, and no empty line is
 *   decided from them.
 * - A row opens its chat and leaves the phone's way back to Library (`threadBack`, with the scroll
 *   it was left at), and, for a chat with no title of its own, the name its row shows, for its
 *   header; a gauge opens its piece's result. Opening marks every Library list old without reading
 *   it: coming back reads the list again (what was done in the chat shows), its cached rows on
 *   screen meanwhile.
 * - The address (`?filter=&q=`) is the one source of the chip and the settled search
 *   (`useSearchParams`). The screen writes it with the History API (`replaceState`, never adding an
 *   entry): the address and `useSearchParams` follow, and no request goes out. An address the screen
 *   did not write (the Library tab, the sidebar's link, Back, Forward) is followed as a chip tap is:
 *   its chip, its text in the field, a new burst of pages, nothing remembered from before. Back from
 *   a chat (`router.back()`) returns to the Library as it was left, and the scroll with it while its
 *   rows are still cached.
 * - Saved: the saved list (`useSavedItems`), read once the Saved chip is first selected, newest
 *   first. Each piece's own text (`buildRowVM`), its kind, and where it came from: "from {chat}"
 *   (the chat's title as the loaded pages show it, else the sidebar's short list's, else "a chat"),
 *   or "saved in Discover"; a piece a tap cannot open is its kind and when it was saved. A tap
 *   opens its chat as a chat row does; a Discover video with a web address opens it in a new tab.
 *   The search filters the pieces by their own text, here, and asks the server nothing.
 * - "Remove from saved": the row, in its place, is "Removed." with Undo, and nothing is
 *   sent. The delete goes when that line has been up for 6 s, or at once when the creator leaves it:
 *   another chip, a search that hides it, a navigation, the page or the screen going. Undo before
 *   then sends nothing, so the piece keeps its place and its save time. Until its delete has gone
 *   through, a piece is still saved everywhere (`useSavedItemRemoval`). A refused delete brings the
 *   row back with "Couldn't remove it." until the creator's next action on the list. The screen
 *   moves the focus around all this.
 * - A chat row's More (`RowMenu`): the sidebar's own Rename, Pin or Unpin and Delete, with
 *   its requests (`useRenameThread`, `usePinThread`, the shell's `deleteThread`). Each changes the
 *   chat at once in every list the Library's cache holds (each search's pages, Home's first page;
 *   the sidebar's list is the hooks' own), and on a refusal puts back only what it changed, so two
 *   actions out at once cannot undo each other, with the sidebar's kind of message. The endpoint
 *   lists the pinned chats first: a pin moves the row first at once, an unpin to its place by last
 *   message (out of the list until its page comes, when that place is past what is loaded), and a
 *   refusal puts it back where it stood (`withPin`, `pinBack`). The rows are the pages with repeats
 *   dropped (a later page may list a pinned chat again in its place): the first wins. Once answered,
 *   those lists are marked old: Home asks for its page again when it is next shown, the sidebar's
 *   list is asked for again by the hooks. A rename shows the title as the server will store it.
 *   The change is also drawn on the rows on screen (`Shown`), which a search still
 *   loading keeps as a frozen copy; such a search's list, which had no rows for the change to reach,
 *   is asked for again once the action is done; a tapped "Show more" the change called off is asked
 *   for again. Every failure message says "chat".
 * - After posting (plan 2026-11-24-after-posting): the chip Posted keeps the posted chats (one stage
 *   per chat: they have left Simulated). The row menu's third item is the chat's posted link: "Add
 *   posted link" for a chat with a simulated piece and none (it means the piece whose number the row
 *   shows, `summary.sim`), which opens the one posted-link sheet of the list (`PostedSheet`, mounted
 *   here, outside the menu, which closes on the tap); "Remove posted link" for a chat with one, asked
 *   once more in the menu (`useRemovePosted`, whose refusal is the app's toast). Added, the hook starts
 *   that post's read; either way the hooks mark the Library's lists old and the rows follow the server.
 *   The sheet hands the focus back to the row's More, or, when the row has left the list meanwhile, on
 *   as a leaving row does (`focusAfterRow`).
 * - One read of the posts' numbers per visit: once the loaded chats are in (no request out) and one of
 *   them is owed a read (`summary.posted.due`) whose own read is not already out, everything owed is
 *   read once (`useRefreshPosted().refresh()`); the hook marks the lists old when it returns. Never
 *   again in the same visit, whatever comes back. Reads cost no credits.
 */

/** How long after the last key the search asks the server. */
const SEARCH_WAIT_MS = 250;
/** A screenful of rows for the chip: fewer, and older pages come on their own. */
const AUTO_FILL = 12;
/** At most this many pages come on their own after each thing the creator does. */
const AUTO_PAGES = 4;
/** How long a removed piece's "Removed. Undo" line stays before its delete is sent. */
const REMOVE_WAIT_MS = 6_000;

const noop = () => {};
const NO_SAVED: SavedRowData[] = [];

/** The shell's scrolling element: Library scrolls inside `<main>`, not the window. */
const scroller = () => (typeof document === "undefined" ? null : document.querySelector<HTMLElement>("main"));

const keeps = (chat: LibraryChat, filter: LibraryFilter) =>
  filter === "all" ||
  (filter === "drafts" && chat.summary.stage === "draft") ||
  (filter === "simulated" && chat.summary.stage === "simulated") ||
  (filter === "posted" && chat.summary.stage === "posted");

/** The piece a row's "Add posted link" means: the one whose number the row shows; none without one. */
function simPieceOf(chat: LibraryChat): PostedPiece | null {
  const link = chat.summary.sim?.link;
  if (!link) return null;
  return link.type === "video" ? { kind: "video", analysisId: link.analysisId } : { kind: "text", threadId: chat.id, key: link.key };
}

/** The posted-link sheet of the list: the piece it adds to, open or closing, and where the focus goes back. */
interface Posting {
  piece: PostedPiece;
  open: boolean;
  returnFocus: () => HTMLElement | null;
}

/** The chats of `pages` the chip keeps, in the endpoint's order, each once. */
function chatsOf(pages: readonly LibraryPage[], filter: LibraryFilter): LibraryChat[] {
  const seen = new Set<string>();
  const kept: LibraryChat[] = [];
  for (const page of pages) {
    for (const chat of page.chats) {
      if (seen.has(chat.id)) continue;
      seen.add(chat.id);
      if (keeps(chat, filter)) kept.push(chat);
    }
  }
  return kept;
}

// ─── Saved pieces ────────────────────────────────────────────────────────────

/** Each saved type as Library draws it: the mark of its kind, and its name in the line. */
const PIECE: Record<SavedItemType, { kind: PieceKind; name: string }> = {
  hook: { kind: "hooks", name: "Hook" },
  idea: { kind: "ideas", name: "Idea" },
  script: { kind: "script", name: "Script" },
  remix: { kind: "remix", name: "Remix" },
  outlier: { kind: "video", name: "Video" },
  read: { kind: "video", name: "Video" },
};
/** A type the client no longer knows (a legacy `format` row): a text, never a crash. */
const OTHER_PIECE = { kind: "text", name: "Text" } as const;

/**
 * The chats' titles a saved piece's line names: as the loaded pages' rows show them, else as the
 * sidebar's short list holds them. A chat of that list with no title of its own is left out: what
 * it holds (its fallback title) is not known there, and "a chat" is never wrong.
 */
function chatTitlesOf(pages: readonly LibraryPage[], threads: readonly ThreadSummary[] | undefined): Map<string, string> {
  const titles = new Map<string, string>();
  for (const thread of threads ?? []) {
    const title = thread.title?.trim();
    if (title) titles.set(thread.id, shownThreadTitle(title));
  }
  for (const page of pages) for (const chat of page.chats) titles.set(chat.id, titleOf(chat));
  return titles;
}


/**
 * A removed piece's state on screen: "removed", its line up (its delete not sent); "sending", its
 * delete on its way (the line has left the list: nothing offers to undo what is already sent, and
 * the piece is still saved until the answer); "failed", its delete refused.
 */
type SavedMark = "removed" | "sending" | "failed";

/** One saved piece as its row (not for a piece whose delete is on its way: it is not listed): its
 *  own text, its kind, where it came from, and what a tap opens. */
function savedRowOf(item: SavedItem, titles: ReadonlyMap<string, string>, mark: Exclude<SavedMark, "sending"> | undefined): SavedRowData {
  const piece = PIECE[item.item_type] ?? OTHER_PIECE;
  const vm = buildRowVM(item);
  const hero = vm.hero.trim();
  // The old shelf's last resort is its type's label ("Outlier"): Library's own name instead.
  const text = hero && hero !== vm.typeLabel ? hero : piece.name;
  const fromDiscover = item.thread_id === null && item.item_type === "outlier";
  // A library video saved in Discover opens its page there; any other video saved there, its original.
  const video = libraryVideoIdOf(item);
  // A piece with neither a chat nor a place of its own (a row saved before pieces knew their chat)
  // is its kind and when it was saved, in the chat rows' time words ("Hook · 2h ago", "Hook ·
  // Oct 24"); "from a chat" would promise a chat a tap cannot open. No readable time: its kind.
  const saved = whenLabel(item.created_at);
  const line =
    item.thread_id !== null
      ? `${piece.name} · from ${titles.get(item.thread_id) ?? "a chat"}`
      : fromDiscover
        ? `${piece.name} · saved in Discover`
        : saved
          ? `${piece.name} · ${saved}`
          : piece.name;
  return {
    id: item.id,
    kind: piece.kind,
    text,
    line,
    canOpen: item.thread_id !== null || video !== null,
    href: fromDiscover && video === null ? webAddress(item.snapshot?.videoUrl) : null,
    ...(mark ? { state: mark } : {}),
  };
}

// ─── Loading on its own ──────────────────────────────────────────────────────

/**
 * The pages that come on their own since the creator last did something. `start`: the pages loaded
 * then (at most AUTO_PAGES more come). `tap`: a Show more, with the rows it began with and the
 * number of pages once its page is in.
 */
interface Burst {
  start: number;
  tap: { before: number; pagesAfter: number } | null;
}
const burstFrom = (start: number): Burst => ({ start, tap: null });

/**
 * What may still come on their own: from which page count, and up to how many rows. Null: nothing.
 * After a tap: nothing while its page is out (or if it failed); nothing if its page brought a row;
 * if it brought none, the same rule again from there (a screenful, and at least one row more).
 */
function budgetOf(burst: Burst, pages: readonly LibraryPage[], filter: LibraryFilter): { start: number; goal: number } | null {
  const { tap } = burst;
  if (!tap) return { start: burst.start, goal: AUTO_FILL };
  if (pages.length < tap.pagesAfter) return null;
  if (chatsOf(pages.slice(0, tap.pagesAfter), filter).length > tap.before) return null;
  return { start: tap.pagesAfter, goal: Math.max(AUTO_FILL, tap.before + 1) };
}

/** The text the server is asked for under a view: its search, but none under Saved (the saved
 *  pieces are searched here; the chats then only name their chats, from the unsearched list). */
const askedOf = (view: LibraryView) => (view.filter === "saved" ? "" : view.q);

/**
 * Writes an address with the History API: the address and `useSearchParams` follow (Next keeps
 * them in step) and no request goes out, where a `router.replace` costs a server render of the
 * page. `replace`, never a new entry: a chip tap is not a step Back should take.
 *
 * The screen's record of what it wrote is committed first (`flushSync`). Next applies the address
 * in a transition, which today renders after the screen's own update; should the address ever
 * render first, the screen must already know it as its own, or it would take its own write for a
 * navigation and reset the field under the creator's fingers.
 */
function writeAddress(target: string, setWritten: (href: string) => void) {
  flushSync(() => setWritten(target));
  window.history.replaceState(null, "", target);
}

const withoutMark = (marks: Record<string, SavedMark>, id: string): Record<string, SavedMark> => {
  if (!(id in marks)) return marks;
  const next = { ...marks };
  delete next[id];
  return next;
};

/** `marks` without the refusals of `ids` (other marks of theirs are kept). */
const withoutFailed = (marks: Record<string, SavedMark>, ids: ReadonlySet<string>): Record<string, SavedMark> =>
  Object.entries(marks).some(([id, mark]) => mark === "failed" && ids.has(id))
    ? Object.fromEntries(Object.entries(marks).filter(([id, mark]) => !(mark === "failed" && ids.has(id))))
    : marks;

// ─── A chat changed in every list that holds it ─────────────────────

/** Library's cache holds, under `libraryKeys.all`, each search's pages and Home's one page. */
const isPage = (data: unknown): data is LibraryPage =>
  typeof data === "object" && data !== null && Array.isArray((data as Partial<LibraryPage>).chats);
const isPaged = (data: unknown): data is InfiniteData<LibraryPage> =>
  typeof data === "object" && data !== null && Array.isArray((data as Partial<InfiniteData<LibraryPage>>).pages) &&
  (data as InfiniteData<LibraryPage>).pages.every(isPage);

/** The pages an entry holds (Home's is one page), or none. */
function pagesIn(data: unknown): readonly LibraryPage[] {
  if (isPaged(data)) return data.pages;
  return isPage(data) ? [data] : [];
}

/** The entry with each page's chats through `edit`; the same object wherever `edit` changed nothing. */
function editPages(data: unknown, edit: (chats: LibraryChat[], page: number) => LibraryChat[]): unknown {
  const pageOf = (page: LibraryPage, index: number): LibraryPage => {
    const chats = edit(page.chats, index);
    return chats === page.chats ? page : { ...page, chats };
  };
  if (isPaged(data)) {
    const pages = data.pages.map(pageOf);
    return pages.every((page, i) => page === data.pages[i]) ? data : { ...data, pages };
  }
  return isPage(data) ? pageOf(data, 0) : data;
}

/** Chat `id` with `patch`, wherever it is and `when` holds for it (a rollback only undoes its own change). */
const patchChat =
  (id: string, patch: Partial<Pick<LibraryChat, "title" | "pinned">>, when: (chat: LibraryChat) => boolean = () => true) =>
  (data: unknown) =>
    editPages(data, (chats) =>
      chats.some((chat) => chat.id === id && when(chat)) ? chats.map((chat) => (chat.id === id && when(chat) ? { ...chat, ...patch } : chat)) : chats,
    );

// ─── A pin moves the row ─────────────────────────────────

/** Where a chat stands in an entry: its page and its place in it. */
interface At {
  page: number;
  index: number;
}

/** Every place chat `id` stands in `pages`, in order (a later page may list a pinned chat again). */
const placesOf = (pages: readonly LibraryPage[], id: string): At[] =>
  pages.flatMap((page, p) => page.chats.flatMap((chat, index) => (chat.id === id ? [{ page: p, index }] : [])));

/** A chat's last message as a time to compare; one that does not read as a time, the oldest. */
const lastMessageOf = (chat: LibraryChat) => {
  const t = Date.parse(chat.updatedAt);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};
/** `a` comes before `b` by last message, as the endpoint orders them: newest first; at the same
 *  time, the larger id. */
const comesBefore = (a: LibraryChat, b: LibraryChat) => {
  const [ta, tb] = [lastMessageOf(a), lastMessageOf(b)];
  return ta !== tb ? ta > tb : a.id > b.id;
};

/** How many chats head a first page pinned: the endpoint's pinned ones. */
const pinnedHead = (chats: readonly LibraryChat[]) => {
  let n = 0;
  while (n < chats.length && chats[n]!.pinned) n += 1;
  return n;
};

/**
 * A pin or an unpin of chat `id` in one cached list (a search's pages, Home's page), drawn as the
 * endpoint will list it. For the optimistic change only: the endpoint's own order is never redone.
 * - Pinned: first (the most recently pinned leads the pinned chats that head the first page).
 * - Unpinned: at its place by last message, after the pinned head. That is where a later page lists
 *   it, when one does (pages after the first keep a pinned chat in its place); else before the first
 *   chat loaded that it comes before. None, and older pages exist: its place lies past what is loaded,
 *   so it leaves the list and comes back with its page. None and no older page: last.
 * Every other copy of it goes: the list shows a chat once. The entry as it was when it does not
 * hold the chat.
 */
export function withPin(data: unknown, id: string, pinned: boolean): unknown {
  const pages = pagesIn(data);
  const at = placesOf(pages, id);
  if (at.length === 0) return data;
  const chat: LibraryChat = { ...pages[at[0]!.page]!.chats[at[0]!.index]!, pinned };
  const rest = pages.map((page, p) => (at.some((a) => a.page === p) ? page.chats.filter((c) => c.id !== id) : page.chats));

  let to: At | null = null;
  if (pinned) {
    to = { page: 0, index: 0 };
  } else {
    const head = pinnedHead(pages[0]!.chats);
    const listed = at.find((a) => a.page > 0 || a.index >= head);
    if (listed) {
      // Its place on that page once its other copies there are gone.
      to = { page: listed.page, index: listed.index - at.filter((a) => a.page === listed.page && a.index < listed.index).length };
    } else {
      for (let p = 0; p < rest.length && !to; p += 1) {
        const chats = rest[p]!;
        for (let i = p === 0 ? pinnedHead(chats) : 0; i < chats.length; i += 1) {
          if (comesBefore(chat, chats[i]!)) {
            to = { page: p, index: i };
            break;
          }
        }
      }
      const more = (pages[pages.length - 1]!.next ?? null) !== null;
      if (!to && !more) to = { page: rest.length - 1, index: rest[rest.length - 1]!.length };
    }
  }

  return editPages(data, (_chats, p) => {
    const kept = rest[p]!;
    return to && to.page === p ? [...kept.slice(0, to.index), chat, ...kept.slice(to.index)] : kept;
  });
}

/** Where a pinned or unpinned chat stood in one cache entry before the change, for a refusal. */
interface PinPlace {
  key: QueryKey;
  at: At[];
  chat: LibraryChat;
  /** The change took it out of the list (its place lies past what is loaded). */
  left: boolean;
}

/**
 * A refused pin or unpin (`pinned`: what was asked): the chat back where it stood in the entry, with
 * its mark as it was. Not when something else changed its pin since (a second tap), nor when it left
 * the list for another reason (a delete). A rename since is kept.
 */
const pinBack = (place: PinPlace, pinned: boolean) => (data: unknown) => {
  const pages = pagesIn(data);
  const now = placesOf(pages, place.chat.id).map((a) => pages[a.page]!.chats[a.index]!);
  if (now.length === 0 ? !place.left : now.some((chat) => chat.pinned !== pinned)) return data;
  const chat: LibraryChat = { ...(now[0] ?? place.chat), pinned: !pinned };
  return editPages(data, (chats, p) => {
    const back = place.at.filter((a) => a.page === p);
    if (back.length === 0 && !chats.some((c) => c.id === chat.id)) return chats;
    const out = chats.filter((c) => c.id !== chat.id);
    for (const a of back) out.splice(Math.min(a.index, out.length), 0, chat);
    return out;
  });
};

/** What a chat holds as its row says it, in lower case, for its delete step ("5 hooks", "video");
 *  null for a plain chat. */
const insideOf = (chat: LibraryChat | undefined): string | null =>
  chat && chat.summary.lead !== "chat" ? insideLabel(chat.summary).toLowerCase() : null;

const withoutChat = (id: string) => (data: unknown) =>
  editPages(data, (chats) => (chats.some((chat) => chat.id === id) ? chats.filter((chat) => chat.id !== id) : chats));

/** Where a deleted chat was in one cache entry: its page and its place in it. */
interface Place {
  key: QueryKey;
  page: number;
  index: number;
  chat: LibraryChat;
}

/** A refused delete: the chat back in its place, in an entry that does not hold it again already. */
const withChatAt = (place: Place) => (data: unknown) =>
  pagesIn(data).some((page) => page.chats.some((chat) => chat.id === place.chat.id))
    ? data
    : editPages(data, (chats, page) => (page === place.page ? [...chats.slice(0, place.index), place.chat, ...chats.slice(place.index)] : chats));

/**
 * A change of a chat made in this visit, drawn on the rows on screen over what the lists hold.
 * While a typed search loads, the rows are a frozen copy of the search before's, which no
 * change to the cache reaches; and the search's own answer, asked before the change, may still hold
 * the old chat. A refused change is dropped. A done rename or pin goes once the rows on screen are
 * the lists' own again (every list that could not take it has been asked for again by then). A done
 * delete stays for the visit: nothing in the app brings a deleted chat back.
 */
interface Shown {
  n: number;
  id: string;
  change: { kind: "remove" } | { kind: "patch"; patch: Partial<Pick<LibraryChat, "title">> } | { kind: "pin"; pinned: boolean };
  done: boolean;
}

const isSpent = (shown: Shown) => shown.done && shown.change.kind !== "remove";

/** The pages with this visit's changes on them, in the order they were made (a pin moves its row,
 *  as in the lists: `withPin`). */
function withShown(pages: readonly LibraryPage[], changes: readonly Shown[]): readonly LibraryPage[] {
  let data: unknown = { pages };
  for (const { id, change } of changes) {
    if (change.kind === "remove") data = withoutChat(id)(data);
    else if (change.kind === "pin") data = withPin(data, id, change.pinned);
    else data = patchChat(id, change.patch)(data);
  }
  return pagesIn(data);
}

export function LibraryNext(): React.JSX.Element {
  const router = useRouter();
  const actions = useThreadActions();
  const removal = useSavedItemRemoval();
  const queryClient = useQueryClient();
  const renameThread = useRenameThread();
  const pinThread = usePinThread();
  const { toast } = useToast();
  const removePosted = useRemovePosted();
  const refreshPosted = useRefreshPosted();
  const [posting, setPosting] = useState<Posting | null>(null);

  // The address: the chip and the settled search.
  const params = useSearchParams();
  const view = useMemo(() => libraryViewOf({ filter: params.get("filter") ?? undefined, q: params.get("q") ?? undefined }), [params]);
  const { filter } = view;
  const href = libraryHref(view);
  // The address as of the last render, and the one the screen last wrote (or followed): when the
  // address changes to another than the one written, the change came from outside.
  const [seen, setSeen] = useState(href);
  const [written, setWritten] = useState(href);
  // The text in the field (the address holds it once 250 ms passed since the last key).
  const [query, setQuery] = useState(view.q);
  const [burst, setBurst] = useState<Burst>(() => burstFrom(1));
  const [savedOpened, setSavedOpened] = useState(filter === "saved");
  // Each address change from outside, followed (what was remembered goes with it).
  const [followed, setFollowed] = useState(0);
  // Removed pieces (`SavedMark`): their line up, their delete on its way, or refused.
  const [marks, setMarks] = useState<Record<string, SavedMark>>({});
  // The lines up, each with its own 6 s; and the deletes on their way.
  const waiting = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const sending = useRef(new Set<string>());
  // The refusals the creator has seen on screen: only those go with their next action on the list.
  const failedSeen = useRef(new Set<string>());
  // This visit's renames, pins and deletes, drawn on the rows on screen (`Shown`).
  const [changes, setChanges] = useState<readonly Shown[]>([]);
  const changeCount = useRef(0);
  // Changes sent and not answered yet; and a pin or unpin answered whose lists on screen are still to
  // be read again (that waits until no change is out: a read landing meanwhile would not hold it).
  const changesOut = useRef(0);
  const rereadDue = useRef(false);

  // The saved list and the sidebar's short list (the saved pieces' chat titles): read once the
  // Saved chip was first selected, never with the page.
  if (filter === "saved" && !savedOpened) setSavedOpened(true);
  const savedWanted = savedOpened || filter === "saved";
  const saved = useSavedItems(undefined, { enabled: savedWanted });
  const threads = useThreadList({ enabled: savedWanted });

  const typed = librarySearchText(query);
  const asked = askedOf(view);
  const { data, isPlaceholderData, isError, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } =
    useLibraryChats(asked);
  const pages = useMemo(() => data?.pages ?? [], [data]);

  // The address changed. Not to the one written: it came from outside, and is followed as a chip
  // tap is: its text in the field, the pages on their own start over (from what is loaded for it,
  // when that is cached), and nothing remembered from before stays.
  if (href !== seen) {
    setSeen(href);
    if (href !== written) {
      setWritten(href);
      setQuery(view.q);
      setBurst(burstFrom(isPlaceholderData ? 1 : Math.max(pages.length, 1)));
      setFollowed((n) => n + 1);
    }
  }
  useEffect(() => {
    if (followed > 0) useShellStore.getState().takeLibraryScroll();
  }, [followed]);

  /** Writes `next` to the address (see `writeAddress`); nothing when it is the address already. */
  const write = (next: LibraryView) => {
    const target = libraryHref(next);
    if (target !== href) writeAddress(target, setWritten);
  };

  // The typed text goes to the address 250 ms after the last key; the server is asked for it from
  // there (not under Saved). Cleared: at once, in `onQuery`.
  useEffect(() => {
    if (typed === "" || typed === view.q) return;
    const timer = setTimeout(() => {
      writeAddress(libraryHref({ filter: view.filter, q: typed }), setWritten);
      // Another search's pages: a new burst from its first page.
      setBurst(burstFrom(1));
    }, SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [typed, view]);

  const shown = useMemo(() => chatsOf(pages, filter), [pages, filter]);
  // A done rename or pin is in the lists once the rows on screen are theirs (not a frozen copy).
  if (!isPlaceholderData && changes.some(isSpent)) setChanges((all) => all.filter((change) => !isSpent(change)));
  // The rows as drawn: the lists' chats with this visit's changes on them.
  const visible = useMemo(() => chatsOf(withShown(pages, changes), filter), [pages, changes, filter]);
  const rows = useMemo(() => visible.map(rowOf), [visible]);
  // The chats as drawn, by id: what a row's open and its More act on.
  const byId = useMemo(() => new Map(visible.map((chat) => [chat.id, chat])), [visible]);

  const savedItems = saved.data?.items;
  const titles = useMemo(() => chatTitlesOf(pages, threads.data), [pages, threads.data]);
  // Under Saved the search is the pieces' own, here: their text, case-blind, as the screen shows it.
  const savedQuery = query.trim().toLocaleLowerCase();
  const savedRows = useMemo(() => {
    const all = (savedItems ?? []).flatMap((item) => {
      const mark = marks[item.id];
      return mark === "sending" ? [] : [savedRowOf(item, titles, mark)];
    });
    return savedQuery ? all.filter((row) => row.text.toLocaleLowerCase().includes(savedQuery)) : all;
  }, [savedItems, titles, marks, savedQuery]);

  /** Sends a removed piece's delete now. Its line leaves the list at once (nothing offers to undo
   *  what is on its way); once answered the piece leaves the saved list everywhere, or comes back
   *  saying its delete was refused. */
  const send = useCallback(
    (id: string) => {
      const timer = waiting.current.get(id);
      if (timer === undefined) return;
      clearTimeout(timer);
      waiting.current.delete(id);
      sending.current.add(id);
      setMarks((all) => ({ ...all, [id]: "sending" }));
      void removal.remove(id).then((removed) => {
        sending.current.delete(id);
        setMarks((all) => (removed ? withoutMark(all, id) : { ...all, [id]: "failed" }));
      });
    },
    [removal],
  );
  // The `send` of the latest render, for the one effect that must not follow its identity.
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  }, [send]);

  // A line the creator leaves is sent at once: another chip (or an address that is not Saved), a
  // search that hides it.
  const shownSaved = useMemo(() => new Set(filter === "saved" ? savedRows.map((row) => row.id) : []), [filter, savedRows]);
  useEffect(() => {
    for (const id of [...waiting.current.keys()]) if (!shownSaved.has(id)) send(id);
  }, [shownSaved, send]);
  // …and so is every line when the screen goes (a navigation) or the page does (a reload, the tab
  // closed): the request is kept alive past it. Once, on mount: a new `send` (a dev refresh, a
  // memo dropped) is not the screen going, so it is read when needed, not followed.
  useEffect(() => {
    const lines = waiting.current;
    const sender = latestSend;
    const leave = () => {
      for (const id of [...lines.keys()]) sender.current(id);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  // A refusal counts as seen once its row has been on screen with it.
  useEffect(() => {
    if (filter !== "saved") return;
    for (const row of savedRows) if (row.state === "failed") failedSeen.current.add(row.id);
  }, [filter, savedRows]);

  // Back from a chat opened here: the scroll as it was left (the shell store's `libraryScroll`, which
  // goes with the chat's way back), when this is the same address and its rows are still cached
  // (drawn in this first commit, so before the browser paints). A list marked old as the chat was
  // opened is read again now, with its cached rows on screen until the new ones land. Once, on
  // arrival: the value is taken either way, so another address drops it.
  const rowsCached = filter === "saved" ? saved.data !== undefined : data !== undefined && !isPlaceholderData;
  const arrived = useRef(false);
  useLayoutEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const left = useShellStore.getState().takeLibraryScroll();
    if (!left || left.href !== href || !rowsCached) return;
    const main = scroller();
    if (main) main.scrollTop = left.top;
  }, [href, rowsCached]);

  // The rows answer what is typed: not an earlier search's kept on screen while this one loads,
  // and not one for a text still being typed. Only then are an empty line and more pages decided.
  const settled = !isPlaceholderData && typed === asked;
  const budget = budgetOf(burst, pages, filter);
  const autoLoad =
    filter !== "saved" &&
    data !== undefined &&
    settled &&
    hasNextPage &&
    !isFetchNextPageError &&
    budget !== null &&
    shown.length < budget.goal &&
    pages.length - budget.start < AUTO_PAGES;

  // One page at a time: the next goes once the one before is in. Re-run on each page that arrives
  // (`pages.length`): a quick answer's "fetching" and "done" reach React in one batch, so
  // `isFetching` alone may never change between two renders. `cancelRefetch: false`: a second call
  // while one is out (a remount in development) asks for nothing more.
  useEffect(() => {
    if (autoLoad && !isFetching) void fetchNextPage({ cancelRefetch: false });
  }, [autoLoad, isFetching, pages.length, fetchNextPage]);

  // One read of the posts' numbers per visit (after posting): once the loaded chats are in, with no
  // request for them out (a read that just ended has them asked for again: decide on what that
  // brings), and one of them is owed a read whose own read is not already out (an add's). Asked for
  // once, whatever comes back.
  const postsRead = useRef(false);
  const owesRead = pages.some((page) =>
    page.chats.some((chat) => {
      const posted = chat.summary.posted;
      return Boolean(posted?.due) && !refreshPosted.isRefreshing(posted!.id);
    }),
  );
  const { refresh: readPosts } = refreshPosted;
  useEffect(() => {
    if (postsRead.current || !owesRead || isFetching) return;
    postsRead.current = true;
    void readPosts();
  }, [owesRead, isFetching, readPosts]);

  // No row for the chip yet while pages come on their own: still loading, not "nothing". After a
  // tap the screen stays as it is (its busy Show more keeps the focus).
  const filling = visible.length === 0 && burst.tap === null && (autoLoad || isFetchingNextPage);
  let state: "loading" | "ready" | "error";
  // A retry ("Try again") that is out shows loading, not the failure it may replace: with no data,
  // the query is pending again while it is out (TanStack clears the error when a fetch starts), and
  // `!isFetching` keeps it so should a fetch be out while the error is still set.
  if (filter === "saved") state = saved.data !== undefined ? "ready" : saved.isError && !saved.isFetching ? "error" : "loading";
  else if (data === undefined) state = isError && !isFetching ? "error" : "loading";
  else if (visible.length === 0 && (!settled || filling)) state = "loading";
  else state = "ready";
  // An older page failed (the rows stay): said quietly above Show more, whose tap tries again.
  const moreFailed = filter !== "saved" && data !== undefined && isFetchNextPageError && !isFetching;

  /** The creator did something on the list: a refusal they have seen is the row's own line again.
   *  One refused while they were away from it stays until it has been shown. */
  const forgetSeenFailures = () => {
    const seen = failedSeen.current;
    if (seen.size === 0) return;
    failedSeen.current = new Set();
    setMarks((all) => withoutFailed(all, seen));
  };

  const onFilter = (next: LibraryFilter) => {
    if (next === filter) return;
    forgetSeenFailures();
    const nextView: LibraryView = { filter: next, q: view.q };
    // A new burst from what is loaded (from the first page, for a search still on its way or
    // another text asked of the server).
    setBurst(burstFrom(askedOf(nextView) === asked && settled ? Math.max(pages.length, 1) : 1));
    write(nextView);
  };

  const onQuery = (next: string) => {
    setQuery(next);
    forgetSeenFailures();
    // Cleared: every chat again at once, from the cache, with no wait.
    if (librarySearchText(next) === "" && view.q !== "") {
      write({ filter, q: "" });
      setBurst(burstFrom(1));
    }
  };

  const onMore = () => {
    if (isFetchingNextPage || !hasNextPage) return;
    setBurst((b) => ({ ...b, tap: { before: shown.length, pagesAfter: pages.length + 1 } }));
    void fetchNextPage();
  };

  /**
   * Opens a chat as the sidebar does, leaving the way back to Library with the scroll it was left
   * at, and, for a chat with no title of its own, the name its row shows ("Video simulation"), so
   * its header names it the same. Every list of Library's is marked old, not read now: what the
   * creator does in the chat (a simulation, a message) shows once they come back.
   */
  const openChat = (id: string) => {
    const chat = byId.get(id) ?? pages.flatMap((page) => page.chats).find((one) => one.id === id);
    actions.openThread(id, {
      back: LIBRARY_PATH,
      title: chat && !chat.title?.trim() ? titleOf(chat) : undefined,
      scroll: { href, top: scroller()?.scrollTop ?? 0 },
    });
    void queryClient.invalidateQueries({ queryKey: libraryKeys.all, refetchType: "none" });
  };

  const onOpenSaved = (id: string) => {
    forgetSeenFailures();
    const item = savedItems?.find((one) => one.id === id);
    if (!item) return;
    if (item.thread_id) {
      openChat(item.thread_id);
      return;
    }
    // A library video saved in Discover: its page there (Back returns here through history).
    const video = libraryVideoIdOf(item);
    if (video) router.push(videoHref(video));
  };

  // Remove: the row is its "Removed." line, and nothing is sent until its 6 s end or it is left.
  const onRemoveSaved = (id: string) => {
    if (waiting.current.has(id) || sending.current.has(id)) return;
    waiting.current.set(
      id,
      setTimeout(() => send(id), REMOVE_WAIT_MS),
    );
    forgetSeenFailures();
    setMarks((all) => ({ ...all, [id]: "removed" }));
  };

  // Undo before the delete is out: nothing was sent, so the row is simply back as it was. (Once the
  // delete is sent its line has left: there is no Undo to tap.)
  const onUndoSaved = (id: string) => {
    const timer = waiting.current.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    waiting.current.delete(id);
    forgetSeenFailures();
    setMarks((all) => withoutMark(all, id));
  };

  // ─── A chat's More: rename, pin, delete ───────────────────────────

  const lists = { queryKey: libraryKeys.all };

  const change = (edit: (data: unknown) => unknown) => queryClient.setQueriesData<unknown>(lists, edit);

  /**
   * One change of chat `id`, in order:
   * 1. drawn at once on the rows on screen (`shown`; frozen placeholder rows too);
   * 2. a page on its way for a list that has rows is called off (its answer would land over the
   *    change), and the change made in every such list (`apply`). A list with no rows yet (a search
   *    still loading its first page) is left to load, and noted;
   * 3. a "Show more" the creator tapped, called off in 2, is asked for again;
   * 4. sent (`send`: true once done). Refused: `undo` puts the lists back, and the rows on screen with
   *    them. Done: the lists noted in 2, and any begun since, that are on screen or loading are asked
   *    for again (their first page; an answer asked before the change may still hold the old chat).
   *    Either way, every list is marked old: asked for again when next read, not now;
   * 5. a pin or an unpin (`reread`), either way: the lists on screen are read again (`rereadIfDue`),
   *    once no change is out. A rename or a delete reads nothing more.
   */
  const runChange = async (
    id: string,
    shownAs: Shown["change"],
    apply: () => void,
    send: () => Promise<boolean>,
    undo: () => void,
    reread = false,
  ) => {
    const n = ++changeCount.current;
    changesOut.current += 1;
    setChanges((all) => [...all, { n, id, change: shownAs, done: false }]);
    const tapped = isFetchingNextPage && burst.tap !== null && pages.length < burst.tap.pagesAfter;
    await queryClient.cancelQueries({ ...lists, predicate: (query) => query.state.data !== undefined });
    const cache = queryClient.getQueryCache();
    const known = new Set(cache.findAll(lists).map((query) => query.queryHash));
    const noRows = new Set(cache.findAll(lists).filter((query) => query.state.data === undefined).map((query) => query.queryHash));
    apply();
    if (tapped) void fetchNextPage();

    const done = await send();
    changesOut.current -= 1;
    if (reread) rereadDue.current = true;
    // After a rollback's writes (a write makes a list fresh again), before the lists asked again.
    const markOld = () => void queryClient.invalidateQueries({ ...lists, refetchType: "none" });
    if (!done) {
      undo();
      setChanges((all) => all.filter((shown) => shown.n !== n));
      markOld();
      await rereadIfDue(new Set());
      return;
    }
    markOld();
    const again = cache
      .findAll(lists)
      .filter((query) => (noRows.has(query.queryHash) || !known.has(query.queryHash)) && (query.isActive() || query.state.fetchStatus !== "idle"));
    await Promise.all(
      again.map(async (query) => {
        // A request still out was asked before the change: called off, so this one is fresh.
        await queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
        await queryClient.refetchQueries({ queryKey: query.queryKey, exact: true });
      }),
    );
    setChanges((all) => all.map((shown) => (shown.n === n ? { ...shown, done: true } : shown)));
    await rereadIfDue(new Set(again.map((query) => query.queryHash)));
  };

  /**
   * After a pin or an unpin was answered (accepted or refused), once no change is out: every list on
   * screen with rows is read again, all its loaded pages, so the server's order lands. A chat the
   * move took out of the list shows at its place, a row put back a place off is corrected, a page
   * that came while the request was out loses its old mark. The lists off screen stay marked old.
   * Their rows stay on screen meanwhile (a read keeps its list's data), and the focus with them.
   * - A page on its way (a Show more) lands first; then its list is read, that page with the others.
   * - A Show more tapped while the list is read calls that read off (TanStack's `cancelRefetch`): it
   *   is read again once that page is in. So the read is done only when it started here and is what
   *   landed (no `fetchMeta`, a new answer or error), at most a few times over.
   * - A change begun meanwhile calls it off too; the read is due again once that change is answered.
   * `fresh`: lists read just now (step 4).
   */
  const rereadIfDue = async (fresh: ReadonlySet<string>) => {
    if (!rereadDue.current || changesOut.current > 0) return;
    rereadDue.current = false;
    const onScreen = queryClient
      .getQueryCache()
      .findAll(lists)
      .filter((query) => query.isActive() && query.state.data !== undefined && !fresh.has(query.queryHash));
    await Promise.all(
      onScreen.map(async (query) => {
        for (let round = 0; round < 8; round += 1) {
          if (!query.isActive()) return;
          if (changesOut.current > 0) {
            rereadDue.current = true;
            return;
          }
          const starts = query.state.fetchStatus === "idle";
          const answers = query.state.dataUpdateCount + query.state.errorUpdateCount;
          // Not `cancelRefetch`: a page on its way is waited for, never called off.
          await queryClient.refetchQueries({ queryKey: query.queryKey, exact: true }, { cancelRefetch: false });
          const landed = query.state.dataUpdateCount + query.state.errorUpdateCount > answers;
          if (starts && landed && query.state.fetchMeta == null) return;
        }
      }),
    );
  };

  const renameChat = (id: string, typed: string) => {
    const before = byId.get(id)?.title ?? null;
    // As the server will store it (`renameThread` cleans it the same way); null: the row names it.
    const title = cleanThreadTitle(typed);
    return runChange(
      id,
      { kind: "patch", patch: { title } },
      () => change(patchChat(id, { title })),
      () => renameThread.mutateAsync({ id, title: typed }).then(() => true, () => false),
      () => {
        change(patchChat(id, { title: before }, (chat) => chat.title === title));
        toast({ variant: "error", title: "Couldn't rename that chat." });
      },
    );
  };

  // A pin moves the row first, an unpin to its place by last message (`withPin`), in every list
  // that holds it; a refusal puts it back where it stood in each (`pinBack`).
  const pinChat = (id: string, pinned: boolean) => {
    const places: PinPlace[] = [];
    return runChange(
      id,
      { kind: "pin", pinned },
      () => {
        for (const [key, data] of queryClient.getQueriesData<unknown>(lists)) {
          const pages = pagesIn(data);
          const at = placesOf(pages, id);
          if (at.length === 0) continue;
          const next = withPin(data, id, pinned);
          places.push({ key, at, chat: pages[at[0]!.page]!.chats[at[0]!.index]!, left: placesOf(pagesIn(next), id).length === 0 });
          queryClient.setQueryData<unknown>(key, next);
        }
      },
      () => pinThread.mutateAsync({ id, pinned }).then(() => true, () => false),
      () => {
        for (const place of places) queryClient.setQueryData<unknown>(place.key, pinBack(place, pinned));
        toast({ variant: "error", title: pinned ? "Couldn't pin that chat." : "Couldn't unpin that chat." });
      },
      true,
    );
  };

  // The shell's delete, as the sidebar's: its request, its message on a refusal, and the open chat's
  // pointer when the chat is the open one (on /home only; never here).
  const deleteChat = (id: string) => {
    const wasActive = useBoardStore.getState().activeThreadId === id;
    const places: Place[] = [];
    return runChange(
      id,
      { kind: "remove" },
      () => {
        for (const [key, data] of queryClient.getQueriesData<unknown>(lists)) {
          pagesIn(data).forEach((page, index) => {
            const at = page.chats.findIndex((chat) => chat.id === id);
            if (at >= 0) places.push({ key, page: index, index: at, chat: page.chats[at]! });
          });
        }
        change(withoutChat(id));
      },
      () => actions.deleteThread(id, wasActive),
      () => {
        for (const place of places) queryClient.setQueryData<unknown>(place.key, withChatAt(place));
      },
    );
  };

  // ─── A chat's posted link ─────────────────────────────────────────

  /** "Add posted link": the list's one sheet, for the piece the row's number is, opened from More
   *  (the menu has closed and put the focus there). */
  const addPosted = (piece: PostedPiece, more: HTMLElement | null) => {
    const returnFocus = more ? focusAfterRow(more) : () => null;
    setPosting({ piece, open: true, returnFocus });
  };

  const renderRowMenu = (row: ChatRowData) => {
    const chat = byId.get(row.id);
    const posted = chat?.summary.posted ?? null;
    const piece = chat ? simPieceOf(chat) : null;
    return (
      <RowMenu
        title={row.title}
        renameFrom={chat?.title ?? ""}
        pinned={row.pinned}
        inside={insideOf(chat)}
        onRename={(title) => void renameChat(row.id, title)}
        onTogglePin={() => void pinChat(row.id, !row.pinned)}
        onDelete={() => void deleteChat(row.id)}
        posted={posted ? "remove" : piece ? "add" : null}
        onAddPosted={(more) => piece && addPosted(piece, more)}
        onRemovePosted={() => posted && removePosted.mutate(posted.id)}
      />
    );
  };

  return (
    <>
      <LibraryScreen
        filter={filter}
        onFilter={onFilter}
        query={query}
        onQuery={onQuery}
        state={state}
        onRetry={() => void (filter === "saved" ? saved.refetch() : refetch())}
        chats={rows}
        saved={savedRows}
        hasMore={settled && hasNextPage}
        loadingMore={isFetchingNextPage}
        onMore={onMore}
        onOpenChat={openChat}
        onOpenSaved={onOpenSaved}
        onRemoveSaved={onRemoveSaved}
        onUndoSaved={onUndoSaved}
        onNewChat={actions.newThread}
        renderRowMenu={renderRowMenu}
        busy={!settled}
        moreFailed={moreFailed}
        opener={<MenuButton variant="picture" />}
      />
      {/* The list's one posted-link sheet, outside every row menu (a menu closes on the tap that
          opens it, and the sheet must stay mounted to close itself once the link is added). */}
      {posting && (
        <PostedSheet
          open={posting.open}
          onOpenChange={(open) => setPosting((now) => (now ? { ...now, open } : now))}
          piece={posting.piece}
          returnFocus={posting.returnFocus}
        />
      )}
    </>
  );
}

/** The route's loading file under the new look: the screen's own loading state, nothing sent. The
 *  opener is drawn here too, so the heading does not move when the page lands. */
export function LibraryNextLoading(): React.JSX.Element {
  return (
    <LibraryScreen
      filter="all"
      onFilter={noop}
      query=""
      onQuery={noop}
      state="loading"
      onRetry={noop}
      chats={[]}
      saved={NO_SAVED}
      hasMore={false}
      loadingMore={false}
      onMore={noop}
      onOpenChat={noop}
      onOpenSaved={noop}
      onRemoveSaved={noop}
      onNewChat={noop}
      opener={<MenuButton variant="picture" />}
    />
  );
}
