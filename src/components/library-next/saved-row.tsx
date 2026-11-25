"use client";

import { useEffect, useId, useRef } from "react";

import { BookmarkIcon } from "@/components/thread-next/answer-icons";
import { IconButton } from "@/components/ui/icon-button";
import type { PieceKind } from "@/lib/library/chat-summary";
import { cn } from "@/lib/utils";

import { MarkTile } from "./chat-row";

/**
 * One saved piece under the Saved chip (spec 2026-11-23 §3.4): the mark of its kind, the piece's
 * own text (two lines; up to six for a piece nothing opens, which is read here or nowhere),
 * "Hook · from {chat title}", and at the right the filled bookmark that removes it.
 *
 * - A piece that opens its chat is ONE button (named by its text, described by its line) whose
 *   `::after` covers the row. A piece with no chat that has a place of its own (a video saved in
 *   Discover: its address) is ONE link to it, in a new tab, drawn the same; a screen reader also
 *   hears that it opens a new tab. One with neither is plain text, never a dead button.
 * - "Remove from saved" is the same on every row, so it is described by the piece's text.
 * - Just removed (`state: "removed"`): the row, in its place and at its height,
 *   is a quiet line, "Removed." and "Undo" (named for the piece); the piece is not offered then.
 *   Its removal failed (`"failed"`): the row is back, its quiet line reading "Couldn't remove it.".
 *   Each row keeps one status region from the start, given its words only once on the page, so
 *   what it says then is announced.
 */

export interface SavedRowData {
  id: string;
  kind: PieceKind;
  text: string;
  line: string;
  /** A tap opens the chat it came from (`onOpen`). */
  canOpen: boolean;
  /** Where a piece with no chat lives (a video saved in Discover: its web address). The row opens
   *  it in a new tab. Not read when `canOpen`: the chat comes first. */
  href?: string | null;
  /** "removed": just removed, its Undo offered. "failed": its removal failed, and it says so. */
  state?: "removed" | "failed";
}

const ROW = "flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2 text-left";
/** An opening row: its hit area is the whole row, under the Remove control. */
const OPENS = `${ROW} rounded-xl after:absolute after:inset-0`;

const FAILED_LINE = "Couldn't remove it.";

export function SavedRow({
  item,
  onOpen,
  onRemove,
  onUndo,
}: {
  item: SavedRowData;
  onOpen(id: string): void;
  onRemove(id: string): void;
  onUndo?(id: string): void;
}) {
  const uid = useId();
  const said = item.state === "removed" ? "Removed." : item.state === "failed" ? FAILED_LINE : "";
  // The row's status region. Keyed: the same element whichever way the row is drawn. Drawn empty and
  // given its words once it is on the page: a region that changes is announced, while one that
  // appears already holding its text (a row back after a refused delete) often is not. React draws
  // no children here, so it never overwrites them.
  const region = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (region.current && region.current.textContent !== said) region.current.textContent = said;
  }, [said]);
  const status = <span key="status" ref={region} role="status" className="sr-only" />;

  if (item.state === "removed") {
    return (
      <li className="relative flex items-center gap-3">
        <div data-part="removed" className={ROW}>
          {/* Said by the row's status; shown here. */}
          <span aria-hidden className="min-w-0 flex-1 pl-1 text-ui text-foreground-secondary">
            Removed.
          </span>
          <button
            type="button"
            data-part="undo"
            aria-label={`Undo: ${item.text}`}
            onClick={() => onUndo?.(item.id)}
            className="tap-44 inline-flex h-11 shrink-0 items-center rounded-full px-4 text-ui font-[600] text-foreground transition-colors duration-150 hover:bg-surface-sunken"
          >
            Undo
          </button>
        </div>
        {status}
      </li>
    );
  }

  const link = !item.canOpen && item.href ? item.href : null;
  // A piece nothing opens is read here or nowhere: its text in full, up to six lines.
  const opens = item.canOpen || link !== null;
  const body = (
    <>
      <MarkTile kind={item.kind} />
      <span className="min-w-0 flex-1">
        {/* The piece's own words, a shade lighter than a chat's title (a title names; this is the text). */}
        <span
          id={`${uid}-text`}
          className={cn(opens ? "line-clamp-2" : "line-clamp-6", "text-ui font-[560] tracking-[-0.01em] text-foreground")}
        >
          {item.text}
        </span>
        <span id={`${uid}-line`} className="mt-px block truncate text-meta text-foreground-secondary">
          {item.state === "failed" ? FAILED_LINE : item.line}
          {link && <span className="sr-only">, opens in a new tab</span>}
        </span>
      </span>
    </>
  );
  return (
    <li className="relative flex items-center gap-3">
      {item.canOpen ? (
        <button type="button" aria-labelledby={`${uid}-text`} aria-describedby={`${uid}-line`} onClick={() => onOpen(item.id)} className={OPENS}>
          {body}
        </button>
      ) : link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" aria-labelledby={`${uid}-text`} aria-describedby={`${uid}-line`} className={OPENS}>
          {body}
        </a>
      ) : (
        <div className={ROW}>{body}</div>
      )}
      <IconButton
        data-part="remove"
        surface="quiet"
        aria-label="Remove from saved"
        aria-describedby={`${uid}-text`}
        onClick={() => onRemove(item.id)}
        // Above the row's ::after. Filled in ink: it is saved (never the accent).
        className="relative z-[1] text-foreground"
      >
        <BookmarkIcon filled />
      </IconButton>
      {status}
    </li>
  );
}
