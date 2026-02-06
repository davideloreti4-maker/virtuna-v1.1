"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GlassPill } from "@/components/primitives";

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
 * - Uses GlassPill primitive with neutral color
 * - Colored dot on left side
 * - Active/inactive visual states via GlassPill active prop
 * - Click to toggle
 */
export function FilterPill({
  label,
  color,
  active = true,
  onClick,
}: FilterPillProps) {
  return (
    <GlassPill
      color="neutral"
      size="md"
      variant="outline"
      active={active}
      onClick={onClick}
      className="gap-2"
    >
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", !active && "opacity-40")}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </GlassPill>
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
