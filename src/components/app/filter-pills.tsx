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

// Country filters data - matches network visualization colors
const COUNTRY_FILTERS = [
  { label: "United States", color: "#F97316" },
  { label: "United Kingdom", color: "#3B82F6" },
  { label: "Germany", color: "#10B981" },
  { label: "Australia", color: "#8B5CF6" },
  { label: "Canada", color: "#EF4444" },
] as const;

interface FilterPillGroupProps {
  className?: string;
}

/**
 * FilterPillGroup - Group of filter pills for country filters.
 *
 * Features:
 * - Displays country filter pills matching network visualization
 * - Manages active state internally
 * - All active by default
 */
export function FilterPillGroup({ className }: FilterPillGroupProps) {
  // Track which filters are active (all active by default)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(COUNTRY_FILTERS.map((c) => c.label))
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
      {COUNTRY_FILTERS.map((country) => (
        <FilterPill
          key={country.label}
          label={country.label}
          color={country.color}
          active={activeFilters.has(country.label)}
          onClick={() => toggleFilter(country.label)}
        />
      ))}
    </div>
  );
}
