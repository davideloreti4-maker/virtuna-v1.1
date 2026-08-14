/**
 * beat-frames.test.ts — phase 3 frame extraction, now serving BOTH sets from one pass.
 *
 * The things here that can silently do the WRONG thing rather than fail:
 *   - sampling on the beat boundary (a cut) instead of inside the beat
 *   - keying a frame on its loop position instead of the beat's own index
 *   - letting the two frame sets share a keyspace, so scrub frames overwrite beat frames
 *   - taking the whole remix run down when ffmpeg or storage misbehaves
 *   - running past the budget and holding the temp mp4 open past `cleanup()`
 *
 * Only the two I/O boundaries are mocked (ffmpeg, Supabase storage). The orchestration under test
 * — which times get asked for, which key each frame lands on — is real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/engine/filmstrip/extract-grid", () => ({ extractFramesAtTimes: vi.fn() }));
vi.mock("@/lib/engine/filmstrip/storage", () => ({
  uploadFrameAndGetSignedUrl: vi.fn(),
  uploadScrubFrame: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { extractFramesAtTimes } from "@/lib/engine/filmstrip/extract-grid";
import { uploadFrameAndGetSignedUrl, uploadScrubFrame } from "@/lib/engine/filmstrip/storage";
import { extractBeatFrames, MAX_BEAT_FRAMES, SCRUB_FRAME_COUNT } from "../beat-frames";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const mockGrid = extractFramesAtTimes as ReturnType<typeof vi.fn>;
const mockUpload = uploadFrameAndGetSignedUrl as ReturnType<typeof vi.fn>;
const mockScrub = uploadScrubFrame as ReturnType<typeof vi.fn>;

const URL = "https://storage.example/signed/source.mp4";
const BP = "abc123def456";
const DUR = 32;

function beat(over: Partial<BlueprintBeat> & { index: number }): BlueprintBeat {
  const t_start = over.t_start ?? over.index * 4;
  const duration_s = over.duration_s ?? 4;
  // `index` is NOT restated here — `...over` carries it and the type requires it. Restating it
  // read as dead code to tsc (TS2783) while vitest was perfectly green: vitest does not typecheck.
  return {
    t_start,
    t_end: t_start + duration_s,
    duration_s,
    role: "hook",
    spoken: null,
    spoken_span_s: null,
    on_screen_text: null,
    visual_event: "v",
    audio_event: "a",
    cuts: 1,
    weakness: null,
    ...over,
  };
}

/** The times the single pass was asked for, split back into its two halves. */
function requestedTimes(beatCount: number): { beats: number[]; scrub: number[] } {
  const [, , times] = mockGrid.mock.calls[0]!;
  return { beats: times.slice(0, beatCount), scrub: times.slice(beatCount) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // One buffer per requested time, so the mock honours the real contract: an array parallel to
  // `times`. Returning a fixed-length array would let an off-by-one in the split go unnoticed.
  mockGrid.mockImplementation(async (_url: string, _dur: number, times: number[]) =>
    times.map(() => Buffer.from("jpeg")),
  );
  mockUpload.mockResolvedValue("https://signed/beat.jpg");
  mockScrub.mockResolvedValue("https://signed/scrub.jpg");
});

describe("extractBeatFrames — beat sampling", () => {
  it("samples INSIDE the beat, never on the boundary", async () => {
    // A beat boundary is a CUT — the frame on it is very often the transition itself. Sampling
    // t_start would hand the creator a dissolve or a black frame as "the shot to recreate".
    await extractBeatFrames(URL, BP, [beat({ index: 0, t_start: 0, duration_s: 3.2 })], DUR);

    const { beats } = requestedTimes(1);
    expect(beats[0]).toBeGreaterThan(0);
    expect(beats[0]).toBeLessThan(3.2);
  });

  it("caps the offset so a LONG beat still shows its opening image", async () => {
    // A quarter into a 40s beat is 10s in — a different shot entirely by then. The creator is
    // matching the shot the source cut TO, so the offset is capped rather than proportional.
    await extractBeatFrames(URL, BP, [beat({ index: 0, t_start: 10, duration_s: 40 })], 60);

    expect(requestedTimes(1).beats[0]).toBeCloseTo(10.4, 5);
  });

  it("stores under the BLUEPRINT id and the BEAT index", async () => {
    // The read side re-signs by this exact prefix. A mismatch returns {} and every frame silently
    // vanishes from the sheet — no error, no log, a sheet that looks like it was never extracted.
    await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 3 })], DUR);

    expect(mockUpload).toHaveBeenNthCalledWith(1, BP, 0, expect.any(Buffer));
    expect(mockUpload).toHaveBeenNthCalledWith(2, BP, 3, expect.any(Buffer));
  });

  it("keys on the beat's OWN index, not its position in the array", async () => {
    // `beats` is already merged and a sheet can legitimately carry a non-contiguous set. Using
    // the loop counter would offset every frame onto the wrong beat — plausible, and invisible.
    await extractBeatFrames(URL, BP, [beat({ index: 5 })], DUR);
    expect(mockUpload).toHaveBeenCalledWith(BP, 5, expect.any(Buffer));
  });

  it("caps the number of beat frames per run", async () => {
    const many = Array.from({ length: MAX_BEAT_FRAMES + 4 }, (_, i) => beat({ index: i }));
    await extractBeatFrames(URL, BP, many, 200);
    expect(mockUpload).toHaveBeenCalledTimes(MAX_BEAT_FRAMES);
  });
});

