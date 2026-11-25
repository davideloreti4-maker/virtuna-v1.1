"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowClockwise, LinkBreak, PencilSimple, Trash } from "@phosphor-icons/react";

import { DotsIcon } from "@/components/library-next/library-icons";
import { MENU_ITEM, MENU_PILL, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import { IconButton } from "@/components/ui/icon-button";
import { NAME_MAX, type AudiencePage } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, deleteQuestion, disconnectItem, disconnectQuestion, moreLabel, renameLabel } from "@/lib/audience-next/audience-words";
import { cn } from "@/lib/utils";

/**
 * The page's More (spec 2026-11-25-audience, 3.8): Rename, Read again (an account's audience, when the container
 * gives it), and by kind "Disconnect @handle" or "Delete audience", asked once more. Presentational: the
 * container sends. It stands on Library's layer (`row-menu-layer.tsx`: the phone's sheet, the desk's menu,
 * the focus rules); More is the drawing's 38 round button on the page's ground, always shown.
 *
 *   menu                    rename                 the question (focus on Cancel)
 *     Rename                  [ the name ]           Disconnect @nia.tests?
 *     Read again              [   Save   ]           Chats that use this audience go back to …
 *     Disconnect @nia.tests     Cancel               Cancel
 *                                                    [ Disconnect ]
 *
 * - Rename, as Library's chat rename: the field holds the name, at most 80 characters (the route's
 *   limit); Enter or Save sends it trimmed. An empty name is not sent (Save waits), an unchanged one sends
 *   nothing. A stored name already over 80 is not sent as it is either: the route would refuse it.
 * - The remove cannot be undone (an account's audience takes the account with it), as You's disconnect:
 *   the confirming button ignores every press for `CONFIRM_WAIT_MS` after the question appears, by the
 *   page's monotonic clock, so the second press of a double tap never confirms. A press in that window is
 *   dropped, not kept. Cancel works at once and has the focus.
 * - Read again closes the layer with the focus on More, then hands More to the container, whose question
 *   gives the focus back there.
 * - A closing layer does nothing (`live`): it stays on screen and pressable through its exit.
 * - A confirmed remove puts the focus on More before `onRemove`.
 */

const S = AUDIENCE_STRINGS;

/** How long the confirming Disconnect or Delete ignores presses once the question appears. */
const CONFIRM_WAIT_MS = 500;

export interface AudienceMenuProps {
  /** The audience's name: names More and the layer, and is what Rename starts from. */
  name: string;
  removal: AudiencePage["removal"];
  /** A new name: trimmed, 1 to 80 characters, not the current one. */
  onRename(name: string): void;
  /** The remove, confirmed: called with the focus on More. */
  onRemove(): void;
  /** Read again: called once the layer has closed with the focus on More, which it is handed. Without
   *  it the menu has no Read again. */
  onReadAgain?(more: HTMLButtonElement | null): void;
  /** Open on the menu from the start (the dev preview's `menu` state). */
  defaultOpen?: boolean;
}

type Step = "menu" | "rename" | "remove";

