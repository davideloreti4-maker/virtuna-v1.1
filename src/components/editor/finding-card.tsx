"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { Finding } from "@/lib/edit/review";
import { cn } from "@/lib/utils";
import { momentLabel } from "./edit-session";
import { ChevronRightIcon, CloseIcon } from "./editor-icons";
import type { Fix } from "./fixes";

/**
 * finding-card.tsx — a thing to check, one at a time, at the end of the conversation in the chips' place (spec
 * 2026-11-24-editor-screens-design.md §3 screen 8, E18; plan 2026-11-25-editor-screens-b, Task 9; drawing `.fc`): the moment it is
 * at and one sentence for a creator (`sentenceOf`); the fix, its main action, as one ink button on a row of its own as wide as the
 * card, where there is one: its words are never cut, a label too long for one line on a narrow phone goes to two (Task 9's fix
 * round: beside "Keep it" and the count it did not fit at 393 px). Under it one row: "Show" where there is no fix, "Keep it",
 * which puts it away, and at the row's end the count with the way to the next one when there are more (round to the first after
 * the last). A close button at its top right (ruling S2: the drawing shows neither it nor the way to the next).
 *
 * A group named "Things to check", read politely as it changes. It takes the focus when it opens: the chip it was opened from
 * goes as it opens. Escape with the focus inside it closes it. Its actions rest while a call is out; its close does not.
 */

export interface FindingCardProps {
  finding: Finding;
  /** The finding's sentence for a creator. */
  sentence: string;
  /** Its fix as one button, or null: "Show" instead. */
  fix: Fix | null;
  /** Which of the things to check it is, from 0, and how many there are. */
  index: number;
  count: number;
  /** A call is out: the actions rest. */
  disabled: boolean;
  onFix(fix: Fix): void;
  onKeep(): void;
  onShow(): void;
  onNext(): void;
  onClose(): void;
}

/** The second row's buttons: 36 tall and round (drawing `.sb2`), at their own width, 44 to tap. */
const ACTION = "tap-44 h-9 shrink-0 rounded-full px-4 next:rounded-full next:font-[560]";

export function FindingCard({ finding, sentence, fix, index, count, disabled, onFix, onKeep, onShow, onNext, onClose }: FindingCardProps) {
  const box = useRef<HTMLDivElement>(null);
  const said = useId();
  useEffect(() => {
    box.current?.focus({ preventScroll: true });
  }, []);
  const shown = `${index + 1} of ${count}`;
  return (
    <div
      ref={box} role="group" aria-label="Things to check" aria-describedby={said} aria-live="polite" tabIndex={-1} data-part="finding"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="shrink-0 rounded-[20px] bg-surface px-3.5 pb-3 pt-[13px] shadow-[var(--shadow-rest)] outline-none"
    >
      <div className="flex items-start gap-2">
        <p id={said} className="min-w-0 flex-1 text-ui font-[560] leading-5 text-foreground">
          <span className="text-foreground-muted tabular-nums">{`${momentLabel(finding.where.frame)} · `}</span>
          {sentence}
        </p>
        <IconButton surface="quiet" aria-label="Close" onClick={onClose} className="-mr-1.5 -mt-1.5 h-8 w-8 [&_svg]:size-4">
          <CloseIcon strokeWidth={2.2} aria-hidden />
        </IconButton>
      </div>
      {fix && (
        // As wide as the card, 36 tall on one line (drawing `.sb1`); its words wrap to a second line rather than be cut.
        <div data-part="fix" className="mt-[11px]">
          <Button
            variant="primary" size="sm" disabled={disabled} onClick={() => onFix(fix)}
            className="tap-44 h-auto min-h-9 w-full whitespace-normal rounded-full px-4 py-2 text-center leading-5 next:rounded-full"
          >
            {fix.label}
          </Button>
        </div>
      )}
      <div data-part="actions" className={cn("flex items-center gap-2", fix ? "mt-2" : "mt-[11px]")}>
        {!fix && (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={onShow} className={ACTION}>
            Show
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={disabled} onClick={onKeep} className={ACTION}>
          Keep it
        </Button>
        {count > 1 ? (
          <button
            type="button" aria-label={`Next, ${(index + 1) % count + 1} of ${count}`} disabled={disabled} onClick={onNext}
            className="tap-44 ml-auto inline-flex shrink-0 items-center gap-0.5 text-meta text-foreground-muted tabular-nums hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            {shown}
            <ChevronRightIcon size={14} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <span className="ml-auto shrink-0 text-meta text-foreground-muted tabular-nums">{shown}</span>
        )}
      </div>
    </div>
  );
}
