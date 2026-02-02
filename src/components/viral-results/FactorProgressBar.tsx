"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FactorProgressBar - Animated progress bar with score-based color coding
 *
 * Features:
 * - Visual fill animation on mount
 * - Score-based color gradient (green to red)
 * - Size variants (sm/md)
 * - Respects prefers-reduced-motion
 * - Stagger delay support for list animations
 */

export interface FactorProgressBarProps {
  /** Score value (typically 1-10) */
  score: number;
  /** Maximum score (typically 10) */
  maxScore: number;
  /** Enable fill animation on mount */
  animated?: boolean;
  /** Animation delay in ms (for stagger effect) */
  delay?: number;
  /** Height variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get color class based on score percentage
 * Green (high) to Red (low) gradient
 */
function getColorClass(percentage: number): string {
  if (percentage >= 80) return "bg-emerald-400";
  if (percentage >= 60) return "bg-lime-400";
  if (percentage >= 40) return "bg-yellow-400";
  if (percentage >= 20) return "bg-orange-400";
  return "bg-red-400";
}

/**
 * Get text color class matching progress bar color
 * Useful for score displays
 */
export function getScoreColorClass(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return "text-emerald-400";
  if (percentage >= 60) return "text-lime-400";
  if (percentage >= 40) return "text-yellow-400";
  if (percentage >= 20) return "text-orange-400";
  return "text-red-400";
}

export function FactorProgressBar({
  score,
  maxScore,
  animated = true,
  delay = 0,
  size = "sm",
  className,
}: FactorProgressBarProps) {
  const [mounted, setMounted] = React.useState(false);

  // Trigger animation after mount
  React.useEffect(() => {
    if (animated) {
      // Small delay to ensure CSS transition is applied
      const timer = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setMounted(true);
    }
  }, [animated]);

  // Calculate percentage, clamped to 0-100
  const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));

  // Determine height based on size variant
  const heightClass = size === "sm" ? "h-1" : "h-1.5";

  // Get color based on percentage
  const colorClass = getColorClass(percentage);

  // Width for animation: start at 0, animate to final percentage
  const width = animated && !mounted ? 0 : percentage;

  return (
    <div
      className={cn(
        "relative w-full rounded-full overflow-hidden",
        heightClass,
        "bg-white/10",
        className
      )}
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={maxScore}
      aria-label={`Score: ${score} out of ${maxScore}`}
    >
      <div
        className={cn(
          "absolute left-0 top-0 h-full rounded-full",
          colorClass,
          // Animation: smooth transition for motion-safe users
          "motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
          // Instant fill for reduced motion
          "motion-reduce:transition-none"
        )}
        style={{
          width: `${width}%`,
          transitionDelay: animated && delay > 0 ? `${delay}ms` : undefined,
        }}
      />
    </div>
  );
}

export default FactorProgressBar;
