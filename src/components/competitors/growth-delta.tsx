"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GrowthDeltaProps {
  percentage: number;
  direction: "up" | "down" | "flat";
}

/**
 * Green/red velocity badge indicator for competitor growth.
 *
 * Shows an arrow icon with percentage change, color-coded by direction.
 */
export function GrowthDelta({ percentage, direction }: GrowthDeltaProps) {
  if (direction === "up") {
    return (
      <Badge variant="success" size="sm" className="gap-0.5">
        <ArrowUp size={12} />
        +{Math.abs(percentage).toFixed(1)}%
      </Badge>
    );
  }

  if (direction === "down") {
    return (
      <Badge variant="error" size="sm" className="gap-0.5">
        <ArrowDown size={12} />
        -{Math.abs(percentage).toFixed(1)}%
      </Badge>
    );
  }

  // flat
  return (
    <Badge variant="default" size="sm">
      0.0%
    </Badge>
  );
}
