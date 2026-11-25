"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowSquareOut, DownloadSimple, UserMinus } from "@phosphor-icons/react";

import { MENU_ITEM, MENU_PILL, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import type { WatchlistSource } from "@/lib/discover/watchlist-reads";
import { DISCOVER_STRINGS, removeQuestion } from "@/lib/discover-next/discover-words";
import { initialOf, profileHref, pullInput, removalOf, rowCovers, rowLine } from "@/lib/discover-next/watchlist";
import { cn } from "@/lib/utils";

/**
 * One followed creator on the Watchlist chip (spec 3.5; drawing frame 5): the picture (or the initial
 * on a sunken disc), "@handle", the line ("162M followers · 12 proven", or "Couldn't be read"), and at
 * the right up to three covers Maven stores. Presentational: the container sends.
 *
 *   the row (one button)                          its menu (named "@handle")       the question
 *   (J) @jay.makes                  [▯][▯][▯]       Pull their best videos · 5 …     Remove @jay.makes?
 *       162M followers · 12 proven                  Open on TikTok                   Cancel
 *                                                   Remove                           [ Remove ]
 *
 * - The whole row is the button that opens the menu (`RowMenuLayer`'s own trigger, in place of the
 *   three dots): on a phone a small bottom sheet, from 768 a menu standing on the row. A tap focuses
 *   it; every close hands the focus back to it.
 * - Pull and Open on TikTok only for a handle Maven can read; Remove only for a row resting on records
 *   the read could name. A row with nothing to offer is not a button.
 * - Remove clears the creator for good, so it is asked once more, with the focus on Cancel, and the
 *   confirming Remove ignores every press for 500 ms after the question appears (as You's Disconnect,
 *   `account-menu.tsx`): the second press of a double tap lands there, wherever the rows fall. The
 *   button looks the same meanwhile (no `disabled`: the focus must not move).
 * - A closing layer does nothing: it stays on screen and pressable through its exit.
 * - A confirmed Remove puts the focus on the row before `onRemove`: the row leaves at once, and the
 *   list hands the focus on from there.
 */
export interface WatchlistRowProps {
  source: WatchlistSource;
  /** "Pull their best videos": the container arms the pull and opens its page. */
  onPull(): void;
  /** Remove, confirmed. */
  onRemove(): void;
}

type Step = "menu" | "remove";

/** How long the confirming Remove ignores presses once the question appears. */
const CONFIRM_WAIT_MS = 500;

const S = DISCOVER_STRINGS.watchlist;

/** The row, as a button or as a plain line: the picture, the words, the covers. */
const ROW = "flex min-h-[64px] w-full min-w-0 items-center gap-3 rounded-xl py-2.5 text-left";

/** A picture that does not load, or none: the initial on a sunken disc. */
function Picture({ src, handle }: { src: string | null; handle: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const shown = src && failed !== src ? src : null;
  return (
    <span
      data-part="picture"
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-sunken text-ui font-[640] text-foreground-secondary"
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a stored picture address (it can expire); next/image has nothing to optimise
        <img src={shown} alt="" loading="lazy" decoding="async" onError={() => setFailed(shown)} className="size-full object-cover" />
      ) : (
        initialOf(handle)
      )}
    </span>
  );
}

