"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ComparisonItem {
  name: string;
  accuracy: number;
  icon: string;
  highlighted?: boolean;
}

const comparisonData: ComparisonItem[] = [
  { name: "Artificial Societies", accuracy: 86, icon: "as-logo", highlighted: true },
  { name: "Gemini 2.5 Pro", accuracy: 67, icon: "gemini" },
  { name: "Gemini 2.5 Flash", accuracy: 64, icon: "gemini" },
  { name: "GPT-5", accuracy: 62, icon: "openai" },
  { name: "Gemini 2.0 Flash", accuracy: 61, icon: "gemini" },
];

interface ComparisonChartProps {
  className?: string;
}

/**
 * ComparisonChart displays a horizontal bar chart of AI models with accuracy scores.
 * The Artificial Societies row is highlighted with accent color bar,
 * while competitor models show muted bars.
 * Matches societies.io reference design.
 */
export function ComparisonChart({ className }: ComparisonChartProps) {
  // Scale: max bar width represents 100%, actual width = (accuracy / 100) * 100%
  const maxAccuracy = 100;

  return (
    <div className={cn("rounded-lg bg-background-elevated p-6", className)}>
      <div className="space-y-4">
        {comparisonData.map((item) => (
          <div
            key={item.name}
            className={cn(
              "relative",
              !item.highlighted && "opacity-80"
            )}
          >
            {/* Label row */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image
                  src={`/logos/${item.icon}.svg`}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 brightness-0 invert"
                />
                <span className="text-sm text-white">{item.name}</span>
              </div>
              <span className={cn(
                "text-sm text-white",
                item.highlighted && "font-medium"
              )}>
                {item.accuracy}%
              </span>
            </div>

            {/* Bar */}
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  item.highlighted
                    ? "bg-accent"
                    : "bg-white/30"
                )}
                style={{ width: `${(item.accuracy / maxAccuracy) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-foreground-muted">
        Proportional allocation accuracy across 1,000 survey replications
      </p>
    </div>
  );
}
