"use client";

import { TrendingUp, Minus, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VelocityIndicatorProps {
  velocity: number;
  className?: string;
}

/**
 * Determines the visual state for a velocity multiplier.
 *
 * Thresholds:
 * - >= 10x: Rising (green) - strong viral growth
 * - >= 5x: Peaking (coral/accent) - sustained momentum
 * - < 5x: Declining (blue) - slowing down
 */
function getVelocityState(velocity: number) {
  if (velocity >= 10) {
    return {
      label: `${velocity.toFixed(0)}x`,
      color: "text-green-400",
      Icon: TrendingUp,
    };
  }
  if (velocity >= 5) {
    return {
      label: `${velocity.toFixed(0)}x`,
      color: "text-accent",
      Icon: Minus,
    };
  }
  return {
    label: `${velocity.toFixed(1)}x`,
    color: "text-blue-400",
    Icon: TrendingDown,
  };
}

/**
 * VelocityIndicator - Displays a color-coded velocity multiplier with icon.
 *
 * Shows how much faster a video is performing compared to the creator's average.
 * Color indicates trend direction: green (rising), coral (peaking), blue (declining).
 *
 * @example
 * ```tsx
 * <VelocityIndicator velocity={42.3} />  // Green: "42x" with up arrow
 * <VelocityIndicator velocity={7.5} />   // Coral: "8x" with minus
 * <VelocityIndicator velocity={2.8} />   // Blue: "2.8x" with down arrow
 * ```
 */
export function VelocityIndicator({ velocity, className }: VelocityIndicatorProps) {
  const { label, color, Icon } = getVelocityState(velocity);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
