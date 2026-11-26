"use client";

import * as React from "react";

import { BookmarkIcon, ExternalIcon } from "@/components/thread-next/answer-icons";
import { LoopIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cardName } from "@/lib/discover-next/card";
import { DISCOVER_STRINGS, pulledNumbers } from "@/lib/discover-next/discover-words";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { remixOffered } from "@/lib/discover-next/remix";
import { multipleWords, watchLabel, webAddress } from "@/lib/discover-next/video-words";

import { UpMark } from "./discover-icons";
import { CHIP_LINK } from "./page-notice";
import { SheetShell } from "./sheet-shell";
import { CoverImage } from "./video-card";

/**
 * A pulled video's sheet (spec 3.6, "Done"): a pulled video has no page, no "why" and no beats, so a
 * press on its card opens this. The line as the sheet's title (else the video named by its creator),
 * the cover, the multiple's words, "18.4M views · 1.2M likes · 3.4K comments", then "Remix this · 10
 * credits", Save, and "Watch on TikTok". Presentational: the container holds Save and Remix.
 *
 * - Remix is offered only with a web address to hand the engine (`remixOffered`); the container closes
 *   this sheet and asks what to make (`RemixSheet`). While a run starts it waits.
 * - Save marks it (pressed); not a choice while the saved list is first read.
 * - Past 100, the quiet line says the number is shaky, as a library video's page does.
 */
export interface PulledSheetProps {
  video: PulledVideo;
  open: boolean;
  onOpenChange(open: boolean): void;
  saved: boolean;
  /** Save is a choice: the saved list is read, or it could not be and a press asks for it again. */
  saveReady: boolean;
  onSave(): void;
  /** A remix of this video is starting. */
  remixWaiting: boolean;
  onRemix(): void;
  /** Where the focus goes on close when what opened the sheet has left the page: its card. */
  returnFocus?: () => HTMLElement | null;
}

const S = DISCOVER_STRINGS.video;



export function PulledSheet({
  video,
  open,
  onOpenChange,
  saved,
  saveReady,
  onSave,
  remixWaiting,
  onRemix,
  returnFocus,
}: PulledSheetProps): React.JSX.Element {
  const words = multipleWords(video);
  const numbers = pulledNumbers(video);
  const watch = webAddress(video.videoUrl);
  const offered = remixOffered(video.platform, video.videoUrl);

  return (
    <SheetShell open={open} onOpenChange={onOpenChange} title={cardName(video)} returnFocus={returnFocus}>
      <div className="mt-4 flex gap-4">
        <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
          <CoverImage src={video.coverUrl} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
          {words && (
            <p className="flex items-center gap-1.5 text-ui font-[640] text-foreground tabular-nums">
              {video.proven && <UpMark />}
              {words.text}
            </p>
          )}
          {words?.shaky && <p className="text-meta text-foreground-secondary">{S.shaky}</p>}
          {numbers && <p className="text-meta text-foreground-secondary tabular-nums">{numbers}</p>}
          {video.posted && <p className="text-meta text-foreground-secondary tabular-nums">{video.posted}</p>}
        </div>
      </div>
      {offered && (
        <Button
          type="button"
          variant="primary"
          size="lg"
          aria-haspopup="dialog"
          aria-disabled={remixWaiting || undefined}
          aria-busy={remixWaiting || undefined}
          onClick={() => {
            if (!remixWaiting) onRemix();
          }}
          className="mt-5 w-full gap-2 next:rounded-full aria-disabled:opacity-40"
        >
          <LoopIcon aria-hidden />
          {S.remix}
        </Button>
      )}
      <div className={offered ? "mt-3 flex flex-wrap gap-2" : "mt-5 flex flex-wrap gap-2"}>
        <Chip aria-pressed={saved} aria-disabled={!saveReady || undefined} onClick={onSave} className="aria-disabled:opacity-60 [&_svg]:size-[17px]">
          <BookmarkIcon aria-hidden filled={saved} />
          {S.save}
        </Chip>
        {watch && (
          <a href={watch} target="_blank" rel="noopener noreferrer" aria-label={`${watchLabel(video.platform)}${S.newTab}`} className={CHIP_LINK}>
            <ExternalIcon aria-hidden />
            {watchLabel(video.platform)}
          </a>
        )}
      </div>
    </SheetShell>
  );
}
