"use client";

import { useState } from "react";

import { useVideoMeta } from "@/hooks/use-video-meta";
import { cn } from "@/lib/utils";
import { formatLength } from "@/lib/video-file";

import { VideoIcon } from "./answer-icons";

/**
 * Your message (new look, spec 2026-11-20 §4.4; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-bub` and `.f1-att`): a bubble at the
 * column's end edge, and the video it was about as a small tile above it.
 *
 * Geometry as drawn: the bubble at most 80% of the column, padding 10 / 15 / 11, text 15 / 21,
 * the sunken tint, corners 22 with the end-bottom one tucked to 6 (built 24 and 6: the radius
 * scale has no 22). The tile 52 × 70, radius 12, the hairline, 6 above the bubble.
 *
 * A video sent without words is stored as its file's name. That name is not a message: the turn
 * is then the tile alone, and the name stays in the turn for a screen reader only (review
 * 2026-11-23: a bubble reading "test-30s.mp4" under the tile).
 *
 * Rendered by `ThreadUserTurn` (`src/components/thread/thread-shell.tsx`) under the flag, which
 * keeps the turn's `<h2 className="sr-only">You</h2>` (the F-14 heading contract).
 */

/** The video a turn was about: a still for the tile, and its length ("0:29"). */
export interface UserTurnVideo {
  posterUrl?: string | null;
  durationLabel?: string | null;
}

/**
 * The video a reloaded turn was about. The user turn is persisted as plain text (the file name or
 * the link), so the turn's own `video-test-card` block is the only record of it: its first frame
 * and its length (`src/lib/tools/video-test-card.ts`). Neither → null, and no tile.
 */
export function videoOfTurn(blocks: readonly unknown[]): UserTurnVideo | null {
  for (const raw of blocks) {
    const b = raw as { type?: unknown; props?: { filmstrip?: unknown; durationLabel?: unknown } } | null;
    if (b?.type !== "video-test-card" || !b.props) continue;
    const first = Array.isArray(b.props.filmstrip) ? (b.props.filmstrip[0] as { keyframeUrl?: unknown } | undefined) : undefined;
    const posterUrl = typeof first?.keyframeUrl === "string" && first.keyframeUrl ? first.keyframeUrl : null;
    const durationLabel = typeof b.props.durationLabel === "string" && b.props.durationLabel ? b.props.durationLabel : null;
    return posterUrl || durationLabel ? { posterUrl, durationLabel } : null;
  }
  return null;
}

/** A video file's name and nothing else ("take 3.mp4"): what a turn without words is stored as. */
const FILE_NAME = /^[^\n/\\]{1,200}\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i;
export const isVideoFileName = (text: string) => FILE_NAME.test(text.trim());

/**
 * The tile. The still is optional: a stored frame address can expire (the card's schema says so),
 * and a frame that fails to load leaves the tile with the video mark and its length, never a broken
 * image or an empty box. The failure is remembered per address, so a new address gets its own try.
 * `alone` (a turn that is only its video) drops the gap a bubble would follow.
 */
function VideoTile({ posterUrl, durationLabel, alone = false }: UserTurnVideo & { alone?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPicture = !!posterUrl && failedUrl !== posterUrl;
  return (
    <div
      role="img"
      aria-label={durationLabel ? `Video, ${durationLabel}` : "Video"}
      className={cn(
        "relative h-[70px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]",
        !alone && "mb-1.5",
      )}
    >
      {showPicture ? (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame (or a frame drawn in the browser); next/image has nothing to optimise
        <img
          src={posterUrl}
          alt=""
          onError={() => setFailedUrl(posterUrl)}
          className="block size-full object-cover"
        />
      ) : (
        // No picture: the video mark, centred in the room above the length.
        <VideoIcon
          size={18}
          aria-hidden
          data-part="video-mark"
          className={cn("absolute inset-x-0 top-0 m-auto text-foreground-muted", durationLabel ? "bottom-5" : "bottom-0")}
        />
      )}
      {durationLabel && (
        <span
          className={
            showPicture
              ? // Over a picture: the field tile's scrim and light figure (`thread-field.tsx`).
                "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-scrim to-transparent pl-1.5 pt-1.5 text-caption font-[640] leading-4 tracking-normal text-action-foreground dark:text-foreground"
              : // No picture: the length alone, in the secondary ink, no scrim.
                "pointer-events-none absolute inset-x-0 bottom-0 h-6 pl-1.5 pt-1.5 text-caption font-[640] leading-4 tracking-normal text-foreground-secondary"
          }
        >
          {durationLabel}
        </span>
      )}
    </div>
  );
}

/**
 * A turn whose text is a link (a Simulate run from a TikTok link): the bubble is the link, and no
 * tile, live or reloaded, so the turn reads the same before and after a reload. A file name never
 * holds a "/", so a file turn is never taken for one.
 */
const LINK = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}\/\S*$/i;
const isLinkTurn = (text: string) => LINK.test(text.trim());

/**
 * The bubble and, when there is one, the video's tile above it. A tile needs a still or a length;
 * `fileTile` shows it before either is known (the live turn's staged file is a video already).
 * Never on a link turn. A turn whose text is only the video's file name is the tile alone.
 */
export function NextUserTurn({
  text,
  video,
  fileTile = false,
}: {
  text: string;
  video?: UserTurnVideo | null;
  fileTile?: boolean;
}) {
  const hasTile = !isLinkTurn(text) && (fileTile || (!!video && (!!video.posterUrl || !!video.durationLabel)));
  const tileOnly = hasTile && isVideoFileName(text);
  return (
    // `-mb-0.5`: the thread column spaces its parts 14 apart, 16 from md (ThreadShell); the label
    // sits 12 under the bubble, 14 from md, as the answer-system drawing has it (`.ax-msgs` and
    // `.desk .thread` gaps). `mt-3.5` (not on the first turn): a later question sits 16 further down
    // than that rhythm (`.ax-t2`), 28 under the answer above on a phone and 30 from md.
    <div className="-mb-0.5 mt-3.5 flex flex-col items-end first:mt-0">
      <h2 className="sr-only">You</h2>
      {hasTile && <VideoTile posterUrl={video?.posterUrl} durationLabel={video?.durationLabel} alone={tileOnly} />}
      {tileOnly ? (
        // The file's name: in the turn for a screen reader, not painted.
        <p data-part="file-name" className="sr-only">
          {text}
        </p>
      ) : (
        <p className="max-w-[80%] whitespace-pre-wrap text-pretty rounded-3xl rounded-br-sm bg-surface-sunken px-[15px] pb-[11px] pt-2.5 text-ui text-foreground">
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * The live turn of a video simulation: the composer's staged file. Its tile shows at once, and
 * its still and length arrive as the browser reads them (`useVideoMeta`).
 */
export function NextUserTurnFromFile({ text, file }: { text: string; file: File }) {
  const { durationSec, thumbnail } = useVideoMeta(file);
  return (
    <NextUserTurn
      text={text}
      fileTile
      // formatLength is null for a length that is not finite (a browser-recorded webm): no length.
      video={{ posterUrl: thumbnail, durationLabel: durationSec != null ? formatLength(durationSec) : null }}
    />
  );
}
