/**
 * beat-frames.test.ts — phase 3 frame extraction.
 *
 * The three things here that can silently do the WRONG thing rather than fail:
 *   - sampling on the beat boundary (a cut) instead of inside the beat
 *   - taking the whole remix run down when ffmpeg or storage misbehaves
 *   - running past the budget and holding the temp mp4 open past `cleanup()`
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/engine/filmstrip/extract", () => ({ extractFrameAtTimestamp: vi.fn() }));
vi.mock("@/lib/engine/filmstrip/storage", () => ({ uploadFrameAndGetSignedUrl: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { extractFrameAtTimestamp } from "@/lib/engine/filmstrip/extract";
import { uploadFrameAndGetSignedUrl } from "@/lib/engine/filmstrip/storage";
import { extractBeatFrames, MAX_BEAT_FRAMES } from "../beat-frames";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const mockExtract = extractFrameAtTimestamp as ReturnType<typeof vi.fn>;
const mockUpload = uploadFrameAndGetSignedUrl as ReturnType<typeof vi.fn>;

const URL = "https://storage.example/signed/source.mp4";
const BP = "abc123def456";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockExtract.mockResolvedValue(Buffer.from("jpeg"));
  mockUpload.mockResolvedValue("https://signed/0.jpg");
});

describe("extractBeatFrames", () => {
  it("samples INSIDE the beat, never on the boundary", async () => {
    // A beat boundary is a CUT — the frame on it is very often the transition itself. Sampling
    // t_start would hand the creator a dissolve or a black frame as "the shot to recreate".
    await extractBeatFrames(URL, BP, [beat({ index: 0, t_start: 0, duration_s: 3.2 })]);

    const [, at] = mockExtract.mock.calls[0]!;
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(3.2);
  });

  it("caps the offset so a LONG beat still shows its opening image", async () => {
    // A quarter into a 40s beat is 10s in — a different shot entirely by then. The creator is
    // matching the shot the source cut TO, so the offset is capped rather than proportional.
    await extractBeatFrames(URL, BP, [beat({ index: 0, t_start: 10, duration_s: 40 })]);

    const [, at] = mockExtract.mock.calls[0]!;
    expect(at).toBeCloseTo(10.4, 5);
  });

  it("stores under the BLUEPRINT id and the BEAT index", async () => {
    // The read side re-signs by this exact prefix. A mismatch returns {} and every frame silently
    // vanishes from the sheet — no error, no log, a sheet that looks like it was never extracted.
    await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 3 })]);

    expect(mockUpload).toHaveBeenNthCalledWith(1, BP, 0, expect.any(Buffer));
    expect(mockUpload).toHaveBeenNthCalledWith(2, BP, 3, expect.any(Buffer));
  });

  it("keys on the beat's OWN index, not its position in the array", async () => {
    // `beats` is already merged and a sheet can legitimately carry a non-contiguous set. Using
    // the loop counter would offset every frame onto the wrong beat — plausible, and invisible.
    await extractBeatFrames(URL, BP, [beat({ index: 5 })]);
    expect(mockUpload).toHaveBeenCalledWith(BP, 5, expect.any(Buffer));
  });

  it("skips the upload when ffmpeg returns nothing, and keeps going", async () => {
    mockExtract
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(Buffer.from("jpeg"));

    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 })]);

    expect(n).toBe(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(BP, 1, expect.any(Buffer));
  });

  it("treats a ZERO-BYTE buffer as no frame", async () => {
    // ffmpeg can exit 0 having written nothing. Uploading it publishes a broken image that the
    // renderer cannot distinguish from a real one — CoverFill only degrades on a LOAD error.
    mockExtract.mockResolvedValue(Buffer.alloc(0));

    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 })]);

    expect(n).toBe(0);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("counts only frames that actually persisted", async () => {
    mockUpload.mockResolvedValueOnce(null).mockResolvedValueOnce("https://signed/1.jpg");
    const n = await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 })]);
    expect(n).toBe(1);
  });

  it("NEVER throws — a storage fault cannot take the remix run down", async () => {
    // This runs inside the runner's try/finally, before cleanup(). A throw here would propagate
    // through a path whose entire job is guaranteeing the temp mp4 gets dropped.
    mockUpload.mockRejectedValue(new Error("bucket on fire"));
    await expect(extractBeatFrames(URL, BP, [beat({ index: 0 })])).resolves.toBe(0);
  });

  it("NEVER throws when ffmpeg itself rejects", async () => {
    mockExtract.mockRejectedValue(new Error("ffmpeg exploded"));
    await expect(extractBeatFrames(URL, BP, [beat({ index: 0 })])).resolves.toBe(0);
  });

  it("returns 0 for a beatless blueprint without touching ffmpeg", async () => {
    expect(await extractBeatFrames(URL, BP, [])).toBe(0);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("caps the number of frames per run", async () => {
    const many = Array.from({ length: MAX_BEAT_FRAMES + 4 }, (_, i) => beat({ index: i }));
    await extractBeatFrames(URL, BP, many);
    expect(mockExtract).toHaveBeenCalledTimes(MAX_BEAT_FRAMES);
  });

  it("extracts SEQUENTIALLY — never N concurrent seeks against one signed URL", async () => {
    let inFlight = 0;
    let peak = 0;
    mockExtract.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return Buffer.from("jpeg");
    });

    await extractBeatFrames(URL, BP, [beat({ index: 0 }), beat({ index: 1 }), beat({ index: 2 })]);

    expect(peak).toBe(1);
  });
});
