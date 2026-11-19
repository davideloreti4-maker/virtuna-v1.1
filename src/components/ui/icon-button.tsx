"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required: an icon button shows no text. */
  "aria-label": string;
  /** "ground": white circle on the page. "card": tint on a card. "quiet": no fill until hovered. */
  surface?: "ground" | "card" | "quiet";
}

/**
 * Icon button (new look, spec §7): a 38px circle with an 18px icon. The button sizes the icon
 * (any child `svg` is drawn at 18px), so callers pass the icon without a size. `.tap-44` grows
 * the hit area to 44px on touch without growing the drawn circle.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, surface = "ground", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "tap-44 inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-foreground [&_svg]:size-[18px]",
        "duration-150 transition-[color,background-color,box-shadow,scale] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
        surface === "ground" && "bg-surface shadow-[var(--shadow-press)]",
        surface === "card" && "bg-surface-sunken hover:bg-active",
        surface === "quiet" && "text-foreground-secondary hover:bg-hover hover:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";
