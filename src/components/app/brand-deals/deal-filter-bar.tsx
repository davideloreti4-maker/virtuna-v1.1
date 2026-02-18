"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { GlassPill } from "@/components/primitives/GlassPill";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS } from "@/lib/deal-utils";
import type { BrandDealCategory } from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DealFilterBarProps {
  activeCategory: BrandDealCategory | "all";
  onCategoryChange: (category: BrandDealCategory | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount: number;
}

export function DealFilterBar({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  resultCount,
}: DealFilterBarProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Search input + result count */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
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
        <span className="text-xs text-foreground-muted">{resultCount} deals</span>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <GlassPill
          color="neutral"
          size="sm"
          active={activeCategory === "all"}
          onClick={() => onCategoryChange("all")}
        >
          All
        </GlassPill>

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
