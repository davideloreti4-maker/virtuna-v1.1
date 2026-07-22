import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Skeleton - Loading placeholder with a premium warm shimmer.
 *
 * A narrow, low-alpha cream band glides slowly across a calm warm base (the
 * `.skeleton-shimmer` utility in globals.css) — a focused glide, not the old bright
 * clinical-white wash. Slow enough that a screen of skeletons breathes as one calm
 * system. Matte: cream-tinted, no glow.
 *
 * Reduced-motion: `.skeleton-shimmer` self-guards in CSS (drops to the flat warm
 * base). Moved off the old inline `animation` style precisely so that guard wins —
 * an inline style overrides a Tailwind `motion-reduce:` class, which silently left
 * reduced-motion users still animating.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("skeleton-shimmer rounded-md", className)} {...props} />
  );
}

export { Skeleton };
