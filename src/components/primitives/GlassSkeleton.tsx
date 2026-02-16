"use client";

import { cn } from "@/lib/utils";

export type SkeletonShape = "rectangle" | "circle" | "text";

export interface GlassSkeletonProps {
  shape?: SkeletonShape;
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function GlassSkeleton({
  shape = "rectangle",
  width,
  height,
  className,
}: GlassSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-white/[0.06]",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <GlassSkeleton height={12} className="w-full" />
      <GlassSkeleton height={12} className="w-3/4" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-white/[0.06] p-6 space-y-4",
        className
      )}
    >
      <GlassSkeleton height={16} className="w-1/3" />
      <SkeletonText />
    </div>
  );
}
