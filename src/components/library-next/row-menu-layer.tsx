"use client";

import * as React from "react";
import { useId } from "react";

import { CloseIcon } from "@/components/thread-next/field-icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { DotsIcon } from "./library-icons";

/**
 * The layer a row's More stands on, shared by Library's chat rows (`RowMenu`, whose header tells
 * the rules) and You's account rows (`AccountMenu`): the three-dot button, and on a phone a small
 * bottom sheet named for the row, from 768 a menu standing on the button. It holds no action: the
 * rows it shows are its children, built from `MenuRow`, `MENU_ITEM` and `MENU_PILL`.
 *
 * - More: three dots, 24 drawn on the phone (38 from 768), 44 to tap on touch. A tap focuses it
 *   (Safari does not). On a desk with a mouse it waits for its row's hover or focus (`group/row`),
 *   unless `waitsForRow` is false.
 * - Focus: on opening, `firstRef`. Every close hands it back to More (Radix's trigger does not do it
 *   for us: the layer swaps its content, and More may have left with its row), unless something
 *   already took it. The layers carry `data-row-menu`: a list counts a focus in them as still the row's.
 * - The layers are portalled. The desk's menu is modal, as a menu is: a tap outside only closes it,
 *   it does not go through to another row.
 * - The phone's sheet stands on its bottom edge, the desk's menu on its top edge (on its bottom edge
 *   when it opens above More). Library's steps are all three rows of one shape, so a second tap lands
 *   where the step before had its own row, from either edge. A user whose steps differ in length
 *   cannot promise that by position: You's confirming Disconnect waits instead (`account-menu.tsx`).
 */

/** The width from which the layer is a menu standing on More (Tailwind's `md`). */
const DESK = "(min-width: 768px)";

const TRIGGER = cn(
  // 24 drawn on the phone, so the title keeps its room; `tap-44` keeps a 44 tap area on touch.
  "tap-44 flex size-6 shrink-0 items-center justify-center rounded-full text-foreground-secondary md:size-[38px]",
  // On the phone More sits 4 from the card's edge (pulled into its padding): the keyboard ring is
  // drawn inside it there, not 2 outside, so it stays inside the card. `!`: the app-wide ring is
  // unlayered CSS and beats a plain utility (as `SHELL_FOCUS`).
  "max-md:focus-visible:outline-offset-[-2px]!",
  "transition-[color,background-color,opacity] duration-150 hover:bg-hover hover:text-foreground aria-expanded:bg-active aria-expanded:text-foreground",
);
/** From 768 with a mouse it waits for the row: hidden, and not pressable while hidden. */
const TRIGGER_WAITS = cn(
  "md:pointer-fine:pointer-events-none md:pointer-fine:opacity-0",
  "md:pointer-fine:group-hover/row:pointer-events-auto md:pointer-fine:group-hover/row:opacity-100",
  "md:pointer-fine:group-focus-within/row:pointer-events-auto md:pointer-fine:group-focus-within/row:opacity-100",
  "md:pointer-fine:aria-expanded:pointer-events-auto md:pointer-fine:aria-expanded:opacity-100",
);

/** One row of every step, one shape: a step's rows sit where the step before had its own. */
const ROW = "flex min-h-[52px] items-center md:min-h-11";
/** A menu item: the whole row, its mark and its word. */
export const MENU_ITEM =
  "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-left text-ui font-[560] text-foreground transition-colors duration-150 hover:bg-hover md:min-h-11";
/** A step's pill (the field, Save, the confirming Delete), inside its row. */
export const MENU_PILL = "flex h-11 w-full items-center justify-center rounded-full text-ui font-[600] md:h-10";

export function MenuRow({ children }: { children: React.ReactNode }) {
  return (
    <div data-part="menu-row" className={ROW}>
      {children}
    </div>
  );
}

