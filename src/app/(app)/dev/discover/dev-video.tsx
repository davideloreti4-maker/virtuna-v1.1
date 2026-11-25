"use client";

import { useState } from "react";

import { RemixSheet } from "@/components/discover-next/remix-sheet";
import { VideoScreen } from "@/components/discover-next/video-screen";
import type { LibraryVideo } from "@/lib/discover-next/video";

import { DEV_VIDEOS } from "./fixtures";

/**
 * A library video's page on local state, for /dev/discover (`page.tsx`): the real screen and Remix sheet
 * over made-up videos (built from `fixtures.ts`). Save marks and unmarks here only; Remix opens its
 * question and starts nothing. Nothing here sends anything.
 *
 * - video: a proven video, why it works with More, timed beats, Save, the watch link, Remix
 * - video-plain: no line, not proven, beats without times, no original to open (so no Remix either)
 * - video-shaky: past 100 (the quiet line), no beats
 * - video-gone: not in the library
 */

export type DevVideoState = "video" | "video-plain" | "video-shaky" | "video-gone";

const noop = () => {};

const WHY =
  "The spoken hook promises a result the viewer can picture before the first cut. The setup is shown, not told: " +
  "every tool on the bench is in frame. A mistake halfway through keeps people watching to see if it is fixed. " +
  "The reveal comes back to the first shot, so the video loops cleanly.";

const PICKS: Record<Exclude<DevVideoState, "video-gone">, LibraryVideo> = {
  video: {
    ...DEV_VIDEOS[0]!,
    videoUrl: "https://videos.example/jay.makes/1",
    whyItWorks: WHY,
    beats: [
      { name: "The promise", startSec: 0, endSec: 4 },
      { name: "The bench", startSec: 4, endSec: 13 },
      { name: "First cut", startSec: 13, endSec: 22 },
      { name: "The mistake", startSec: 22, endSec: 36 },
      { name: "The reveal", startSec: 36, endSec: 51 },
    ],
  },
  "video-plain": {
    ...DEV_VIDEOS[12]!,
    proven: false,
    videoUrl: null,
    whyItWorks: "The first shot is the finished loaf. Everything after is how it got there.",
    beats: [{ name: "The finished loaf" }, { name: "Three days of dough" }, { name: "The first slice" }],
  },
  "video-shaky": {
    ...DEV_VIDEOS[14]!,
    videoUrl: "https://videos.example/dev.lifts/15",
    whyItWorks: WHY,
    beats: [],
  },
};

export function DevVideo({ state }: { state: DevVideoState }) {
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState(false);
  if (state === "video-gone") return <VideoScreen state="gone" />;
  return (
    <>
      <VideoScreen
        state="ready"
        video={PICKS[state]}
        saved={saved}
        saveReady
        onSave={() => setSaved((now) => !now)}
        remixWaiting={false}
        onRemix={() => setAsking(true)}
      />
      <RemixSheet open={asking} onOpenChange={setAsking} onRemix={noop} />
    </>
  );
}
