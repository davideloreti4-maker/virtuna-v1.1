"use client";

import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import type { ConfidenceLevel } from "@/types/viral-results";

/**
 * ConfidenceBadge - Small pill badge showing confidence level
 *
 * Features:
 * - Color-coded by confidence level (High/Medium/Low)
 * - Optional info icon with tooltip for reason
 * - Compact size for header placement
 */

export interface ConfidenceBadgeProps {
  /** Confidence level to display */
  confidence: ConfidenceLevel;
  /** Optional tooltip/explanation text */
  reason?: string;
  /** Additional CSS classes */
  className?: string;
}

// Color configuration per confidence level
const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  High: "bg-emerald-500/20 text-emerald-400",
  Medium: "bg-yellow-500/20 text-yellow-400",
  Low: "bg-red-500/20 text-red-400",
};

export function ConfidenceBadge({
  confidence,
  reason,
  className,
}: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1 rounded-full",
        "text-xs font-medium",
        CONFIDENCE_COLORS[confidence],
        className
      )}
      title={reason}
    >
      {confidence} confidence
      {reason && (
        <Info
          className="h-3 w-3 opacity-70 cursor-help"
          aria-label={reason}
        />
      )}
    </span>
  );
}

export default ConfidenceBadge;