export interface RowMenuLayerProps {
  /** Names More ("More: {name}"). */
  name: string;
  /** The layer's header (and its name): the row's name, or a step's own words. */
  heading: React.ReactNode;
  open: boolean;
  onOpenChange(next: boolean): void;
  /** The header's cross. */
  onClose(): void;
  /** Takes the focus when the layer opens. */
  firstRef: React.RefObject<HTMLElement | null>;
  /** More itself. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Hairlines between the rows (a menu); a step's pill has none. Their 1 px stays, unseen. */
  divided: boolean;
  /** A step whose first row is two lines: the desk header is 36, not 44, so the rows below keep their places. */
  shortHeader?: boolean;
  /** From 768 with a mouse, More waits for its row's hover or focus (`group/row`). Default true. */
  waitsForRow?: boolean;
  /**
   * More drawn by the caller, in place of the three dots: the element returned is the trigger. It holds
   * `ref` (the layer's `triggerRef`) and names itself. A tap focuses it, as it does the dots.
   */
  renderTrigger?: (ref: React.RefObject<HTMLButtonElement | null>) => React.ReactElement;
  children: React.ReactNode;
}

export function RowMenuLayer({
  name,
  heading,
  open,
  onOpenChange,
  onClose,
  firstRef,
  triggerRef,
  divided,
  shortHeader = false,
  waitsForRow = true,
  renderTrigger,
  children,
}: RowMenuLayerProps): React.JSX.Element {
  const wide = useMediaQuery(DESK);
  const titleId = useId();

  const focus = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault();
      firstRef.current?.focus();
    },
    // Back to More once the layer is gone, unless something already took the focus (the list,
    // handing it on after a delete). More may have left with its row: then nothing here.
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    },
  };

  const body = (headingAs: (children: React.ReactNode) => React.ReactNode) => (
    <>
      {/* On a desk a step whose first row is two lines (Library's delete step) has a header of 36,
          not 44: that row is 52 (the line under the question), and the rows below stand where they
          stood. */}
      <div className={cn("mt-1 flex h-11 items-center justify-between gap-3 px-2", shortHeader && "md:h-9")}>
        {headingAs(heading)}
        <IconButton surface="card" aria-label="Close" onClick={onClose} className="h-8 w-8 [&_svg]:size-[15px]">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>
      {/* The hairlines are the menu's (rows of one kind); a step's pill has none above or below it.
          Their 1 px stays, unseen, so every step keeps its height. */}
      <div className={cn("max-md:divide-y", divided ? "max-md:divide-border" : "max-md:divide-transparent")}>{children}</div>
    </>
  );

  // The ref is handed on for the caller's button to hold (`ref={ref}`), as the dots below hold it; it is
  // not read while rendering.
  // eslint-disable-next-line react-hooks/refs
  const own = renderTrigger?.(triggerRef);
  const trigger = own ?? (
    <button
      ref={triggerRef}
      type="button"
      aria-label={`More: ${name}`}
      // Safari does not focus a button on a tap: focused here, so the list knows which row the menu
      // is for, and the focus has a place to come back to.
      onClick={(e) => e.currentTarget.focus()}
      className={cn(TRIGGER, waitsForRow && TRIGGER_WAITS)}
    >
      <DotsIcon size={18} aria-hidden />
    </button>
  );
  // The caller's own More is focused on a tap as the dots are: the trigger part hands it this click
  // before it opens the layer.
  const focusOnTap = renderTrigger ? { onClick: (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.focus() } : {};

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverTrigger asChild {...focusOnTap}>
          {trigger}
        </PopoverTrigger>
        {/* The shared primitive's panel names `bg-popover` and `shadow-md`; given the new look's
            surface and shadow here (`!`: cn() keeps `shadow-md` beside an arbitrary shadow, as the
            sidebar's account menu found). */}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-labelledby={titleId}
          data-row-menu=""
          {...focus}
          className="z-[var(--z-modal)] w-[264px] max-w-[calc(100vw-24px)] rounded-3xl border-0 bg-surface p-0 px-2 pb-2 text-foreground shadow-[var(--shadow-float)]!"
        >
          {body((children) => (
            <h2 id={titleId} className="min-w-0 truncate text-ui font-[640] text-foreground">
              {children}
            </h2>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild {...focusOnTap}>
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        data-row-menu=""
        {...focus}
        className="gap-0 px-4 pb-[max(34px,env(safe-area-inset-bottom))]"
      >
        {body((children) => <SheetTitle className="min-w-0 truncate text-title font-[640]">{children}</SheetTitle>)}
      </SheetContent>
    </Sheet>
  );
}
