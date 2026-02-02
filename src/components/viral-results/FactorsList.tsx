"use client";

import { cn } from "@/lib/utils";
import { AccordionRoot } from "@/components/ui/accordion";
import { FactorCard } from "./FactorCard";
import type { ViralFactor } from "@/types/viral-results";

/**
 * FactorsList - Staggered list wrapper for factor cards
 *
 * Features:
 * - Vertical stacked layout
 * - Single accordion item open at a time
 * - Selection management for remix feature
 * - Staggered reveal animation on mount
 */

export interface FactorsListProps {
  /** Array of factors to display */
  factors: ViralFactor[];
  /** Enable checkbox selection for remix */
  selectable?: boolean;
  /** Set of selected factor IDs */
  selectedIds?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<string>) => void;
  /** Additional CSS classes */
  className?: string;
}

export function FactorsList({
  factors,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  className,
}: FactorsListProps) {
  // Handle individual factor selection change
  const handleSelectChange = (factorId: string, selected: boolean) => {
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(factorId);
    } else {
      newSelection.delete(factorId);
    }
    onSelectionChange?.(newSelection);
  };

  // Empty state
  if (!factors || factors.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-12",
          "text-text-tertiary text-sm",
          className
        )}
      >
        No factors to display.
      </div>
    );
  }

  return (
    <AccordionRoot
      type="single"
      collapsible
      className={cn("flex flex-col gap-3", className)}
    >
      {factors.map((factor, index) => (
        <FactorCard
          key={factor.id}
          factor={factor}
          index={index}
          selectable={selectable}
          selected={selectedIds.has(factor.id)}
          onSelectChange={handleSelectChange}
        />
      ))}
    </AccordionRoot>
  );
}

export default FactorsList;
