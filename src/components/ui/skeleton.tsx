import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Skeleton - Loading placeholder with shimmer animation.
 *
 * Uses a moving gradient highlight (shimmer) instead of simple pulse.
 * Matches the GlassSkeleton pattern for premium loading states.
 *
 * Note: motion-reduce:animate-none is applied via the Tailwind class,
 * which sets `animation: none` and overrides the inline animation style.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md motion-reduce:animate-none",
        className
      )}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s ease-in-out infinite",
      }}
      {...props}
    />
  );
}

export { Skeleton };
