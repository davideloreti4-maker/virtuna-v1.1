"use client";

import { IconButton } from "@/components/ui/icon-button";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
import { clockLabel, timingEnd, timingStart } from "@/lib/thread-next/beat-timing";
import { cn } from "@/lib/utils";

import { AnswerCard, AnswerFoot, AnswerPrimary, CardHeader, PROSE, keepHyphens } from "./answer-card";
import { GaugeSlot, type GaugeState } from "./answer-gauge";
import { CheckIcon, CopyIcon, UploadIcon } from "./answer-icons";
import { useCopyText } from "./sheet-actions";

/** The script as plain text: each beat's words, a blank line between beats, no times. */
export function scriptText(beats: readonly { content: string }[]): string {
  return beats
    .map((beat) => beat.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
}

/**
 * The script card (spec §4.3; drawing `.scratch/next-look/part3/answers/answers.html`, `axScript`,
 * `.tq-beat`, `.ax-b0`, `.ax-slot`): one card, the beats on a time rail.
 *
 * - Header "Script" and, when the last beat's timing has an end, the total ("0:24"), then Copy: the
 *   whole script as plain text, a blank line between beats, no times (`scriptText`). The script is
 *   what the creator takes away; without Copy the only way out was selecting it by hand (review
 *   2026-11-23). The icon is a check for a moment after, and "Copied" is announced.
 * - A beat: its start ("0:03") when its timing parses, else no time; the rail; its `content`.
 * - Under the opening beat the slot "Simulate the opening" · "1 credit" (`GaugeSlot`): the text it
 *   simulates is `openingBeatSeed`, else the first beat's content (the text today's door fires and
 *   looks its seal up by). Simulated: the gauge with its number and "would stop to watch", a link to
 *   its result page once the thread and its key are known (step 2, `opener.href`).
 * - The one primary "Add your take" (upload icon, free, the arrow).
 *
 * Geometry as drawn: rows 2 / 2 on a 28 · 3 · 1fr grid 10 apart; the time 12 / 21 in the muted ink
 * 6 down; the rail 3 wide on 13% of the ink; the text 15 / 21, 6 above and 8 under (the opening's
 * 2 under, then the 40 slot and 4). The header's "Script" 14 / 640 in ink (`.tq-h b`).
 */
export function ScriptAnswer({
  block,
  opener,
  onAddTake,
}: {
  block: ScriptCardBlock;
  /** The opening's gauge; `href`, its result page once simulated and its key is known (step 2). */
  opener: { state: GaugeState; onSimulate?: () => void; href?: string | null };
  onAddTake?: () => void;
}) {
  const { beats, openingBeatSeed } = block.props;
  const last = beats[beats.length - 1];
  const end = last ? timingEnd(last.timing) : null;
  const openingText = openingBeatSeed || beats[0]?.content || "";
  const text = scriptText(beats);
  const { copied, copy } = useCopyText(text);

  return (
    <AnswerCard>
      <CardHeader
        left={<b className="block text-reading font-[640] leading-[21px] text-foreground">Script</b>}
        right={
          <span className="flex items-center gap-1.5">
            {end !== null ? clockLabel(end) : null}
            {text.length > 0 && (
              <>
                {/* 32 on a 21 line: the negative margins keep the header's height as drawn. */}
                <IconButton surface="quiet" aria-label="Copy script" onClick={copy} className="-my-1.5 -mr-1.5 h-8 w-8">
                  {copied ? <CheckIcon aria-hidden data-part="copied-mark" /> : <CopyIcon aria-hidden />}
                </IconButton>
                <span role="status" className="sr-only">
                  {copied ? "Copied" : ""}
                </span>
              </>
            )}
          </span>
        }
      />
      <ol className="m-0 list-none p-0">
        {beats.map((beat, i) => {
          const start = timingStart(beat.timing);
          return (
            <li key={i} data-part="beat" className="grid grid-cols-[28px_3px_minmax(0,1fr)] gap-x-2.5 p-0.5">
              <span data-part="time" className="pt-1.5 text-label leading-[21px] text-foreground-muted tabular-nums">
                {start !== null ? clockLabel(start) : ""}
              </span>
              <i aria-hidden className="block rounded-full bg-foreground/13" />
              <div className={cn("min-w-0", PROSE)}>
                <p className={cn("text-pretty text-ui leading-[21px] text-foreground", i === 0 ? "pb-0.5 pt-1.5" : "pb-2 pt-1.5")}>
                  {keepHyphens(beat.content)}
                </p>
                {i === 0 && (
                  <GaugeSlot
                    state={opener.state}
                    label="Simulate the opening"
                    text={openingText}
                    onSimulate={opener.onSimulate}
                    href={opener.href ?? null}
                    className="mb-1"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <AnswerFoot>
        <AnswerPrimary
          icon={<UploadIcon size={20} aria-hidden className="shrink-0" />}
          label="Add your take"
          onClick={onAddTake}
          trailingArrow
        />
      </AnswerFoot>
    </AnswerCard>
  );
}
