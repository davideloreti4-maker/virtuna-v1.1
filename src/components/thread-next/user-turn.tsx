"use client";

import { useState } from "react";

import { useVideoMeta } from "@/hooks/use-video-meta";
import { formatLength } from "@/lib/video-file";

/**
 * Your message (new look, spec 2026-11-20 §4.4; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-bub` and `.f1-att`): a bubble at the
 * column's end edge, and the video it was about as a small tile above it.
 *
 * Geometry as drawn: the bubble at most 80% of the column, padding 10 / 15 / 11, text 15 / 21,
 * the sunken tint, corners 22 with the end-bottom one tucked to 6 (built 24 and 6: the radius
 * scale has no 22). The tile 52 × 70, radius 12, the hairline, 6 above the bubble.
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

/**
 * The tile. The still is optional: a stored frame address can expire (the card's schema says so),
 * and a frame that fails to load leaves the tile with its length only, never a broken image. The
 * failure is remembered per address, so a new address gets its own try.
 */
function VideoTile({ posterUrl, durationLabel }: UserTurnVideo) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPicture = !!posterUrl && failedUrl !== posterUrl;
  return (
    <div
      role="img"
      aria-label={durationLabel ? `Video, ${durationLabel}` : "Video"}
      className="relative mb-1.5 h-[70px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]"
    >
      {showPicture && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame (or a frame drawn in the browser); next/image has nothing to optimise
        <img
          src={posterUrl}
          alt=""
          onError={() => setFailedUrl(posterUrl)}
          className="block size-full object-cover"
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
 * Never on a link turn.
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
  return (
    // `-mb-0.5`: the thread column spaces turns 20 apart (ThreadShell `gap-5`); the label sits 18
    // under the bubble as drawn. `mt-2` (not on the first turn): 28 from the answer above, as drawn.
    <div className="-mb-0.5 mt-2 flex flex-col items-end first:mt-0">
      <h2 className="sr-only">You</h2>
      {hasTile && <VideoTile posterUrl={video?.posterUrl} durationLabel={video?.durationLabel} />}
      <p className="max-w-[80%] whitespace-pre-wrap text-pretty rounded-3xl rounded-br-sm bg-surface-sunken px-[15px] pb-[11px] pt-2.5 text-ui text-foreground">
        {text}
      </p>
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
