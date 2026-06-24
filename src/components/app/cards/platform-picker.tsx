"use client";

import * as React from "react";
import { Instagram, Music2, Youtube, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PlatformPicker — Card 0 of the 9-card creator interview.
 *
 * Pure controlled multi-select tile group. The PROFILE-03 platform list is fixed;
 * the modal/store enforces the "at least one selected" validation, not this component.
 *
 * Selected-state styling override (UI-SPEC §Color):
 * tiles MUST use `bg-white/[0.08]` + `border-white/[0.12]` — NO coral fill on
 * selected tiles (divergent from the legacy `goal-step.tsx` analog).
 */

export type PlatformId = "tiktok" | "instagram" | "youtube";

interface PlatformOption {
  id: PlatformId;
  label: string;
  icon: LucideIcon;
}

const PLATFORMS: PlatformOption[] = [
  { id: "tiktok", label: "TikTok", icon: Music2 },
  { id: "instagram", label: "Instagram Reels", icon: Instagram },
  { id: "youtube", label: "YouTube Shorts", icon: Youtube },
];

export interface PlatformPickerProps {
  value: PlatformId[];
  onChange: (next: PlatformId[]) => void;
}

export function PlatformPicker({ value, onChange }: PlatformPickerProps): React.JSX.Element {
  const toggle = (id: PlatformId): void => {
    const next = value.includes(id)
      ? value.filter((existing) => existing !== id)
      : [...value, id];
    onChange(next);
  };

  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="group"
      aria-label="Select platforms you create for"
    >
      {PLATFORMS.map(({ id, label, icon: Icon }) => {
        const selected = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            data-testid={`card-0-tile-${id}`}
            onClick={() => toggle(id)}
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
              <Icon size={24} aria-hidden="true" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