export function AudienceMenu({ name, removal, onRename, onRemove, onReadAgain, defaultOpen = false }: AudienceMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState<Step>("menu");
  const [draft, setDraft] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const lineId = useId();
  // Open as of the last tap, not the last render: two taps can land before a render, and a closing
  // layer stays pressable through its exit. Nothing acts once it is closing.
  const live = useRef(defaultOpen);
  // When the question appeared (`performance.now()`): the confirming button waits from there.
  const askedAt = useRef(0);

  const onOpenChange = (next: boolean) => {
    live.current = next;
    if (next) setStep("menu");
    setOpen(next);
  };
  const close = () => {
    live.current = false;
    setOpen(false);
  };
  /** Closes the layer with the focus on More, then `act`: what follows must find the focus there, not in
   *  the closing layer, where it would fall to the page once the layer is gone. */
  const closeThen = (act: () => void) => {
    if (!live.current) return;
    live.current = false;
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    act();
  };

  const startRename = () => {
    if (!live.current) return;
    setDraft(name);
    flushSync(() => setStep("rename"));
    fieldRef.current?.focus();
    fieldRef.current?.select();
  };
  const next = draft.trim();
  const sendable = next.length > 0 && next.length <= NAME_MAX;
  const save = () => {
    if (!live.current || !sendable) return; // the field stays
    close();
    if (next !== name.trim()) onRename(next);
  };

  const askRemove = () => {
    if (!live.current) return;
    flushSync(() => setStep("remove"));
    askedAt.current = performance.now();
    cancelRef.current?.focus();
  };
  const confirmRemove = () => {
    if (!live.current) return;
    // Inside the window the press is dropped, not kept for later.
    if (performance.now() - askedAt.current < CONFIRM_WAIT_MS) return;
    closeThen(onRemove);
  };
  const readAgain = () => closeThen(() => onReadAgain?.(triggerRef.current));

  const disconnect = removal.kind === "disconnect";
  const removeItem = disconnect ? disconnectItem(removal.handle) : S.deleteAudience;
  const question = disconnect ? disconnectQuestion(removal.handle) : deleteQuestion(name);
  const confirmWord = disconnect ? S.disconnect : S.delete;

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
              // Kept from going on: the focus moves to More on close, and the rest of an Enter must not
              // press it.
              e.preventDefault();
              save();
            }}
            aria-label={renameLabel(name)}
            placeholder={name}
            maxLength={NAME_MAX}
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            // 16 on the phone: iOS zooms the page into a field set smaller. 15 on a desk.
            className="h-11 w-full min-w-0 rounded-full bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-10 md:text-ui"
          />
        </MenuRow>
        <MenuRow>
          {/* `aria-disabled`, not `disabled`: Save stays in the tab order while it waits. */}
          <button
            type="button"
            onClick={save}
            aria-disabled={!sendable || undefined}
            className={cn(MENU_PILL, "bg-action text-action-foreground aria-disabled:cursor-default aria-disabled:opacity-40")}
          >
            {S.save}
          </button>
        </MenuRow>
        <MenuRow>
          <button type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            {S.cancel}
          </button>
        </MenuRow>
      </>
    );
  } else if (step === "remove") {
    rows = (
      <>
        <MenuRow>
          {/* Not selectable: the second click of a double click on the menu's item lands here and would
              leave a word highlighted. */}
          <div className="flex min-w-0 select-none flex-col justify-center gap-0.5 px-2 py-2">
            <p id={questionId} className="break-words text-ui font-[560] text-foreground">
              {question}
            </p>
            <p id={lineId} className="text-meta text-foreground-secondary">
              {S.removeLine}
            </p>
          </div>
        </MenuRow>
        <MenuRow>
          <button ref={cancelRef} type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            {S.cancel}
          </button>
        </MenuRow>
        <MenuRow>
          <button
            type="button"
            onClick={confirmRemove}
            aria-describedby={`${questionId} ${lineId}`}
            className={cn(MENU_PILL, "bg-surface-sunken text-error")}
          >
            {confirmWord}
          </button>
        </MenuRow>
      </>
    );
  } else {
    rows = (
      <>
        <MenuRow>
          <button ref={firstRef} type="button" onClick={startRename} className={MENU_ITEM}>
            <PencilSimple size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            {S.rename}
          </button>
        </MenuRow>
        {onReadAgain && (
          <MenuRow>
            <button type="button" onClick={readAgain} className={MENU_ITEM}>
              <ArrowClockwise size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {S.readAgain}
            </button>
          </MenuRow>
        )}
        <MenuRow>
          <button type="button" onClick={askRemove} className={MENU_ITEM}>
            {disconnect ? (
              <LinkBreak size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            ) : (
              <Trash size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            )}
            {removeItem}
          </button>
        </MenuRow>
      </>
    );
  }

  // The header: the audience's name; "Rename" while renaming (the name is in the field), still named for
  // the audience to a screen reader.
  const heading =
    step === "rename" ? (
      <>
        {S.rename}
        <span className="sr-only"> {name}</span>
      </>
    ) : (
      name
    );

  return (
    <RowMenuLayer
      name={name}
      heading={heading}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      waitsForRow={false}
      renderTrigger={(ref) => (
        <IconButton ref={ref} surface="ground" aria-label={moreLabel(name)} className="aria-expanded:bg-active">
          <DotsIcon aria-hidden />
        </IconButton>
      )}
    >
      {rows}
    </RowMenuLayer>
  );
}
