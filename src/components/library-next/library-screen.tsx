"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { PlusIcon } from "@/components/shell/icons";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import type { LibraryFilter } from "@/lib/library/library-view";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { cn } from "@/lib/utils";

import { ChatRow, TABLE_GRID, TABLE_GRID_MENU, type ChatRowData } from "./chat-row";
import { SearchIcon } from "./library-icons";
import { SavedRow, type SavedRowData } from "./saved-row";

export type { ChatRowData } from "./chat-row";
export type { SavedRowData } from "./saved-row";

/**
 * Library (spec 2026-11-23 §3, §5; reference v11 Library A on the phone and the Library table on
 * desktop): every chat as a row that says what is in it and how it did, filtered by stage,
 * searchable, with the saved pieces one chip away. Presentational: the container
 * (`library-next.tsx`) reads the chats and the saved pieces, debounces the search and pages;
 * nothing here sends.
 *
 *   phone                                desktop (beside the sidebar, a 980 column)
 *   Library ···················· (⌕)     Library ·············· [⌕ Search      ]
 *   All · Drafts · Simulated · Posted ·› All · Drafts · Simulated · Posted · Saved
 *   one card of rows                     one card: a table, Stage · Simulated · After posting
 *   Show more                            Show more
 *
 * - The phone's search is a round button; a tap turns the header into the field with a cross.
 *   Escape or the cross clears the query and hands the focus back to the button. On a desk the
 *   field is always there: Escape clears it and the focus stays in it.
 * - States: loading (header, chips and six quiet rows, busy), failed, nothing at all, a filter
 *   with nothing, a search with nothing.
 * - Departures from the reference (spec §7): no record ("9 of 12 right"); a fifth chip, Saved; no
 *   empty gauge on a draft; ink gauges, a posted row's included (what Maven said); the line says what
 *   is inside.
 * - After posting (plan 2026-11-24-after-posting): the chip Posted, and the table's column "After
 *   posting". Five chips do not fit on a phone of 320 to 393: the row scrolls sideways, no scrollbar,
 *   and the selected chip is scrolled into view before the first paint (only the row moves).
 */

export type { LibraryFilter };

export interface LibraryScreenProps {
  filter: LibraryFilter;
  onFilter(next: LibraryFilter): void;
  query: string;
  onQuery(next: string): void;
  state: "loading" | "ready" | "error";
  onRetry(): void;
  chats: ChatRowData[];
  saved: SavedRowData[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore(): void;
  onOpenChat(id: string): void;
  onOpenSaved(id: string): void;
  onRemoveSaved(id: string): void;
  /** Undo on a just-removed piece's line (`SavedRowData.state` "removed"). */
  onUndoSaved?(id: string): void;
  onNewChat(): void;
  /** A row's More control (the container's `RowMenu`); absent, the rows have none. A row deleted
   *  from it leaves with the focus on it: the screen hands the focus on (next row, row before, chip). */
  renderRowMenu?(chat: ChatRowData): React.ReactNode;
  /** The rows shown are an earlier search's while the current one loads: the list is busy. */
  busy?: boolean;
  /** An older page failed: "Couldn't load more." above "Show more", whose tap tries again. */
  moreFailed?: boolean;
  /** The phone's way into the drawer (the creator's picture), before the heading. Not given: none. */
  opener?: React.ReactNode;
}

const FILTERS: ReadonlyArray<{ id: LibraryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "drafts", label: "Drafts" },
  { id: "simulated", label: "Simulated" },
  { id: "posted", label: POSTED_STRINGS.stage },
  { id: "saved", label: "Saved" },
];

const NOTHING: Record<LibraryFilter, string> = {
  all: "Nothing here yet.",
  drafts: "No drafts.",
  simulated: "Nothing simulated yet.",
  posted: POSTED_STRINGS.emptyFilter,
  saved: "Nothing saved yet. Save a hook or an idea from its details.",
};

