"use client";

/**
 * ToolChips — chip row + active-model field + disabled cost slots (D-07/D-08/D-09).
 *
 * Six chips: Test · Idea · Hooks · Chat · Script · Remix.
 * Chip ids + model labels reuse the ToolRunner union (THREAD-06) as single SSOT.
 * "test", "idea", "hooks" are live (P1/P3/P4); "chat" enabled P5; "script"/"remix" live P6.
 * Active-model field maps the active chip to its model label (D-09):
 *   test → "SIM-1 Max" (video path, full model)
 *   idea | hooks | chat | script | remix → "SIM-1 Flash" (text path, fast model)
 *
 * A reserved cost slot affordance is present on each chip (D-07 — live metering deferred).
 * Styling follows Raycast rules: 6% borders, 10% hover, 8px radius, coral only on active
 * accent, no glow (CLAUDE.md §Raycast Design Language Rules).
 */

import { cn } from "@/lib/utils";

// ─── Chip vocabulary — matches ToolRunner id union (tool-runner.ts) ──────────
// P6: "script" and "remix" added (06-05)
export type ToolId = "test" | "idea" | "hooks" | "chat" | "script" | "remix";

// ─── Model labels (D-09) — same vocabulary as the block model tag (D-10) ─────
// P6: script + remix use SIM-1 Flash (text/decode path, same as hooks/ideas)
const MODEL_LABEL: Record<ToolId, string> = {
  test: "SIM-1 Max",
  idea: "SIM-1 Flash",
  hooks: "SIM-1 Flash",
  chat: "SIM-1 Flash",
  script: "SIM-1 Flash",
  remix: "SIM-1 Flash",
};

// ─── Chip metadata ─────────────────────────────────────────────────────────────
interface ChipMeta {
  id: ToolId;
  label: string;
  /** Only "test" is live in P1 (D-08). */
  enabled: boolean;
  /** Reserved cost slot label (D-07 — deferred live metering). */
  costSlot: string;
}

const CHIPS: ChipMeta[] = [
  { id: "test", label: "Test", enabled: true, costSlot: "credit" },
  { id: "idea", label: "Idea", enabled: true, costSlot: "credit" },
  { id: "hooks", label: "Hooks", enabled: true, costSlot: "credit" }, // live P4 (D-09)
  { id: "chat", label: "Chat", enabled: true, costSlot: "credit" },   // live P5
  { id: "script", label: "Script", enabled: true, costSlot: "credit" }, // live P6 (06-05)
  { id: "remix", label: "Remix", enabled: true, costSlot: "credit" },   // live P6 (06-05)
];

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ToolChipsProps {
  activeTool: ToolId;
  onSelect: (id: ToolId) => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ToolChips({ activeTool, onSelect, className }: ToolChipsProps) {
  const activeModel = MODEL_LABEL[activeTool];

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="group"
      aria-label="Tool selection"
    >
      {/* Chip row */}
      {CHIPS.map((chip) => {
        const isActive = chip.id === activeTool;
        const disabled = !chip.enabled;

        return (
          <button
            key={chip.id}
            type="button"
            role="button"
            aria-pressed={isActive}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onSelect(chip.id);
            }}
            className={cn(
              // Base: 8px radius (Raycast buttons/chips), 6% border
              "relative flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              // Active: coral accent border + bg tint
              isActive && !disabled && [
                "border-accent/60 bg-accent/10 text-accent",
              ],
              // Enabled, not active: 6% border, hover 10%
              !isActive && !disabled && [
                "border-white/[0.06] text-foreground-muted",
                "hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-foreground",
              ],
              // Disabled: 6% border, muted, no-pointer
              disabled && [
                "cursor-not-allowed border-white/[0.06] text-foreground-muted/50 opacity-50",
              ],
            )}
            title={disabled ? "Coming soon" : undefined}
          >
            {/* Chip label */}
            <span>{chip.label}</span>

            {/* Reserved cost slot affordance (D-07 — live metering deferred) */}
            <span
              aria-hidden="true"
              className="ml-0.5 rounded px-0.5 text-[9px] leading-none opacity-40"
              data-cost-slot={chip.costSlot}
            >
              {/* cost slot reserved — no live credit display in P1 */}
            </span>

            {/* Coming soon badge on disabled chips (D-08) */}
            {disabled && (
              <span className="sr-only">coming soon</span>
            )}
          </button>
        );
      })}

      {/* Active-model field (D-09) — which engine judges before firing */}
      <span
        className="ml-auto text-xs text-foreground-muted/60"
        aria-label={`Active model: ${activeModel}`}
        data-testid="active-model-label"
      >
        {activeModel}
      </span>
    </div>
  );
}
