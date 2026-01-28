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
      <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/80 px-4 py-2">
        {/* Optional: colored dot indicator */}
        <span
          className="h-2 w-2 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        <span className="text-sm text-white">{location}</span>
      </div>
    </div>
  );
}
