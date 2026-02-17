"use client";

import { useState, useMemo, useCallback } from "react";

import { useDebouncedCallback } from "@/hooks/use-debounce";
import { useDeals } from "@/hooks/queries";
import { mapDealRowToUI } from "@/lib/mappers";
import type { BrandDeal, BrandDealCategory } from "@/types/brand-deals";

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
  /** Set of deal IDs the user has applied to (derived from useDealEnrollments in parent) */
  appliedDeals: Set<string>;
}

// ---------------------------------------------------------------------------
// DealsTab
// ---------------------------------------------------------------------------

/**
 * DealsTab -- Container component for the Deals tab.
 *
 * Manages filter/search/apply state internally. Applied deals state is
 * lifted to BrandDealsPage so it survives tab switches.
 *
 * Layout (top to bottom):
 * 1. NewThisWeekRow - horizontal scroll of featured deals
 * 2. DealFilterBar - search input + category pills
 * 3. Deal grid (3 cols lg, 2 sm, 1 mobile) or empty state
 * 4. DealApplyModal (portal, rendered at bottom)
 *
 * @example
 * ```tsx
 * <DealsTab appliedDeals={appliedDeals} />
 * ```
 */
export function DealsTab({
  appliedDeals,
}: DealsTabProps): React.JSX.Element {
  const { data, isLoading } = useDeals({ status: "active" });
  const [activeCategory, setActiveCategory] = useState<BrandDealCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [applyingDeal, setApplyingDeal] = useState<BrandDeal | null>(null);

  // Flatten paginated pages and map DB rows to UI types
  const allDeals = useMemo(
    () => data?.pages.flatMap((page) => page.data.map(mapDealRowToUI)) ?? [],
    [data]
  );

  // Debounce search filtering at 300ms
  const debouncedSetSearch = useDebouncedCallback(
    useCallback((value: string) => setDebouncedSearch(value), []),
    300
  );

  function handleSearchChange(query: string): void {
    setSearchQuery(query); // Immediate UI update
    debouncedSetSearch(query); // Debounced filter update
  }

  // Filtered deals based on category + debounced search
  const filteredDeals = useMemo(() => {
    return allDeals.filter((deal) => {
      const matchesCategory =
        activeCategory === "all" || deal.category === activeCategory;
      const matchesSearch = deal.brandName
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allDeals, activeCategory, debouncedSearch]);

  // New deals for the featured row
  const newDeals = useMemo(() => allDeals.filter((d) => d.isNew), [allDeals]);

  // Reset all filters
  function handleClearFilters(): void {
    setActiveCategory("all");
    setSearchQuery("");
    setDebouncedSearch("");
  }

  // Apply flow
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

      {/* Filter bar: search + category pills */}
      <DealFilterBar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
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
