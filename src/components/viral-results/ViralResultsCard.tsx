"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ViralScoreRing } from "./ViralScoreRing";
import { FactorsList } from "./FactorsList";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RemixCTA } from "./RemixCTA";
import type { ViralResult } from "@/types/viral-results";

/**
 * ViralResultsCard - Premium viral results composition
 *
 * The "wow moment" card for viral prediction analysis.
 * Features ambient lighting, glassmorphism, and coordinated animations.
 */

export interface ViralResultsCardProps {
  result: ViralResult;
  onRemix?: (selectedFactorIds: string[]) => void;
  showRemixCTA?: boolean;
  className?: string;
}

// Get ambient glow color based on score
function getAmbientGlowColor(score: number): string {
  if (score >= 70) return "rgba(34, 197, 94, 0.08)";
  if (score >= 40) return "rgba(234, 179, 8, 0.08)";
  return "rgba(239, 68, 68, 0.08)";
}

// Animation timing constants
const RING_SETTLE_DELAY = 1200;
const CTA_REVEAL_DELAY = 1800;

export function ViralResultsCard({
  result,
  onRemix,
  showRemixCTA = false,
  className,
}: ViralResultsCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFactors, setShowFactors] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  const formattedDate = result.generatedAt
    ? new Date(result.generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const handleRemix = () => {
    if (onRemix) {
      onRemix(Array.from(selectedIds));
    }
  };

  // Orchestrate animations
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      setShowFactors(true);
      setShowCTA(true);
      return;
    }

    const factorsTimer = setTimeout(() => setShowFactors(true), RING_SETTLE_DELAY);
    const ctaTimer = setTimeout(() => setShowCTA(true), CTA_REVEAL_DELAY);

    return () => {
      clearTimeout(factorsTimer);
      clearTimeout(ctaTimer);
    };
  }, []);

  const ambientGlowColor = getAmbientGlowColor(result.overallScore);

  return (
    <div className={cn("relative", className)}>
      {/* Ambient glow behind card */}
      <div
        className="absolute -inset-4 rounded-3xl blur-3xl"
        style={{ background: ambientGlowColor }}
        aria-hidden="true"
      />

      {/* Main card container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={cn(
          "relative",
          "max-h-[85vh] flex flex-col overflow-hidden",
          // Premium glass styling
          "bg-gradient-to-b from-white/[0.08] to-white/[0.02]",
          "backdrop-blur-2xl",
          "border border-white/10",
          "rounded-3xl",
          // Layered shadow for depth
          "shadow-[0_20px_70px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white">Viral Analysis</h2>
            {formattedDate && (
              <span className="text-xs text-gray-500 mt-0.5">{formattedDate}</span>
            )}
          </div>
          <ConfidenceBadge
            confidence={result.confidence}
            reason={result.confidenceReason}
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero score section with extra padding */}
          <div className="flex justify-center py-10 px-6">
            <ViralScoreRing
              score={result.overallScore}
              tier={result.tier}
              size="lg"
              animated
            />
          </div>

          {/* Factor breakdown section */}
          <motion.div
            className="px-5 pb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={showFactors ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Factor Breakdown
              </h3>
              {showRemixCTA && (
                <span className="text-xs text-gray-500">
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
          </motion.div>
        </div>

        {/* Sticky CTA */}
        {showRemixCTA && (
          <motion.div
            className="shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={showCTA ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <RemixCTA
              selectedFactorIds={selectedIds}
              totalFactors={result.factors.length}
              onRemix={handleRemix}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default ViralResultsCard;