/** Up to three covers, 36 by 48; one that does not load is the neutral tile. */
function Covers({ covers }: { covers: string[] }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  if (covers.length === 0) return null;
  return (
    <span data-part="covers" aria-hidden="true" className="flex shrink-0 gap-1">
      {covers.map((src, i) => (
        <span
          key={src}
          // A phone of 320 keeps room for the handle: the third cover waits for 360.
          className={cn("relative h-12 w-9 overflow-hidden rounded-md bg-surface-sunken", i === 2 && "max-[359px]:hidden")}
        >
          {failed.has(src) ? (
            <span data-part="tile" className="absolute inset-0 bg-surface-sunken" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a stored cover address (it can expire); next/image has nothing to optimise
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailed((now) => new Set(now).add(src))}
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </span>
      ))}
    </span>
  );
}

export function WatchlistRow({ source, onPull, onRemove }: WatchlistRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lineId = useId();
  const questionId = useId();
  // Open as of the last tap, not the last render: two taps can land before a render.
  const live = useRef(false);
  // When the question appeared (`performance.now()`): the confirming Remove waits from there.
  const askedAt = useRef(0);

  const handle = source.handle.trim().replace(/^@+/, "") || source.name;
  const name = `@${handle}`;
  const line = rowLine(source);
  const pull = pullInput(source.handle) !== null;
  const profile = profileHref(source.handle);
  const removable = removalOf(source) !== null;

  const face = (
    <>
      <Picture src={source.avatarUrl} handle={handle} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-[600] tracking-[-0.012em] text-foreground">{name}</span>
        {line && (
          // Wraps to a second line beside the covers rather than cut a count ("162.3M followers · 2 proven").
          <span id={lineId} className="mt-px block break-words text-meta text-foreground-secondary">
            {line}
          </span>
        )}
      </span>
      <Covers covers={rowCovers(source)} />
    </>
  );

  if (!pull && !removable) return <div className={ROW}>{face}</div>;

  const onOpenChange = (next: boolean) => {
    live.current = next;
    if (next) setStep("menu");
    setOpen(next);
  };
  const close = () => {
    live.current = false;
    setOpen(false);
  };
  const pullNow = () => {
    if (!live.current) return;
    close();
    onPull();
  };
  const askRemove = () => {
    if (!live.current) return;
    flushSync(() => setStep("remove"));
    askedAt.current = performance.now();
    cancelRef.current?.focus();
  };
  const confirmRemove = () => {
    if (!live.current) return;
    // Inside the window the press is dropped, not kept for later.
    if (performance.now() - askedAt.current < CONFIRM_WAIT_MS) return;
    live.current = false;
    // The focus on the row first: it leaves at once, and the list hands the focus on from there. Left
    // in the closing layer, it would fall to the page.
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    onRemove();
  };

  const rows =
    step === "remove" ? (
      <>
        <MenuRow>
          {/* Not selectable: the second click of a double click on the menu's Remove lands here. */}
          <div className="flex min-w-0 select-none flex-col justify-center px-2 py-2">
            <p id={questionId} className="break-words text-ui font-[560] text-foreground">
              {removeQuestion(handle)}
            </p>
          </div>
        </MenuRow>
        <MenuRow>
          <button ref={cancelRef} type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            {S.cancel}
          </button>
        </MenuRow>
        <MenuRow>
          <button type="button" onClick={confirmRemove} aria-describedby={questionId} className={cn(MENU_PILL, "bg-surface-sunken text-error")}>
            {S.remove}
          </button>
        </MenuRow>
      </>
    ) : (
      <>
        {pull && (
          <MenuRow>
            <button ref={firstRef} type="button" onClick={pullNow} className={MENU_ITEM}>
              <DownloadSimple size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {S.pull}
            </button>
          </MenuRow>
        )}
        {profile && (
          <MenuRow>
            <a
              href={profile}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${S.openOnTikTok}${DISCOVER_STRINGS.video.newTab}`}
              onClick={close}
              className={MENU_ITEM}
            >
              <ArrowSquareOut size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {S.openOnTikTok}
            </a>
          </MenuRow>
        )}
        {removable && (
          <MenuRow>
            <button ref={pull ? undefined : firstRef} type="button" onClick={askRemove} className={MENU_ITEM}>
              <UserMinus size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {S.remove}
            </button>
          </MenuRow>
        )}
      </>
    );

  return (
    <RowMenuLayer
      name={name}
      heading={name}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      waitsForRow={false}
      renderTrigger={(ref) => (
        <button ref={ref} type="button" aria-label={name} aria-describedby={line ? lineId : undefined} className={ROW}>
          {face}
        </button>
      )}
    >
      {rows}
    </RowMenuLayer>
  );
}
