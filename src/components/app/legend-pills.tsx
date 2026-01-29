"use client";

import { cn } from "@/lib/utils";

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
        <button
          key={level.id}
          type="button"
          onClick={() => onToggle?.(level.id)}
          disabled={!onToggle}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            isActive(level.id)
              ? "bg-zinc-800/80 text-zinc-200"
              : "bg-zinc-900/50 text-zinc-500",
            onToggle && "cursor-pointer hover:bg-zinc-700",
            !onToggle && "cursor-default"
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              level.color,
              !isActive(level.id) && "opacity-40"
            )}
          />
          {level.label}
        </button>
      ))}
    </div>
  );
}
