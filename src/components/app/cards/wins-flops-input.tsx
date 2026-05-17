"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * WinsFlopsInput — Card 6 of the 9-card creator interview (PROFILE-09 past performance).
 *
 * Two-column dynamic URL list: up to 2 "past wins" URLs and up to 2 "past flops"
 * URLs. Each column has its own +Add button visible only when its list is below 2.
 *
 * The TruthfulnessCallout for Card 6 is rendered by the parent modal (Plan 02-04),
 * NOT from inside this picker.
 *
 * Pure controlled.
 */

/**
 * `id` is a client-side stable key for React's reconciler — added per WR-11
 * so deleting the middle row does not re-key (and thus re-mount, losing focus
 * and selection) the rows after it. The `id` is stripped at the API boundary
 * by zod's default `.strip()` behavior, so it does not bloat the DB row.
 */
export interface UrlEntry {
  id?: string;
  url: string;
}

export interface WinsFlopsInputProps {
  wins: UrlEntry[];
  flops: UrlEntry[];
  onChange: (next: { wins: UrlEntry[]; flops: UrlEntry[] }) => void;
}

const MAX_PER_COLUMN = 2;

type Column = "win" | "flop";

function newUrlId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `url-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function ensureUrlIds(entries: UrlEntry[]): UrlEntry[] {
  return entries.map((entry) =>
    entry.id ? entry : { ...entry, id: newUrlId() }
  );
}

interface ColumnProps {
  column: Column;
  heading: string;
  entries: UrlEntry[];
  otherEntries: UrlEntry[];
  /** Builder that returns the WCAG-required aria-label literal for the remove button. */
  removeLabel: (index: number) => string;
  /** Addition CTA label, e.g. "+ Add win" or "+ Add flop". */
  addLabel: string;
  onChange: WinsFlopsInputProps["onChange"];
}

function UrlColumn({
  column,
  heading,
  entries,
  otherEntries,
  removeLabel,
  addLabel,
  onChange,
}: ColumnProps): React.JSX.Element {
  const rows: UrlEntry[] =
    entries.length === 0
      ? [{ id: `card-6-${column}-empty-row`, url: "" }]
      : ensureUrlIds(entries);
  const canAdd = entries.length < MAX_PER_COLUMN;

  const emit = (nextEntries: UrlEntry[]): void => {
    if (column === "win") {
      onChange({ wins: nextEntries, flops: otherEntries });
    } else {
      onChange({ wins: otherEntries, flops: nextEntries });
    }
  };

  const handleRowChange = (rowIndex: number, nextValue: string): void => {
    const source: UrlEntry[] =
      entries.length === 0
        ? [{ id: newUrlId(), url: "" }]
        : ensureUrlIds(entries);
    const next = source.map((entry, idx) =>
      idx === rowIndex ? { ...entry, url: nextValue } : entry
    );
    emit(next);
  };

  const handleRemove = (rowIndex: number): void => {
    emit(entries.filter((_, idx) => idx !== rowIndex));
  };

  const handleAdd = (): void => {
    if (entries.length >= MAX_PER_COLUMN) return;
    const base: UrlEntry[] =
      entries.length === 0
        ? [{ id: newUrlId(), url: "" }]
        : ensureUrlIds(entries);
    emit([...base, { id: newUrlId(), url: "" }]);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{heading}</p>
      <div className="space-y-2">
        {rows.map((entry, index) => (
          <div
            key={entry.id ?? `idx-${index}`}
            className="flex items-center gap-2"
          >
            <div className="flex-1">
              <Input
                data-testid={`card-6-${column}-${index}`}
                value={entry.url}
                placeholder="TikTok video URL"
                onChange={(e) => handleRowChange(index, e.target.value)}
              />
            </div>
            <button
              type="button"
              aria-label={removeLabel(index)}
              data-testid={`card-6-${column}-remove-${index}`}
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
          data-testid={`card-6-${column}-add`}
          onClick={handleAdd}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-foreground-secondary transition-colors",
            "hover:bg-white/[0.05] hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          )}
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

export function WinsFlopsInput({
  wins,
  flops,
  onChange,
}: WinsFlopsInputProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UrlColumn
        column="win"
        heading="Past wins"
        entries={wins}
        otherEntries={flops}
        // Literal "Remove win N" — see WCAG aria-label requirement in 02-UI-SPEC §Accessibility.
        removeLabel={(index) => `Remove win ${index + 1}`}
        addLabel="+ Add win"
        onChange={onChange}
      />
      <UrlColumn
        column="flop"
        heading="Past flops"
        entries={flops}
        otherEntries={wins}
        // Literal "Remove flop N" — see WCAG aria-label requirement in 02-UI-SPEC §Accessibility.
        removeLabel={(index) => `Remove flop ${index + 1}`}
        addLabel="+ Add flop"
        onChange={onChange}
      />
    </div>
  );
}