/** The room the selected chip keeps from either end of the scrolling row: its own 16 inset. */
const CHIP_ROOM = 16;

/** The width from which the search field is always in the header (Tailwind's `md`). */
const DESK = "(min-width: 768px)";
const onDesk = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DESK).matches;

const PLACEHOLDERS = 6;

/** The focus fell to the page: the control that held it is gone. Only then does the screen move it. */
const focusDropped = () => {
  const active = document.activeElement;
  return !active || active === document.body;
};

/**
 * Where the focus goes when the row at `index` that held it left the list: that row's control in the
 * row now in its place (the next one), else in the row before. Null when the list is empty (the
 * caller then picks a chip). Saved rows and chat rows hand it on the same way.
 */
function nextInLine(rows: readonly Element[], index: number, controlOf: (row: Element) => HTMLElement | null): HTMLElement | null {
  const at = (i: number) => (rows[i] ? controlOf(rows[i]) : null);
  return at(index) ?? at(index - 1);
}

/** A chat row's open button (the row itself, not its gauge or its More). */
const chatButtonOf = (row: Element) => row.querySelector<HTMLButtonElement>(":scope > button");

/**
 * Where the focus goes back to once a layer opened from a chat row's More closes (the container's
 * posted-link sheet, which is not the row menu's own layer): that More, while it is on the page. When
 * its row has left meanwhile (a link added under Simulated makes the chat Posted), as when a row
 * leaves with the focus on it: the row now in its place (the next one), else the row before, else the
 * selected chip. Taken when the layer opens, read when it closes.
 */
export function focusAfterRow(more: HTMLElement): () => HTMLElement | null {
  const row = more.closest("li");
  const list = row?.parentElement ?? null;
  const index = row && list ? Array.from(list.children).indexOf(row) : -1;
  const page = more.closest('[data-testid="library-next"]');
  return () => {
    if (more.isConnected) return more;
    const rows = list?.isConnected ? Array.from(list.children) : [];
    return (
      (index >= 0 ? nextInLine(rows, index, chatButtonOf) : null) ??
      page?.querySelector<HTMLButtonElement>('[role="group"][aria-label="Filter"] [aria-pressed="true"]') ??
      null
    );
  };
}

/** The heading takes the focus but is not a control: no ring. Inline, because the app-wide
 *  `:focus-visible` outline is unlayered and beats a utility (as the answer sheet's heading). */
const HEADING_STYLE: React.CSSProperties = { letterSpacing: "-0.035em", outline: "none" };

/** The card the rows sit in: the drawing's one card, 2 / 16 inside on a phone, 4 / 24 on a desk. Its
 *  own width picks the table's columns (`@container`, `TABLE_GRID`): the sidebar's width varies. */
function Card({ children }: { children: React.ReactNode }) {
  return <div className="@container mt-3 rounded-3xl bg-surface px-4 py-0.5 shadow-[var(--shadow-rest)] md:mt-4 md:px-6 md:py-1">{children}</div>;
}

/** A sentence in place of the list, and at most one control. Announced: a status, or for the
 *  failure an alert (assertive). */
function Notice({ line, children, alert }: { line: string; children?: React.ReactNode; alert?: boolean }) {
  return (
    <div role={alert ? "alert" : "status"} className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-ui text-foreground-secondary">{line}</p>
      {children}
    </div>
  );
}

function Placeholder() {
  return (
    <li aria-hidden data-part="placeholder" className="flex min-h-[72px] items-center gap-3 py-2 md:min-h-[76px]">
      <span className="h-14 w-[42px] shrink-0 rounded-lg bg-surface-sunken md:h-[58px] md:w-11" />
      <span className="flex flex-1 flex-col gap-2.5">
        <span className="h-3.5 w-3/5 rounded-full bg-surface-sunken" />
        <span className="h-3 w-2/5 rounded-full bg-surface-sunken" />
      </span>
    </li>
  );
}

