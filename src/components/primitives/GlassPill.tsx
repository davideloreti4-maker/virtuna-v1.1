"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties, type HTMLAttributes } from "react";

/**
 * Accepted for API back-compat only. Flat-warm renders EVERY pill as a neutral
 * cream chip — the design system has ONE accent (terracotta, liveness-only) and
 * no rainbow chrome (DESIGN-SYSTEM.md). Categorical meaning comes from the label
 * (and any sibling dot indicator), never from the pill's hue.
 */
type PillColor = "purple" | "blue" | "pink" | "cyan" | "green" | "orange";

export interface GlassPillProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  children: ReactNode;
  /** Retained for back-compat; does NOT change the hue (flat-warm = neutral cream). */
  color?: PillColor | "neutral";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Visual style variant — `outline` shows the hairline border at rest. */
  variant?: "subtle" | "solid" | "outline";
  /** Show as selected/active state (cream-prominent). */
  active?: boolean;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Click handler - makes pill interactive */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
}

const sizeMap = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

/**
 * GlassPill — flat-warm MATTE pill/chip for tags, filters, and small actions.
 *
 * NOTE: the name is legacy. This was a Raycast glassmorphic pill (137deg gradient
 * + backdrop-blur + inset white-shine + spectral text). It is now a flat-warm matte
 * chip per DESIGN-SYSTEM.md hard rules: solid charcoal surface, 6%→10% hairline
 * border, cream text, no glass / no blur / no glow / no rainbow. Active = cream-
 * prominent (brighter surface + full-cream text + 10% border), never an accent ring.
 *
 * @example
 * <GlassPill>Tag Label</GlassPill>
 * <GlassPill active onClick={() => selectFilter()}>Selected Filter</GlassPill>
 */
export function GlassPill({
  children,
  color: _color = "neutral",
  size = "md",
  variant = "subtle",
  active = false,
  className,
  style,
  onClick,
  disabled = false,
  ...rest
}: GlassPillProps) {
  const isInteractive = Boolean(onClick) && !disabled;
  const Component = onClick ? "button" : "span";
  // Outline variant shows the border at rest; active always carries one.
  const showBorder = variant === "outline" || active;

  return (
    <Component
      {...(rest as Record<string, unknown>)}
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium",
        "transition-colors duration-200",
        sizeMap[size],
        // Matte cream chip — solid charcoal surface, never glass.
        active ? "bg-white/[0.06] text-foreground" : "bg-white/[0.03] text-foreground-muted",
        showBorder && "border",
        showBorder && (active ? "border-white/[0.10]" : "border-white/[0.06]"),
        // Interactive states
        isInteractive && "cursor-pointer hover:bg-white/[0.05] hover:text-foreground",
        isInteractive && "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={style}
    >
      {children}
    </Component>
  );
}
