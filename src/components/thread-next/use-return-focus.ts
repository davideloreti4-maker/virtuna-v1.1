"use client";

import { useRef } from "react";

/** A layer opened from a plain button (not a Radix trigger) has nothing to hand focus back to.
 *  Remember what had focus when it opened and return there on close, unless something already
 *  took focus, the close came from a pointer outside (popover only), or `handOn()` was called
 *  (the layer opened another one). If what had focus has left the page, or nothing had focus
 *  (the page itself), `fallback` is focused.
 *
 *  The popover skips the return after a pointer outside, as Radix's non-modal popover does (focus
 *  stays where that tap left it); the sheet, a modal dialog, returns focus either way, as Radix's
 *  dialog does. Lifted from the More sheet (final review 5), behaviour unchanged there: More
 *  passes no fallback, and focusing the page was already a no-op. */
export function useReturnFocus(fallback?: () => HTMLElement | null): {
  sheetFocus: { onOpenAutoFocus(): void; onCloseAutoFocus(e: Event): void };
  popoverFocus: { onOpenAutoFocus(): void; onCloseAutoFocus(e: Event): void; onPointerDownOutside(): void };
  handOn(): void;
} {
  const returnTo = useRef<HTMLElement | null>(null);
  const closedFromOutside = useRef(false);
  const handedOn = useRef(false);
  const handOn = () => {
    handedOn.current = true;
  };
  const sheetFocus = {
    onOpenAutoFocus: () => {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closedFromOutside.current = false;
      handedOn.current = false;
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      const active = document.activeElement;
      if (!closedFromOutside.current && !handedOn.current && (!active || active === document.body)) {
        const target = returnTo.current;
        if (target && target !== document.body && target.isConnected) target.focus();
        else fallback?.()?.focus();
      }
      closedFromOutside.current = false;
      handedOn.current = false;
    },
  };
  const popoverFocus = {
    ...sheetFocus,
    onPointerDownOutside: () => {
      closedFromOutside.current = true;
    },
  };
  return { sheetFocus, popoverFocus, handOn };
}
