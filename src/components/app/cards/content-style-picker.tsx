"use client";

import * as React from "react";
import {
  BookOpen,
  Camera,
  GraduationCap,
  Mic,
  Smile,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ContentStylePicker — Card 4 of the 9-card creator interview (PROFILE-08 / PROFILE-09).
 *
 * Single-select 2×3 tile grid for content style + 3-button toggle row for
 * cuts-per-second preference. Pure controlled. Selected tile styling follows the
 * UI-SPEC §Color override — `bg-white/[0.08]` + `border-white/[0.12]`, no coral.
 */

export type ContentStyle =
  | "talking_head"
  | "b_roll"
  | "educational"
  | "comedy"
  | "tutorial"
  | "vlog";

export type CutsPerSecond = "slow" | "medium" | "fast";

interface StyleOption {
  id: ContentStyle;
  label: string;
  icon: LucideIcon;
}

interface CutsOption {
  id: CutsPerSecond;
  label: string;
}

const STYLES: StyleOption[] = [
  { id: "talking_head", label: "Talking Head", icon: Mic },
  { id: "b_roll", label: "B-Roll", icon: Video },
  { id: "educational", label: "Educational", icon: BookOpen },
  { id: "comedy", label: "Comedy", icon: Smile },
  { id: "tutorial", label: "Tutorial", icon: GraduationCap },
  { id: "vlog", label: "Vlog", icon: Camera },
];

const CUTS: CutsOption[] = [
  { id: "slow", label: "Slow (<1/s)" },
  { id: "medium", label: "Medium (1-3/s)" },
  { id: "fast", label: "Fast (3+/s)" },
];

export interface ContentStylePickerProps {
  style: ContentStyle | null;
  cuts: CutsPerSecond | null;
  onChange: (next: { style: ContentStyle | null; cuts: CutsPerSecond | null }) => void;
}

export function ContentStylePicker({
  style,
  cuts,
  onChange,
}: ContentStylePickerProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Style grid 2×3 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Style</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Content style">
          {STYLES.map(({ id, label, icon: Icon }) => {
            const selected = style === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`card-4-style-${id}`}
                onClick={() => onChange({ style: id, cuts })}
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

      {/* Cuts per second toggle group */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Cuts per second preference</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cuts per second">
          {CUTS.map(({ id, label }) => {
            const selected = cuts === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`card-4-cuts-${id}`}
                onClick={() => onChange({ style, cuts: id })}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl border px-3 text-center transition-colors",
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
