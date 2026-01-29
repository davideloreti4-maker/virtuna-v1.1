"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

/**
 * Role levels with colors matching accumulated decisions (Phase 4).
 * Indigo (Executive), Emerald (Senior), Pink (Mid), Orange (Entry)
 */
export const ROLE_LEVELS = [
  { id: "executive", label: "Executive", color: "bg-indigo-500" },
  { id: "senior", label: "Senior", color: "bg-emerald-500" },
  { id: "mid", label: "Mid", color: "bg-pink-500" },
  { id: "entry", label: "Entry", color: "bg-orange-500" },
] as const;

export type RoleLevelId = (typeof ROLE_LEVELS)[number]["id"];

/**
 * Available view options for the dashboard.
 * Each view groups/colors the network visualization differently.
 */
const VIEW_OPTIONS = [
  { id: "country", label: "Country" },
  { id: "city", label: "City" },
  { id: "generation", label: "Generation" },
  { id: "role-level", label: "Role Level" },
  { id: "sector", label: "Sector" },
  { id: "role-area", label: "Role Area" },
] as const;

export type ViewOption = (typeof VIEW_OPTIONS)[number];

interface ViewSelectorProps {
  className?: string;
  value?: ViewOption;
  onSelect?: (view: ViewOption) => void;
}

/**
 * View Selector dropdown component.
 * Allows selecting different views for the network visualization.
 * Uses Radix DropdownMenu for accessibility and keyboard navigation.
 * Supports controlled and uncontrolled modes via value prop.
 */
export function ViewSelector({ className, value, onSelect }: ViewSelectorProps) {
  const [internalValue, setInternalValue] = useState<ViewOption>(VIEW_OPTIONS[0]);
  const selectedView = value ?? internalValue;

  const handleSelect = (view: ViewOption) => {
    if (!value) {
      setInternalValue(view);
    }
    onSelect?.(view);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
            className
          )}
        >
          <span>{selectedView.label}</span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-lg border border-zinc-800 bg-[#18181B] py-2 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          sideOffset={4}
          align="start"
        >
          {/* Section label */}
          <DropdownMenu.Label className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Views
          </DropdownMenu.Label>

          {VIEW_OPTIONS.map((view) => (
            <DropdownMenu.Item
              key={view.id}
              onSelect={() => handleSelect(view)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-zinc-200 outline-none transition-colors hover:bg-zinc-800 focus:bg-zinc-800",
                selectedView.id === view.id && "text-white"
              )}
            >
              {/* Color dots for Role Level option */}
              {view.id === "role-level" && (
                <div className="flex gap-1">
                  {ROLE_LEVELS.map((level) => (
                    <span
                      key={level.id}
                      className={cn("h-2 w-2 rounded-full", level.color)}
                    />
                  ))}
                </div>
              )}
              <span className="flex-1">{view.label}</span>
              {selectedView.id === view.id && (
                <Check className="h-4 w-4 text-indigo-500" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
