/**
 * Shared set-up for the hero's tests (plan Task 3): a recorded run turned into the page's model, and
 * the real playhead around the part under test. Not a test file itself.
 */
import { useEffect, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { videoStateOf } from "@/lib/result/video-model";
import type { ResultRow, VideoModel } from "@/lib/result/types";
import { PlayheadProvider, usePlayhead, type Playhead } from "../playhead";

export const FRAME_BASE = "https://frames.test/run";

/**
 * A recorded run as the page's model. `frames`: every scene gets the still `<base>/<i>.jpg` (the
 * stored addresses expire, so the fixtures carry none; the dev page does the same). `videoPath`:
 * the run keeps its uploaded file. `description: null`: the named scene's sentence is a stub.
 */
export function modelOf(
  fixture: unknown,
  opts: { frames?: boolean; videoPath?: string; description?: null } = {},
): VideoModel {
  const row = structuredClone(fixture) as ResultRow;
  if (opts.frames && row.heatmap) {
    const segments = row.heatmap.segments ?? [];
    row.heatmap = { ...row.heatmap, segments: segments.map((s, i) => ({ ...s, keyframe_uri: `${FRAME_BASE}/${i}.jpg` })) };
    row.variants = { ...row.variants, filmstrip_segments: segments.map((s, i) => ({ idx: s.idx, keyframe_uri: `${FRAME_BASE}/${i}.jpg` })) };
  }
  if (opts.videoPath) {
    row.input_mode = "video_upload";
    row.video_storage_path = opts.videoPath;
  }
  if (opts.description === null && row.heatmap?.segments) {
    row.heatmap = { ...row.heatmap, segments: row.heatmap.segments.map((s) => ({ ...s, label: "" })) };
  }
  const state = videoStateOf(row);
  if (state.kind !== "result") throw new Error(`fixture is not a result (${state.kind})`);
  return state.model;
}

/** The playhead as the parts see it, read after every render. */
export const playhead = { current: undefined as unknown as Playhead };

function Probe() {
  const value = usePlayhead();
  useEffect(() => {
    playhead.current = value;
  });
  return null;
}

export function renderWithPlayhead(model: VideoModel, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayheadProvider clipS={model.clipS} scenes={model.audience.scenes}>
        {ui}
        <Probe />
      </PlayheadProvider>
    </QueryClientProvider>,
  );
}
