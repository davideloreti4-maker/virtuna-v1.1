"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { GlassPill } from "@/components/primitives/GlassPill";
import { Input } from "@/components/ui/input";
import { CATEGORY_COLORS } from "@/lib/deal-utils";
import type { BrandDealCategory, PlatformType } from "@/types/brand-deals";

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

export type ProgramTypeFilter = "all" | "ecommerce" | "marketplace" | "network" | "virtuna";

const PROGRAM_TYPE_LABELS: Record<ProgramTypeFilter, string> = {
  all: "All",
  ecommerce: "E-Commerce",
  marketplace: "Marketplaces",
  network: "Networks",
  virtuna: "Virtuna Deals",
};

const PLATFORM_LABELS: Record<"all" | PlatformType, string> = {
  all: "All Platforms",
  tiktok: "TikTok",
  instagram: "Instagram",
};

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
  activeProgramType: ProgramTypeFilter;
  onProgramTypeChange: (type: ProgramTypeFilter) => void;
  activePlatform: PlatformType | "all";
  onPlatformChange: (platform: PlatformType | "all") => void;
}

export function DealFilterBar({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  activeProgramType,
  onProgramTypeChange,
  activePlatform,
  onPlatformChange,
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

      {/* Program type filter row */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(PROGRAM_TYPE_LABELS) as [ProgramTypeFilter, string][]).map(
          ([key, label]) => (
            <GlassPill
              key={key}
              color={key === "virtuna" ? "orange" : "neutral"}
              size="sm"
              active={activeProgramType === key}
              onClick={() => onProgramTypeChange(key)}
            >
              {label}
            </GlassPill>
          )
        )}
      </div>

      {/* Platform filter row */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(PLATFORM_LABELS) as [("all" | PlatformType), string][]).map(
          ([key, label]) => (
            <GlassPill
              key={key}
              color="neutral"
              size="sm"
              active={activePlatform === key}
              onClick={() => onPlatformChange(key)}
            >
              {label}
            </GlassPill>
          )
        )}
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
