"use client";

/**
 * /start's header (sketch screens 2–5): the app's round Back on the left, then on the three questions a bar of
 * three segments (ink filled, the track empty) and "n of 3"; the account step shows Back alone.
 */
import { BackIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { QUESTION_COUNT } from "@/lib/onboarding/start-steps";
import { cn } from "@/lib/utils";

import { START_WORDS as W } from "./start-words";

export function StartHeader({ onBack, filled }: { onBack: () => void; filled: number | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3.5">
      <IconButton aria-label={W.back} onClick={onBack}>
        <BackIcon aria-hidden />
      </IconButton>
      {filled === null ? (
        <span className="flex-1" />
      ) : (
        <>
          <div
            role="progressbar"
            aria-label={W.progress}
            aria-valuemin={1}
            aria-valuemax={QUESTION_COUNT}
            aria-valuenow={filled}
            aria-valuetext={W.stepOf(filled)}
            className="grid flex-1 grid-cols-3 gap-1.5"
          >
            {Array.from({ length: QUESTION_COUNT }, (_, i) => (
              <span key={i} data-segment={i < filled ? "on" : "off"} className={cn("h-1 rounded-full", i < filled ? "bg-action" : "bg-track")} />
            ))}
          </div>
          <span aria-hidden className="text-meta font-[560] tabular-nums text-foreground-secondary">
            {W.stepOf(filled)}
          </span>
        </>
      )}
    </header>
  );
}