describe("extractBeatFrames — the scrub set", () => {
  it("asks for BOTH sets in ONE pass", async () => {
    // Two passes would download the same object twice, and the download IS the cost: measured,
    // 115 frames in one pass beat 4 frames as individual seeks by 3x.
    await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 })], DUR);

    expect(mockGrid).toHaveBeenCalledTimes(1);
    const [, , times] = mockGrid.mock.calls[0]!;
    expect(times).toHaveLength(2 + SCRUB_FRAME_COUNT);
  });

  it("writes scrub frames on their own keyspace, by GRID index", async () => {
    // The collision this prevents: ~30 scrub frames keyed 0..29 written flat would overwrite beat
    // frames 0..7, and the sheet would render a scrub frame where it means a beat frame.
    await extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR);

    expect(mockScrub).toHaveBeenCalledTimes(SCRUB_FRAME_COUNT);
    expect(mockScrub).toHaveBeenNthCalledWith(1, BP, 0, expect.any(Buffer));
    expect(mockScrub).toHaveBeenNthCalledWith(SCRUB_FRAME_COUNT, BP, SCRUB_FRAME_COUNT - 1, expect.any(Buffer));
  });

  it("samples the scrub grid evenly, and off BOTH ends", async () => {
    // Frame zero is very often black or a title card, and the final frame is very often a cut to
    // black or an end card. A raw 0..duration grid systematically misrepresents the video at both
    // ends, so the grid is offset by half a step.
    await extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR);

    const { scrub } = requestedTimes(1);
    expect(scrub[0]).toBeGreaterThan(0);
    expect(scrub[scrub.length - 1]).toBeLessThan(DUR);

    const gaps = scrub.slice(1).map((t, i) => t - scrub[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(DUR / SCRUB_FRAME_COUNT, 5);
  });

  it("falls back to the beats' own span when the blueprint duration is unusable", async () => {
    // A degenerate blueprint can carry duration_s: 0. The beats always span the video, so their
    // tail is a sound fallback — without it a bad duration would silently cost the whole strip.
    await extractBeatFrames(URL, BP, [beat({ index: 0, t_start: 0, duration_s: 12 })], 0);

    const [, span] = mockGrid.mock.calls[0]!;
    expect(span).toBe(12);
    expect(mockScrub).toHaveBeenCalledTimes(SCRUB_FRAME_COUNT);
  });
});

describe("extractBeatFrames — degradation", () => {
  it("treats a ZERO-BYTE buffer as no frame", async () => {
    // ffmpeg can exit 0 having written nothing. Uploading it publishes a broken image that the
    // renderer cannot distinguish from a real one — CoverFill only degrades on a LOAD error.
    mockGrid.mockImplementation(async (_u: string, _d: number, times: number[]) =>
      times.map(() => Buffer.alloc(0)),
    );

    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR);

    expect(n).toEqual({ beatFrames: 0, scrubFrames: 0 });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockScrub).not.toHaveBeenCalled();
  });

  it("skips a frame the pass could not resolve, and keeps going", async () => {
    mockGrid.mockImplementation(async (_u: string, _d: number, times: number[]) =>
      times.map((_t, i) => (i === 0 ? null : Buffer.from("jpeg"))),
    );

    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 })], DUR);

    expect(n.beatFrames).toBe(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(BP, 1, expect.any(Buffer));
  });

  it("counts only frames that actually persisted", async () => {
    mockUpload.mockResolvedValueOnce(null).mockResolvedValueOnce("https://signed/1.jpg");
    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 })], DUR);
    expect(n.beatFrames).toBe(1);
  });

  it("a failed scrub upload does not cost the beat frames", async () => {
    mockScrub.mockResolvedValue(null);
    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR);
    expect(n).toEqual({ beatFrames: 1, scrubFrames: 0 });
  });

  it("NEVER throws — a storage fault cannot take the remix run down", async () => {
    // This runs inside the runner's try/finally, before cleanup(). A throw here would propagate
    // through a path whose entire job is guaranteeing the temp mp4 gets dropped.
    mockUpload.mockRejectedValue(new Error("bucket on fire"));
    await expect(extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR)).resolves.toEqual({
      beatFrames: 0,
      scrubFrames: 0,
    });
  });

  it("NEVER throws when the extraction pass itself rejects", async () => {
    mockGrid.mockRejectedValue(new Error("ffmpeg exploded"));
    await expect(extractBeatFrames(URL, BP, [beat({ index: 0 })], DUR)).resolves.toEqual({
      beatFrames: 0,
      scrubFrames: 0,
    });
  });

  it("returns nothing for a beatless blueprint without touching ffmpeg", async () => {
    expect(await extractBeatFrames(URL, BP, [], DUR)).toEqual({ beatFrames: 0, scrubFrames: 0 });
    expect(mockGrid).not.toHaveBeenCalled();
  });

  it("returns nothing when there is no usable span at all", async () => {
    const zero = beat({ index: 0, t_start: 0, duration_s: 0 });
    expect(await extractBeatFrames(URL, BP, [zero], 0)).toEqual({ beatFrames: 0, scrubFrames: 0 });
    expect(mockGrid).not.toHaveBeenCalled();
  });
});
