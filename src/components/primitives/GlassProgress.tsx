"use client";

import { cn } from "@/lib/utils";

export type ProgressSize = "sm" | "md" | "lg";
export type ProgressVariant = "coral" | "blue" | "purple" | "default";

export interface GlassProgressProps {
  value: number;
  color?: ProgressVariant;
  size?: ProgressSize;
  className?: string;
}

const colorMap: Record<ProgressVariant, string> = {
  coral: "bg-accent",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  default: "bg-white/20",
};

const sizeMap: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function GlassProgress({
  value,
  color = "default",
  size = "md",
  className,
}: GlassProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-white/[0.06]",
        sizeMap[size],
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          colorMap[color]
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
