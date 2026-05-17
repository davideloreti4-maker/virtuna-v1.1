"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * ReferenceCreatorsInput — Card 5 of the 9-card creator interview (PROFILE-08-style URL list).
 *
 * Dynamic list of up to 3 TikTok handle / profile URL inputs. Accepts any raw
 * string — no URL validation (per Phase 02 decision D-06; handle parsing
 * happens at save-time in Plan 02-06).
 *
 * Pure controlled. Always renders at least one row so the user has a visible
 * input target on the empty-state.
 */

export interface ReferenceCreatorEntry {
  handle_or_url: string;
}

export interface ReferenceCreatorsInputProps {
  value: ReferenceCreatorEntry[];
  onChange: (next: ReferenceCreatorEntry[]) => void;
}

const MAX_ENTRIES = 3;

export function ReferenceCreatorsInput({
  value,
  onChange,
}: ReferenceCreatorsInputProps): React.JSX.Element {
  // Show at least one input row when value is empty so the user has a target.
  const rows = value.length === 0 ? [{ handle_or_url: "" }] : value;

  const handleRowChange = (rowIndex: number, nextValue: string): void => {
    // If the prop value was empty and we synthesized a row, materialize it on first edit.
    const source = value.length === 0 ? [{ handle_or_url: "" }] : value;
    const next = source.map((entry, idx) =>
      idx === rowIndex ? { handle_or_url: nextValue } : entry
    );
    onChange(next);
  };

  const handleRemove = (rowIndex: number): void => {
    onChange(value.filter((_, idx) => idx !== rowIndex));
  };

  const handleAdd = (): void => {
    if (value.length >= MAX_ENTRIES) return;
    const base = value.length === 0 ? [{ handle_or_url: "" }] : value;
    onChange([...base, { handle_or_url: "" }]);
  };

  const canAdd = value.length < MAX_ENTRIES;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                data-testid={`card-5-input-${index}`}
                value={entry.handle_or_url}
                placeholder="@handle or TikTok profile URL"
                onChange={(e) => handleRowChange(index, e.target.value)}
              />
            </div>
            <button
              type="button"
              aria-label={`Remove creator ${index + 1}`}
              data-testid={`card-5-remove-${index}`}
              onClick={() => handleRemove(index)}
              className={cn(
                "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[8px] border border-white/[0.06] text-foreground-muted transition-colors",
                "hover:bg-white/[0.1] hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              )}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {canAdd && (
        <button
          type="button"
          data-testid="card-5-add"
          onClick={handleAdd}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-foreground-secondary transition-colors",
            "hover:bg-white/[0.05] hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          )}
        >
          + Add creator
        </button>
      )}
    </div>
  );
}
