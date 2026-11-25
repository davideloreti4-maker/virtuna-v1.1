"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ResultPage } from "@/components/result/result-page";
import type { RunningPreview } from "@/components/result/running";
import { seedSignedVideo } from "@/components/result/use-signed-video";
import { isPictureAddress } from "@/lib/result/run-progress";
import type { ResultRow } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";

/** The storage path the dev page gives a run whose video is a plain address (`?video=`). */
const DEV_VIDEO_PATH = "dev/video";

/**
 * A recorded run with the dev page's overrides applied: frames, a video, still in flight. A run in
 * flight started `elapsed` seconds ago (now when not given): a recorded run's own start is long
 * past the point where a run counts as stalled.
 */
function devRow(row: ResultRow, frames: string | null, video: string | null, processing: boolean, elapsed = 0): ResultRow {
  const next: ResultRow = { ...row, processing };
  if (processing) next.created_at = new Date(Date.now() - elapsed * 1000).toISOString();
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

/** The running screen's moment, from the dev page's parameters (see page.tsx). */
export interface DevRun {
  frames?: number;
  own: boolean;
  cover?: string;
  elapsed?: number;
}

/** What the running screen shows instead of the live run: never the real stream on the dev page. */
function runningPreview(run: DevRun, frames: string | null, video: string | null): RunningPreview {
  const base = frames?.replace(/\/+$/, "") ?? null;
  const arrived = base ? Array.from({ length: run.frames ?? 0 }, (_, i) => `${base}/${i}.jpg`) : [];
  return {
    // As the stream's own reader takes it: an https address, or none.
    progress: { groups: null, frames: arrived, cover: isPictureAddress(run.cover) ? run.cover : null, done: false },
    video: run.own ? video : null,
    elapsed: run.elapsed,
  };
}

export function DevResult({
  row,
  frames,
  video,
  processing,
  t,
  simulateAgain,
  run,
  land,
}: {
  row: ResultRow;
  frames: string | null;
  video: string | null;
  processing: boolean;
  t: number | undefined;
  simulateAgain: boolean;
  run: DevRun;
  /** Seconds after which the running moment turns into the result. */
  land?: number;
}) {
  const client = useQueryClient();
  // The address stands in for the signed one before the page first asks for it.
  useState(() => {
    if (video) seedSignedVideo(client, DEV_VIDEO_PATH, video);
    return null;
  });
  const [running] = useState(() => videoStateOf(devRow(row, frames, video, processing, run.elapsed)));
  // `land`: the same recorded run, finished, takes the running moment's place after that many seconds.
  const [finished] = useState(() =>
    processing && land !== undefined ? videoStateOf(devRow(row, frames, video, false)) : null,
  );
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!finished || land === undefined) return;
    const timer = setTimeout(() => setLanded(true), land * 1000);
    return () => clearTimeout(timer);
  }, [finished, land]);
  const [preview] = useState(() => (processing ? runningPreview(run, frames, video) : undefined));
  const state = landed && finished ? finished : running;
  return <ResultPage state={state} startAt={t} simulateAgain={simulateAgain} runningPreview={preview} />;
}
