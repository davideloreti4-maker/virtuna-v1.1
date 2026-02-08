"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

/** Available gradient colors for pills */
type PillColor = "purple" | "blue" | "pink" | "cyan" | "green" | "orange";

export interface GlassPillProps {
  children: ReactNode;
  /** Color theme for the pill */
  color?: PillColor | "neutral";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Visual style variant */
  variant?: "subtle" | "solid" | "outline";
  /** Show as selected/active state */
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

// Color values for pills
const colorValues: Record<PillColor | "neutral", { bg: string; border: string; text: string }> = {
  neutral: {
    bg: "oklch(0.25 0.02 264 / 0.5)",
    border: "oklch(1 0 0 / 0.1)",
    text: "text-white/80",
  },
  purple: {
    bg: "oklch(0.63 0.24 300 / 0.15)",
    border: "oklch(0.63 0.24 300 / 0.3)",
    text: "text-purple-300",
  },
  blue: {
    bg: "oklch(0.62 0.19 250 / 0.15)",
    border: "oklch(0.62 0.19 250 / 0.3)",
    text: "text-blue-300",
  },
  pink: {
    bg: "oklch(0.66 0.22 350 / 0.15)",
    border: "oklch(0.66 0.22 350 / 0.3)",
    text: "text-pink-300",
  },
  cyan: {
    bg: "oklch(0.72 0.15 200 / 0.15)",
    border: "oklch(0.72 0.15 200 / 0.3)",
    text: "text-cyan-300",
  },
  green: {
    bg: "oklch(0.68 0.17 145 / 0.15)",
    border: "oklch(0.68 0.17 145 / 0.3)",
    text: "text-green-300",
  },
  orange: {
    bg: "oklch(0.70 0.18 50 / 0.15)",
    border: "oklch(0.70 0.18 50 / 0.3)",
    text: "text-orange-300",
  },
};

const sizeMap = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
};

/**
 * GlassPill - Glassmorphic pill/chip component for tags, filters, and small actions.
 *
 * @example
 * // Neutral pill
 * <GlassPill>Tag Label</GlassPill>
 *
 * @example
 * // Colored pill with click handler
 * <GlassPill color="purple" onClick={() => selectFilter()}>
 *   AI Analysis
 * </GlassPill>
 *
 * @example
 * // Active filter pill
 * <GlassPill color="blue" active>
 *   Selected Filter
 * </GlassPill>
 */
export function GlassPill({
  children,
  color = "neutral",
  size = "md",
  variant = "subtle",
  active = false,
  className,
  style,
  onClick,
  disabled = false,
}: GlassPillProps) {
  const isInteractive = Boolean(onClick) && !disabled;
  const colorConfig = colorValues[color];

  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center rounded-full font-medium",
        "backdrop-blur-sm transition-all duration-200",
        sizeMap[size],
        // Text color
        colorConfig.text,
        // Interactive states
        isInteractive && "cursor-pointer hover:scale-105 active:scale-95",
        // Active state
        active && "ring-1",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        backgroundColor: active
          ? colorConfig.bg.replace("0.15", "0.3")
          : colorConfig.bg,
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: colorConfig.border,
        // Active ring color
        ...(active && { "--tw-ring-color": colorConfig.border } as CSSProperties),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
