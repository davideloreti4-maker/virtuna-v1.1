"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DISCOVER_ORDERS, DISCOVER_PLATFORMS, type DiscoverOrder, type DiscoverPlatform } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS, showVideos } from "@/lib/discover-next/discover-words";
import type { NicheOption } from "@/lib/discover-next/niches";

import { useWide } from "./use-wide";

/**
 * The filter (spec 3.2; drawing frame 2): Niche, Platform and Order as rows of chips, and "Show N
 * videos". One body, two stands: on a phone a bottom sheet (opened from the mark at the field's end),
 * from 768 a menu standing on the Filter button (modal, as a row's menu in Library). Presentational:
 * the container counts and applies.
 *
 * - What is tapped is held as a choice until "Show N videos", which counts that choice and applies it.
 *   A choice that would show nothing waits ("Show 0 videos", `aria-disabled`): it cannot be applied.
 * - The body, and so its count (a search over the whole library), is drawn only while the panel is:
 *   the hub renders on every key, and a closed panel counts nothing.
 *   Closed any other way, nothing changes, and the next opening starts from what is applied.
 * - Focus: on the first chip when it opens; back to what opened it when it closes.
 */

export interface FilterChoice {
  niche: string | null;
  platform: DiscoverPlatform | null;
  order: DiscoverOrder;
}

export interface FilterPanelProps {
  open: boolean;
  onOpenChange(next: boolean): void;
  /** The desk's Filter button: from 768 the menu stands on it (and it opens and closes it). */
  anchor: React.ReactElement;
  /** The niches that have videos, most first. */
  niches: readonly NicheOption[];
  /** What is applied now: the choice each opening starts from. */
  applied: FilterChoice;
  /** How many videos a choice would show. */
  countOf(choice: FilterChoice): number;
  onApply(choice: FilterChoice): void;
  /** Where the focus goes back when it closes: what opened it. */
  returnFocus(): HTMLElement | null;
}



const TITLE = "text-subhead font-[640] tracking-[-0.018em] text-foreground";

/** One group of chips, named by its label. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="mt-4">
      <p id={id} className="mb-2 text-meta text-foreground-secondary">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Body({
  choice,
  onChoice,
  niches,
  countOf,
  onShow,
  firstRef,
}: {
  choice: FilterChoice;
  onChoice(next: FilterChoice): void;
  niches: readonly NicheOption[];
  countOf(choice: FilterChoice): number;
  onShow(): void;
  firstRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const S = DISCOVER_STRINGS;
  const count = countOf(choice);
  const none = count === 0;
  return (
    <>
      <Group label={S.filter.niche}>
        <Chip ref={firstRef} surface="card" selected={choice.niche === null} onClick={() => onChoice({ ...choice, niche: null })}>
          {S.filter.all}
        </Chip>
        {niches.map((n) => (
          <Chip key={n.key} surface="card" selected={choice.niche === n.key} onClick={() => onChoice({ ...choice, niche: n.key })}>
            {n.label}
          </Chip>
        ))}
      </Group>
      <Group label={S.filter.platform}>
        <Chip surface="card" selected={choice.platform === null} onClick={() => onChoice({ ...choice, platform: null })}>
          {S.filter.all}
        </Chip>
        {DISCOVER_PLATFORMS.map((p) => (
          <Chip key={p} surface="card" selected={choice.platform === p} onClick={() => onChoice({ ...choice, platform: p })}>
            {S.platforms[p]}
          </Chip>
        ))}
      </Group>
      <Group label={S.filter.order}>
        {DISCOVER_ORDERS.map((o) => (
          <Chip key={o} surface="card" selected={choice.order === o} onClick={() => onChoice({ ...choice, order: o })}>
            {S.orders[o]}
          </Chip>
        ))}
      </Group>
      {/* `aria-disabled`, not `disabled`: the button keeps the focus, and says why it waits. */}
      <Button
        type="button"
        variant="primary"
        size="lg"
        aria-disabled={none || undefined}
        onClick={() => {
          if (!none) onShow();
        }}
        className="mt-6 w-full tabular-nums next:rounded-full aria-disabled:cursor-default aria-disabled:opacity-40"
      >
        {showVideos(count)}
      </Button>
    </>
  );
}

export function FilterPanel({ open, onOpenChange, anchor, niches, applied, countOf, onApply, returnFocus }: FilterPanelProps): React.JSX.Element {
  const wide = useWide();
  const titleId = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  // The choice held until "Show N videos"; each opening starts again from what is applied.
  const [choice, setChoice] = useState(applied);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChoice(applied);
  }

  const show = () => {
    onApply(choice);
    onOpenChange(false);
  };

  const focus = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault();
      firstRef.current?.focus();
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      const back = returnFocus();
      if (back?.isConnected) back.focus();
    },
  };

  // An element, not yet drawn: the sheet and the menu draw their content only while open.
  const body = <Body choice={choice} onChoice={setChoice} niches={niches} countOf={countOf} onShow={show} firstRef={firstRef} />;

  if (wide) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} modal>
        <PopoverTrigger asChild>{anchor}</PopoverTrigger>
        {/* The shared primitive's panel names `bg-popover` and `shadow-md`: given the new look's surface
            and shadow here (`!`: cn() keeps `shadow-md` beside an arbitrary shadow). */}
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
          {...focus}
          className="z-[var(--z-modal)] max-h-[min(640px,var(--radix-popover-content-available-height))] w-[380px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-3xl border-0 bg-surface p-5 text-foreground shadow-[var(--shadow-float)]!"
        >
          <h2 id={titleId} className={TITLE}>
            {DISCOVER_STRINGS.filter.title}
          </h2>
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {anchor}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          onHandleDismiss={() => onOpenChange(false)}
          {...focus}
          className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-0"
        >
          <SheetTitle className={`${TITLE} mt-1`}>{DISCOVER_STRINGS.filter.title}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    </>
  );
}
