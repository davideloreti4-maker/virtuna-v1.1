"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { ViralScoreRing } from "./ViralScoreRing";
import { FactorsList } from "./FactorsList";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RemixCTA } from "./RemixCTA";
import type { ViralResult } from "@/types/viral-results";

/**
 * ViralResultsCard - Complete viral results composition
 *
 * The "wow moment" card that displays viral prediction analysis.
 * Composes all sub-components with coordinated animations.
 *
 * Features:
 * - Animated score ring with count-up
 * - Factor breakdown with accordion expansion
 * - Sticky remix CTA with selection tracking
 * - Confidence badge for data quality indicator
 * - Animation orchestration (ring first, then factors, then CTA)
 */

export interface ViralResultsCardProps {
  /** The viral analysis result to display */
  result: ViralResult;
  /** Callback when remix is triggered with selected factor IDs */
  onRemix?: (selectedFactorIds: string[]) => void;
  /** Show the remix CTA section */
  showRemixCTA?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Animation timing constants (ms)
const RING_ANIMATION_DURATION = 1500;
const FACTORS_REVEAL_DELAY = RING_ANIMATION_DURATION + 200;
const CTA_REVEAL_DELAY = FACTORS_REVEAL_DELAY + 300;

export function ViralResultsCard({
  result,
  onRemix,
  showRemixCTA = false,
  className,
}: ViralResultsCardProps) {
  // Selection state for remix feature
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Animation orchestration state
  const [showFactors, setShowFactors] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  // Format generated date
  const formattedDate = result.generatedAt
    ? new Date(result.generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Handle remix button click
  const handleRemix = () => {
    if (onRemix) {
      onRemix(Array.from(selectedIds));
    }
  };

  // Orchestrate staggered animations
  useEffect(() => {
    // Check for reduced motion preference
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      // Show everything immediately
      setShowFactors(true);
      setShowCTA(true);
      return;
    }

    // Staggered reveal: factors after ring settles
    const factorsTimer = setTimeout(() => {
      setShowFactors(true);
    }, FACTORS_REVEAL_DELAY);

    // CTA fades in last
    const ctaTimer = setTimeout(() => {
      setShowCTA(true);
    }, CTA_REVEAL_DELAY);

    return () => {
      clearTimeout(factorsTimer);
      clearTimeout(ctaTimer);
    };
  }, []);

  return (
    <GlassPanel
      blur="md"
      opacity={0.7}
      className={cn(
        // Layout
        "max-h-[80vh] flex flex-col overflow-hidden",
        // Rounded corners and shadow
        "rounded-2xl shadow-elevated",
        className
      )}
    >
      {/* Header - fixed */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-text-primary">
            Viral Analysis
          </h2>
          {formattedDate && (
            <span className="text-xs text-text-tertiary">{formattedDate}</span>
          )}
        </div>
        <ConfidenceBadge
          confidence={result.confidence}
          reason={result.confidenceReason}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Hero score ring - centered */}
        <div className="flex justify-center py-4">
          <ViralScoreRing
            score={result.overallScore}
            tier={result.tier}
            size="lg"
            animated
          />
        </div>

        {/* Factor breakdown section */}
        <div
          className={cn(
            "space-y-4 transition-all duration-500",
            showFactors
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              Factor Breakdown
            </h3>
            {showRemixCTA && (
              <span className="text-xs text-text-tertiary">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : "Tap to select"}
              </span>
            )}
          </div>
          <FactorsList
            factors={result.factors}
            selectable={showRemixCTA}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </div>

      {/* Sticky CTA - fixed at bottom */}
      {showRemixCTA && (
        <div
          className={cn(
            "transition-all duration-500 shrink-0",
            showCTA
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          )}
        >
          <RemixCTA
            selectedFactorIds={selectedIds}
            totalFactors={result.factors.length}
            onRemix={handleRemix}
          />
        </div>
      )}
    </GlassPanel>
  );
}

export default ViralResultsCard;
