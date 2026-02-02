"use client";

import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

/**
 * RemixCTA - Sticky call-to-action button for the remix flow
 *
 * Features:
 * - Sticky positioning at bottom of container
 * - Glass blur background for separation from content
 * - Selection summary showing factor count
 * - Gradient primary button matching hero CTA style
 */

export interface RemixCTAProps {
  /** Set of currently selected factor IDs */
  selectedFactorIds: Set<string>;
  /** Total number of factors available */
  totalFactors: number;
  /** Callback when remix button is clicked */
  onRemix: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function RemixCTA({
  selectedFactorIds,
  totalFactors,
  onRemix,
  disabled = false,
  className,
}: RemixCTAProps) {
  const selectionCount = selectedFactorIds.size;
  const hasSelection = selectionCount > 0;

  return (
    <div
      className={cn(
        // Sticky positioning
        "sticky bottom-0 z-10",
        // Glass background with blur
        "border-t border-white/10",
        "bg-surface/80 backdrop-blur-md",
        "-webkit-backdrop-filter: blur(12px)",
        // Padding for touch targets
        "p-4",
        className
      )}
      style={{
        // Explicit backdrop filter for Safari
        WebkitBackdropFilter: "blur(12px)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex flex-col gap-3 max-w-md mx-auto">
        {/* Selection summary */}
        <p className="text-sm text-text-secondary text-center">
          {hasSelection
            ? `${selectionCount} of ${totalFactors} factors selected`
            : "Select factors to carry into remix"}
        </p>

        {/* Primary CTA button */}
        <button
          onClick={onRemix}
          disabled={disabled}
          className={cn(
            // Layout
            "w-full py-3.5 px-6 rounded-xl",
            // Gradient background matching hero CTA
            "bg-gradient-to-r from-orange-500 to-pink-500",
            // Text styling
            "text-white font-semibold text-base",
            // Interactive states
            "hover:brightness-110 hover:scale-[1.02]",
            "active:scale-[0.98]",
            "transition-all duration-200",
            // Disabled state
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "disabled:hover:brightness-100 disabled:hover:scale-100",
            // Focus state for accessibility
            "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-surface"
          )}
        >
          <span className="inline-flex items-center gap-2 justify-center">
            <Sparkles className="h-5 w-5" />
            Create your version
          </span>
        </button>

        {/* Optional hint for empty selection */}
        {!hasSelection && (
          <p className="text-xs text-text-tertiary text-center">
            Your selected factors will guide the remix
          </p>
        )}
      </div>
    </div>
  );
}

export default RemixCTA;
