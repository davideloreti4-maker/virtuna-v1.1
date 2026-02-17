"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { GlassPill } from "@/components/primitives/GlassPill";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS } from "@/lib/deal-utils";
import type { BrandDealCategory } from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All BrandDealCategory values as a runtime array.
 * TypeScript unions aren't iterable, so we keep an explicit list
 * that mirrors the BrandDealCategory type definition.
 */
const FILTER_CATEGORIES: BrandDealCategory[] = [
  "tech",
  "fashion",
  "gaming",
  "fitness",
  "beauty",
  "food",
  "travel",
  "finance",
];

/** Capitalize first letter for pill display labels */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DealFilterBarProps {
  /** Currently selected category filter, or "all" for no filter */
  activeCategory: BrandDealCategory | "all";
  /** Callback when a category pill is clicked */
  onCategoryChange: (category: BrandDealCategory | "all") => void;
  /** Current search input value (controlled) */
  searchQuery: string;
  /** Callback when search input changes */
  onSearchChange: (query: string) => void;
}

/**
 * DealFilterBar -- search input + category filter pills.
 *
 * The search input is a controlled component; the parent (DealsTab)
 * is responsible for debouncing the actual filtering logic.
 *
 * @example
 * ```tsx
 * <DealFilterBar
 *   activeCategory={category}
 *   onCategoryChange={setCategory}
 *   searchQuery={search}
 *   onSearchChange={setSearch}
 * />
 * ```
 */
export function DealFilterBar({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: DealFilterBarProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Search input */}
      <div className="relative max-w-sm">
        <MagnifyingGlass
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          size={18}
          weight="regular"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by brand name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {/* "All" pill -- always first */}
        <GlassPill
          color="neutral"
          size="sm"
          active={activeCategory === "all"}
          onClick={() => onCategoryChange("all")}
        >
          All
        </GlassPill>

        {/* One pill per category */}
        {FILTER_CATEGORIES.map((category) => (
          <GlassPill
            key={category}
            color={CATEGORY_COLORS[category]}
            size="sm"
            active={activeCategory === category}
            onClick={() => onCategoryChange(category)}
          >
            {capitalize(category)}
          </GlassPill>
        ))}
      </div>
    </div>
  );
}
