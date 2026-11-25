"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LinkBreak, LinkSimple, PencilSimple, PushPin, Trash } from "@phosphor-icons/react";

import { RemovePostedRows } from "@/components/posted-next/after-posting-card";
import { POSTED_STRINGS } from "@/lib/posted/posted-words";
import { cn } from "@/lib/utils";

import { MENU_ITEM, MENU_PILL, MenuRow, RowMenuLayer } from "./row-menu-layer";

/**
 * A chat row's More (spec 2026-11-23 §3.5): the sidebar's own actions on a chat, Rename,
 * Pin or Unpin, Delete, for the phone, which has no sidebar; and (after posting, plan
 * 2026-11-24-after-posting) the chat's posted link. Presentational: the container sends.
 *
 *   phone: a small bottom sheet named for the chat     desk (768 up): the same, standing on More
 *     Gym hooks, the 5am test             (x)            menu      rename          delete
 *     Rename                                             Rename    [ the title ]   Delete this chat?
 *     Pin                                                Pin       [   Save    ]   [   Delete    ]
 *     Add posted link | Remove posted link               (posted)
 *     Delete                                             Delete      Cancel          Cancel
 *
 * - The More button: three dots, 24 drawn on the phone (38 from 768), 44 to tap on touch. Always
 *   shown on a phone and on touch; on a desk with a mouse it waits for the row's hover or focus (and
 *   while hidden it takes no pointer events). A tap focuses it (Safari does not).
 * - Rename turns the layer into a field with the chat's own title (empty for an untitled chat, its
 *   shown title the placeholder), at most 200 characters (the server's limit). Enter or Save sends
 *   the trimmed title; an empty one is not sent and an unchanged one sends nothing. Escape, Cancel,
 *   the cross or a tap outside cancel.
 * - A closing layer does nothing: it stays on screen through its exit, and a second tap on Pin,
 *   Save or the confirming Delete there must not send a second request.
 * - Delete is asked once more ("Delete this chat?"), with the focus on Cancel, the safe default (as
 *   the sidebar's two-step delete). Every step's rows are of one shape and Delete is the menu's last
 *   row, so a second tap where Delete was lands on Cancel (the phone's sheet stands on its bottom
 *   edge), or below the shorter step (the desk's menu, on its top edge), never on the confirming Delete.
 * - The posted item, third, when the container gives one: "Add posted link" (a chat with a simulated
 *   piece and no posted link) closes the menu with the focus on More, and the container opens its
 *   sheet; "Remove posted link" (a chat with one) is asked once more, as on the result page's card
 *   (`RemovePostedRows`: "Remove the posted link?", Remove, Cancel, the focus on Cancel). With four rows
 *   the confirming Remove can stand where "Remove posted link" stood (the phone's sheet): it ignores
 *   every press for its first 500 ms, which is what keeps a double tap from removing.
 * - Focus: on opening, Rename. Every close hands it back to More (`row-menu-layer.tsx`). A
 *   confirmed delete puts it on More before `onDelete`, so the list can hand it on once the row
 *   leaves. The layers carry `data-row-menu`: the list counts a focus in them as still the row's.
 * - The layers are portalled (`row-menu-layer.tsx`), and nothing in them is inside the row's open
 *   button: no tap on More, nor anywhere in its layer, reaches the row. The desk's menu is modal, as
 *   a menu is: a tap outside only closes it, it does not go through to another row.
 * - More, the sheet, the desk's menu, the header and the focus rules are the shared layer's
 *   (`RowMenuLayer`, also You's account rows); the steps and their rows are this file's.
 */

export interface RowMenuProps {
  /** The chat's title as its row shows it: names More, the layer, and the rename field. */
  title: string;
  /** What Rename starts from: the chat's own title, "" for an untitled chat. */
  renameFrom: string;
  pinned: boolean;
  /** What the chat holds as its row says it, in lower case ("5 hooks", "video"), for the delete
   *  step's line; null or absent for a plain chat (only messages). */
  inside?: string | null;
  /** A new title, trimmed and never empty. */
  onRename(title: string): void;
  onTogglePin(): void;
  onDelete(): void;
  /** The posted item (after posting): "add" for a chat with a simulated piece and no posted link,
   *  "remove" for a chat with one; null or absent for neither. */
  posted?: "add" | "remove" | null;
  /** "Add posted link": called once the menu has closed with the focus on More, which it is handed
   *  (the sheet it opens gives the focus back there). */
  onAddPosted?(more: HTMLButtonElement | null): void;
  /** "Remove posted link", confirmed: called with the focus on More. */
  onRemovePosted?(): void;
}

type Step = "menu" | "rename" | "delete" | "remove-posted";

/** The longest title the server takes (`PATCH /api/threads/[id]`); it stores at most 48 of it. */
const TITLE_MAX = 200;

/** The delete step's quiet line: what goes with the chat, and that it is for good. */
function deleteLine(inside: string | null | undefined): string {
  return inside ? `This also deletes what's in it (${inside}). It can't be undone.` : "It can't be undone.";
}

