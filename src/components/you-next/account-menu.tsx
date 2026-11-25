"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LinkBreak, Star } from "@phosphor-icons/react";

import { MENU_ITEM, MENU_PILL, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import { cn } from "@/lib/utils";

import { DISCONNECT_LINE } from "./you-words";

/**
 * An account row's More on You (spec 2026-11-24 §3.1): Make primary (not on the primary account) and
 * Disconnect, asked once more with the existing warning. Presentational: the container sends. It
 * stands on Library's layer (`row-menu-layer.tsx`: More, the phone's sheet, the desk's menu, the
 * focus rules); More is always shown, as drawn (it does not wait for a hover).
 *
 *   menu                    the question (focus on Cancel)
 *     Make primary            Disconnect @nia.tests.kitchen?
 *     Disconnect              This removes its analytics history. …
 *                             Cancel
 *                             [ Disconnect ]
 *
 * - A disconnect cannot be undone from here (the account's snapshots and posts go with it), so the
 *   second press of a double tap, a double click or a second Enter must never confirm it. Where that
 *   press lands depends on where the question's rows fall (the phone's sheet stands on its bottom
 *   edge, the desk's menu on its top edge or, opened above More, its bottom; the warning is shown
 *   whole, one line or four), so it is not left to position: the confirming Disconnect ignores every
 *   press for `CONFIRM_WAIT_MS` after the question appears, by the page's monotonic clock. A press
 *   inside that window is dropped, not kept: nothing fires when it ends. The button looks and reads
 *   the same meanwhile (no `disabled`: the focus must not move). Cancel works at once; the focus is on
 *   it when the question appears. The window starts again each time the question appears.
 * - A closing layer does nothing (`live`, as Library's `RowMenu`): it stays on screen and pressable
 *   through its exit, and a second tap on Make primary or the confirming Disconnect there sends
 *   nothing more.
 * - A confirmed disconnect puts the focus on More before `onDisconnect`: the row leaves at once, and
 *   the screen hands the focus on from there.
 */
export interface AccountMenuProps {
  /** Without the "@". */
  handle: string;
  /** The account's name where the handle alone is not enough (`accountName`): "@handle on Instagram". */
  name?: string;
  primary: boolean;
  onMakePrimary(): void;
  onDisconnect(): void;
}

type Step = "menu" | "disconnect";

/** How long the confirming Disconnect ignores presses once the question appears. */
const CONFIRM_WAIT_MS = 500;

export function AccountMenu({ handle, name: given, primary, onMakePrimary, onDisconnect }: AccountMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();
  const lineId = useId();
  // Open as of the last tap, not the last render: two taps can land before a render. Nothing acts
  // once the layer is closing.
  const live = useRef(false);
  // When the question appeared (`performance.now()`): the confirming Disconnect waits from there.
  const askedAt = useRef(0);
  const name = given ?? `@${handle}`;

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
  const makePrimary = () => {
    if (!live.current) return;
    close();
    onMakePrimary();
  };
  const askDisconnect = () => {
    if (!live.current) return;
    flushSync(() => setStep("disconnect"));
    askedAt.current = performance.now();
    cancelRef.current?.focus();
  };
  const confirmDisconnect = () => {
    if (!live.current) return;
    // Inside the window the press is dropped, not kept for later.
    if (performance.now() - askedAt.current < CONFIRM_WAIT_MS) return;
    live.current = false;
    // The focus on More first: the row (and More with it) leaves at once, and the screen hands the
    // focus on from there. Left in the closing layer, it would fall to the page.
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    onDisconnect();
  };

  const rows =
    step === "disconnect" ? (
      <>
        <MenuRow>
          {/* Not selectable: the second click of a double click on the menu's Disconnect lands here
              and would leave a word of the warning highlighted. */}
          <div className="flex min-w-0 select-none flex-col justify-center gap-0.5 px-2 py-2">
            <p id={questionId} className="break-words text-ui font-[560] text-foreground">
              {`Disconnect ${name}?`}
            </p>
            <p id={lineId} className="text-meta text-foreground-secondary">
              {DISCONNECT_LINE}
            </p>
          </div>
        </MenuRow>
        <MenuRow>
          <button ref={cancelRef} type="button" onClick={close} className={cn(MENU_ITEM, "justify-center text-foreground-secondary")}>
            Cancel
          </button>
        </MenuRow>
        <MenuRow>
          <button
            type="button"
            onClick={confirmDisconnect}
            aria-describedby={`${questionId} ${lineId}`}
            className={cn(MENU_PILL, "bg-surface-sunken text-error")}
          >
            Disconnect
          </button>
        </MenuRow>
      </>
    ) : (
      <>
        {!primary && (
          <MenuRow>
            <button ref={firstRef} type="button" onClick={makePrimary} className={MENU_ITEM}>
              <Star size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              Make primary
            </button>
          </MenuRow>
        )}
        <MenuRow>
          <button ref={primary ? firstRef : undefined} type="button" onClick={askDisconnect} className={MENU_ITEM}>
            <LinkBreak size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
            Disconnect
          </button>
        </MenuRow>
      </>
    );

  return (
    <RowMenuLayer
      name={name}
      heading={name}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={firstRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      waitsForRow={false}
    >
      {rows}
    </RowMenuLayer>
  );
}
