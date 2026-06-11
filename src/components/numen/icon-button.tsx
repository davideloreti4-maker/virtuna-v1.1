"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

/**
 * IconButton — the circular icon button of the Numen kit.
 *
 * Built on `tailwind-variants` (D-08, not cva) and composed through `cn()`.
 * Enforces a 44px minimum hit area (`min-h-[44px] min-w-[44px]`) even when the
 * Lucide icon inside is smaller — touch-target floor copied from `ui/button.tsx`,
 * inverted from `rounded-md` to `rounded-full`.
 *
 * Warm-neutral resting fill (transparent), icon resting at `text-text-muted`,
 * accent focus ring, `disabled:opacity-50`. NO glass, NO glow (D-07). Icons are
 * Lucide only (D-09) — do not use the Phosphor `ui/icon.tsx` wrapper.
 */
export const iconButton = tv({
  base: "inline-flex items-center justify-center rounded-full min-h-[44px] min-w-[44px] text-text-muted bg-transparent transition-colors hover:bg-panel hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
});

export type IconButtonVariants = VariantProps<typeof iconButton>;

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    IconButtonVariants {
  /** The Lucide icon node to render (required for a meaningful control) */
  children: ReactNode;
  /** Accessible label — icon-only buttons MUST name themselves */
  "aria-label": string;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
  return (
    <button type="button" className={cn(iconButton(), className)} {...props}>
      {children}
    </button>
  );
}
