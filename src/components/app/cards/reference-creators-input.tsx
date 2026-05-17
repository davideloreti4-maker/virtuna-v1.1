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

/**
 * `id` is a client-side stable key for React's reconciler — added per WR-11
 * so deleting the middle row does not re-key (and thus re-mount, losing focus
 * and selection) the rows after it. The `id` is stripped at the API boundary
 * by zod's default `.strip()` behavior, so it does not bloat the DB row.
 */
export interface ReferenceCreatorEntry {
  id?: string;
  handle_or_url: string;
}

export interface ReferenceCreatorsInputProps {
  value: ReferenceCreatorEntry[];
  onChange: (next: ReferenceCreatorEntry[]) => void;
}

const MAX_ENTRIES = 3;

function newId(): string {
  // crypto.randomUUID is available in modern browsers; fall back to a
  // monotonic Math.random for jsdom environments that lack it.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ref-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Ensure every entry has a stable `id` for React keying. Materializes IDs
 * for entries hydrated from the DB (where `id` was stripped) so subsequent
 * deletes don't re-mount the inputs.
 */
function ensureIds(
  entries: ReferenceCreatorEntry[]
): ReferenceCreatorEntry[] {
  return entries.map((entry) =>
    entry.id ? entry : { ...entry, id: newId() }
  );
}

export function ReferenceCreatorsInput({
  value,
  onChange,
}: ReferenceCreatorsInputProps): React.JSX.Element {
  // Show at least one input row when value is empty so the user has a target.
  const rows: ReferenceCreatorEntry[] =
    value.length === 0
      ? [{ id: "card-5-empty-row", handle_or_url: "" }]
      : ensureIds(value);

  const handleRowChange = (rowIndex: number, nextValue: string): void => {
    // If the prop value was empty and we synthesized a row, materialize it on first edit.
    const source: ReferenceCreatorEntry[] =
      value.length === 0
        ? [{ id: newId(), handle_or_url: "" }]
        : ensureIds(value);
    const next = source.map((entry, idx) =>
      idx === rowIndex ? { ...entry, handle_or_url: nextValue } : entry
    );
    onChange(next);
  };

  const handleRemove = (rowIndex: number): void => {
    onChange(value.filter((_, idx) => idx !== rowIndex));
  };

  const handleAdd = (): void => {
    if (value.length >= MAX_ENTRIES) return;
    const base: ReferenceCreatorEntry[] =
      value.length === 0
        ? [{ id: newId(), handle_or_url: "" }]
        : ensureIds(value);
    onChange([...base, { id: newId(), handle_or_url: "" }]);
  };

  const canAdd = value.length < MAX_ENTRIES;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((entry, index) => (
          <div
            key={entry.id ?? `idx-${index}`}
            className="flex items-center gap-2"
          >
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
