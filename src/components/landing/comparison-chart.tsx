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
 * ComparisonChart displays a list of AI models with their accuracy scores.
 * The Artificial Societies row is highlighted with full opacity,
 * while competitor models are shown with reduced opacity.
 */
export function ComparisonChart({ className }: ComparisonChartProps) {
  return (
    <div className={cn("rounded-lg bg-background-elevated p-6", className)}>
      <div className="space-y-3">
        {comparisonData.map((item) => (
          <div
            key={item.name}
            className={cn(
              "flex items-center justify-between py-2",
              !item.highlighted && "opacity-70"
            )}
          >
            <div className="flex items-center gap-3">
              <Image
                src={`/logos/${item.icon}.svg`}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 brightness-0 invert"
              />
              <span className="text-white">{item.name}</span>
            </div>
            <span className={cn("text-white", item.highlighted && "font-medium")}>
              {item.accuracy}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-foreground-muted">
        Proportional allocation accuracy across 1,000 survey replications
      </p>
    </div>
  );
}
