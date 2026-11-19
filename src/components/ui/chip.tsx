"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Give it for a filter or a choice; leave it out for a plain action ("3 more"). */
  selected?: boolean;
  /** "ground": on the page, 36 tall. "card": a quiet next step under a card, 32 tall. */
  surface?: "ground" | "card";
}

/**
 * Chip (new look, spec §7): a pill, 14px at weight 560. On the ground it is a white pill with
 * the hairline; selected it takes the action fill. Under a card it is a tint.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, surface = "ground", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
        "text-reading font-[560] leading-none text-foreground",
        "duration-150 transition-[color,background-color,box-shadow,scale] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
        surface === "card" ? "h-8 px-3" : "h-9 px-3.5",
        selected
          ? "bg-action text-action-foreground"
          : surface === "card"
            ? "bg-surface-sunken hover:bg-active"
            : "bg-surface shadow-[var(--shadow-press)]",
        className,
      )}
      {...props}
    />
  ),
);
Chip.displayName = "Chip";
