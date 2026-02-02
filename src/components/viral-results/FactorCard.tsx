"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  FactorProgressBar,
  getScoreColorClass,
} from "./FactorProgressBar";
import type { ViralFactor } from "@/types/viral-results";

/**
 * FactorCard - Individual factor display with accordion expansion
 *
 * Features:
 * - Glass panel background
 * - Score display with color coding
 * - Animated progress bar
 * - Accordion expand/collapse for details
 * - Optional checkbox for remix selection
 * - Staggered reveal animation
 */

export interface FactorCardProps {
  /** Factor data to display */
  factor: ViralFactor;
  /** Index in list (for stagger delay calculation) */
  index: number;
  /** Show checkbox for remix selection */
  selectable?: boolean;
  /** Checkbox state */
  selected?: boolean;
  /** Callback when selection changes */
  onSelectChange?: (id: string, selected: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

/** Base stagger delay between cards (ms) */
const STAGGER_DELAY = 100;

/** Stagger animation style - inline CSS for animation-delay */
function getStaggerStyle(index: number) {
  return {
    animationDelay: `${index * STAGGER_DELAY}ms`,
  };
}

export function FactorCard({
  factor,
  index,
  selectable = false,
  selected = false,
  onSelectChange,
  className,
}: FactorCardProps) {
  const { id, name, score, maxScore, description, details, tips } = factor;

  // Calculate percentage for color determination
  const scoreColor = getScoreColorClass(score, maxScore);

  // Handle checkbox click without triggering accordion
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectChange?.(id, e.target.checked);
  };

  return (
    <AccordionItem
      value={id}
      className={cn(
        // Glass panel styling
        "glass-base glass-blur-sm",
        "rounded-xl border border-white/10",
        // Hover effect
        "transition-all duration-200",
        "hover:border-white/20 hover:brightness-110",
        // Stagger animation
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4",
        "motion-safe:fill-mode-backwards",
        // Reduced motion: instant appearance
        "motion-reduce:animate-none motion-reduce:opacity-100",
        className
      )}
      style={getStaggerStyle(index)}
    >
      <AccordionTrigger className="p-4 hover:no-underline">
        <div className="flex items-center gap-3 w-full">
          {/* Optional selection checkbox */}
          {selectable && (
            <div onClick={handleCheckboxClick} className="shrink-0">
              <input
                type="checkbox"
                checked={selected}
                onChange={handleCheckboxChange}
                className={cn(
                  "h-4 w-4 rounded border-white/30",
                  "bg-white/5 text-violet-500",
                  "focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-0",
                  "cursor-pointer"
                )}
                aria-label={`Select ${name} for remix`}
              />
            </div>
          )}

          {/* Factor content */}
          <div className="flex-1 min-w-0">
            {/* Header row: name and score */}
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-white font-medium truncate">{name}</span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums shrink-0",
                  scoreColor
                )}
              >
                {score}/{maxScore}
              </span>
            </div>

            {/* Progress bar */}
            <FactorProgressBar
              score={score}
              maxScore={maxScore}
              animated={true}
              delay={index * STAGGER_DELAY + 200}
              size="sm"
            />

            {/* Brief description */}
            <p className="text-text-secondary text-sm mt-2 line-clamp-1">
              {description}
            </p>
          </div>
        </div>
      </AccordionTrigger>

      {/* Expanded content */}
      <AccordionContent className="px-4 pb-4 pt-0">
        <div
          className={cn(
            "pt-3 border-t border-white/5",
            selectable && "ml-7" // Indent if checkbox is present
          )}
        >
          {/* Detailed explanation */}
          {details && (
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              {details}
            </p>
          )}

          {/* Tips list */}
          {tips && tips.length > 0 && (
            <div>
              <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">
                Improvement Tips
              </h4>
              <ul className="space-y-1.5">
                {tips.map((tip, tipIndex) => (
                  <li
                    key={tipIndex}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <span className="text-violet-400 mt-1 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty state if no details or tips */}
          {!details && (!tips || tips.length === 0) && (
            <p className="text-text-tertiary text-sm italic">
              No additional details available for this factor.
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default FactorCard;
