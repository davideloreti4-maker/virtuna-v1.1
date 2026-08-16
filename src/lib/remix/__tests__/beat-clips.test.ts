/**
 * beat-clips.test.ts — phase 4 clip cutting.
 *
 * THE load-bearing assertion in this file is the per-output option block. ffmpeg output options
 * are POSITIONAL — written once at the front they bind to output 0 alone, and the other seven
 * clips ship at source resolution WITH THE AUDIO TRACK (measured 2026-08-16, spec §2.3). A
 * substring check ("argv contains -an") passes on that broken argv, so these tests count and
 * segment, never grep.
 *
 * Only the I/O boundaries are mocked (child_process spawn, fs, clip-storage). The argv builder
 * and the orchestration — what gets cut, what gets kept, what gets uploaded — are real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...a: unknown[]) => mockSpawn(...a) }));
vi.mock("ffmpeg-static", () => ({ default: "/fake/ffmpeg" }));

const mockMkdtemp = vi.fn();
const mockStat = vi.fn();
const mockReadFile = vi.fn();
const mockRm = vi.fn();
vi.mock("node:fs/promises", () => ({
  mkdtemp: (...a: unknown[]) => mockMkdtemp(...a),
  stat: (...a: unknown[]) => mockStat(...a),
  readFile: (...a: unknown[]) => mockReadFile(...a),
  rm: (...a: unknown[]) => mockRm(...a),
}));

const mockUploadClip = vi.fn();
vi.mock("../clip-storage", () => ({
  uploadClip: (...a: unknown[]) => mockUploadClip(...a),
  CLIPS_BUCKET: "clips",
}));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import {
  buildClipArgs,
  clipDuration,
  cutBeatClips,
  uploadBeatClips,
  MAX_BEAT_CLIPS,
  CLIP_BUDGET_MS,
} from "../beat-clips";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const URL = "https://storage.example/signed/source.mp4";

function beat(over: Partial<BlueprintBeat> & { index: number }): BlueprintBeat {
  const t_start = over.t_start ?? over.index * 4;
  const duration_s = over.duration_s ?? 4;
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

/** A fake ffmpeg process that exits `code` on the next tick. */
function fakeProc(code: number | null = 0) {
  const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter; kill: () => void };
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  setImmediate(() => proc.emit("close", code));
  return proc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSpawn.mockImplementation(() => fakeProc(0));
  mockMkdtemp.mockResolvedValue("/tmp/remix-clips-x");
  mockStat.mockResolvedValue({ size: 1000 });
  mockReadFile.mockResolvedValue(Buffer.from("mp4"));
  mockRm.mockResolvedValue(undefined);
  mockUploadClip.mockImplementation(async (bp: string, idx: number) => `${bp}/${idx}.mp4`);
});

describe("clipDuration", () => {
  it("caps at 4s and keeps a shorter beat's natural length", () => {
    expect(clipDuration(beat({ index: 0, duration_s: 12 }))).toBe(4);
    expect(clipDuration(beat({ index: 0, duration_s: 2.5 }))).toBe(2.5);
    expect(clipDuration(beat({ index: 0, duration_s: -1 }))).toBe(0);
  });
});

describe("buildClipArgs — the per-output option block", () => {
  it("repeats the FULL option block before every output (count equality, never a substring)", () => {
    const beats = [beat({ index: 0 }), beat({ index: 1 }), beat({ index: 2 })];
    const args = buildClipArgs(URL, beats, "/d");

    expect(args.filter((a) => a === "-i")).toHaveLength(1);
    // One per output — the assertion §2.3's measured failure cannot pass:
    expect(args.filter((a) => a === "-an")).toHaveLength(3);
    expect(args.filter((a) => a === "-crf")).toHaveLength(3);
    expect(args.filter((a) => a === "-vf")).toHaveLength(3);
    expect(args.filter((a) => a === "-ss")).toHaveLength(3);
    expect(args.filter((a) => a === "-t")).toHaveLength(3);
  });

  it("every inter-output SEGMENT carries its own -an -ss -t (position, not just count)", () => {
    const beats = [beat({ index: 0, t_start: 0.5 }), beat({ index: 1, t_start: 4 })];
    const args = buildClipArgs(URL, beats, "/d");
    const out0 = args.indexOf("/d/0.mp4");
    const out1 = args.indexOf("/d/1.mp4");
    const seg0 = args.slice(0, out0);
    const seg1 = args.slice(out0 + 1, out1);
    for (const seg of [seg0, seg1]) {
      expect(seg.filter((a) => a === "-an")).toHaveLength(1);
      expect(seg.filter((a) => a === "-ss")).toHaveLength(1);
      expect(seg.filter((a) => a === "-t")).toHaveLength(1);
    }
  });

  it("names outputs by the beat's OWN index and seeks to its t_start", () => {
    const args = buildClipArgs(URL, [beat({ index: 5, t_start: 20, duration_s: 3 })], "/d");
    expect(args).toContain("/d/5.mp4");
    expect(args[args.indexOf("-ss") + 1]).toBe("20");
    expect(args[args.indexOf("-t") + 1]).toBe("3");
  });
});

