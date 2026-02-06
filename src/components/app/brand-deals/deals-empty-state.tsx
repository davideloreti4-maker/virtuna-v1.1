import { MagnifyingGlass } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DealsEmptyStateProps {
  /** Callback to reset all active filters */
  onClearFilters: () => void;
}

/**
 * DealsEmptyState -- shown when no deals match the current filters/search.
 *
 * Displays an illustration, message, and a "Clear filters" CTA that
 * resets both the category filter and search query.
 *
 * @example
 * ```tsx
 * <DealsEmptyState onClearFilters={() => {
 *   setCategory("all");
 *   setSearch("");
 * }} />
 * ```
 */
export function DealsEmptyState({ onClearFilters }: DealsEmptyStateProps) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-border-subtle p-8">
      <MagnifyingGlass
        className="text-foreground-muted"
        size={40}
        weight="thin"
        aria-hidden="true"
      />

      <div className="text-center">
        <h3 className="text-lg font-medium text-foreground">
          No deals found
        </h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Try adjusting your filters or search query
        </p>
      </div>

      <Button variant="secondary" size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}
