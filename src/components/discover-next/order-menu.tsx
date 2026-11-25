"use client";

import * as React from "react";
import { useRef, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DISCOVER_ORDERS, type DiscoverOrder } from "@/lib/discover-next/discover-view";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";

import { ChevronDownIcon } from "./discover-icons";

/**
 * The order on a desk (spec 3.2; the desktop drawing's "Most viewed ⌄"): a button with the order in
 * words, and a menu of the three orders, the current one checked. A choice applies at once and closes
 * the menu; the focus goes back to the button. Arrow keys, Home and End move through the choices.
 * (On a phone the order is chosen in the filter's sheet.) Presentational.
 */

export interface OrderMenuProps {
  order: DiscoverOrder;
  onOrder(next: DiscoverOrder): void;
}


const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-ui font-[560] text-foreground transition-colors duration-150 hover:bg-hover aria-checked:bg-active";

export function OrderMenu({ order, onOrder }: OrderMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const itemsRef = useRef<HTMLDivElement>(null);
  const items = () => Array.from(itemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);

  const move = (e: React.KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === "ArrowDown" ? (at + 1) % all.length
      : e.key === "ArrowUp" ? (at - 1 + all.length) % all.length
      : e.key === "Home" ? 0
      : e.key === "End" ? all.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    all[to]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Chip aria-haspopup="menu" className="gap-1 pr-3">
          {DISCOVER_STRINGS.orders[order]}
          <ChevronDownIcon size={16} aria-hidden className="text-foreground-secondary" />
        </Chip>
      </PopoverTrigger>
      <PopoverContent
        role="menu"
        aria-label={DISCOVER_STRINGS.filter.order}
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          items().find((item) => item.getAttribute("aria-checked") === "true")?.focus();
        }}
        onKeyDown={move}
        className="z-[var(--z-modal)] w-[200px] rounded-3xl border-0 bg-surface p-1.5 text-foreground shadow-[var(--shadow-float)]!"
      >
        <div ref={itemsRef} className="flex flex-col gap-0.5">
          {DISCOVER_ORDERS.map((o) => (
            <button
              key={o}
              type="button"
              role="menuitemradio"
              aria-checked={order === o}
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                if (o !== order) onOrder(o);
              }}
              className={ITEM}
            >
              {DISCOVER_STRINGS.orders[o]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
