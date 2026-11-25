"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { useDeleteSavedItem, useSaveItem, useSavedItemByRef } from "@/hooks/queries/use-saved-items";
import { useSaveProvenance } from "@/lib/save-provenance-context";
import type { SavedItemType } from "@/lib/shelf/shelf-repo";

import { BookmarkIcon, CopyIcon } from "./answer-icons";

/**
 * Copy and Save in the details sheet (spec §3): round icon buttons, 44 (drawn 40, `.ax-qi`), on the
 * sunken tint. Save is a new-look button over today's saved-items hooks, with the same identity as
 * `SaveAffordance` (`src/components/thread/save-affordance.tsx:58-101`): the ref is the rendering
 * block's `${messageId}:${index}` (`BlockOriginContext`), the thread is `ThreadIdContext`. Saved: the
 * filled bookmark in ink (never the accent), and "Saved" announced. Copy announces "Copied".
 */

const COPIED_MS = 1600;
const ROUND = "h-11 w-11";

export function CopyButton({ copied, onCopy }: { copied: boolean; onCopy?: () => void }) {
  return (
    <>
      <IconButton surface="card" aria-label="Copy" onClick={onCopy} disabled={!onCopy} className={ROUND}>
        <CopyIcon aria-hidden />
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

export function SaveButton({ saved, onToggle }: { saved: boolean; onToggle?: () => void }) {
  return (
    <>
      <IconButton surface="card" aria-label="Save" aria-pressed={saved} onClick={onToggle} disabled={!onToggle} className={ROUND}>
        <BookmarkIcon aria-hidden filled={saved} />
      </IconButton>
      <span role="status" className="sr-only">
        {saved ? "Saved" : ""}
      </span>
    </>
  );
}

/** Writes `text` to the clipboard; `copied` for 1.6 s after. No clipboard (an insecure page): nothing. */
export function useCopyText(text: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {},
    );
  }, [text]);
  return { copied, copy };
}

/** `SaveAffordance`'s state, without its look: saved, and the toggle (save, or remove a row we can name; nothing while busy). */
export function useSaveToggle({
  itemType,
  title,
  snapshot,
}: {
  itemType: SavedItemType;
  title: string;
  snapshot: Record<string, unknown>;
}): { saved: boolean; toggle: () => void } {
  const save = useSaveItem();
  const remove = useDeleteSavedItem();
  const { threadId, refId } = useSaveProvenance();
  const { item: savedRow } = useSavedItemByRef(itemType, refId);
  // A block with no identity (a live run) keeps the per-mount flag and cannot be removed.
  const savedThisMount = refId === null && save.isSuccess;
  const saved = savedRow !== undefined || savedThisMount;
  // Until the list's refetch brings the real row, the row shown is the save's optimistic stand-in
  // (`useSaveItem`): it has no row to remove yet, so the toggle waits for it.
  const rowPending = savedRow?.id.startsWith("optimistic-") ?? false;
  const busy = save.isPending || remove.isPending || rowPending;
  const toggle = () => {
    if (busy) return;
    if (savedRow) {
      remove.mutate(savedRow.id);
      return;
    }
    if (savedThisMount) return;
    save.mutate({ item_type: itemType, ref_id: refId, thread_id: threadId, title, snapshot });
  };
  return { saved, toggle };
}
