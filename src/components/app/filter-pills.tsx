"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
}

/**
 * FilterPill - Individual filter pill with colored indicator dot.
 *
 * Features:
 * - Colored dot on left side
 * - Active/inactive visual states
 * - Click to toggle
 */
export function FilterPill({
  label,
  color,
  active = true,
  onClick,
}: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
        active
          ? "border-zinc-600 bg-zinc-800/50 text-white"
          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white"
      )}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}

// Role levels data
const ROLE_LEVELS = [
  { label: "Executive Level", color: "#6366F1" },
  { label: "Mid Level", color: "#EC4899" },
  { label: "Senior Level", color: "#10B981" },
  { label: "Entry Level", color: "#F97316" },
] as const;

interface FilterPillGroupProps {
  className?: string;
}

/**
 * FilterPillGroup - Group of filter pills for role levels.
 *
 * Features:
 * - Displays all 4 role level pills
 * - Manages active state internally
 * - All active by default
 */
export function FilterPillGroup({ className }: FilterPillGroupProps) {
  // Track which filters are active (all active by default)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(ROLE_LEVELS.map((r) => r.label))
  );

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ROLE_LEVELS.map((role) => (
        <FilterPill
          key={role.label}
          label={role.label}
          color={role.color}
          active={activeFilters.has(role.label)}
          onClick={() => toggleFilter(role.label)}
        />
      ))}
    </div>
  );
}