export function RowMenu({
  title,
  renameFrom,
  pinned,
  inside,
  onRename,
  onTogglePin,
  onDelete,
  posted = null,
  onAddPosted,
  onRemovePosted,
}: RowMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [draft, setDraft] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const lineId = useId();
  // Open as of the last tap, not the last render: a closing layer stays on screen (and pressable)
  // through its 300 ms exit, and two taps can land before a render. Nothing acts once it is closing.
  const live = useRef(false);

  // A layer opens on the menu; a closing one keeps its step while it leaves.
  const onOpenChange = (next: boolean) => {
    live.current = next;
    if (next) setStep("menu");
    setOpen(next);
  };
  const close = () => {
    live.current = false;
    setOpen(false);
  };

  const startRename = () => {
    if (!live.current) return;
    setDraft(renameFrom);
    flushSync(() => setStep("rename"));
    fieldRef.current?.focus();
    fieldRef.current?.select();
  };
  const next = draft.trim();
  const save = () => {
    if (!live.current || !next) return; // an empty title is not sent: the field stays
    close();
    if (next !== renameFrom.trim()) onRename(next);
  };
  const togglePin = () => {
    if (!live.current) return;
    close();
    onTogglePin();
  };
  const askDelete = () => {
    if (!live.current) return;
    flushSync(() => setStep("delete"));
    cancelRef.current?.focus();
  };
  /** Closes the layer with the focus on More, then `act`. A row's action that changes or removes the
   *  row (a delete, a posted link) must find the focus there, not in the closing layer, where it would
   *  fall to the page once the layer is gone. */
  const closeThen = (act: (() => void) | undefined) => {
    if (!live.current) return;
    live.current = false;
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    act?.();
  };
  // The row (and More with it) leaves at once; the list hands the focus on from More.
  const confirmDelete = () => closeThen(onDelete);
  // The container opens its sheet: it takes the focus from More, and gives it back there.
  const addPosted = () => closeThen(() => onAddPosted?.(triggerRef.current));
  const askRemovePosted = () => {
    if (!live.current) return;
    flushSync(() => setStep("remove-posted"));
    cancelRef.current?.focus();
  };
  // Under Posted the row then leaves, and the list hands the focus on from More.
  const removePosted = () => closeThen(onRemovePosted);

  let rows: React.ReactNode;
  if (step === "rename") {
    rows = (
      <>
        <MenuRow>
          <input
            ref={fieldRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
              // Kept from going on: the focus moves to More on close, and the rest of an Enter must
              // not press it (the sidebar's rename learned this).
              e.preventDefault();
              save();
            }}
            aria-label={`Rename ${title}`}
            placeholder={title}
            maxLength={TITLE_MAX}
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            // 16 on the phone: iOS zooms the page into a field set smaller. 15 on a desk.
            className="h-11 w-full min-w-0 rounded-full bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-10 md:text-ui"
          />
        </MenuRow>
        <MenuRow>
          {/* `aria-disabled`, not `disabled`: Save stays in the tab order and says why it waits. */}
          <button
            type="button"
            onClick={save}
            aria-disabled={next === "" || undefined}
            className={cn(MENU_PILL, "bg-action text-action-foreground aria-disabled:cursor-default aria-disabled:opacity-40")}
          >
            Save
          </button>
        </MenuRow>
        <MenuRow>
          <button type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            Cancel
          </button>
        </MenuRow>
      </>
    );
  } else if (step === "delete") {
    rows = (
      <>
        <MenuRow>
          {/* The question and, under it, what goes. 52 tall on a desk too (two lines of 16 under
              a 20 line): the header gives up the 8 above, so the rows below keep their places. */}
          <div className="flex min-w-0 flex-col justify-center px-2 md:h-[52px]">
            <p id={questionId} className="text-ui font-[560] leading-5 text-foreground">
              Delete this chat?
            </p>
            <p id={lineId} className="line-clamp-2 text-label leading-4 text-foreground-secondary">
              {deleteLine(inside)}
            </p>
          </div>
        </MenuRow>
        <MenuRow>
          <button
            type="button"
            onClick={confirmDelete}
            aria-describedby={`${questionId} ${lineId}`}
            className={cn(MENU_PILL, "bg-surface-sunken text-error")}
          >
            Delete
          </button>
        </MenuRow>
        <MenuRow>
          <button ref={cancelRef} type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            Cancel
          </button>
        </MenuRow>
      </>
    );
  } else if (step === "remove-posted") {
    rows = <RemovePostedRows cancelRef={cancelRef} onRemove={removePosted} onCancel={close} />;
  } else {
    rows = (
      <>
        <MenuRow>
          <button ref={firstRef} type="button" onClick={startRename} className={MENU_ITEM}>
            <PencilSimple size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            Rename
          </button>
        </MenuRow>
        <MenuRow>
          <button type="button" onClick={togglePin} className={MENU_ITEM}>
            <PushPin size={18} weight={pinned ? "fill" : "regular"} aria-hidden className="shrink-0 text-foreground-secondary" />
            {pinned ? "Unpin" : "Pin"}
          </button>
        </MenuRow>
        {posted === "add" && (
          <MenuRow>
            <button type="button" onClick={addPosted} className={MENU_ITEM}>
              <LinkSimple size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {POSTED_STRINGS.addItem}
            </button>
          </MenuRow>
        )}
        {posted === "remove" && (
          <MenuRow>
            <button type="button" onClick={askRemovePosted} className={MENU_ITEM}>
              <LinkBreak size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {POSTED_STRINGS.removeItem}
            </button>
          </MenuRow>
        )}
        <MenuRow>
          <button type="button" onClick={askDelete} className={MENU_ITEM}>
            <Trash size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            Delete
          </button>
        </MenuRow>
      </>
    );
  }

  // The header: the chat's name; "Rename" while renaming (the name is in the field), still named
  // for the chat to a screen reader.
  const heading =
    step === "rename" ? (
      <>
        Rename<span className="sr-only"> {title}</span>
      </>
    ) : (
      title
    );

  return (
    <RowMenuLayer
      name={title}
      heading={heading}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      shortHeader={step === "delete"}
    >
      {rows}
    </RowMenuLayer>
  );
}
