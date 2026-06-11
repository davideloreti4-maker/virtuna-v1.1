"use client";

import { type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Glass — the RARE blur-behind primitive of the Numen kit.
 *
 * Glass is reserved for the composer and the tool-sheet ONLY (UI-SPEC §6) — it is
 * not a general card surface. For default panels/cards use `<Surface>` instead.
 *
 * D-05 (Lightning CSS): the blur MUST be applied via a React inline `style`
 * (see below) — the Tailwind utility-class form is STRIPPED in the production
 * build by Lightning CSS (CLAUDE.md known issue). The webkit-prefixed property
 * is included for Safari / iOS PWA. NEVER emit the utility-class form here.
 *
 * Verify the blur actually renders on a DEPLOYED build (Plan 04) — happy-dom and
 * dev builds do not exercise the Lightning CSS pass.
 *
 * Warm-neutral tokens only (`bg-numen-panel/70`, `border-numen-border`) — no Raycast 137deg
 * gradient, no inset glow, no neon/beam/shimmer (D-07).
 */
export interface GlassProps {
  children?: ReactNode;
  /** Blur radius in px applied via the inline blur-behind style. @default 12 */
  blur?: number;
  /** Additional className for layout overrides */
  className?: string;
  /** Custom style overrides (merged after the blur-behind style) */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

export function Glass({
  children,
  blur = 12,
  className,
  style,
  as: Component = "div",
}: GlassProps) {
  return (
    <Component
      className={cn("rounded-[12px] border border-numen-border bg-numen-panel/70", className)}
      style={{
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
