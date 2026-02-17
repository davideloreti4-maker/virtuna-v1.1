import { MagnifyingGlass } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

interface DealsEmptyStateProps {
  onClearFilters: () => void;
}

export function DealsEmptyState({ onClearFilters }: DealsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
        <MagnifyingGlass
          size={32}
          weight="thin"
          className="text-foreground-muted"
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">
        No deals found
      </h2>
      <p className="text-sm text-foreground-muted mb-6 text-center max-w-sm">
        Try adjusting your filters or search query
      </p>
      <Button variant="secondary" size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}
