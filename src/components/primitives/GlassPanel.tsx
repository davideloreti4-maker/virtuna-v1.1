"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

export interface GlassPanelProps {
  children: ReactNode;
  /** Blur intensity: sm (8px), md (12px), lg (20px) */
  blur?: "sm" | "md" | "lg";
  /** Background opacity 0-1, default 0.6 */
  opacity?: number;
  /** Show border glow effect */
  borderGlow?: boolean;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

/**
 * GlassPanel - Glassmorphism container with configurable blur and opacity.
 *
 * Safari-compatible: Uses both backdrop-filter and -webkit-backdrop-filter.
 * Mobile-optimized: Blur is reduced on mobile per performance constraints.
 *
 * @example
 * <GlassPanel blur="md" opacity={0.7} borderGlow>
 *   <h2>Premium Content</h2>
 * </GlassPanel>
 */
export function GlassPanel({
  children,
  blur = "md",
  opacity = 0.6,
  borderGlow = false,
  className,
  style,
  as: Component = "div",
}: GlassPanelProps) {
  // Map blur prop to CSS class (uses globals.css glass-blur-* classes)
  const blurClass = {
    sm: "glass-blur-sm",
    md: "glass-blur-md",
    lg: "glass-blur-lg",
  }[blur];

  return (
    <Component
      className={cn(
        // Base glass styling
        "glass-base",
        blurClass,
        // Shadows for depth
        "shadow-glass",
        // Border glow variant
        borderGlow && "ring-1 ring-white/5",
        // Rounded corners
        "rounded-xl",
        className
      )}
      style={{
        // Dynamic opacity via inline style (CSS variable fallback)
        backgroundColor: `oklch(0.18 0.02 264 / ${opacity})`,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
