import { type CSSProperties, type ReactNode } from "react";

import { tv } from "tailwind-variants";

import { cn } from "@/lib/utils";

/**
 * Surface — the DEFAULT hairline-border container of the Numen kit.
 *
 * A plain `<div>` (no glass, no blur) with a warm hairline border
 * (`border-border`), `bg-panel` fill, 12px radius, and a SOFT low-opacity
 * elevation shadow — NOT the Raycast `rgba(255,255,255,0.15) inset` glow (D-07).
 *
 * This is what cards and panels use; reserve `<Glass>` for the rare
 * composer / tool-sheet surfaces.
 *
 * Built on a `tailwind-variants` slot (D-08) so callers can extend predictably;
 * the caller `className` is still merged through `cn()` so external overrides win.
 */
export const surface = tv({
  base: "rounded-[12px] border border-border bg-panel shadow-[0_1px_2px_0_rgba(0,0,0,0.24),0_2px_8px_-2px_rgba(0,0,0,0.20)]",
});

export interface SurfaceProps {
  children?: ReactNode;
  /** Additional className for layout overrides */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

export function Surface({
  children,
  className,
  style,
  as: Component = "div",
}: SurfaceProps) {
  return (
    <Component className={cn(surface(), className)} style={style}>
      {children}
    </Component>
  );
}
