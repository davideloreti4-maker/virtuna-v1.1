"use client";

import * as React from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LinkBreak } from "@phosphor-icons/react";

import { MENU_ITEM, MENU_PILL, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Posted, PostedUsual } from "@/lib/posted/posted";
import { POSTED_STRINGS, countsLine, footWords, gotWords } from "@/lib/posted/posted-words";
import { cn } from "@/lib/utils";

/**
 * The "After posting" card on a result page (spec 2026-11-24-after-posting §3.2, §3.3; drawing frames 3
 * to 5). Presentational: the container (`after-posting.tsx`) reads and sends.
 *
 *   After posting                                     ···
 *   [ Maven said      ]  [ It got           ]
 *   [ 67%             ]  [ 31K              ]
 *   [ would stop to…  ]  [ views            ]
 *                        [ 1.8× your usual  ]   green from 1.5×, coral up to 0.6×, else secondary ink
 *   2.1K likes · 84 comments · 310 shares · 420 saves
 *   Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers
 *
 * - Reading (and while "Try again" reads the post): the two lines, announced politely; no numbers.
 * - Could not be read: the sentence, Try again (ink) and Remove (quiet). Remove is asked once more on
 *   the card; no More there (as drawn: Remove is on the card).
 * - More ("More: posted link") stands on Library's layer (`row-menu-layer.tsx`): on a phone a small
 *   sheet, from 768 a menu on the button. Its one item, Remove posted link, asks once more
 *   (`RemovePostedRows`).
 * - Only the usual is coloured. The foot's handle links to the post's own address, built by the server
 *   from the handle and the post id (`posted.href`), never from what was pasted; no caption is shown.
 * - The day words come from `now`, which the caller takes in the browser (ruling 9).
 */

/** What Maven said, in the words its page uses ("% would stop to watch", "% watch to the end"). */
const SAID_WORDS: Record<Posted["said"]["measure"], string> = {
  stop: "would stop to watch",
  end: "watch to the end",
};

/** The usual's colour: green and coral say only "against your usual"; around it, the secondary ink. */
const TONE: Record<PostedUsual["tone"], string> = {
  above: "text-above",
  below: "text-below-text",
  around: "text-foreground-secondary",
};

/**
 * The title takes the focus when the ask row it replaced has left (after a link is added), and is not
 * a control: no ring. Inline, because the app-wide `:focus-visible` outline is unlayered (as the
 * answer sheet's heading).
 */
const NO_RING: React.CSSProperties = { outline: "none" };

/** How long a confirming Remove ignores presses once the question appears (`account-menu.tsx`). */
export const CONFIRM_WAIT_MS = 500;

/**
 * The page's monotonic clock from when a question appeared: `ready()` is false for `CONFIRM_WAIT_MS`
 * after `start()`, so the second press of a double tap (or a held Enter) never confirms. A press
 * inside the window is dropped, not kept for later.
 */
function useConfirmWait() {
  // One pair for the component's life: an effect may depend on `start` without running again.
  const [wait] = useState(() => {
    let askedAt: number | null = null;
    return {
      start: () => {
        askedAt = performance.now();
      },
      ready: () => askedAt !== null && performance.now() - askedAt >= CONFIRM_WAIT_MS,
    };
  });
  return wait;
}

export interface RemovePostedRowsProps {
  /** Cancel: the parent puts the focus here when the question appears (the safe default). */
  cancelRef: React.Ref<HTMLButtonElement>;
  onRemove(): void;
  onCancel(): void;
}

/**
 * "Remove the posted link?" with Remove and Cancel, as three rows of a menu built on Library's layer
 * (`RowMenuLayer`): the card's More here, Library's row menu. The confirming Remove ignores
 * every press for `CONFIRM_WAIT_MS` after the rows appear (wherever its row falls, a second tap or a
 * second Enter never lands on it). The parent focuses Cancel when the rows appear and checks that its
 * layer is still open before acting.
 */
