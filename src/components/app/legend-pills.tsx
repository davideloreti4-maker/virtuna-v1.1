"use client";

import { cn } from "@/lib/utils";
import { GlassPill } from "@/components/primitives";

/**
 * Role levels with colors matching accumulated decisions (Phase 4).
 * Indigo (Executive), Emerald (Senior), Pink (Mid), Orange (Entry)
 */
export const ROLE_LEVELS = [
  { id: "executive", label: "Executive", color: "bg-indigo-500" },
  { id: "senior", label: "Senior", color: "bg-emerald-500" },
  { id: "mid", label: "Mid", color: "bg-pink-500" },
  { id: "entry", label: "Entry", color: "bg-orange-500" },
] as const;

/** Hex color values for inline dot styling (avoids Tailwind class dependencies) */
const ROLE_LEVEL_COLORS: Record<string, string> = {
  executive: "#6366F1", // indigo
  senior: "#10B981",    // emerald
  mid: "#EC4899",       // pink
  entry: "#F97316",     // orange
};

export type RoleLevel = (typeof ROLE_LEVELS)[number]["id"];

interface LegendPillsProps {
  className?: string;
  /** Optional: which levels are currently visible/active */
  activeLevels?: RoleLevel[];
  /** Optional: toggle a level on/off */
  onToggle?: (levelId: RoleLevel) => void;
}

/**
 * LegendPills - Displays role level color legend for network visualization.
 * Uses GlassPill primitives with neutral color and hex-based dot indicators.
 * Can optionally support click-to-toggle filtering.
 */
export function LegendPills({
  className,
  activeLevels,
  onToggle,
}: LegendPillsProps) {
  // If no activeLevels provided, all are active (display-only mode)
  const isActive = (id: RoleLevel) =>
    activeLevels ? activeLevels.includes(id) : true;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {ROLE_LEVELS.map((level) => (
        <GlassPill
          key={level.id}
          color="neutral"
          size="sm"
          variant="outline"
          active={isActive(level.id)}
          onClick={onToggle ? () => onToggle(level.id) : undefined}
          className="gap-1.5"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              !isActive(level.id) && "opacity-40"
            )}
            style={{ backgroundColor: ROLE_LEVEL_COLORS[level.id] }}
            aria-hidden="true"
          />
          {level.label}
        </GlassPill>
      ))}
    </div>
  );
}
