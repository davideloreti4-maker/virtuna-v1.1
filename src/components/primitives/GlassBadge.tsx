"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

/** Badge color variants */
export type BadgeVariant =
  | "neutral"
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "red"
  | "pink"
  | "cyan";

/** Badge size */
export type BadgeSize = "sm" | "md";

export interface GlassBadgeProps {
  children: ReactNode;
  /** Color variant — controls text color only; background is always neutral */
  variant?: BadgeVariant;
  /** Size */
  size?: BadgeSize;
  /** Optional leading icon/dot element */
  icon?: ReactNode;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

// Every badge shares the same neutral dark background — no colored tinting
const NEUTRAL_BG = "rgba(255, 255, 255, 0.05)";

// Differentiation is purely via text color
const variantTextClass: Record<BadgeVariant, string> = {
  neutral: "text-white/70",
  blue: "text-blue-400",
  purple: "text-purple-400",
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
  pink: "text-pink-400",
  cyan: "text-cyan-400",
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

/**
 * GlassBadge — Compact label/badge following Raycast design language.
 *
 * Background is always neutral `rgba(255,255,255,0.05)`. Variant differentiation
 * is carried exclusively by the text color — no colored background fills.
 *
 * @example
 * <GlassBadge variant="green">Live</GlassBadge>
 *
 * @example
 * <GlassBadge variant="orange" icon={<DotIcon />}>Pending</GlassBadge>
 */
export function GlassBadge({
  children,
  variant = "neutral",
  size = "md",
  icon,
  className,
  style,
}: GlassBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium",
        "border border-white/[0.06]",
        sizeMap[size],
        variantTextClass[variant],
        className
      )}
      style={{
        backgroundColor: NEUTRAL_BG,
        ...style,
      }}
    >
      {icon && (
        <span className="shrink-0 leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
