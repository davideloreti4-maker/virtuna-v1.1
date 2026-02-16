"use client";

import { cn } from "@/lib/utils";

export type ProgressSize = "sm" | "md" | "lg";
export type ProgressVariant = "default" | "accent";

export interface GlassProgressProps {
  value: number;
  max?: number;
  size?: ProgressSize;
  variant?: ProgressVariant;
  className?: string;
}

const sizeStyles: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function GlassProgress({
  value,
  max = 100,
  size = "md",
  variant = "default",
  className,
}: GlassProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn(
        "w-full rounded-full bg-white/10 overflow-hidden",
        sizeStyles[size],
        className
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          variant === "accent" ? "bg-accent" : "bg-white/30"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
