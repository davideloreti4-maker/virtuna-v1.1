"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

import {
  usePosted,
  useRefreshPosted,
  useRefreshWhenDue,
  useRemovePosted,
  type PostedPiece,
} from "@/hooks/queries/use-posted";

import { AfterPostingCard } from "./after-posting-card";
import { PostedAsk } from "./posted-ask";
import { PostedSheet } from "./posted-sheet";

/**
 * What a result page shows directly under its first block (plan 2026-11-24-after-posting, Task 3): the
 * "After posting" card when the piece has a posted link, else the quiet "Posted it?" row, and the sheet
 * that adds one. The result pages pass it in as a slot (`after`) only when the piece has a number, so
 * the result views fetch nothing themselves.
 *
 * - Nothing while the piece's link is read the first time, nor when that first read is refused (a
 *   funnel visitor, a piece that is not the caller's). Once read, it stays, even if a re-read fails.
 * - A link owed a read asks for one, once per mount (`useRefreshWhenDue`); "Try again" asks again with
 *   `retry`, and the card reads the post meanwhile. While it says "Reading the post", `usePosted` reads
 *   its row again every 10 seconds for at most 3 minutes.
 * - A refused remove says so in the app's toast (`useRemovePosted`); the card stays.
 * - The focus is never left on the page itself: added, it lands on the card's title (the ask row it
 *   replaced has left); removed, on the ask row back in its place; "Try again", on the card's title.
 * - The clock for the card's day words is taken here, in the browser (ruling 9): these pages never render
 *   on the server (the shell's auth guard), and the card only renders once the link was read in the
 *   browser.
 */
export function AfterPosting({ piece }: { piece: PostedPiece }): React.JSX.Element | null {
  const { data: posted } = usePosted(piece);
  useRefreshWhenDue(posted);
  const reads = useRefreshPosted();
  const remove = useRemovePosted();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now] = useState(() => new Date());
  const askRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // A remove sent from here: once the ask row is back, the focus goes to it.
  const handToAsk = useRef(false);

  // Whenever the piece's link has been read once (ruling 20): a later re-read that fails keeps what was
  // read (TanStack keeps `data` on a failed refetch), and the card or the row stays.
  const shown = posted === undefined ? null : posted ? "card" : "ask";
  const retrying = !!posted && posted.state === "unread" && reads.isRefreshing(posted.id);

  useEffect(() => {
    if (shown !== "ask" || !handToAsk.current) return;
    handToAsk.current = false;
    askRef.current?.focus();
  }, [shown]);

  // "Try again" leaves with its row (the card reads the post): the focus goes to the card's title.
  useEffect(() => {
    if (retrying && (document.activeElement === null || document.activeElement === document.body)) titleRef.current?.focus();
  }, [retrying]);

  if (shown === null) return null;

  const onRemove = (id: string) => {
    if (remove.isPending) return;
    handToAsk.current = true;
    // Refused: the hook says so in the toast ("Couldn't remove the link.") and the card stays; here only
    // the focus rule is undone.
    remove.mutate(id, {
      onError: () => {
        handToAsk.current = false;
      },
    });
  };

  return (
    <>
      {posted ? (
        <AfterPostingCard
          posted={posted}
          now={now}
          retrying={retrying}
          removing={remove.isPending}
          onTryAgain={() => void reads.refresh({ id: posted.id, retry: true })}
          onRemove={() => onRemove(posted.id)}
          titleRef={titleRef}
        />
      ) : (
        <PostedAsk onOpen={() => setSheetOpen(true)} buttonRef={askRef} />
      )}
      <PostedSheet open={sheetOpen} onOpenChange={setSheetOpen} piece={piece} returnFocus={() => titleRef.current} />
    </>
  );
}
