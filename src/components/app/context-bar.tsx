import { cn } from "@/lib/utils";
import { GlassPill } from "@/components/primitives";

interface ContextBarProps {
  location?: string;
  className?: string;
}

/**
 * ContextBar - Top context bar showing current location/filter context.
 *
 * Features:
 * - Location pill using GlassPill primitive with colored dot
 * - Positioned at top-left of visualization area
 */
export function ContextBar({
  location = "Switzerland",
  className,
}: ContextBarProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <GlassPill color="neutral" size="md" variant="outline" className="gap-2">
        <span
          className="h-2 w-2 rounded-full bg-success shrink-0"
          aria-hidden="true"
        />
        {location}
      </GlassPill>
    </div>
  );
}
