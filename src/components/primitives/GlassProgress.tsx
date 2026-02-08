import { cn } from "@/lib/utils";

export type ProgressSize = "sm" | "md" | "lg";
export type ProgressVariant = "default" | "coral" | "blue" | "purple" | "green";

export interface GlassProgressProps {
  value: number;
  size?: ProgressSize;
  color?: ProgressVariant;
  className?: string;
}

const sizeMap: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const colorMap: Record<ProgressVariant, string> = {
  default: "bg-foreground-secondary",
  coral: "bg-accent",
  blue: "bg-info",
  purple: "bg-[oklch(0.63_0.24_300)]",
  green: "bg-success",
};

/** Progress bar with glass styling. */
export function GlassProgress({
  value,
  size = "md",
  color = "default",
  className,
}: GlassProgressProps): React.ReactNode {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-white/[0.05]",
        sizeMap[size],
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", colorMap[color])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
