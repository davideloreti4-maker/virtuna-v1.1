"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { useReturnFocus } from "@/components/thread-next/use-return-focus";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { useWide } from "./use-wide";

/**
 * The shell of Discover's one-field sheets (Remix on a video's page; Follow and a pulled video use it
 * too): the app's own, as "Posted it?" has it (`posted-next/posted-sheet.tsx`). On a phone the `Sheet`
 * part as a bottom sheet with its handle; from 768 a centred Radix dialog. Presentational: what it holds
 * is the caller's.
 *
 * - The width is read from the store `matchMedia` keeps, so a sheet that mounts open on a desk is the
 *   dialog from its first commit (the shared `useMediaQuery` answers false until after mount).
 * - The focus goes to the first control on open, or to `initialFocus`; on close it returns to what
 *   opened it (a plain button, not a Radix trigger), and when that has left the page, to `returnFocus`.
 * - `busy`: Escape, the scrim and the handle do not close it (an answer must have a sheet to land in).
 * - A hidden Close for a screen reader on a touch screen (no Escape key there; the handle is hidden from
 *   it and the scrim is not a control), shown when the keyboard reaches it.
 */
export interface SheetShellProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  busy?: boolean;
  /** Where the focus goes on close when what opened the sheet has left the page. */
  returnFocus?: () => HTMLElement | null;
  /** What takes the focus on open; else the first control. */
  initialFocus?: () => HTMLElement | null;
  children: React.ReactNode;
}


const TITLE = "text-subhead font-[640] tracking-[-0.018em] text-foreground";

/** "Close", out of sight until the keyboard reaches it. */
const CLOSE =
  "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-4 focus-visible:top-4 focus-visible:z-[1] focus-visible:rounded-full focus-visible:bg-surface-sunken focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-meta focus-visible:font-[560] focus-visible:text-foreground";

export function SheetShell({ open, onOpenChange, title, busy = false, returnFocus, initialFocus, children }: SheetShellProps): React.JSX.Element {
  const wide = useWide();
  const { sheetFocus } = useReturnFocus(returnFocus);

  const change = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };
  const focus = {
    onOpenAutoFocus: (event: Event) => {
      sheetFocus.onOpenAutoFocus();
      const target = initialFocus?.();
      if (!target) return;
      event.preventDefault();
      target.focus();
    },
    onCloseAutoFocus: sheetFocus.onCloseAutoFocus,
  };

  if (wide) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={change}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-sheet-shell="scrim"
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            data-sheet-shell="dialog"
            aria-describedby={undefined}
            {...focus}
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] max-h-[calc(100dvh-48px)] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-4xl bg-surface p-6 text-foreground shadow-[var(--shadow-float)] motion-safe:duration-200 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className={TITLE}>{title}</DialogPrimitive.Title>
            {children}
            <DialogPrimitive.Close className={CLOSE}>Close</DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent
        side="bottom"
        data-sheet-shell="sheet"
        aria-describedby={undefined}
        showCloseButton={false}
        {...focus}
        onHandleDismiss={() => change(false)}
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-0"
      >
        <SheetTitle className={cn(TITLE, "mt-1")}>{title}</SheetTitle>
        {children}
        <SheetClose className={CLOSE}>Close</SheetClose>
      </SheetContent>
    </Sheet>
  );
}
