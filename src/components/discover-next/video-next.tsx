"use client";

import * as React from "react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useThreadActions } from "@/components/shell/use-thread-actions";
import { useSavedItemByRef } from "@/hooks/queries/use-saved-items";
import { isLibraryVideoRef, videoSaveOf } from "@/lib/discover-next/saved-ref";
import { watchLabel, webAddress } from "@/lib/discover-next/video-words";
import type { LibraryVideo } from "@/lib/discover-next/video";
import { leaveRemixFrom } from "@/lib/thread-next/remix-from";

import { RemixSheet } from "./remix-sheet";
import { useVideoSave } from "./use-video-save";
import { VideoScreen } from "./video-screen";

/**
 * A library video's page with its data (spec 3.3): the route reads the video on the server and hands it
 * in. Here: Save (`useVideoSave`) and Remix.
 *
 * - Remix: the main button asks what to make (`RemixSheet`); its answer leaves the video for a new chat
 *   (`leaveRemixFrom`: the link, its platform, the brief) and opens one (the shell's `newThreadAt`). Home's
 *   composer then runs its own Remix on the link, so the request shows as the creator's turn, the run is
 *   billed once, and the walls (no credits, a lapsed session) are Home's. Nothing is sent from here.
 *   While Home opens the main button waits, and a second press leaves nothing more: a remix is paid.
 * - Not in the library: the gone state. When the creator saved the video, the saved row still holds the
 *   original's address, and the gone state opens it (the saved list is read for a library video's id
 *   only). The read failed: Try again reads the page again (`router.refresh()`).
 */
export interface VideoNextProps {
  /** The video, or null when it is not in the library (or could not be read: `failed`). */
  video: LibraryVideo | null;
  failed?: boolean;
  /** The address's id, for a video that is gone: a saved row of it may still hold its original. */
  id?: string;
}

/** A video that left the library: its original's link, when a saved row of it holds a web address. */
function GoneVideo({ id }: { id: string }) {
  const { item } = useSavedItemByRef("outlier", id);
  const href = webAddress(item?.snapshot.videoUrl);
  const platform = item?.snapshot.platform;
  const watch = href ? { href, label: watchLabel(typeof platform === "string" ? platform : null) } : null;
  return <VideoScreen state="gone" watch={watch} />;
}

function ReadyVideo({ video }: { video: LibraryVideo }) {
  const row = useMemo(() => videoSaveOf(video), [video]);
  const save = useVideoSave(row);
  const { newThreadAt } = useThreadActions();
  const [asking, setAsking] = useState(false);
  // Home is opening for a remix left here: the button waits until the page goes.
  const [waiting, setWaiting] = useState(false);
  // Left as of the last press, not the last render: two presses can land before one.
  const starting = useRef(false);

  const start = (brief: string | null) => {
    if (starting.current || waiting) return;
    if (!leaveRemixFrom({ url: video.videoUrl ?? "", platform: video.platform, brief })) return;
    starting.current = true;
    setWaiting(true);
    newThreadAt("/home");
  };

  return (
    <>
      <VideoScreen
        state="ready"
        video={video}
        saved={save.saved}
        // A list that could not be read is still a choice: a press asks for it again.
        saveReady={save.ready || save.unread}
        onSave={save.toggle}
        remixWaiting={waiting}
        onRemix={() => setAsking(true)}
      />
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={start} />
    </>
  );
}

export function VideoNext({ video, failed = false, id }: VideoNextProps): React.JSX.Element {
  const router = useRouter();
  if (video === null) {
    if (failed) return <VideoScreen state="failed" onRetry={() => router.refresh()} />;
    return id && isLibraryVideoRef(id) ? <GoneVideo id={id} /> : <VideoScreen state="gone" />;
  }
  // Keyed by the video: another video starts with its own Save and its own sheet.
  return <ReadyVideo key={video.id} video={video} />;
}

/** The route's loading file under the new look: the page's own outline, nothing sent. */
export function VideoNextLoading(): React.JSX.Element {
  return <VideoScreen state="loading" />;
}
