"use client";

import { Badge } from "@/components/ui/badge";
import type { CalibrationStatus } from "./audience-display";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<CalibrationStatus, string> = {
  baseline: "Baseline",
  template: "Template",
  thin: "Limited data",
  calibrated: "Calibrated",
  needs_calibration: "Needs calibration",
};

const STATUS_VARIANTS: Record<
  CalibrationStatus,
  "default" | "secondary" | "warning" | "info"
> = {
  baseline: "default",
  template: "secondary",
  thin: "warning",
  calibrated: "default",
  // warm amber, not blue — "needs calibration" is a nudge to act, and the
  // flat-warm palette has no cool informational tint on this surface
  needs_calibration: "warning",
};

export interface AudienceStatusChipProps {
  status: CalibrationStatus;
  className?: string;
}

export function AudienceStatusChip({ status, className }: AudienceStatusChipProps) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      size="sm"
      className={cn("shrink-0", className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
