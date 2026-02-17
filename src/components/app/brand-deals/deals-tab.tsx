"use client";

import { useState, useMemo, useCallback } from "react";

import { useDebouncedCallback } from "@/hooks/use-debounce";
import { useDeals } from "@/hooks/queries";
import { useCJProducts } from "@/hooks/queries/use-cj-products";
import { mapDealRowToUI } from "@/lib/mappers";
import { getExternalDeals, affiliateProgramToDeal } from "@/lib/affiliate-programs";
import type { BrandDeal, BrandDealCategory, PlatformType } from "@/types/brand-deals";
import type { ProgramTypeFilter } from "./deal-filter-bar";

import { DealApplyModal } from "./deal-apply-modal";
import { DealCard } from "./deal-card";
import { DealFilterBar } from "./deal-filter-bar";
import { DealsEmptyState } from "./deals-empty-state";
import { DealsTabSkeleton } from "./deals-tab-skeleton";
import { NewThisWeekRow } from "./new-this-week-row";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealsTabProps {
  appliedDeals: Set<string>;
}

// ---------------------------------------------------------------------------
// DealsTab
// ---------------------------------------------------------------------------

export function DealsTab({
  appliedDeals,
}: DealsTabProps): React.JSX.Element {
  const { data, isLoading } = useDeals({ status: "active" });
  const [activeCategory, setActiveCategory] = useState<BrandDealCategory | "all">("all");
  const [activeProgramType, setActiveProgramType] = useState<ProgramTypeFilter>("all");
  const [activePlatform, setActivePlatform] = useState<PlatformType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [applyingDeal, setApplyingDeal] = useState<BrandDeal | null>(null);

  // CJ live search: enabled when query is non-empty and type filter includes networks
  const cjEnabled =
    debouncedSearch.trim().length > 0 &&
    (activeProgramType === "all" || activeProgramType === "network");
  const { data: cjData } = useCJProducts(debouncedSearch, { enabled: cjEnabled });

  // Flatten paginated Supabase deals
  const supabaseDeals = useMemo(
    () => data?.pages.flatMap((page) => page.data.map(mapDealRowToUI)) ?? [],
    [data]
  );

  // Static external programs
  const externalDeals = useMemo(() => getExternalDeals(), []);

  // CJ live results converted to BrandDeal
  const cjDeals = useMemo(() => {
    if (!cjData?.data?.length) return [];
    return cjData.data.map(affiliateProgramToDeal);
  }, [cjData]);

  // Merge all three sources
  const allDeals = useMemo(() => {
    // Deduplicate CJ results by id (they might overlap with static programs)
    const existingIds = new Set([
      ...supabaseDeals.map((d) => d.id),
      ...externalDeals.map((d) => d.id),
    ]);
    const uniqueCJ = cjDeals.filter((d) => !existingIds.has(d.id));
    return [...supabaseDeals, ...externalDeals, ...uniqueCJ];
  }, [supabaseDeals, externalDeals, cjDeals]);

  // Debounce search filtering at 300ms
  const debouncedSetSearch = useDebouncedCallback(
    useCallback((value: string) => setDebouncedSearch(value), []),
    300
  );

  function handleSearchChange(query: string): void {
    setSearchQuery(query);
    debouncedSetSearch(query);
  }

  // Filtered deals based on all active filters
  const filteredDeals = useMemo(() => {
    return allDeals
      .filter((deal) => {
        // Category filter
        if (activeCategory !== "all" && deal.category !== activeCategory) return false;

        // Program type filter
        if (activeProgramType !== "all") {
          if (activeProgramType === "virtuna") {
            if (deal.source === "external") return false;
          } else {
            if (deal.source !== "external") return false;
            if (deal.programType !== activeProgramType) return false;
          }
        }

        // Platform filter
        if (activePlatform !== "all") {
          if (deal.platforms && !deal.platforms.includes(activePlatform)) return false;
        }

        // Search filter
        if (debouncedSearch) {
          const matchesSearch = deal.brandName
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase());
          if (!matchesSearch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Featured first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // Virtuna deals before external
        if (a.source !== "external" && b.source === "external") return -1;
        if (a.source === "external" && b.source !== "external") return 1;
        return 0;
      });
  }, [allDeals, activeCategory, activeProgramType, activePlatform, debouncedSearch]);

  // New deals for the featured row
  const newDeals = useMemo(() => allDeals.filter((d) => d.isNew), [allDeals]);

  function handleClearFilters(): void {
    setActiveCategory("all");
    setActiveProgramType("all");
    setActivePlatform("all");
    setSearchQuery("");
    setDebouncedSearch("");
  }

  function handleApplyClick(deal: BrandDeal): void {
    setApplyingDeal(deal);
  }

  if (isLoading) return <DealsTabSkeleton />;

  return (
    <div>
      {/* Featured new deals row */}
      <NewThisWeekRow
        deals={newDeals}
        appliedDeals={appliedDeals}
        onApply={handleApplyClick}
      />

      {/* Filter bar: search + type + platform + category pills */}
      <DealFilterBar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        activeProgramType={activeProgramType}
        onProgramTypeChange={setActiveProgramType}
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
      />

      {/* Deal grid or empty state */}
      {filteredDeals.length === 0 ? (
        <div className="mt-6">
          <DealsEmptyState onClearFilters={handleClearFilters} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              isApplied={appliedDeals.has(deal.id)}
              onApply={handleApplyClick}
            />
          ))}
        </div>
      )}

      {/* Apply modal (portal) */}
      <DealApplyModal
        deal={applyingDeal}
        open={!!applyingDeal}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setApplyingDeal(null);
        }}
      />
    </div>
  );
}
