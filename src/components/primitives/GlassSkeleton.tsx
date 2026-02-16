"use client";

import { cn } from "@/lib/utils";

export interface GlassSkeletonProps {
  width?: string | number;
  height?: string | number;
  shape?: "rectangle" | "circle";
  className?: string;
}

export type SkeletonShape = "rectangle" | "circle";

export function GlassSkeleton({
  width,
  height,
  shape = "rectangle",
  className,
}: GlassSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-white/[0.06]",
        shape === "circle" ? "rounded-full" : "rounded-md",
        className
      )}
      style={{ width, height }}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <GlassSkeleton
          key={i}
          height="12px"
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] p-4", className)}>
      <GlassSkeleton height="14px" width="40%" />
      <SkeletonText lines={2} className="mt-3" />
    </div>
  );
}
