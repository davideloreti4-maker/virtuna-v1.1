import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-foreground-muted/10 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
