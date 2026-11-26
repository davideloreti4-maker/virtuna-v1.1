"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";

import { useThreadActions } from "@/components/shell/use-thread-actions";
import type { PulledVideo } from "@/lib/discover-next/pull";
import { pulledVideoSaveOf } from "@/lib/discover-next/saved-ref";
import { leaveRemixFrom } from "@/lib/thread-next/remix-from";

import { PulledSheet, type PulledSheetProps } from "./pulled-sheet";
import { RemixSheet } from "./remix-sheet";
import { useVideoSave } from "./use-video-save";

/**
 * A pulled video's sheet and the question before its remix, with their data: one for the pull page and a
 * creator's page. The page holds which video is open and the card the focus goes back to.
 *
 * - The sheet's Save, under the video's TikTok id, so Library opens its original.
 * - Remix closes the sheet and asks what to make, then leaves the video for a new chat (`leaveRemixFrom`)
 *   and opens one (the shell's `newThreadAt`): Home's composer runs its own Remix on the link (its turn,
 *   its walls, one billed run). Nothing is sent from here. The focus comes back to the card when the
 *   question is closed without a remix.
 */
export interface PulledVideoLayerProps {
  /** The video whose sheet is open (or closing); null before the first. */
  video: PulledVideo | null;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The card the sheet and the Remix question hand the focus back to. */
  returnFocus(): HTMLElement | null;
}

/** The open video's sheet, with its own Save (keyed by the video: each starts with its own mark). */
function OpenedSheet({ video, ...rest }: Omit<PulledSheetProps, "saved" | "saveReady" | "onSave">) {
  const row = useMemo(() => pulledVideoSaveOf(video), [video]);
  const save = useVideoSave(row);
  // A list that could not be read is still a choice: a press asks for it again.
  return <PulledSheet video={video} saved={save.saved} saveReady={save.ready || save.unread} onSave={save.toggle} {...rest} />;
}

export function PulledVideoLayer({ video, open, onOpenChange, returnFocus }: PulledVideoLayerProps): React.JSX.Element {
  const { newThreadAt } = useThreadActions();
  const [asking, setAsking] = useState(false);
  // A remix left for Home, from this video or another: every Remix of the page waits until it goes. A
  // remix is paid, and one is all a creator asked for. Left as of the last press, not the last render.
  const [waiting, setWaiting] = useState(false);
  const starting = useRef(false);
  const startRemix = (brief: string | null) => {
    if (!video || starting.current || waiting) return;
    if (!leaveRemixFrom({ url: video.videoUrl ?? "", platform: video.platform, brief })) return;
    starting.current = true;
    setWaiting(true);
    newThreadAt("/home");
  };
  const remix = () => {
    onOpenChange(false);
    setAsking(true);
  };
  return (
    <>
      {video && (
        <OpenedSheet
          key={video.id}
          video={video}
          open={open}
          onOpenChange={onOpenChange}
          remixWaiting={waiting}
          onRemix={remix}
          returnFocus={returnFocus}
        />
      )}
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={startRemix} returnFocus={returnFocus} />
    </>
  );
}