export function LibraryScreen({
  filter,
  onFilter,
  query,
  onQuery,
  state,
  onRetry,
  chats,
  saved,
  hasMore,
  loadingMore,
  onMore,
  onOpenChat,
  onOpenSaved,
  onRemoveSaved,
  onUndoSaved,
  onNewChat,
  renderRowMenu,
  busy,
  moreFailed,
  opener,
}: LibraryScreenProps): React.JSX.Element {
  // The phone's field: open while searching. It follows the query: one that arrives shows it, and
  // one emptied from outside closes it, unless the search has the focus (the last letter deleted).
  const [open, setOpen] = useState(() => query !== "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    if (query !== "") setOpen(true);
    else if (!searchFocused) setOpen(false);
  }
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLUListElement>(null);
  const selectedChip = () => chipsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? null;

  const openSearch = () => {
    flushSync(() => setOpen(true));
    fieldRef.current?.focus();
  };
  const clearSearch = () => {
    onQuery("");
    flushSync(() => setOpen(false));
    // On a desk the field stays in the header; on a phone it closes and its button comes back.
    (onDesk() ? fieldRef.current : buttonRef.current)?.focus();
  };

  // The selected chip in view where the row scrolls sideways (a phone: five chips do not fit at 320
  // to 393), 16 from the row's edge: in the first commit, before the browser paints (nothing jumps),
  // and again whenever the chip changes. Only the row's own scroll moves, never the page's. A row
  // that fits (a desk) is left alone.
  useLayoutEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const box = row.getBoundingClientRect();
    const at = chip.getBoundingClientRect();
    if (at.left < box.left + CHIP_ROOM) row.scrollLeft -= box.left + CHIP_ROOM - at.left;
    else if (at.right > box.right - CHIP_ROOM) row.scrollLeft += at.right - (box.right - CHIP_ROOM);
  }, [filter]);

  const searched = query.trim();
  const grid = renderRowMenu ? TABLE_GRID_MENU : TABLE_GRID;
  const showMore = state === "ready" && hasMore && filter !== "saved";

  // "Show more" goes once the last page is in; the focus it held would drop to the page. It moves
  // to the first row that page brought (the last row, when it brought none), and to the selected
  // chip when the chip is left with no row at all.
  const listRef = useRef<HTMLUListElement>(null);
  const firstNew = useRef<number | null>(null);
  const more = () => {
    if (loadingMore) return;
    firstNew.current = chats.length;
    onMore();
  };
  useEffect(() => {
    if (firstNew.current === null || showMore) return;
    const index = firstNew.current;
    firstNew.current = null;
    if (!focusDropped()) return;
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(":scope > li > button");
    const target = rows && rows.length > 0 ? rows[Math.min(index, rows.length - 1)] : selectedChip();
    target?.focus();
  }, [showMore, chats.length]);

  // "Try again": the failure's notice (and its button) goes once the screen loads again; the focus
  // goes to the page's heading. A retry that fails at once keeps the notice, and the focus with it.
  const retried = useRef(false);
  const retry = () => {
    retried.current = true;
    onRetry();
  };
  useEffect(() => {
    if (!retried.current || state === "error") return;
    retried.current = false;
    if (focusDropped()) headingRef.current?.focus();
  }, [state]);

  // The saved rows' focus. A row's control is its "Remove from saved", or the Undo of its
  // "Removed." line.
  // - Remove tapped: once the row is its line, the focus is on its Undo. Undo tapped: once the row
  //   is back, on its Remove.
  // - The row whose control had the focus leaves or changes under it (its line left by itself, a
  //   removal went through, one failed): the focus fell to the page. It goes to the control of that
  //   row when it is still listed, else of the row now in its place (the next one), else of the
  //   row before, else (nothing left) to the Saved chip. Not once the focus has left the list.
  const intent = useRef<{ id: string; to: "undo" | "remove" } | null>(null);
  const focusedRow = useRef<string | null>(null);
  const savedBefore = useRef(saved);
  const removeSaved = (id: string) => {
    intent.current = { id, to: "undo" };
    onRemoveSaved(id);
  };
  const undoSaved = (id: string) => {
    intent.current = { id, to: "remove" };
    onUndoSaved?.(id);
  };
  useEffect(() => {
    const before = savedBefore.current;
    savedBefore.current = saved;
    const rows = savedRef.current ? Array.from(savedRef.current.children) : [];
    const controlOf = (row: Element) => row.querySelector<HTMLButtonElement>('[data-part="undo"], [data-part="remove"]');
    const controlAt = (index: number) => (rows[index] ? controlOf(rows[index]) : null);
    const wanted = intent.current;
    if (wanted) {
      intent.current = null;
      const index = saved.findIndex((item) => item.id === wanted.id);
      if (index >= 0 && (saved[index]!.state === "removed") === (wanted.to === "undo")) {
        if (focusDropped()) controlAt(index)?.focus();
        return;
      }
      // Not as wanted: the row left, changed otherwise, or did not change at all (the container did
      // not take the tap). The move is dropped, and the hand-off below decides, so it never holds
      // back another row's.
    }
    if (!focusDropped()) return;
    const had = before.findIndex((item) => item.id === focusedRow.current);
    if (had < 0) return;
    const now = saved.findIndex((item) => item.id === before[had]!.id);
    if (now >= 0 && saved[now]!.state === before[had]!.state) return;
    const target =
      (now >= 0 ? controlAt(now) : nextInLine(rows, had, controlOf)) ??
      chipsRef.current?.querySelector<HTMLButtonElement>('[data-filter="saved"]');
    target?.focus();
  }, [saved]);

  // The chat rows' focus, handed on the same way: a chat deleted from its More leaves the
  // list with the focus on that More (the menu puts it there before the delete). Once the row is
  // gone and the focus fell to the page, it goes to the row now in its place (the next one), else to
  // the row before, else (no row left) to the selected chip. A row that stays (renamed, pinned)
  // keeps it where it is. Not once the focus has left the list (its row's own menu is not leaving).
  const focusedChat = useRef<string | null>(null);
  const chatsBefore = useRef(chats);
  useEffect(() => {
    const before = chatsBefore.current;
    chatsBefore.current = chats;
    if (!focusDropped()) return;
    const had = before.findIndex((chat) => chat.id === focusedChat.current);
    if (had < 0 || chats.some((chat) => chat.id === before[had]!.id)) return;
    const rows = listRef.current ? Array.from(listRef.current.children) : [];
    (nextInLine(rows, had, chatButtonOf) ?? selectedChip())?.focus();
  }, [chats]);

  let body: React.ReactNode;
  if (state === "loading") {
    body = (
      <Card>
        <ul aria-label="Chats" aria-busy="true" className="divide-y divide-border">
          {Array.from({ length: PLACEHOLDERS }, (_, i) => (
            <Placeholder key={i} />
          ))}
        </ul>
      </Card>
    );
  } else if (state === "error") {
    body = (
      <Notice line="Couldn't load your library." alert>
        <Chip onClick={retry}>Try again</Chip>
      </Notice>
    );
  } else if (filter !== "saved" && chats.length === 0 && hasMore) {
    // Nothing matches in the pages loaded, and older ones exist: no empty line, only "Show more".
    body = null;
  } else if (filter === "saved" ? saved.length === 0 : chats.length === 0) {
    body = searched ? (
      <Notice line={filter === "saved" ? `Nothing saved matches "${searched}".` : `No chat called "${searched}".`} />
    ) : (
      <Notice line={NOTHING[filter]}>
        {filter === "all" && (
          <button
            type="button"
            onClick={onNewChat}
            className="tap-44 inline-flex h-11 items-center gap-2 rounded-full bg-action pl-4 pr-5 text-ui font-[600] text-action-foreground transition-[scale] duration-150 motion-safe:active:scale-[0.98]"
          >
            <PlusIcon size={18} aria-hidden />
            New chat
          </button>
        )}
      </Notice>
    );
  } else if (filter === "saved") {
    body = (
      <Card>
        <ul
          ref={savedRef}
          aria-label="Saved"
          className="divide-y divide-border"
          // Which row's control has the focus, for the hand-off when that row leaves or changes.
          onFocus={(e) => {
            const row = (e.target as HTMLElement).closest("li");
            const index = row ? Array.from(e.currentTarget.children).indexOf(row) : -1;
            focusedRow.current = saved[index]?.id ?? null;
          }}
          // …forgotten once the focus leaves the list, so a row leaving later never pulls it back.
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && e.currentTarget.contains(next)) return;
            if (next) {
              focusedRow.current = null;
              return;
            }
            // To the page (a click on blank space; Safari, where a click does not focus a button).
            // Not when the control itself went (its row left or changed): that is the hand-off.
            const list = e.currentTarget;
            const control = e.target;
            const was = focusedRow.current;
            queueMicrotask(() => {
              if (control.isConnected && focusedRow.current === was && !list.contains(document.activeElement)) focusedRow.current = null;
            });
          }}
        >
          {saved.map((item) => (
            <SavedRow key={item.id} item={item} onOpen={onOpenSaved} onRemove={removeSaved} onUndo={undoSaved} />
          ))}
        </ul>
      </Card>
    );
  } else {
    body = (
      <Card>
        {/* The table's head, from 768 (the reference's, "After posting" included). */}
        <div
          aria-hidden
          data-part="table-head"
          className={cn("hidden border-b border-border pb-2.5 pt-3.5 text-meta font-[560] text-foreground-secondary md:grid", grid)}
        >
          <span />
          <span />
          <span>Stage</span>
          <span>Simulated</span>
          <span>{POSTED_STRINGS.column}</span>
        </div>
        <ul
          ref={listRef}
          aria-label="Chats"
          aria-busy={busy || undefined}
          className="divide-y divide-border"
          // Which row's control has the focus, for the hand-off when that row leaves. A focus inside a
          // row's menu (portalled: it bubbles here through React, not through the page) is not a row's.
          onFocus={(e) => {
            if (!e.currentTarget.contains(e.target as Node)) return;
            const row = (e.target as HTMLElement).closest("li");
            const index = row ? Array.from(e.currentTarget.children).indexOf(row) : -1;
            focusedChat.current = chats[index]?.id ?? null;
          }}
          // …forgotten once the focus leaves the list, as the saved rows' is. A focus moving into the
          // row's own menu (portalled, `data-row-menu`) is still that row's: a delete from there
          // must hand the focus on.
          onBlur={(e) => {
            const next = e.relatedTarget as Element | null;
            const list = e.currentTarget;
            const inMenu = (el: Element | null) => Boolean(el?.closest("[data-row-menu]"));
            if (next && (list.contains(next) || inMenu(next))) return;
            if (next) {
              focusedChat.current = null;
              return;
            }
            // To the page (a click on blank space; Safari, where a click does not focus a button).
            // Not when the control itself went (its row left, its menu closed): that is the hand-off.
            const control = e.target;
            const was = focusedChat.current;
            queueMicrotask(() => {
              const active = document.activeElement;
              if (control.isConnected && focusedChat.current === was && !list.contains(active) && !inMenu(active)) focusedChat.current = null;
            });
          }}
        >
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} onOpen={onOpenChat} menu={renderRowMenu?.(chat)} />
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <div data-testid="library-next" className="flex w-full flex-1 flex-col max-md:-mt-[var(--mobile-nav-band)]">
      <div className="mx-auto flex w-full max-w-[1012px] flex-col px-4 pb-6 md:pb-12">
        {/* Phone: the header row sits where the band was, 44 tall, as the reference's `.lt`. */}
        <header className="flex h-11 items-center gap-3 pl-1 max-md:mt-1.5 md:h-auto md:justify-between md:pb-[22px] md:pl-0 md:pt-11">
          {/* The opener first; the phone's open search takes the whole row, so it steps aside. */}
          {opener && (
            <div data-part="opener" className={cn("flex shrink-0 md:hidden", open && "hidden")}>
              {opener}
            </div>
          )}
          {/* The global h1 tracking is unlayered and beats a utility: set inline. */}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className={cn("min-w-0 flex-1 text-3xl font-bold leading-[35px] text-foreground md:flex-none", open && "max-md:sr-only")}
            style={HEADING_STYLE}
          >
            Library
          </h1>
          <IconButton ref={buttonRef} aria-label="Search" onClick={openSearch} className={cn("md:hidden", open && "hidden")}>
            <SearchIcon />
          </IconButton>
          {/* One pill: the lens, the field, the cross. The cross is a flex item, not placed
              absolutely: on touch `.tap-44` sets `position: relative` from unlayered CSS. */}
          <div
            role="search"
            data-part="search"
            className={cn(
              "h-11 cursor-text items-center gap-2.5 rounded-full bg-surface-sunken pl-3.5 pr-1 md:w-[280px] md:flex-none",
              open ? "flex flex-1" : "hidden md:flex",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) fieldRef.current?.focus();
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchFocused(false);
            }}
          >
            <SearchIcon size={17} aria-hidden className="shrink-0 text-foreground-secondary" />
            <input
              ref={fieldRef}
              type="text"
              aria-label="Search"
              placeholder="Search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                e.preventDefault();
                clearSearch();
              }}
              // 16 on the phone: iOS zooms the page into a field set smaller. 15 on a desk, as drawn.
              className="h-full min-w-0 flex-1 bg-transparent text-title text-foreground placeholder:text-foreground-muted md:text-ui"
            />
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
              className={cn(
                "tap-44 flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-150 hover:text-foreground",
                query === "" && "md:invisible",
              )}
            >
              <CloseIcon size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </header>

        {/* On a phone the chips scroll sideways from screen edge to screen edge when they do not fit
            (a 320 phone), and end with 16 of space inside the scroll (the 8 gap and an 8 spacer:
            a flex scroller's end padding is not kept by every browser), so the last chip can clear
            the edge. 6 above and below for the chips' 44 tap areas and their shadow, taken back
            outside so nothing moves. From 768, as before. */}
        <div
          ref={chipsRef}
          role="group"
          aria-label="Filter"
          className={cn(
            "-mx-4 -mb-1.5 mt-1 flex gap-2 overflow-x-auto py-1.5 pl-4 pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "after:w-2 after:shrink-0 after:content-['']",
            "md:mx-0 md:mb-0 md:mt-0 md:overflow-visible md:py-0 md:pl-0 md:after:hidden",
          )}
        >
          {FILTERS.map((f) => (
            <Chip key={f.id} data-filter={f.id} selected={filter === f.id} onClick={() => onFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {body}

        {showMore && (
          <>
            {/* Kept in the page while "Show more" is, so the line is announced when it comes. */}
            <p role="status" className={cn("text-center text-meta text-foreground-secondary", moreFailed && "mt-4")}>
              {moreFailed ? "Couldn't load more." : null}
            </p>
            {/* `aria-disabled`, not `disabled`, while the page loads: a disabled button drops the focus. */}
            <Chip
              aria-disabled={loadingMore || undefined}
              aria-busy={loadingMore || undefined}
              onClick={more}
              className={cn("self-center aria-disabled:cursor-default aria-disabled:opacity-40", moreFailed ? "mt-2" : "mt-4")}
            >
              Show more
            </Chip>
          </>
        )}
      </div>
    </div>
  );
}
