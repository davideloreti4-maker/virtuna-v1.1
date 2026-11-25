"use client";

import * as React from "react";

import { SearchIcon } from "@/components/library-next/library-icons";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Chip } from "@/components/ui/chip";
import { DISCOVER_TABS, type DiscoverTab } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import { cn } from "@/lib/utils";

import { FilterIcon } from "./discover-icons";
import { VideosOutline } from "./videos-panel";

/**
 * Discover's frame (spec 3.1; drawing frame 1 and the desktop's left half; Library's header geometry,
 * `library-screen.tsx`): the heading, the search, the three chips, and the chip's panel under them.
 * Presentational: the container (`discover-next.tsx`) holds the view, the field's text and the panels.
 *
 *   phone                                desktop (beside the sidebar, a 980 column)
 *   Discover                             Discover ······················ [⌕ Search          ]
 *   [⌕ Search videos, or paste …   ≡]    Videos · Collections · Watchlist ····· [≡ Filter] [Most viewed ⌄]
 *   Videos · Collections · Watchlist     the panel
 *   the panel
 *
 * - The field: the lens, the text, the cross while there is text, and on a phone, on Videos, the
 *   filter mark at its end. On a desk the mark is not drawn: Filter beside the order is the one control
 *   (one place for the menu to stand). Escape clears the field and keeps the focus in it.
 * - Loading: the same frame, and the grid's outline (busy, no count).
 */

export interface DiscoverScreenProps {
  tab: DiscoverTab;
  onTab(next: DiscoverTab): void;
  query: string;
  onQuery(next: string): void;
  /** The filter mark at the field's end (a phone's; on Videos only). Absent: no mark. */
  onFilter?(opener: HTMLElement): void;
  /** The filter is open (the mark says so). */
  filterOpen?: boolean;
  state: "loading" | "ready";
  /** At the chips' right from 768: Filter and the order. */
  tools?: React.ReactNode;
  /** The field, for the container to hand the focus to (after a Clear outside the field). */
  fieldRef?: React.RefObject<HTMLInputElement | null>;
  /** The heading, for the container to hand the focus to (after Try again). */
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  /** The phone's way into the drawer (the creator's picture), before the heading. Not given: none. */
  opener?: React.ReactNode;
  children?: React.ReactNode;
}


/** The heading takes the focus (after Try again) but is not a control: no ring. Inline, because the
 *  app-wide h1 tracking and `:focus-visible` outline are unlayered and beat a utility. */
const HEADING_STYLE: React.CSSProperties = { letterSpacing: "-0.035em", outline: "none" };

export function DiscoverScreen({
  tab,
  onTab,
  query,
  onQuery,
  onFilter,
  filterOpen = false,
  state,
  tools,
  fieldRef,
  headingRef,
  opener,
  children,
}: DiscoverScreenProps): React.JSX.Element {
  const ownField = React.useRef<HTMLInputElement | null>(null);
  const field = fieldRef ?? ownField;

  const clear = () => {
    onQuery("");
    field.current?.focus();
  };

  return (
    <div data-testid="discover-next" className="flex w-full flex-1 flex-col max-md:-mt-[var(--mobile-nav-band)]">
      <div className="mx-auto flex w-full max-w-[1012px] flex-col px-4 pb-6 md:pb-12">
        <header className="flex flex-col max-md:mt-1.5 md:flex-row md:items-center md:justify-between md:gap-6 md:pb-[22px] md:pt-11">
          {/* Phone: the heading's row sits where the band was, 44 tall, as Library's; the opener first. */}
          <div className="flex h-11 items-center gap-3 pl-1 md:h-auto md:pl-0">
            {opener && (
              <div data-part="opener" className="flex shrink-0 md:hidden">
                {opener}
              </div>
            )}
            <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold leading-[35px] text-foreground" style={HEADING_STYLE}>
              {DISCOVER_STRINGS.hub.title}
            </h1>
          </div>
          {/* One pill: the lens, the field, the cross, the mark. The buttons are flex items, not placed
              absolutely: on touch `.tap-44` sets `position: relative` from unlayered CSS. */}
          <div
            role="search"
            className="mt-2 flex h-11 cursor-text items-center gap-2.5 rounded-full bg-surface-sunken pl-3.5 pr-1 md:mt-0 md:w-[320px] md:flex-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) field.current?.focus();
            }}
          >
            <SearchIcon size={17} aria-hidden className="shrink-0 text-foreground-secondary" />
            <input
              ref={field}
              type="text"
              aria-label={DISCOVER_STRINGS.hub.searchName}
              placeholder={DISCOVER_STRINGS.hub.searchPlaceholder}
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              readOnly={state === "loading"}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape" || query === "") return;
                e.preventDefault();
                clear();
              }}
              // 16 on the phone: iOS zooms the page into a field set smaller. 15 on a desk.
              className="h-full min-w-0 flex-1 bg-transparent text-title text-foreground placeholder:text-foreground-muted md:text-ui"
            />
            {query !== "" && (
              <button
                type="button"
                aria-label={DISCOVER_STRINGS.hub.clearSearch}
                onClick={clear}
                className="tap-44 flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-150 hover:text-foreground"
              >
                <CloseIcon size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
            {onFilter && (
              <button
                type="button"
                aria-label={DISCOVER_STRINGS.hub.filter}
                aria-haspopup="dialog"
                aria-expanded={filterOpen}
                onClick={(e) => {
                  // Safari does not focus a button on a tap: focused here, so the sheet has it to hand back.
                  e.currentTarget.focus();
                  onFilter(e.currentTarget);
                }}
                className="tap-44 flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-secondary transition-colors duration-150 hover:text-foreground md:hidden"
              >
                <FilterIcon size={19} aria-hidden />
              </button>
            )}
          </div>
        </header>

        <div className="mt-3 flex items-center gap-3 md:mt-0">
          {/* The three chips fit a 320 phone; should a font make them wider, the row scrolls sideways
              from screen edge to screen edge rather than wrap. 6 above and below for the chips' 44 tap
              areas, taken back outside so nothing moves. */}
          <div
            role="group"
            aria-label={DISCOVER_STRINGS.hub.title}
            className={cn(
              "-mx-4 -my-1.5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "md:mx-0 md:flex-none md:overflow-visible md:px-0",
            )}
          >
            {DISCOVER_TABS.map((id) => (
              <Chip key={id} selected={tab === id} onClick={() => onTab(id)}>
                {DISCOVER_STRINGS.tabs[id]}
              </Chip>
            ))}
          </div>
          {tools && (
            <div data-part="tools" className="ml-auto hidden items-center gap-2 md:flex">
              {tools}
            </div>
          )}
        </div>

        {state === "loading" ? <VideosOutline /> : children}
      </div>
    </div>
  );
}
