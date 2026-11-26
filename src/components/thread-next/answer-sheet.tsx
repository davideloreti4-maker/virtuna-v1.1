"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { reportSheetOpen } from "@/lib/thread-next/open-sheets";
import { cn } from "@/lib/utils";

import { PROSE, keepHyphens } from "./answer-card";

/**
 * The details sheet's shell (thread answers step 2, spec §3 "Where"; drawing P6, `.sheet`, `.grab`,
 * `.ax-sh`): a bottom sheet on the phone (the `Sheet` part, as More), a centred dialog 560 wide from
 * 768 up, the same content. Its name and heading are the text it is about, large (the drawing's 19 / 26 at 620, built 18 / 26 as the remix hook).
 * Escape, the scrim and the grab handle close it. On open, focus goes to the heading, not to the first
 * control (for a hook not simulated that is the paid "Simulate": a held Enter on the row would repeat
 * onto it); Tab from there reaches the first control. It is opened from a row, not from a Radix
 * trigger, so it hands focus back itself: to `returnFocus` (the row's button), without scrolling the
 * thread.
 */

const HEADING = "text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground";
/**
 * The heading takes focus when the sheet opens (so the first control, sometimes a paid one, does not),
 * and is not a control: it shows no focus ring. Inline, because the app-wide `:focus-visible` outline in
 * globals.css is unlayered and beats an `outline-none` utility (seen as a box round the title for a
 * keyboard user, 2026-11-23).
 */
const NO_RING: React.CSSProperties = { outline: "none" };

/** How long after it opens the sheet takes no click (the double-tap's second tap). */
export const SETTLE_MS = 320;

/**
 * The clock that window is read from. Time is an outside thing: a test that is not about the window
 * replaces `now` (so a click right after opening counts), and the one that is drives it by hand.
 */
export const settleClock = { now: (): number => performance.now() };

/**
 * "Close", for a screen reader on a touch screen: the grab handle is hidden from it, the scrim is not
 * a control, and there is no Escape key. Out of sight until the keyboard reaches it; then a small
 * pill at the sheet's top corner.
 */
const CLOSE =
  "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-4 focus-visible:top-4 focus-visible:z-[1] focus-visible:rounded-lg focus-visible:bg-surface-sunken focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-meta focus-visible:font-[560] focus-visible:text-foreground";

/**
 * The width is read from the store `matchMedia` keeps, so the first client render already knows it:
 * a sheet that mounts open on a desk is the dialog from its first commit, never the bottom sheet first
 * (the shared `useMediaQuery` answers false until after mount). False on the server.
 */
const WIDE = "(min-width: 768px)";

function subscribeWide(onChange: () => void) {
  const list = window.matchMedia(WIDE);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
const wideNow = () => window.matchMedia(WIDE).matches;
const wideOnServer = () => false;

export function AnswerSheet({
  open,
  onOpenChange,
  title,
  returnFocus = null,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  returnFocus?: HTMLElement | null;
  children: React.ReactNode;
}) {
  const wide = useSyncExternalStore(subscribeWide, wideNow, wideOnServer);
  // While open, the page knows (`open-sheets.ts`): the thread's fold waits, so the turn this sheet
  // was opened from is not replaced under it. In a layout effect, so it is told in the commit that
  // opens or closes the sheet, before any effect of the composer reads it.
  useLayoutEffect(() => (open ? reportSheetOpen() : undefined), [open]);
  const heading = useRef<HTMLHeadingElement>(null);
  const openedAt = useRef(Number.NEGATIVE_INFINITY);
  const onOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    openedAt.current = settleClock.now();
    heading.current?.focus();
  };
  // The second tap of a double-tap on a row lands where the sheet has just appeared, sometimes on a
  // paid button. A click in the sheet's first moment is not a choice: it is dropped.
  const dropEarlyClick = (event: React.MouseEvent) => {
    if (settleClock.now() - openedAt.current >= SETTLE_MS) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    returnFocus?.focus({ preventScroll: true });
  };

  if (wide) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-sheet="scrim"
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            data-sheet="dialog"
            aria-describedby={undefined}
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={onCloseAutoFocus}
            onClickCapture={dropEarlyClick}
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] max-h-[calc(100dvh-48px)] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-4xl bg-surface p-6 text-foreground shadow-[var(--shadow-float)] motion-safe:duration-200 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title ref={heading} tabIndex={-1} style={NO_RING} className={cn(HEADING, PROSE, "px-0.5")}>
              {keepHyphens(title)}
            </DialogPrimitive.Title>
            {children}
            <DialogPrimitive.Close className={CLOSE}>Close</DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-sheet="sheet"
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        onClickCapture={dropEarlyClick}
        onHandleDismiss={() => onOpenChange(false)}
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-0"
      >
        <SheetTitle ref={heading} tabIndex={-1} style={NO_RING} className={cn(HEADING, PROSE, "mt-px px-0.5")}>
          {keepHyphens(title)}
        </SheetTitle>
        {children}
        <SheetClose className={CLOSE}>Close</SheetClose>
      </SheetContent>
    </Sheet>
  );
}
