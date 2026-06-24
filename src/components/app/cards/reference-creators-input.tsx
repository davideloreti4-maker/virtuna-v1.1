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

export function ReferenceCreatorsInput({
  value,
  onChange,
}: ReferenceCreatorsInputProps): React.JSX.Element {
  // CR-A (iter-3 of WR-11): materialize stable IDs ONCE per entry reference.
  // The previous implementation called `ensureIds(value)` in both the render
  // path and the change handler, but `ensureIds` returns NEW objects with
  // NEW UUIDs on every invocation, so render-time key and handler-time key
  // diverged. On the first keystroke the React reconciler saw a different
  // `key`, unmounted the input, and dropped the cursor.
  //
  // The fix has two layers:
  //   1. A stable empty-row id (via useState initializer) used by both
  //      render and handler when `value.length === 0`.
  //   2. A WeakMap-style cache (useRef<Map<entry, id>>) so id-less entries
  //      hydrated from the DB get a UUID assigned ONCE per reference. Entry
  //      references are preserved across re-renders by the parent's state
  //      (setReferenceCreators preserves array reference until the user
  //      edits), and `handleRowChange` attaches the materialized id to the
  //      replacement entry before emitting — so the key survives the edit.
  const [emptyRowId] = React.useState(newId);
  const idCacheRef = React.useRef<Map<ReferenceCreatorEntry, string>>(
    new Map()
  );

  const materializeId = React.useCallback(
    (entry: ReferenceCreatorEntry): string => {
      if (entry.id) return entry.id;
      const cached = idCacheRef.current.get(entry);
      if (cached) return cached;
      const fresh = newId();
      idCacheRef.current.set(entry, fresh);
      return fresh;
    },
    []
  );

  const rows: Array<{ id: string; handle_or_url: string }> = React.useMemo(
    () =>
      value.length === 0
        ? [{ id: emptyRowId, handle_or_url: "" }]
        : value.map((entry) => ({
            id: materializeId(entry),
            handle_or_url: entry.handle_or_url,
          })),
    [value, emptyRowId, materializeId]
  );

  const handleRowChange = (rowIndex: number, nextValue: string): void => {
    // Use the SAME ids that render is using, so the React key is stable.
    const next: ReferenceCreatorEntry[] = rows.map((row, idx) =>
      idx === rowIndex
        ? { id: row.id, handle_or_url: nextValue }
        : { id: row.id, handle_or_url: row.handle_or_url }
    );
    onChange(next);
  };

  const handleRemove = (rowIndex: number): void => {
    // Drop from the materialized rows (carrying stable ids) so the
    // post-delete order keeps every surviving row's identity intact.
    const next: ReferenceCreatorEntry[] = rows
      .filter((_, idx) => idx !== rowIndex)
      .map((row) => ({ id: row.id, handle_or_url: row.handle_or_url }));
    onChange(next);
  };

  const handleAdd = (): void => {
    if (value.length >= MAX_ENTRIES) return;
    const base: ReferenceCreatorEntry[] = rows.map((row) => ({
      id: row.id,
      handle_or_url: row.handle_or_url,
    }));
    onChange([...base, { id: newId(), handle_or_url: "" }]);
  };

  const canAdd = value.length < MAX_ENTRIES;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((entry, index) => (
          <div
            key={entry.id}
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
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
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
          )}
        >
          + Add creator
        </button>
      )}
    </div>
  );
}
