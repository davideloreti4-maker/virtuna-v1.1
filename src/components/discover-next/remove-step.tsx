"use client";

import * as React from "react";
import { useId } from "react";

import { MENU_ITEM, MENU_PILL, MenuRow } from "@/components/library-next/row-menu-layer";
import { DISCOVER_STRINGS, removeQuestion } from "@/lib/discover-next/discover-words";
import { cn } from "@/lib/utils";

/**
 * The question a followed creator's Remove asks inside its menu (`RowMenuLayer`): "Remove @jay.makes?",
 * Cancel, and the confirming Remove. One for the Watchlist row and a creator's page. Presentational.
 *
 * - Remove clears the creator for good, so the caller puts the focus on Cancel as the question appears.
 * - The confirming Remove ignores every press for 500 ms after the question appears (as You's
 *   Disconnect, `account-menu.tsx`): the second press of a double tap lands there, wherever the rows
 *   fall. It looks the same meanwhile (no `disabled`: the focus must not move).
 */

/** How long the confirming Remove ignores presses once the question appears. */
export const CONFIRM_WAIT_MS = 500;

const S = DISCOVER_STRINGS.watchlist;

export interface RemoveStepProps {
  /** Bare: "Remove @jay.makes?". */
  handle: string;
  /** When the question appeared (`performance.now()`). */
  askedAt: React.RefObject<number>;
  /** The caller focuses Cancel when the question appears. */
  cancelRef: React.RefObject<HTMLButtonElement | null>;
  onCancel(): void;
  /** Only 500 ms or more after the question appeared. */
  onConfirm(): void;
}

export function RemoveStep({ handle, askedAt, cancelRef, onCancel, onConfirm }: RemoveStepProps): React.JSX.Element {
  const questionId = useId();
  const confirm = () => {
    // Inside the window the press is dropped, not kept for later.
    if (performance.now() - askedAt.current < CONFIRM_WAIT_MS) return;
    onConfirm();
  };
  return (
    <>
      <MenuRow>
        {/* Not selectable: the second click of a double click on the menu's Remove lands here. */}
        <div className="flex min-w-0 select-none flex-col justify-center px-2 py-2">
          <p id={questionId} className="break-words text-ui font-[560] text-foreground">
            {removeQuestion(handle)}
          </p>
        </div>
      </MenuRow>
      <MenuRow>
        <button ref={cancelRef} type="button" onClick={onCancel} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
          {S.cancel}
        </button>
      </MenuRow>
      <MenuRow>
        <button type="button" onClick={confirm} aria-describedby={questionId} className={cn(MENU_PILL, "bg-surface-sunken text-error")}>
          {S.remove}
        </button>
      </MenuRow>
    </>
  );
}
