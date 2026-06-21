"use client";

/**
 * SaveAffordance — reusable "Save → Saved ✓" button for thread output cards
 * (Plan 10-04 Task 2, SAVE-02). The Act→State affordance: any typed thread
 * output can be saved to the flat Saved shelf.
 *
 * Interaction contract (10-UI-SPEC §Interaction Contracts + §Color):
 *  - Default: "Save" + bookmark icon (cream-secondary chrome).
 *  - On success: flips to "Saved ✓" with a CREAM-SECONDARY check — NEVER coral
 *    (mirrors STATE 05-04 "checkmark uses cream-secondary, never coral").
 *  - POSTs { item_type, ref_id?, thread_id?, title?, snapshot } via useSaveItem.
 *    `snapshot` = the block's own props so the shelf renders the SAME typed
 *    renderer without a re-fetch.
 *
 * Mount points: hook/idea/script/remix/outlier output cards (and — added in
 * Plan 05 — the account-read card).
 */

import { BookmarkSimple, Check } from "@phosphor-icons/react";
import { useSaveItem } from "@/hooks/queries/use-saved-items";
import type { SavedItemInput, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";

export interface SaveAffordanceProps {
  item_type: SavedItemType;
  /** Optional external ref (e.g. a persisted card/thread row id). */
  ref_id?: string | null;
  /** The thread this output belongs to (for "Use in thread →" provenance). */
  thread_id?: string | null;
  /** Human-readable title shown on the shelf card. */
  title?: string | null;
  /** The block's own props — persisted so the shelf renders without re-fetch. */
  snapshot: Record<string, unknown>;
  className?: string;
}

export function SaveAffordance({
  item_type,
  ref_id,
  thread_id,
  title,
  snapshot,
  className,
}: SaveAffordanceProps) {
  const save = useSaveItem();
  const saved = save.isSuccess;

  const handleSave = () => {
    if (saved || save.isPending) return;
    const input: SavedItemInput = {
      item_type,
      ref_id: ref_id ?? null,
      thread_id: thread_id ?? null,
      title: title ?? null,
      snapshot,
    };
    save.mutate(input);
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saved || save.isPending}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
        // Cream chrome — NEVER coral, in either state (UI-SPEC §Color).
        "text-foreground-secondary hover:text-foreground",
        (saved || save.isPending) && "cursor-default",
        className,
      )}
      aria-label={saved ? "Saved to shelf" : "Save to shelf"}
      title={saved ? "Saved to your shelf" : "Save this to your shelf"}
    >
      {saved ? (
        <>
          {/* Cream-secondary check — never coral (STATE 05-04). */}
          <Check size={16} weight="bold" className="text-foreground-secondary" />
          Saved
        </>
      ) : (
        <>
          <BookmarkSimple size={16} weight="regular" />
          {save.isPending ? "Saving…" : "Save"}
        </>
      )}
    </button>
  );
}
