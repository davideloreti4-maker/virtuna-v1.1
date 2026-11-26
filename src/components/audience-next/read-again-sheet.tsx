"use client";

import { useEffect, useRef } from "react";

import { AnswerSheet } from "@/components/thread-next/answer-sheet";
import { Button } from "@/components/ui/button";
import { AUDIENCE_STRINGS, readAgainLine } from "@/lib/audience-next/audience-words";

/**
 * The question before an account's audience is read again (spec 2026-11-25-audience, 3.6 last paragraph and
 * 3.8), on the thread's details sheet (`AnswerSheet`: a bottom sheet on a phone, the centred 560 dialog from
 * 768):
 *
 *   Read again                                    the sheet's heading (the focus lands here on open)
 *   Maven reads @nia.tests again and rebuilds the groups. About two minutes.
 *   [ Read again ]                                ink
 *     Cancel
 *
 * A read costs a scrape and takes minutes, so it is asked once more, and the sheet's first moment takes no
 * press (`AnswerSheet` drops it): the second tap of a double tap on the page's button never confirms. Two
 * presses before the page draws again confirm once. Cancel, Escape and the scrim close it; the sheet then
 * gives the focus back to `returnFocus` itself (it is opened from a button that is not its trigger).
 */

const S = AUDIENCE_STRINGS;

export interface ReadAgainSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The account read again, with or without "@". */
  handle: string;
  /** Read again, confirmed: called once per opening. The caller closes the sheet. */
  onConfirm(): void;
  /** Where the focus goes when the sheet closes: the button that opened it, or null. */
  returnFocus: HTMLElement | null;
}

export function ReadAgainSheet({ open, onOpenChange, handle, onConfirm, returnFocus }: ReadAgainSheetProps) {
  // Confirmed as of the last press, not the last render: two presses can land before one.
  const confirmed = useRef(false);
  useEffect(() => {
    if (open) confirmed.current = false;
  }, [open]);

  const confirm = () => {
    if (!open || confirmed.current) return;
    confirmed.current = true;
    onConfirm();
  };

  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title={S.readAgain} returnFocus={returnFocus}>
      <p className="mt-1 px-0.5 text-pretty break-words text-ui leading-[21px] text-foreground-secondary">{readAgainLine(handle)}</p>
      <div className="mt-5 flex flex-col gap-1">
        <Button type="button" variant="primary" size="lg" className="w-full" onClick={confirm}>
          {S.readAgain}
        </Button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-11 w-full items-center justify-center text-ui font-[620] text-foreground"
        >
          {S.cancel}
        </button>
      </div>
    </AnswerSheet>
  );
}
