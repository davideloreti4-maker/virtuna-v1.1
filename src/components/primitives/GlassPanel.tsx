"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

/** Available tint colors for glass panels */
export type GlassTint = "neutral" | "purple" | "blue" | "pink" | "cyan" | "green" | "orange";

export interface GlassPanelProps {
  children: ReactNode;
  /** Blur intensity: sm (8px), md (12px), lg (20px) */
  blur?: "sm" | "md" | "lg";
  /** Background opacity 0-1, default 0.6 */
  opacity?: number;
  /** Show border glow effect */
  borderGlow?: boolean;
  /** Color tint for the glass (matches gradient palette) */
  tint?: GlassTint;
  /** Inner glow color intensity (0 = none, 1 = max) */
  innerGlow?: number;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

// Map tint colors to oklch background values (subtle tinting)
const tintMap: Record<GlassTint, { bg: string; border: string; glow: string }> = {
  neutral: {
    bg: "oklch(0.18 0.02 264",
    border: "oklch(1 0 0 / 0.1)",
    glow: "oklch(1 0 0 / 0.05)",
  },
  purple: {
    bg: "oklch(0.18 0.04 300",
    border: "oklch(0.63 0.24 300 / 0.2)",
    glow: "oklch(0.63 0.24 300 / 0.15)",
  },
  blue: {
    bg: "oklch(0.18 0.04 250",
    border: "oklch(0.62 0.19 250 / 0.2)",
    glow: "oklch(0.62 0.19 250 / 0.15)",
  },
  pink: {
    bg: "oklch(0.18 0.04 350",
    border: "oklch(0.66 0.22 350 / 0.2)",
    glow: "oklch(0.66 0.22 350 / 0.15)",
  },
  cyan: {
    bg: "oklch(0.18 0.04 200",
    border: "oklch(0.72 0.15 200 / 0.2)",
    glow: "oklch(0.72 0.15 200 / 0.15)",
  },
  green: {
    bg: "oklch(0.18 0.04 145",
    border: "oklch(0.68 0.17 145 / 0.2)",
    glow: "oklch(0.68 0.17 145 / 0.15)",
  },
  orange: {
    bg: "oklch(0.18 0.04 50",
    border: "oklch(0.70 0.18 50 / 0.2)",
    glow: "oklch(0.70 0.18 50 / 0.15)",
  },
};

/**
 * GlassPanel - Glassmorphism container with configurable blur, opacity, and color tint.
 *
 * Safari-compatible: Uses both backdrop-filter and -webkit-backdrop-filter.
 * Mobile-optimized: Blur is reduced on mobile per performance constraints.
 *
 * @example
 * // Neutral glass
 * <GlassPanel blur="md" opacity={0.7} borderGlow>
 *   <h2>Premium Content</h2>
 * </GlassPanel>
 *
 * @example
 * // Tinted glass with inner glow (iOS 26 liquid glass style)
 * <GlassPanel tint="purple" innerGlow={0.5} borderGlow>
 *   <h2>AI Feature</h2>
 * </GlassPanel>
 */
export function GlassPanel({
  children,
  blur = "md",
  opacity = 0.6,
  borderGlow = false,
  tint = "neutral",
  innerGlow = 0,
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

  const tintColors = tintMap[tint];

  // Build box-shadow for inner glow effect
  const innerGlowShadow = innerGlow > 0
    ? `inset 0 0 ${20 + innerGlow * 40}px ${tintColors.glow.replace("0.15", String(innerGlow * 0.3))}`
    : undefined;

  return (
    <Component
      className={cn(
        // Base glass styling
        "glass-base",
        blurClass,
        // Shadows for depth
        "shadow-glass",
        // Border glow variant - use tinted border if tint is set
        borderGlow && tint !== "neutral" && "ring-1",
        borderGlow && tint === "neutral" && "ring-1 ring-white/5",
        // Rounded corners
        "rounded-xl",
        className
      )}
      style={{
        // Dynamic opacity and tint via inline style
        backgroundColor: `${tintColors.bg} / ${opacity})`,
        // Tinted border if borderGlow and tint
        ...(borderGlow && tint !== "neutral" && {
          "--tw-ring-color": tintColors.border,
        } as CSSProperties),
        // Inner glow effect
        ...(innerGlowShadow && {
          boxShadow: `var(--shadow-glass), ${innerGlowShadow}`,
        }),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
