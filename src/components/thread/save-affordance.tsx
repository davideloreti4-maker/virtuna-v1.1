"use client";

/**
 * SaveAffordance — the "Save ⇄ Saved" toggle on thread output cards (SAVE-02).
 *
 * ⚠️ REWRITTEN 2026-08-02 (lane/library-rework). It shipped WRITE-ONLY: saved state came from
 * `save.isSuccess`, which is per-mount mutation state. Consequences, all live:
 *   - a card saved last week rendered "Save" again on every fresh mount;
 *   - clicking it wrote a SECOND row, because nothing deduplicated;
 *   - there was no way to un-save from the card you saved it on.
 *
 * State now comes from the saved-items store, keyed on the item's IDENTITY
 * (item_type, ref_id) — `${messageId}:${index}`, stable across reloads because message bodies are
 * immutable. That is the same key the partial unique index enforces in Postgres, so the client
 * and the database agree on what "already saved" means.
 *
 * A block with no identity (a live run has no message row yet; /dev/cards has no thread at all)
 * cannot be looked up, so it falls back to the old per-mount flag and does NOT offer un-save —
 * it has no row id to remove. Honest degradation rather than a guessed identity.
 *
 * COLOUR — this deliberately contradicts an older spec. Plan 10's UI-SPEC said the saved state
 * uses a cream-secondary check, "never coral". That rule was written against the RETIRED Raycast
 * coral (#FF7F50). Sketch rev 4 (owner-signed-off 2026-08-02) and rev 5 assign the current accent
 * #FF6363 to exactly three places — the checked box, the in-thread bookmark, and the save
 * confirmation — because accent means liveness and interactive state. A filled accent bookmark
 * here IS that rule, not a violation of it. Do not "restore" the cream check.
 */

import { BookmarkSimple } from "@phosphor-icons/react";
import {
  useSaveItem,
  useDeleteSavedItem,
  useSavedItemByRef,
} from "@/hooks/queries/use-saved-items";
import { useSaveProvenance } from "@/lib/save-provenance-context";
import type { SavedItemInput, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";

export interface SaveAffordanceProps {
  item_type: SavedItemType;
  /**
   * Optional external ref. Normally LEFT UNSET: it falls back to the rendering block's
   * `${messageId}:${index}` from SaveProvenanceContext. Pass it only where a truer id exists —
   * e.g. an outlier tile's `platformVideoId`, which identifies the video across threads.
   */
  ref_id?: string | null;
  /** The thread this output belongs to. Falls back to the thread being rendered. */
  thread_id?: string | null;
  /** Human-readable title shown on the shelf card. */
  title?: string | null;
  /** The block's own props — persisted so the shelf renders without re-fetch. */
  snapshot: Record<string, unknown>;
  className?: string;
  /** Render the icon only (no "Save"/"Saved" label) — for dense/cover-forward surfaces. */
  iconOnly?: boolean;
}

export function SaveAffordance({
  item_type,
  ref_id,
  thread_id,
  title,
  snapshot,
  className,
  iconOnly = false,
}: SaveAffordanceProps) {
  const save = useSaveItem();
  const remove = useDeleteSavedItem();
  // Provenance the renderers cannot pass — they are all invoked as `<Component block={block} />`.
  // An explicit prop always wins; context only fills what the caller left unset.
  const provenance = useSaveProvenance();

  const effectiveRef = ref_id ?? provenance.refId;
  const { item: savedRow } = useSavedItemByRef(item_type, effectiveRef);

  // Identity-less blocks keep the old per-mount behaviour — there is nothing to match them to.
  const savedThisMount = effectiveRef === null && save.isSuccess;
  const saved = savedRow !== undefined || savedThisMount;
  // Only a row we can name can be un-saved.
  const canUnsave = savedRow !== undefined;
  const busy = save.isPending || remove.isPending;

  const handleClick = () => {
    if (busy) return;

    if (savedRow) {
      remove.mutate(savedRow.id);
      return;
    }
    // Saved this mount but unidentifiable: refuse rather than write a duplicate row.
    if (savedThisMount) return;

    const input: SavedItemInput = {
      item_type,
      ref_id: effectiveRef,
      thread_id: thread_id ?? provenance.threadId,
      title: title ?? null,
      snapshot,
    };
    save.mutate(input);
  };

  const label = saved
    ? canUnsave
      ? "Remove from your Library"
      : "Saved to shelf"
    : "Save to shelf";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || (saved && !canUnsave)}
      aria-pressed={saved}
      className={cn(
        // `tap-44`: measured 55×20 on a phone (F-19). It rides the action bar's baseline beside a
        // filled primary, so the box stays put and only the hit area grows, on coarse pointers.
        "tap-44 inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        saved
          ? "text-accent hover:text-accent/80"
          : "text-foreground-secondary hover:text-foreground",
        busy && "cursor-default",
        saved && !canUnsave && "cursor-default",
        className,
      )}
      aria-label={label}
      title={
        saved
          ? canUnsave
            ? "Saved — click to remove from your Library"
            : "Saved to your Library"
          : "Save this to your Library"
      }
    >
      {/* One icon in two weights, so the glyph never jumps between states. */}
      <BookmarkSimple size={16} weight={saved ? "fill" : "regular"} />
      {!iconOnly && (busy ? (save.isPending ? "Saving…" : "Removing…") : saved ? "Saved" : "Save")}
    </button>
  );
}
