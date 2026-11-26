"use client";

import * as React from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";

import { SheetShell } from "@/components/discover-next/sheet-shell";
import { Button } from "@/components/ui/button";
import { ErrorLine } from "@/components/you-next/row-parts";
import { canDelete, type PlanView } from "@/lib/settings/plan-view";
import { cn } from "@/lib/utils";

import { FIELD, FIELD_LABEL } from "./password-row";
import {
  BLOCKED_NEXT,
  BLOCKED_TITLE,
  CANCEL,
  CANCEL_ON_WHOP,
  CANT_UNDO,
  CLOSE,
  DELETE_ACCOUNT,
  DELETE_BODY,
  DELETE_FAILED,
  DELETE_WHOP_UNREACHABLE,
  DELETE_WORD,
  DELETING,
  TYPE_DELETE,
  blockedBody,
  creditsLost,
  deleteTitle,
  opensWhop,
} from "./settings-words";

/**
 * Delete account (spec 2026-11-26-settings-design 2.4; drawing frames 8 and 9): a sheet on a phone, a
 * dialog from 768 (`SheetShell`), with two faces. Presentational: `onDelete` is the container's (the
 * server checks the plan again, removes the files, then the account) and answers what happened.
 *
 *   a plan renews      "Cancel your plan first": why, "Cancel on Whop" (a link, new tab), Close
 *   otherwise          "Delete nia@example.com?": what goes, the credits lost, "This can't be undone.",
 *                      the field "Type DELETE", Delete account (waits for exactly DELETE), Cancel
 *
 * - The face follows the plan the page read (`canDelete`), when the sheet opens and whenever that read
 *   changes while it is open. A plan not read yet (`view` null) does not hold the confirm back: the
 *   server decides, and its refusal ("plan_renews") turns the sheet to "Cancel your plan first" until
 *   the plan is read as something else.
 * - While "Cancel your plan first" is open, coming back to the page (it is shown again, or the window
 *   takes the focus) asks for the plan to be read again: a plan cancelled on Whop meanwhile turns the
 *   open sheet into the confirm, with the focus in its field.
 * - Deleting: the button says "Deleting…" (announced), once; the sheet holds against Escape, the scrim
 *   and Cancel. A failure is said in the sheet and it can be tried again. Deleted: the sheet stays held
 *   until the container leaves the page, so nothing offers a second delete.
 * - Each opening starts empty. Enter in the field deletes nothing: the button is the way.
 * - Ink only: nothing here is in colour.
 */
export type DeleteResult = "deleted" | "plan_renews" | "whop_unreachable" | "failed";

export interface DeleteSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The plan as the page read it; null while it is not known (loading, or the read failed). */
  view: PlanView | null;
  /** Named in the confirm's title; null: "Delete your account?". */
  email: string | null;
  /** Whop's page of the visitor's memberships, where a plan is cancelled. */
  manageHref: string;
  onDelete(): Promise<DeleteResult>;
  /** The page is shown again while "Cancel your plan first" is open: read the plan again. */
  onRecheckPlan(): void;
  /** Where the focus goes on close when what opened the sheet has left the page. */
  returnFocus?: () => HTMLElement | null;
}

type Face = "blocked" | "confirm";

const BODY = "text-ui text-foreground-secondary";
const MAIN = "w-full next:rounded-full";
const QUIET = "mt-1.5 w-full text-ui next:rounded-full";

