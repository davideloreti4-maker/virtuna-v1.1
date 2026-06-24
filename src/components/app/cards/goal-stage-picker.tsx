"use client";

import * as React from "react";
import {
  Briefcase,
  DollarSign,
  Heart,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GoalStagePicker — Card 3 of the 9-card creator interview (PROFILE-06 / PROFILE-07).
 *
 * Two stacked sections — Goal (2×2 grid with icons) and Stage (3-tile row, no icons).
 * Pure controlled. Selected state diverges from the `goal-step.tsx` analog per
 * UI-SPEC §Color override: tiles use `bg-white/[0.08]` + `border-white/[0.12]`.
 */

export type CreatorGoal = "growth" | "engagement" | "brand_deals" | "conversion";
export type CreatorStage = "new" | "growing" | "established";

interface GoalOption {
  id: CreatorGoal;
  label: string;
  icon: LucideIcon;
}

interface StageOption {
  id: CreatorStage;
  label: string;
}

const GOALS: GoalOption[] = [
  { id: "growth", label: "Growth", icon: TrendingUp },
  { id: "engagement", label: "Engagement", icon: Heart },
  { id: "brand_deals", label: "Brand Deals", icon: Briefcase },
  { id: "conversion", label: "Conversion", icon: DollarSign },
];

const STAGES: StageOption[] = [
  { id: "new", label: "New creator" },
  { id: "growing", label: "Growing" },
  { id: "established", label: "Established" },
];

export interface GoalStagePickerProps {
  goal: CreatorGoal | null;
  stage: CreatorStage | null;
  onChange: (next: { goal: CreatorGoal | null; stage: CreatorStage | null }) => void;
}

export function GoalStagePicker({
  goal,
  stage,
  onChange,
}: GoalStagePickerProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Goal section — 2×2 grid */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Goal</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Goal">
          {GOALS.map(({ id, label, icon: Icon }) => {
            const selected = goal === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`card-3-goal-${id}`}
                onClick={() => onChange({ goal: id, stage })}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                  selected
                    ? "border-white/[0.12] bg-white/[0.08]"
                    : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center",
                    selected ? "text-foreground" : "text-foreground-secondary"
                  )}
                >
                  <Icon size={20} aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage section — 3-tile row */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Stage</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Stage">
          {STAGES.map(({ id, label }) => {
            const selected = stage === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`card-3-stage-${id}`}
                onClick={() => onChange({ goal, stage: id })}
                className={cn(
                  "flex h-14 items-center justify-center rounded-xl border px-3 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                  selected
                    ? "border-white/[0.12] bg-white/[0.08]"
                    : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
                )}
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
