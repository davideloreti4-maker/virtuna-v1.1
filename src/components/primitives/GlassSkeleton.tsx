import { cn } from "@/lib/utils";

export type SkeletonShape = "rectangle" | "circle" | "text";

export interface GlassSkeletonProps {
  width?: string | number;
  height?: string | number;
  shape?: SkeletonShape;
  className?: string;
}

/** Skeleton loading placeholder with glass styling. */
export function GlassSkeleton({
  width,
  height = 16,
  shape = "text",
  className,
}: GlassSkeletonProps): React.ReactNode {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.05]",
        shape === "circle" && "rounded-full",
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }): React.ReactNode {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <GlassSkeleton key={i} width="100%" height={14} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }): React.ReactNode {
  return <GlassSkeleton width="100%" height={120} shape="rectangle" className={className} />;
}