export function RemovePostedRows({ cancelRef, onRemove, onCancel }: RemovePostedRowsProps): React.JSX.Element {
  const questionId = useId();
  const wait = useConfirmWait();
  const { start } = wait;
  // The rows appear with the question: the window starts here.
  useLayoutEffect(() => {
    start();
  }, [start]);
  return (
    <>
      <MenuRow>
        {/* Not selectable: a double click on the menu's item lands here and would highlight a word. */}
        <p id={questionId} className="min-w-0 select-none px-2 text-ui font-[560] text-foreground">
          {POSTED_STRINGS.removeConfirm}
        </p>
      </MenuRow>
      <MenuRow>
        <button
          type="button"
          onClick={() => {
            if (wait.ready()) onRemove();
          }}
          aria-describedby={questionId}
          className={cn(MENU_PILL, "bg-surface-sunken text-error")}
        >
          {POSTED_STRINGS.remove}
        </button>
      </MenuRow>
      <MenuRow>
        <button ref={cancelRef} type="button" onClick={onCancel} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
          {POSTED_STRINGS.cancel}
        </button>
      </MenuRow>
    </>
  );
}

/** The card's More: Remove posted link, asked once more. */
function PostedMenu({ onRemove }: { onRemove(): void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"menu" | "confirm">("menu");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Open as of the last tap, not the last render: a closing layer stays on screen (and pressable)
  // through its exit, and two taps can land before a render. Nothing acts once it is closing.
  const live = useRef(false);

  const onOpenChange = (next: boolean) => {
    live.current = next;
    if (next) setStep("menu");
    setOpen(next);
  };
  const close = () => {
    live.current = false;
    setOpen(false);
  };
  const ask = () => {
    if (!live.current) return;
    flushSync(() => setStep("confirm"));
    cancelRef.current?.focus();
  };
  const remove = () => {
    if (!live.current) return;
    live.current = false;
    // The focus on More first: the card (and More with it) leaves once the link is removed, and the
    // container hands the focus on from there.
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    onRemove();
  };

  return (
    <RowMenuLayer
      name="posted link"
      heading={POSTED_STRINGS.cardTitle}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      waitsForRow={false}
    >
      {step === "confirm" ? (
        <RemovePostedRows cancelRef={cancelRef} onRemove={remove} onCancel={close} />
      ) : (
        <MenuRow>
          <button ref={firstRef} type="button" onClick={ask} className={MENU_ITEM}>
            <LinkBreak size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            {POSTED_STRINGS.removeItem}
          </button>
        </MenuRow>
      )}
    </RowMenuLayer>
  );
}

/** The drawing's `.btn` on a card: 44 tall, round, 20 at the sides, 15. */
const PILL = "px-5 text-ui next:rounded-full";

/** Could not be read: the sentence, Try again and Remove; Remove asked once more, here on the card. */
function Unread({ removing, onTryAgain, onRemove }: { removing: boolean; onTryAgain(): void; onRemove(): void }) {
  const [asking, setAsking] = useState(false);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const wait = useConfirmWait();
  const sent = useRef(false);

  const ask = () => {
    flushSync(() => setAsking(true));
    wait.start();
    cancelRef.current?.focus();
  };
  const cancel = () => {
    flushSync(() => setAsking(false));
    removeRef.current?.focus();
  };
  const confirm = () => {
    if (removing || sent.current || !wait.ready()) return;
    sent.current = true;
    onRemove();
  };
  // A refused remove leaves the card as it was: once it is no longer out, the question can be
  // answered again.
  useEffect(() => {
    if (!removing) sent.current = false;
  }, [removing]);

  return (
    <>
      <p className="mt-2.5 text-ui text-foreground">{POSTED_STRINGS.unread}</p>
      {asking ? (
        <>
          {/* Under the sentence, where the buttons stood: the second tap of a double tap on Remove
              lands on these words, then on Cancel, never on the confirming Remove. */}
          <p id={questionId} className="mt-3 select-none text-ui font-[560] text-foreground">
            {POSTED_STRINGS.removeConfirm}
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button
              type="button"
              variant="primary"
              aria-describedby={questionId}
              aria-disabled={removing || undefined}
              aria-busy={removing || undefined}
              onClick={confirm}
              className={cn(PILL, "aria-disabled:opacity-40")}
            >
              {POSTED_STRINGS.remove}
            </Button>
            <Button ref={cancelRef} type="button" variant="quiet" onClick={cancel} className={PILL}>
              {POSTED_STRINGS.cancel}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="primary" onClick={onTryAgain} className={PILL}>
            {POSTED_STRINGS.tryAgain}
          </Button>
          <Button ref={removeRef} type="button" variant="quiet" onClick={ask} className={PILL}>
            {POSTED_STRINGS.remove}
          </Button>
        </div>
      )}
    </>
  );
}

/** Reading the post: two lines, announced politely. */
function Reading() {
  return (
    <div role="status" aria-live="polite" className="mt-2.5">
      <p className="text-ui font-[560] text-foreground">{POSTED_STRINGS.reading}</p>
      <p className="text-meta text-foreground-secondary">{POSTED_STRINGS.readingText}</p>
    </div>
  );
}

/** So far or final: the two tiles, the counts and the foot. */
function Numbers({ posted, now }: { posted: Posted; now: Date }) {
  const got = gotWords(posted);
  if (!got || !posted.numbers) return <Reading />;
  const foot = footWords(posted, now);
  const tile = "min-w-0 rounded-2xl bg-surface-sunken px-3.5 pb-3 pt-2.5";
  const label = "text-meta text-foreground-secondary";
  const figure = "mt-0.5 text-heading font-bold leading-7 tracking-[-0.03em] text-foreground tabular-nums";
  return (
    <>
      <dl className="mt-3 grid grid-cols-2 gap-2.5">
        <div data-tile="" className={tile}>
          <dt className={label}>{POSTED_STRINGS.said}</dt>
          <dd className={figure}>{posted.said.number}%</dd>
          <dd className={label}>{SAID_WORDS[posted.said.measure]}</dd>
        </div>
        <div data-tile="" className={tile}>
          <dt className={label}>{POSTED_STRINGS.got}</dt>
          <dd className={figure}>{got.number}</dd>
          <dd className={label}>{got.unit}</dd>
          {got.usual && posted.usual && <dd className={cn("text-meta font-[560] tabular-nums", TONE[posted.usual.tone])}>{got.usual}</dd>}
        </div>
      </dl>
      <p className="mt-3 text-meta text-foreground-secondary tabular-nums">{countsLine(posted.numbers)}</p>
      <p className="mt-1.5 text-meta text-foreground-secondary">
        {foot.lead}
        {foot.handle && (
          <>
            {", "}
            {posted.href ? (
              <a
                href={posted.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-44 underline decoration-border-hover underline-offset-2 transition-colors duration-150 hover:text-foreground"
              >
                {foot.handle}
              </a>
            ) : (
              foot.handle
            )}
          </>
        )}
        {foot.tail}
      </p>
    </>
  );
}

export interface AfterPostingCardProps {
  posted: Posted;
  /** The viewer's clock, taken in the browser: the foot's day words come from it. */
  now: Date;
  /** "Try again" is reading the post: the card shows the reading state. */
  retrying?: boolean;
  /** A remove is out: the confirming Remove sends nothing more. */
  removing?: boolean;
  onTryAgain(): void;
  onRemove(): void;
  /** The title, for the focus to land on when the ask row it replaced has left. */
  titleRef?: React.Ref<HTMLHeadingElement>;
}

export function AfterPostingCard({ posted, now, retrying = false, removing = false, onTryAgain, onRemove, titleRef }: AfterPostingCardProps): React.JSX.Element {
  const state = retrying ? "reading" : posted.state;
  return (
    <Card data-after-posting={state} className="px-[18px] pb-4 pt-3.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 ref={titleRef} tabIndex={-1} style={NO_RING} className="text-ui font-[640] text-foreground">
          {POSTED_STRINGS.cardTitle}
        </h2>
        {state !== "unread" && (
          <div className="-mr-1 md:-my-2 md:-mr-2">
            <PostedMenu onRemove={onRemove} />
          </div>
        )}
      </div>
      {state === "reading" ? (
        <Reading />
      ) : state === "unread" ? (
        <Unread removing={removing} onTryAgain={onTryAgain} onRemove={onRemove} />
      ) : (
        <Numbers posted={posted} now={now} />
      )}
    </Card>
  );
}
