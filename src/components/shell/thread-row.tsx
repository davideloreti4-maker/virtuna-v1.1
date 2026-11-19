"use client";

import { useState } from "react";
import { Check, PencilSimple, PushPin, Trash, X } from "@phosphor-icons/react";
import type { ThreadSummary } from "@/hooks/queries";
import { FOCUS_RING, cn } from "@/lib/utils";

/**
 * One thread in the desktop sidebar's "Recent" list (new look, spec §6.2): 34 tall, 14px, one
 * line. Behaviour is the legacy row's, kept on purpose:
 *
 * - Open and the row actions are SIBLING buttons (a button cannot nest in a button).
 * - Pin, rename and delete stay hidden until the row is hovered or focused, and while hidden
 *   they take no pointer events: an invisible control must not be pressable.
 * - Delete is two-step (trash, then confirm), so one stray click never drops a thread. The
 *   confirm disarms when the pointer leaves the row.
 * - Rename replaces the row with a field. Enter and blur commit, Escape cancels. An emptied
 *   field clears the title, which hands the thread back to automatic naming.
 */
const ACTION = cn(
  "flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary",
  "transition-colors duration-150 hover:bg-active hover:text-foreground",
  FOCUS_RING,
);

export function ThreadRow({
  thread,
  isActive,
  onOpen,
  onDelete,
  onTogglePin,
  onRename,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const label = thread.title?.trim() || "New chat";
  const isPinned = thread.pinned_at != null;

  if (renaming) {
    return (
      <div className="flex h-[34px] items-center rounded-lg bg-surface-sunken px-3">
        <input
          autoFocus
          defaultValue={thread.title ?? ""}
          aria-label={`Rename ${label}`}
          placeholder="Thread name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(e.currentTarget.value);
              setRenaming(false);
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          onBlur={(e) => {
            onRename(e.currentTarget.value);
            setRenaming(false);
          }}
          className="w-full min-w-0 bg-transparent text-reading text-foreground outline-none placeholder:text-foreground-muted"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/row flex h-[34px] items-center rounded-lg transition-colors duration-150",
        isActive ? "bg-active" : "hover:bg-hover",
      )}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-reading",
          FOCUS_RING,
          isActive
            ? "font-[560] text-foreground"
            : "text-foreground-secondary group-hover/row:text-foreground",
        )}
      >
        {isPinned && <PushPin size={12} weight="fill" className="shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </button>

      {confirming ? (
        <div className="mr-1 flex items-center gap-0.5">
          <button type="button" onClick={onDelete} aria-label={`Delete ${label}`} className={cn(ACTION, "text-error hover:text-error")}>
            <Check size={14} weight="bold" aria-hidden />
          </button>
          <button type="button" onClick={() => setConfirming(false)} aria-label="Cancel delete" className={ACTION}>
            <X size={14} weight="bold" aria-hidden />
          </button>
        </div>
      ) : (
        // While hidden the actions also take no width, so the title runs the full row as in the
        // reference. They stay in the tab order (zero width, not display:none), and focusing one
        // opens the group through focus-within.
        <div
          className={cn(
            "pointer-events-none flex w-0 items-center gap-0.5 overflow-hidden opacity-0 transition-opacity duration-150",
            "group-hover/row:pointer-events-auto group-hover/row:mr-1 group-hover/row:w-auto group-hover/row:opacity-100",
            "focus-within:pointer-events-auto focus-within:mr-1 focus-within:w-auto focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
            aria-pressed={isPinned}
            className={cn(ACTION, isPinned && "text-foreground")}
          >
            <PushPin size={14} weight={isPinned ? "fill" : "regular"} aria-hidden />
          </button>
          <button type="button" onClick={() => setRenaming(true)} aria-label={`Rename ${label}`} className={ACTION}>
            <PencilSimple size={14} aria-hidden />
          </button>
          <button type="button" onClick={() => setConfirming(true)} aria-label={`Delete thread: ${label}`} className={ACTION}>
            <Trash size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
