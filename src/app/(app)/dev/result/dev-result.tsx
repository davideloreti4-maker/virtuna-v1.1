"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ResultPage } from "@/components/result/result-page";
import { seedSignedVideo } from "@/components/result/use-signed-video";
import type { ResultRow } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";

/** The storage path the dev page gives a run whose video is a plain address (`?video=`). */
const DEV_VIDEO_PATH = "dev/video";

/** A recorded run with the dev page's overrides applied: frames, a video, still in flight. */
function devRow(row: ResultRow, frames: string | null, video: string | null, processing: boolean): ResultRow {
  const next: ResultRow = { ...row, processing };
  if (frames && next.heatmap) {
    const base = frames.replace(/\/+$/, "");
    const segments = next.heatmap.segments ?? [];
    next.heatmap = {
      ...next.heatmap,
      segments: segments.map((s, i) => ({ ...s, keyframe_uri: `${base}/${i}.jpg` })),
    };
    next.variants = {
      ...next.variants,
      filmstrip_segments: segments.map((s, i) => ({ idx: s.idx, keyframe_uri: `${base}/${i}.jpg` })),
    };
  }
  if (video) {
    next.input_mode = "video_upload";
    next.video_storage_path = DEV_VIDEO_PATH;
  }
  return next;
}

export function DevResult({
  row,
  frames,
  video,
  processing,
  t,
  simulateAgain,
}: {
  row: ResultRow;
  frames: string | null;
  video: string | null;
  processing: boolean;
  t: number | undefined;
  simulateAgain: boolean;
}) {
  const client = useQueryClient();
  // The address stands in for the signed one before the page first asks for it.
  useState(() => {
    if (video) seedSignedVideo(client, DEV_VIDEO_PATH, video);
    return null;
  });
  const [state] = useState(() => videoStateOf(devRow(row, frames, video, processing)));
  return <ResultPage state={state} startAt={t} simulateAgain={simulateAgain} />;
}