describe("cutBeatClips", () => {
  it("cuts at most MAX_BEAT_CLIPS and keeps only outputs that landed with bytes", async () => {
    const many = Array.from({ length: MAX_BEAT_CLIPS + 4 }, (_, i) => beat({ index: i }));
    // Output 1 never landed; output 2 landed empty.
    mockStat.mockImplementation(async (p: string) => {
      if (p.endsWith("/1.mp4")) throw new Error("ENOENT");
      if (p.endsWith("/2.mp4")) return { size: 0 };
      return { size: 1000 };
    });
    const cut = await cutBeatClips(URL, many, 60);
    expect(cut.files).toHaveLength(MAX_BEAT_CLIPS - 2);
    expect(cut.files.map((f) => f.beatIndex)).not.toContain(1);
    expect(cut.files.map((f) => f.beatIndex)).not.toContain(2);
  });

  it("never throws — a spawn error yields zero files and a safe dispose", async () => {
    mockSpawn.mockImplementation(() => {
      const proc = fakeProc(null);
      setImmediate(() => proc.emit("error", new Error("ENOENT")));
      return proc;
    });
    const cut = await cutBeatClips(URL, [beat({ index: 0 })], 30);
    expect(cut.files).toEqual([]);
    await expect(cut.dispose()).resolves.toBeUndefined();
  });

  it("returns none without touching fs when there are no beats", async () => {
    const cut = await cutBeatClips(URL, [], 30);
    expect(cut.files).toEqual([]);
    expect(mockMkdtemp).not.toHaveBeenCalled();
  });

  it("dispose removes the temp dir, recursively and forcefully", async () => {
    const cut = await cutBeatClips(URL, [beat({ index: 0 })], 30);
    await cut.dispose();
    expect(mockRm).toHaveBeenCalledWith("/tmp/remix-clips-x", { recursive: true, force: true });
  });
});

describe("uploadBeatClips", () => {
  it("uploads each file under its beat index and returns the landed paths", async () => {
    const paths = await uploadBeatClips("bp1", [
      { beatIndex: 0, path: "/t/0.mp4" },
      { beatIndex: 5, path: "/t/5.mp4" },
    ]);
    expect(mockUploadClip).toHaveBeenNthCalledWith(1, "bp1", 0, expect.any(Buffer));
    expect(mockUploadClip).toHaveBeenNthCalledWith(2, "bp1", 5, expect.any(Buffer));
    expect(paths).toEqual(["bp1/0.mp4", "bp1/5.mp4"]);
  });

  it("skips a failed upload and returns what landed — never throws", async () => {
    mockUploadClip.mockResolvedValueOnce(null);
    const paths = await uploadBeatClips("bp1", [
      { beatIndex: 0, path: "/t/0.mp4" },
      { beatIndex: 1, path: "/t/1.mp4" },
    ]);
    expect(paths).toEqual(["bp1/1.mp4"]);
  });

  it("skips a file that cannot be read instead of dying", async () => {
    mockReadFile.mockRejectedValueOnce(new Error("gone"));
    const paths = await uploadBeatClips("bp1", [
      { beatIndex: 0, path: "/t/0.mp4" },
      { beatIndex: 1, path: "/t/1.mp4" },
    ]);
    expect(paths).toEqual(["bp1/1.mp4"]);
  });
});

describe("constants", () => {
  it("budget aligns with the grid pass and the cap matches the frames cap", () => {
    expect(CLIP_BUDGET_MS).toBe(40_000);
    expect(MAX_BEAT_CLIPS).toBe(8);
  });
});
