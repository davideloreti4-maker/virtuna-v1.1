import { cn } from "@/lib/utils";

interface ContextBarProps {
  location?: string;
  className?: string;
}

/**
 * ContextBar - Top context bar showing current location/filter context.
 *
 * Features:
 * - Location pill with optional colored dot
 * - Positioned at top-left of visualization area
 */
export function ContextBar({
  location = "Switzerland",
  className,
}: ContextBarProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1.5">
        {/* Colored dot indicator */}
        <span
          className="h-2.5 w-2.5 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        <span className="text-sm text-zinc-300">{location}</span>
      </div>
    </div>
  );
}
