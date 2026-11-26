"use client";

import * as React from "react";
import { useCallback, useId, useRef } from "react";

import { PlusIcon } from "@/components/shell/icons";
import { CheckIcon } from "@/components/thread-next/answer-icons";
import { ChevronIcon, CloseIcon } from "@/components/thread-next/field-icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { SwitcherChoice } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, pillLabel } from "@/lib/audience-next/audience-words";
import { cn } from "@/lib/utils";

import { Face } from "./face";

/**
 * The switch between a creator's audiences (spec 2026-11-25-audience, 3.5), in Audience's title: a pill with
 * the audience's name and a caret. It opens, on a phone, a bottom sheet; from 768, a menu under the pill at
 * its end edge. Presentational: the container switches.
 *
 *   Audience                               (×)
 *   Whose viewers Maven simulates
 *   (N) @nia.tests                          ✓     the one new chats use is checked
 *       TikTok · 12 videos read
 *   (L) @leo.makes
 *       Another creator · TikTok
 *   (+) New audience                        ›
 *       From an account or a description
 *
 * - The rows are the audience sheet's in the message field (`thread-next/audience-sheet.tsx`): each named
 *   for the audience alone, described by its line, `aria-pressed` on the checked one; here with the face in
 *   front, so the "+" of the last row stands where the faces are.
 * - Focus: on opening, the checked row (else the first), so a keyboard starts where the creator is. Every
 *   close hands it back to the pill, unless something already took it.
 * - The pill shrinks before the heading does: its name is cut on one line, at most 180 wide.
 * - While a switch is on its way (`busy`) the pill says so: `aria-busy`, its name dimmed.
 * - The pill is drawn again under the other layer when the width crosses 768 (and once after the first
 *   frame, before the width is known): one that had the focus keeps it.
 */

const S = AUDIENCE_STRINGS;

/** The width from which the layer is a menu under the pill (Tailwind's `md`). */
const DESK = "(min-width: 768px)";

export interface AudienceSwitcherProps {
  /** The audience on the page: the pill's words. */
  name: string;
  /** The creator's audiences in order; the checked one is the one new chats use. */
  choices: readonly SwitcherChoice[];
  open: boolean;
  onOpenChange(open: boolean): void;
  /** A row. The caller closes the layer. */
  onPick(choice: SwitcherChoice): void;
  /** The last row, New audience. The caller closes the layer. */
  onNew(): void;
  /** A switch on its way: the pill says so. */
  busy?: boolean;
}

/** One shape for every row; the last column holds the check, or New audience's chevron. */
const ROW = "flex min-h-[60px] w-full items-center gap-3 px-1 py-2.5 text-left transition-colors duration-150";
const NAME = "block truncate text-ui font-[560] text-foreground";
const LINE = "block truncate text-meta text-foreground-secondary";
const END = "flex w-5 shrink-0 items-center justify-center";

function ChoiceRow({ choice, onPick }: { choice: SwitcherChoice; onPick(choice: SwitcherChoice): void }) {
  // Named for the audience alone, so "tap @nia.tests" finds it; its line describes it.
  const id = useId();
  const line = choice.line.length > 0;
  return (
    <button
      type="button"
      aria-pressed={choice.selected}
      aria-labelledby={`${id}-name`}
      aria-describedby={line ? `${id}-line` : undefined}
      onClick={() => onPick(choice)}
      className={ROW}
    >
      <Face face={choice.face} size={36} />
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className={NAME}>
          {choice.name}
        </span>
        {line && (
          <span id={`${id}-line`} className={LINE}>
            {choice.line}
          </span>
        )}
      </span>
      <span className={END}>{choice.selected && <CheckIcon data-check="" size={18} aria-hidden className="text-foreground" />}</span>
    </button>
  );
}

function NewRow({ onNew }: { onNew(): void }) {
  const id = useId();
  return (
    <button type="button" aria-labelledby={`${id}-name`} aria-describedby={`${id}-line`} onClick={onNew} className={ROW}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-foreground-secondary">
        <PlusIcon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className={NAME}>
          {S.newAudience}
        </span>
        <span id={`${id}-line`} className={LINE}>
          {S.newAudienceLine}
        </span>
      </span>
      <span className={END}>
        <ChevronIcon size={16} strokeWidth={2.1} aria-hidden className="text-foreground-muted" />
      </span>
    </button>
  );
}