export function DeleteSheet({ open, onOpenChange, view, email, manageHref, onDelete, onRecheckPlan, returnFocus }: DeleteSheetProps): React.JSX.Element {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server refused because a plan renews, whatever the page had read.
  const [refused, setRefused] = useState(false);
  // Out as of the last press, not the last render: two presses can land before a render.
  const sending = useRef(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const whopRef = useRef<HTMLAnchorElement>(null);

  // Each opening starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTyped("");
      setError(null);
      setRefused(false);
    }
  }
  // The server's refusal stands until the plan is read as something else (the same read again is not news).
  const read = JSON.stringify(view);
  const [lastRead, setLastRead] = useState(read);
  if (read !== lastRead) {
    setLastRead(read);
    setRefused(false);
  }

  const plan = view?.kind === "plan" ? view : null;
  // A delete on its way keeps its face: its answer needs the confirm to land in.
  const face: Face = !busy && (refused || (view !== null && !canDelete(view))) ? "blocked" : "confirm";

  // The face changed under the focus (its controls went with it): the focus goes to the new face's
  // first, the field or the way to Whop. On open the shell places it.
  const shown = useRef<Face | null>(null);
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = open ? face : null;
    if (open && was !== null && was !== face) (face === "confirm" ? fieldRef.current : whopRef.current)?.focus();
  }, [open, face]);

  // Back from Whop: the page is shown again, or the window has the focus again.
  useEffect(() => {
    if (!open || face !== "blocked") return;
    const onShown = () => {
      if (document.visibilityState === "visible") onRecheckPlan();
    };
    const onFocus = () => onRecheckPlan();
    document.addEventListener("visibilitychange", onShown);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener("focus", onFocus);
    };
  }, [open, face, onRecheckPlan]);

  const ready = typed === DELETE_WORD;
  const send = async () => {
    if (!ready || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    let result: DeleteResult;
    try {
      result = await onDelete();
    } catch {
      result = "failed";
    }
    // Deleted: the container signs out and leaves; the sheet stays as it is until then.
    if (result === "deleted") return;
    sending.current = false;
    setBusy(false);
    if (result === "plan_renews") setRefused(true);
    else setError(result === "whop_unreachable" ? DELETE_WHOP_UNREACHABLE : DELETE_FAILED);
  };

  const left = plan && typeof plan.credits === "object" && plan.credits !== null ? plan.credits.left : 0;
  const body = [DELETE_BODY, left > 0 ? creditsLost(left) : null, CANT_UNDO].filter(Boolean).join(" ");

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={face === "blocked" ? BLOCKED_TITLE : deleteTitle(email)}
      busy={busy}
      returnFocus={returnFocus}
      initialFocus={() => fieldRef.current}
    >
      {face === "blocked" ? (
        <>
          <p className={cn("mt-2", BODY)}>{blockedBody(plan?.name ?? null, plan?.on ?? null)}</p>
          <p className={cn("mt-3", BODY)}>{BLOCKED_NEXT}</p>
          <Button asChild variant="primary" size="lg" className={cn("mt-5 gap-2", MAIN)}>
            <a ref={whopRef} href={manageHref} target="_blank" rel="noopener noreferrer" aria-label={opensWhop(CANCEL_ON_WHOP)}>
              {CANCEL_ON_WHOP}
              <ArrowSquareOut size={18} aria-hidden />
            </a>
          </Button>
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)} className={QUIET}>
            {CLOSE}
          </Button>
        </>
      ) : (
        <>
          <p className={cn("mt-2", BODY)}>{body}</p>
          <label htmlFor={`${id}-field`} className={cn("mt-4", FIELD_LABEL)}>
            {TYPE_DELETE}
          </label>
          <input
            id={`${id}-field`}
            ref={fieldRef}
            type="text"
            value={typed}
            // While it deletes the field is held (read-only keeps the focus).
            readOnly={busy}
            onChange={(e) => {
              if (!busy) setTyped(e.target.value);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={cn("mt-1.5", FIELD)}
          />
          {error && <ErrorLine>{error}</ErrorLine>}
          {/* On the page from the start, so "Deleting…" is announced when it begins. */}
          <p role="status" className="sr-only">
            {busy ? DELETING : ""}
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            aria-disabled={!ready || busy || undefined}
            aria-busy={busy || undefined}
            onClick={() => void send()}
            className={cn("mt-3 aria-disabled:opacity-40", MAIN)}
          >
            {busy ? DELETING : DELETE_ACCOUNT}
          </Button>
          <Button
            type="button"
            variant="quiet"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onOpenChange(false);
            }}
            className={QUIET}
          >
            {CANCEL}
          </Button>
        </>
      )}
    </SheetShell>
  );
}
