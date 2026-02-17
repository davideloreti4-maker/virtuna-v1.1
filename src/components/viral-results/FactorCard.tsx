"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Check } from "lucide-react";
import type { ViralFactor } from "@/types/viral-results";

/**
 * FactorCard - Premium factor display with accordion expansion
 *
 * Features:
 * - Glass panel background with depth
 * - Animated progress bar with score-based colors
 * - Accordion expand/collapse for details
 * - Checkbox for remix selection
 * - Staggered reveal animation
 */

export interface FactorCardProps {
  factor: ViralFactor;
  index: number;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (id: string, selected: boolean) => void;
  className?: string;
}

// Color utilities
function getScoreColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return "text-emerald-400";
  if (percentage >= 60) return "text-lime-400";
  if (percentage >= 40) return "text-yellow-400";
  if (percentage >= 20) return "text-orange-400";
  return "text-red-400";
}

function getBarColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 80) return "bg-emerald-400";
  if (percentage >= 60) return "bg-lime-400";
  if (percentage >= 40) return "bg-yellow-400";
  if (percentage >= 20) return "bg-orange-400";
  return "bg-red-400";
}

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function FactorCard({
  factor,
  index,
  selectable = false,
  selected = false,
  onSelectChange,
  className,
}: FactorCardProps) {
  const { id, name, score, maxScore, description, details, tips } = factor;

  const scoreColor = getScoreColor(score, maxScore);
  const barColor = getBarColor(score, maxScore);
  const percentage = (score / maxScore) * 100;

  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelectChange?.(id, !selected);
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <AccordionItem
        value={id}
        className={cn(
          // Raycast card styling
          "group border border-white/[0.06] rounded-lg overflow-hidden",
          "bg-transparent",
          // Hover enhancement
          "transition-all duration-300",
          "hover:bg-white/[0.02]",
          className
        )}
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <AccordionTrigger className="p-5 hover:no-underline w-full">
          <div className="flex items-center gap-4 w-full">
            {/* Selection checkbox */}
            {selectable && (
              <button
                onClick={handleCheckboxClick}
                aria-label={`Select ${name} for remix`}
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-lg border transition-all duration-200",
                  "flex items-center justify-center",
                  selected
                    ? "bg-violet-500 border-violet-500"
                    : "border-white/[0.06] hover:border-white/[0.1] hover:bg-white/5"
                )}
              >
                {selected && <Check className="w-4 h-4 text-white" />}
              </button>
            )}

            {/* Factor content */}
            <div className="flex-1 min-w-0">
              {/* Header: name and score */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="text-white font-semibold text-lg truncate">
                  {name}
                </span>
                <span
                  className={cn(
                    "text-xl font-bold tabular-nums shrink-0",
                    scoreColor
                  )}
                >
                  {score}/{maxScore}
                </span>
              </div>

              {/* Animated progress bar */}
              <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden mb-3">
                <motion.div
                  className={cn("h-full rounded-full", barColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                />
              </div>

              {/* Brief description */}
              <p className="text-gray-400 text-sm line-clamp-1">{description}</p>
            </div>
          </div>
        </AccordionTrigger>

        {/* Expanded content */}
        <AccordionContent className="px-5 pb-5 pt-0">
          <div
            className={cn(
              "pt-4 border-t border-white/[0.06]",
              selectable && "ml-10" // Indent when checkbox present
            )}
          >
            {/* Detailed explanation */}
            {details && (
              <p className="text-gray-300 text-sm leading-relaxed mb-5">
                {details}
              </p>
            )}

            {/* Improvement tips */}
            {tips && tips.length > 0 && (
              <div>
                <h4 className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-3">
                  Improvement Tips
                </h4>
                <ul className="space-y-2">
                  {tips.map((tip, tipIndex) => (
                    <li
                      key={tipIndex}
                      className="flex items-start gap-2 text-sm text-gray-400"
                    >
                      <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty state */}
            {!details && (!tips || tips.length === 0) && (
              <p className="text-gray-500 text-sm italic">
                No additional details available.
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </motion.div>
  );
}

export default FactorCard;
