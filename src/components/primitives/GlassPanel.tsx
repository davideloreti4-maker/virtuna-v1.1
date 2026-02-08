"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

export interface GlassPanelProps {
  children: ReactNode;
  /** Additional className for layout overrides */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

/**
 * GlassPanel - Raycast-style frosted glass container.
 *
 * Fixed 5px blur, Raycast neutral glass gradient, 12px radius.
 * No configuration needed -- matches Raycast 1:1.
 *
 * Safari-compatible via inline backdrop-filter (bypasses Lightning CSS stripping).
 *
 * @example
 * <GlassPanel>
 *   <h2>Content</h2>
 * </GlassPanel>
 *
 * @example
 * <GlassPanel as="aside" className="p-6">
 *   <nav>Sidebar content</nav>
 * </GlassPanel>
 */
export function GlassPanel({
  children,
  className,
  style,
  as: Component = "div",
}: GlassPanelProps) {
  return (
    <Component
      className={cn(
        "rounded-[12px] border border-white/[0.06]",
        className
      )}
      style={{
        background:
          "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