export function AudienceSwitcher({ name, choices, open, onOpenChange, onPick, onNew, busy = false }: AudienceSwitcherProps): React.JSX.Element {
  const wide = useMediaQuery(DESK);
  const titleId = useId();
  const lineId = useId();
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Whether the pill that just left had the focus: the one drawn in its place takes it.
  const pillHadFocus = useRef(false);
  const holdPill = useCallback((node: HTMLButtonElement | null) => {
    if (!node) {
      const old = pillRef.current;
      pillHadFocus.current = old !== null && document.activeElement === old;
      pillRef.current = null;
      return;
    }
    pillRef.current = node;
    if (pillHadFocus.current) {
      pillHadFocus.current = false;
      if (document.activeElement !== node) node.focus();
    }
  }, []);

  const focus = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault();
      const list = listRef.current;
      const checked = list?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      (checked ?? list?.querySelector<HTMLButtonElement>("button"))?.focus();
    },
    // Back to the pill once the layer is gone, unless something already took the focus.
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (pillRef.current?.isConnected) pillRef.current.focus();
    },
  };

  const pill = (
    <button
      ref={holdPill}
      type="button"
      data-audience-pill=""
      aria-label={pillLabel(name)}
      aria-busy={busy || undefined}
      // Safari does not focus a button on a tap: focused here, so the focus has a place to come back to.
      onClick={(e) => e.currentTarget.focus()}
      className={cn(
        "tap-44 inline-flex h-[38px] min-w-0 items-center gap-1.5 rounded-lg bg-surface-sunken pl-3.5 pr-3 text-ui font-[560] text-foreground",
        // Under 360 wide a little padding and gap go, so a ten-letter handle stays whole beside Audience and More.
        "max-[359px]:gap-1 max-[359px]:pl-3 max-[359px]:pr-2.5",
        "transition-colors duration-150 hover:bg-active aria-expanded:bg-active aria-busy:cursor-progress",
      )}
    >
      <span className={cn("min-w-0 max-w-[180px] truncate transition-opacity duration-150", busy && "opacity-50")}>{name}</span>
      <ChevronIcon size={14} strokeWidth={2.2} aria-hidden className="shrink-0 rotate-90 text-foreground-secondary" />
    </button>
  );

  const body = (title: React.ReactNode, line: React.ReactNode) => (
    <>
      <div className="mt-1 flex items-start justify-between gap-3 px-1 pb-1.5 pt-2.5">
        <div className="min-w-0">
          {title}
          {line}
        </div>
        <IconButton surface="card" aria-label={S.close} onClick={() => onOpenChange(false)} className="h-8 w-8 [&_svg]:size-[15px]">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>
      <div ref={listRef} className="divide-y divide-border">
        {choices.map((choice) => (
          <ChoiceRow key={choice.id} choice={choice} onPick={onPick} />
        ))}
        <NewRow onNew={onNew} />
      </div>
    </>
  );

  const TITLE = "text-title font-[640] text-foreground";
  const SUBTITLE = "mt-0.5 text-meta text-foreground-secondary";

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverTrigger asChild>{pill}</PopoverTrigger>
        {/* The shared panel names `bg-popover` and `shadow-md`: given the new look's surface and shadow here
            (`!`: cn() keeps `shadow-md` beside an arbitrary shadow). */}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
          aria-describedby={lineId}
          {...focus}
          className="z-[var(--z-modal)] max-h-[var(--radix-popover-content-available-height)] w-[360px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-4xl border-0 bg-surface p-0 px-4 pb-3 pt-1 text-foreground shadow-[var(--shadow-float)]!"
        >
          {body(
            <h2 id={titleId} className={TITLE}>
              {S.switcherTitle}
            </h2>,
            <p id={lineId} className={SUBTITLE}>
              {S.switcherLine}
            </p>,
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{pill}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        {...focus}
        // Its own scroll: a creator with many audiences can outgrow the screen.
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))]"
      >
        {body(
          <SheetTitle className={TITLE}>{S.switcherTitle}</SheetTitle>,
          <SheetDescription className={SUBTITLE}>{S.switcherLine}</SheetDescription>,
        )}
      </SheetContent>
    </Sheet>
  );
}
