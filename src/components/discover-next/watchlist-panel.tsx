"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useRef } from "react";

import { PlusIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { WatchlistSource } from "@/lib/discover/watchlist-reads";
import { DISCOVER_STRINGS, libraryHolds } from "@/lib/discover-next/discover-words";
import { rowKeys } from "@/lib/discover-next/watchlist";

import { WatchlistRow } from "./watchlist-row";

/**
 * The Watchlist chip (spec 3.5; drawing frame 5): the creators followed, as one card of rows, and at
 * its foot "Follow a creator · Paste a @handle". Presentational: the container holds the rows, narrows
 * them by the search, and follows, pulls and removes.
 *
 * - A search no row holds: "No creator matches that." above the card, which keeps its Follow row.
 * - Nobody followed: "Nobody on your watchlist yet", Follow a creator (ink), and quietly "372 proven
 *   videos are in the library", which opens Videos (left out when the library could not be read).
 * - The watchlist could not be read: its sentence and Try again, nothing else (never "nobody yet").
 * - A row that leaves with the focus on it (a confirmed Remove puts it there) hands the focus to the
 *   row now in its place, else the row before, else the Follow row (as Library's rows hand it on).
 */
export interface WatchlistPanelProps {
  state: "ready" | "failed";
  /** The rows to draw, in order, already narrowed by the search. */
  rows: readonly WatchlistSource[];
  /** How many creators are followed, before the search narrows them: 0 is the empty state. */
  total: number;
  /** A search is on: with no row left, the sentence says nothing matched. */
  searching: boolean;
  /** The library's proven videos, for the empty state's quiet button; null when it could not be read. */
  libraryCount: number | null;
  onVideos(): void;
  /** Opens the Follow sheet; `opener` takes the focus back when it closes. */
  onFollow(opener: HTMLElement): void;
  onPull(source: WatchlistSource): void;
  onRemove(source: WatchlistSource): void;
  onRetry(): void;
}

const S = DISCOVER_STRINGS.watchlist;

/** The focus fell to the page: the control that held it is gone. Only then does the panel move it. */
const focusDropped = () => {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
};

/** The card the rows sit in: 2 / 16 inside on a phone, 4 / 24 on a desk (as Library's). */
const CARD = "rounded-3xl bg-surface px-4 py-0.5 shadow-[var(--shadow-rest)] md:px-6 md:py-1";

export function WatchlistPanel({
  state,
  rows,
  total,
  searching,
  libraryCount,
  onVideos,
  onFollow,
  onPull,
  onRemove,
  onRetry,
}: WatchlistPanelProps): React.JSX.Element {
  const base = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const followRef = useRef<HTMLButtonElement>(null);

  // One key per row on screen, unique even where the read repeats one (React needs each once).
  const keys = useMemo(() => rowKeys(rows), [rows]);

  // The row the focus was last in (a row's menu counts as its row: its layer is the row's in React).
  const focusedKey = useRef<string | null>(null);
  const before = useRef(keys);
  useEffect(() => {
    const was = before.current;
    before.current = keys;
    if (!focusDropped()) return;
    const key = focusedKey.current;
    if (key === null) return;
    const had = was.indexOf(key);
    if (had < 0 || keys.includes(key)) return;
    // Each row's control, a link (a creator with a profile) or a button (the menu): both are counted,
    // or a link would shift the count. A selector list returns them in document order.
    const controls = listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLElement>(":scope > li[data-row] > a, :scope > li[data-row] > button"))
      : [];
    (controls[had] ?? controls[had - 1] ?? followRef.current)?.focus();
  }, [keys]);

  // The first creator followed: the empty state goes, its Follow with it, and the rows come. The focus
  // goes to the Follow row (the same control, in its new place), not to the page. (After a failed read,
  // the container hands the focus on itself.)
  const empty = state === "ready" && total === 0;
  const wasEmpty = useRef(empty);
  useEffect(() => {
    const was = wasEmpty.current;
    wasEmpty.current = empty;
    if (was && !empty && focusDropped()) followRef.current?.focus();
  }, [empty]);

  if (state === "failed") {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p id={`${base}-failed`} className="text-ui text-foreground-secondary">
          {S.failed}
        </p>
        <Chip aria-describedby={`${base}-failed`} onClick={onRetry}>
          {S.tryAgain}
        </Chip>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-title font-[640] tracking-[-0.018em] text-foreground">{S.empty}</p>
        <Button
          ref={followRef}
          variant="primary"
          size="lg"
          aria-haspopup="dialog"
          onClick={(e) => onFollow(e.currentTarget)}
          className="next:rounded-full"
        >
          {S.follow}
        </Button>
        {libraryCount !== null && libraryCount > 0 && (
          <button
            type="button"
            onClick={onVideos}
            className="tap-44 rounded-full px-2 text-ui text-foreground-secondary transition-colors duration-150 hover:text-foreground"
          >
            {libraryHolds(libraryCount)}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      {rows.length === 0 && searching && (
        <div role="status" className="px-6 pb-2 pt-10 text-center">
          <p className="text-ui text-foreground-secondary">{S.noMatch}</p>
        </div>
      )}
      <div className={CARD}>
        <ul ref={listRef} aria-label={DISCOVER_STRINGS.tabs.watchlist} className="divide-y divide-border">
          {rows.map((source, i) => {
            const key = keys[i]!;
            return (
              <li key={key} data-row="" onFocus={() => (focusedKey.current = key)}>
                <WatchlistRow source={source} onPull={() => onPull(source)} onRemove={() => onRemove(source)} />
              </li>
            );
          })}
          <li onFocus={() => (focusedKey.current = null)}>
            <button
              ref={followRef}
              type="button"
              aria-haspopup="dialog"
              aria-labelledby={`${base}-follow`}
              aria-describedby={`${base}-follow-line`}
              onClick={(e) => onFollow(e.currentTarget)}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-xl py-2.5 text-left"
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-foreground-secondary">
                <PlusIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span id={`${base}-follow`} className="block truncate text-ui font-[600] tracking-[-0.012em] text-foreground">
                  {S.followRow}
                </span>
                <span id={`${base}-follow-line`} className="mt-px block truncate text-meta text-foreground-secondary">
                  {S.followRowLine}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
