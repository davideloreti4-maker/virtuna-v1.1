# Remix Phase 4 (Beat Clips) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ≤8 muted ≤4s clips cut from a remix source during the run's existing window, played by the scrub stage, reaped after 7 days — per `docs/superpowers/specs/2026-08-15-remix-clips-and-revise-design.md` (the revised 2026-08-16 version; read §2, §4, §5 before starting).

**Architecture:** A new `beat-clips.ts` cuts clips from the **signed URL** (one ffmpeg pass, options repeated per output) into a temp dir while the adapt call runs, and uploads to a new private `clips` bucket **only when the run is about to return a blueprint**. The route writes the storage paths into `remix_blueprints.clip_uris`; the read route signs them fresh; the existing retention cron gains an independent second sweep; the source viewer overlays one `<video>` on its stage for covered windows. **`resolve-and-rehost.ts` is not touched — zero diff, checked at the end.**

**Tech Stack:** Next.js 15 App Router, TypeScript, vitest (+ happy-dom for components), ffmpeg via `ffmpeg-static`, Supabase Storage (service client).

## Global Constraints

- Worktree: `/Users/davideloreti/virtuna-remix-shoot-sheet`, branch `lane/remix-clips-and-revise`. Commits auto-push (`.githooks/post-commit`).
- 🔴 `src/lib/engine/remix/resolve-and-rehost.ts` must show **zero diff** when this plan is done.
- 🔴 `analyze/__tests__/derive-and-drop.test.ts`, `analyze/__tests__/decode-route.test.ts`, `engine/__tests__/tiktok-url-branch.test.ts` stay green **unmodified**.
- 🔴 Deploy is OFF (owner-confirmed). Nothing may claim "runs in production" as evidence.
- Signed URLs are **never persisted** — `clip_uris` holds storage paths only.
- No accent colour anywhere in the UI. Cream/brightness only (dosage rule is LOCKED).
- ffmpeg output options are **positional** — the option block is repeated per output (spec §2.3; measured failure otherwise).
- vitest does not typecheck: run `node node_modules/typescript/bin/tsc --noEmit` separately (npx output can be swallowed — trust `$?`).
- Targeted tests: `npm test -- <path>`. Full suite: kill dev servers first, `npm test -- --maxWorkers=3`; known flakes in `scraping/resolve-video` + `engine/omni-analysis-*` + three `composer-*.tsx` under load — check *which file* before blaming the diff.
- Commit format `type(scope): description`.

---

### Task 1: `clip-storage.ts` — upload + sign

**Files:**
- Create: `src/lib/remix/clip-storage.ts`
- Test: `src/lib/remix/__tests__/clip-storage.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (`@/lib/supabase/service`), `createLogger` (`@/lib/logger`).
- Produces: `CLIPS_BUCKET = "clips"`; `uploadClip(blueprintId: string, beatIndex: number, mp4: Buffer): Promise<string | null>` (returns the **storage path**, not a signed URL — paths go in the row, signing happens on read); `signClips(paths: string[], ttlSeconds?: number): Promise<Record<number, string>>` (beatIndex → signed URL; `{}` on any fault; **signs the given paths, never lists** — spec §2.6).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/remix/__tests__/clip-storage.test.ts
/**
 * clip-storage.test.ts — the clips bucket writer/signer (phase 4).
 *
 * What can silently do the WRONG thing here:
 *   - signClips listing the bucket instead of signing the given paths (a second round-trip to
 *     rediscover something the row already carries — spec §2.6's one deviation)
 *   - a signed URL leaking back as the "stored" value (dead link on day 8, live credential in a row)
 *   - a junk path crashing the map instead of being skipped
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpload = vi.fn();
const mockCreateSignedUrls = vi.fn();
const mockList = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  createSignedUrls: mockCreateSignedUrls,
  list: mockList,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ storage: { from: mockStorageFrom } })),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { uploadClip, signClips, CLIPS_BUCKET } from "../clip-storage";

const BP = "abc123def456";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockCreateSignedUrls.mockResolvedValue({
    data: [{ signedUrl: "https://signed/0.mp4" }],
    error: null,
  });
});

describe("uploadClip", () => {
  it("uploads to clips/<blueprintId>/<beatIndex>.mp4 and returns the PATH, never a URL", async () => {
    const path = await uploadClip(BP, 3, Buffer.from("mp4"));
    expect(mockStorageFrom).toHaveBeenCalledWith(CLIPS_BUCKET);
    expect(mockUpload).toHaveBeenCalledWith(
      `${BP}/3.mp4`,
      expect.any(Buffer),
      { contentType: "video/mp4", upsert: true },
    );
    expect(path).toBe(`${BP}/3.mp4`);
  });

  it("returns null on an upload error — never throws", async () => {
    mockUpload.mockResolvedValue({ error: { message: "quota" } });
    await expect(uploadClip(BP, 0, Buffer.from("x"))).resolves.toBeNull();
  });
});

describe("signClips", () => {
  it("signs EXACTLY the given paths — no bucket listing", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed/0.mp4" }, { signedUrl: "https://signed/5.mp4" }],
      error: null,
    });
    const clips = await signClips([`${BP}/0.mp4`, `${BP}/5.mp4`]);
    expect(mockList).not.toHaveBeenCalled();
    expect(mockCreateSignedUrls).toHaveBeenCalledWith([`${BP}/0.mp4`, `${BP}/5.mp4`], 3600);
    // Keys are the BEAT indexes parsed from the filename — 0 and 5, not 0 and 1.
    expect(Object.keys(clips).map(Number).sort((a, b) => a - b)).toEqual([0, 5]);
    expect(clips[5]).toBe("https://signed/5.mp4");
  });

  it("returns {} for an empty or non-array input (a pre-lane row's jsonb)", async () => {
    await expect(signClips([])).resolves.toEqual({});
    await expect(signClips(undefined as unknown as string[])).resolves.toEqual({});
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it("returns {} when signing throws — the sheet degrades to stills, never 500s", async () => {
    mockCreateSignedUrls.mockRejectedValue(new Error("storage down"));
    await expect(signClips([`${BP}/0.mp4`])).resolves.toEqual({});
  });

  it("skips a junk path instead of producing a NaN key", async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed/x" }, { signedUrl: "https://signed/1.mp4" }],
      error: null,
    });
    const clips = await signClips([`${BP}/not-a-number.mp4`, `${BP}/1.mp4`]);
    expect(Object.keys(clips)).toEqual(["1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/remix/__tests__/clip-storage.test.ts`
Expected: FAIL — cannot resolve `../clip-storage`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/remix/clip-storage.ts
/**
 * clip-storage.ts — the `clips` bucket writer/signer (remix phase 4).
 *
 * Deliberately NOT added to `src/lib/engine/filmstrip/storage.ts`: that module's own
 * `SCRUB_PREFIX` comment records what happened last time a shared writer was widened to serve a
 * second keyspace. Clips get their own bucket (a different media type with a different retention
 * policy — the reaper must never be ambiguous about what it may delete) and their own module.
 *
 * One deviation from `signScrubFrames`, which lists a prefix and signs what it finds:
 * `signClips` takes THE PATHS and signs exactly those. The row already carries them
 * (`remix_blueprints.clip_uris`) and the route has already read the row, so listing would be a
 * second storage round-trip to rediscover something in hand.
 *
 * Graceful-degradation contract throughout: never throws; null / {} on any fault. A sheet with
 * no clips is exactly the pre-lane sheet, which is a complete product.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "remix.clip-storage" });

export const CLIPS_BUCKET = "clips";

/**
 * Upload one clip to `clips/<blueprintId>/<beatIndex>.mp4` and return the STORAGE PATH, or null
 * on any failure. Never a signed URL: paths are what the row stores — a signed URL in a durable
 * column is a dead link on day 31 and a live credential in a shared row.
 */
export async function uploadClip(
  blueprintId: string,
  beatIndex: number,
  mp4: Buffer,
): Promise<string | null> {
  const supabase = createServiceClient();
  const path = `${blueprintId}/${beatIndex}.mp4`;

  const { error } = await supabase.storage
    .from(CLIPS_BUCKET)
    .upload(path, mp4, { contentType: "video/mp4", upsert: true });

  if (error) {
    log.error("clip upload failed", { path, error: error.message });
    return null;
  }
  return path;
}

/**
 * Re-sign the given clip paths as `{ beatIndex → signedUrl }`. The beat index comes from the
 * filename (`<blueprintId>/<beatIndex>.mp4`), exactly as the frame signers parse theirs.
 *
 * `paths` arrives from a jsonb column read without a zod parse, so the non-array guard is not
 * paranoia — a pre-lane row or a manually-edited row must degrade to {}, never throw.
 */
export async function signClips(
  paths: string[],
  ttlSeconds = 60 * 60,
): Promise<Record<number, string>> {
  try {
    if (!Array.isArray(paths) || paths.length === 0) return {};
    const service = createServiceClient();
    const { data: signed } = await service.storage
      .from(CLIPS_BUCKET)
      .createSignedUrls(paths, ttlSeconds);

    const clips: Record<number, string> = {};
    (signed ?? []).forEach((s, i) => {
      const name = paths[i]?.split("/").pop() ?? "";
      const idx = Number.parseInt(name.replace(/\.mp4$/u, ""), 10);
      if (s.signedUrl && Number.isFinite(idx)) clips[idx] = s.signedUrl;
    });
    return clips;
  } catch (err) {
    log.error("clip re-sign failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/remix/__tests__/clip-storage.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/lib/remix/clip-storage.ts src/lib/remix/__tests__/clip-storage.test.ts
git commit -m "feat(remix): clip-storage — clips bucket writer/signer (phase 4)"
```

---

### Task 2: `beat-clips.ts` — cut + upload orchestration

**Files:**
- Create: `src/lib/remix/beat-clips.ts`
- Test: `src/lib/remix/__tests__/beat-clips.test.ts`

**Interfaces:**
- Consumes: `uploadClip` from Task 1; `BlueprintBeat` (`@/lib/engine/remix/blueprint`); `ffmpeg-static`; `node:child_process`, `node:fs/promises`.
- Produces (Task 3 depends on these exact names):
  - `MAX_BEAT_CLIPS = 8`, `MAX_CLIP_DURATION_S = 4`, `CLIP_BUDGET_MS = 40_000`
  - `clipDuration(beat: BlueprintBeat): number`
  - `buildClipArgs(inputUrl: string, targets: BlueprintBeat[], dir: string): string[]`
  - `interface CutClip { beatIndex: number; path: string }`
  - `interface CutResult { files: CutClip[]; dispose: () => Promise<void> }`
  - `cutBeatClips(videoUrl: string, beats: BlueprintBeat[], durationS: number): Promise<CutResult>` — never throws
  - `uploadBeatClips(blueprintId: string, files: CutClip[]): Promise<string[]>` — landed storage paths, never throws

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/remix/__tests__/beat-clips.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/remix/__tests__/beat-clips.test.ts`
Expected: FAIL — cannot resolve `../beat-clips`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/remix/beat-clips.ts
/**
 * Beat clips (remix phase 4) — ≤8 muted ≤4s fragments of the SOURCE video, one per beat.
 *
 * ── Where the bytes come from ────────────────────────────────────────────────────────────────
 * The SIGNED URL, exactly like `beat-frames.ts`. Gate 0 (2026-08-16) measured the full 8-clip
 * re-encode pass against a real signed URL at 7.2–9.7s vs 6.0s local — the premium is the one
 * sequential download, so `resolveAndRehost` is NOT touched and no local copy of the source
 * exists. Cutting runs inside the window the ~50s adapt call already pays for; the runner joins
 * it before `cleanup()` drops the object it reads.
 *
 * ── ⚠️ The option block is repeated PER OUTPUT — this is load-bearing ────────────────────────
 * ffmpeg output options are POSITIONAL: each applies only to the NEXT output file. Hoisted to
 * the front once, `-an`/`-crf`/`-vf` bind to output 0 alone and the remaining clips ship at
 * source resolution WITH THE AUDIO TRACK — measured 2026-08-16 (spec §2.3), and invisible to any
 * substring test. `buildClipArgs` is exported so the tests can count options per output segment.
 *
 * ── Cut vs upload — two steps on purpose ─────────────────────────────────────────────────────
 * `cutBeatClips` cuts to a mkdtemp dir during the adapt call. `uploadBeatClips` runs ONLY when
 * the runner is about to return a blueprint (`hasBeats && blocks.length > 0`): an `adapt_failed`
 * run must leave the `clips` bucket untouched, or the object sits outside the reaper's
 * `clip_uris` worklist forever (spec §2.4). The mitigations: `-an` strips audio from the file
 * itself (stronger than a muted attribute), dur ≤ 4s, ≤8 per source, 7-day TTL (spec §5).
 *
 * Never throws — a sheet with no clips is exactly the pre-lane sheet, a complete product.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { uploadClip } from "./clip-storage";
import { createLogger } from "@/lib/logger";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const log = createLogger({ module: "remix.beat-clips" });

/** Hard cap on clips per run, matching MAX_BEAT_FRAMES. `buildBlueprint` merges to 8 beats. */
export const MAX_BEAT_CLIPS = 8;

/** The ≤4s owner ruling. A shorter beat keeps its natural length. */
export const MAX_CLIP_DURATION_S = 4;

/**
 * Whole-job ceiling, aligned with the grid pass's PASS_TIMEOUT_MS. The cut is joined before
 * `cleanup()` drops the temp mp4, so a hung ffmpeg must not hold the source open past the run.
 */
export const CLIP_BUDGET_MS = 40_000;

export interface CutClip {
  /** The beat's OWN index — `beats` can be non-contiguous, same rule as the frames. */
  beatIndex: number;
  /** Absolute path of the cut file inside the temp dir. */
  path: string;
}

export interface CutResult {
  files: CutClip[];
  /** Removes the temp dir. Never throws; safe to call on every path, more than once. */
  dispose: () => Promise<void>;
}

/** `min(4, duration_s)` — the ≤4s ruling. The UI re-clamps to `loadedmetadata` (spec §4.2). */
export function clipDuration(beat: BlueprintBeat): number {
  return Math.min(MAX_CLIP_DURATION_S, Math.max(0, beat.duration_s));
}

/**
 * The full option set, spread before EVERY output. Kept as one constant so the repetition is
 * structural: hoisting these to the front of the argv is the measured failure this module's
 * header documents, and the per-output test would go red.
 */
const CLIP_OUTPUT_OPTIONS = [
  "-an",                       // strip the audio TRACK — a muted attribute can be defeated
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-crf", "28",
  "-vf", "scale=-2:640",       // ~360×640 from 1080×1920 — 3×+ retina for a ~112px stage
] as const;

export function buildClipArgs(
  inputUrl: string,
  targets: BlueprintBeat[],
  dir: string,
): string[] {
  const args: string[] = ["-y", "-i", inputUrl];
  for (const beat of targets) {
    args.push(
      ...CLIP_OUTPUT_OPTIONS,
      "-ss", String(Math.max(0, beat.t_start)),  // output-side -ss on a re-encode: frame-accurate
      "-t", String(clipDuration(beat)),
      join(dir, `${beat.index}.mp4`),
    );
  }
  return args;
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath!, args);
    let settled = false;
    const done = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code);
    };
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      log.warn("ffmpeg clip pass timed out", { timeoutMs });
      done(null);
    }, timeoutMs);

    // stderr is drained but discarded — an unread pipe fills and deadlocks the child.
    proc.stderr.on("data", () => {});
    proc.on("close", done);
    proc.on("error", (err) => {
      log.error("ffmpeg clip spawn failed", { error: err.message });
      done(null);
    });
  });
}

/**
 * Cut one clip per beat (≤8) from the signed URL into a temp dir, in ONE ffmpeg pass.
 *
 * A non-zero exit still leaves whatever outputs completed — a partial set is a better outcome
 * than none, so the exit code is logged, not obeyed; what "landed" is decided by `stat`.
 */
export async function cutBeatClips(
  videoUrl: string,
  beats: BlueprintBeat[],
  durationS: number,
): Promise<CutResult> {
  const none: CutResult = { files: [], dispose: async () => {} };
  if (beats.length === 0) return none;
  if (!Number.isFinite(durationS) || durationS <= 0) {
    log.warn("clip cut skipped — no usable duration", { durationS });
    return none;
  }
  if (!ffmpegPath) {
    log.error("ffmpeg-static binary not available on this platform");
    return none;
  }

  const targets = beats.slice(0, MAX_BEAT_CLIPS).filter((b) => clipDuration(b) > 0);
  if (targets.length === 0) return none;

  let dir: string;
  try {
    dir = await mkdtemp(join(tmpdir(), "remix-clips-"));
  } catch (err) {
    log.error("clip temp dir failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return none;
  }

  const dispose = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  };

  const startedAt = Date.now();
  try {
    const code = await runFfmpeg(buildClipArgs(videoUrl, targets, dir), CLIP_BUDGET_MS);

    const files: CutClip[] = [];
    for (const b of targets) {
      const path = join(dir, `${b.index}.mp4`);
      try {
        const s = await stat(path);
        if (s.size > 0) files.push({ beatIndex: b.index, path });
      } catch {
        /* this output never landed — skip it */
      }
    }

    log.info("clip cut complete", {
      code,
      requested: targets.length,
      cut: files.length,
      ms: Date.now() - startedAt,
    });
    return { files, dispose };
  } catch (err) {
    log.error("clip cut failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { files: [], dispose };
  }
}

/**
 * Upload cut files to the clips bucket under `<blueprintId>/<beatIndex>.mp4` and return the
 * landed storage paths. Called ONLY on the runner's success path — see the module header.
 */
export async function uploadBeatClips(
  blueprintId: string,
  files: CutClip[],
): Promise<string[]> {
  const landed: string[] = [];
  for (const f of files) {
    try {
      const bytes = await readFile(f.path);
      if (bytes.length === 0) continue;
      const path = await uploadClip(blueprintId, f.beatIndex, bytes);
      if (path) landed.push(path);
    } catch {
      /* an unreadable cut is skipped, never fatal */
    }
  }
  return landed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/remix/__tests__/beat-clips.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/lib/remix/beat-clips.ts src/lib/remix/__tests__/beat-clips.test.ts
git commit -m "feat(remix): beat-clips — per-output argv, cut in window, upload on success"
```

---

### Task 3: Runner wiring — cut overlaps adapt, upload before return

**Files:**
- Modify: `src/lib/tools/runners/remix-runner.ts` (the `framesPromise` declaration ~line 268, the phase-3 block ~line 320, the return ~line 504, the `finally` ~line 521, and the `RemixPipelineResult` interface ~line 136)
- Test: `src/lib/tools/runners/__tests__/remix-runner.test.ts` (additions)

**Interfaces:**
- Consumes: `cutBeatClips`, `uploadBeatClips`, `CutResult` from Task 2.
- Produces: `RemixPipelineResult.blueprint` gains `clipPaths: string[]` — Task 4's route write reads exactly this field.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/tools/runners/__tests__/remix-runner.test.ts`. First, next to the existing `vi.mock` block (after the `predicted-pin` mock, ~line 73):

```ts
const mockCutBeatClips = vi.fn();
const mockUploadBeatClips = vi.fn();
vi.mock("@/lib/remix/beat-clips", () => ({
  cutBeatClips: (...args: unknown[]) => mockCutBeatClips(...args),
  uploadBeatClips: (...args: unknown[]) => mockUploadBeatClips(...args),
}));
```

In the file's shared `beforeEach` (with the other mock defaults), add:

```ts
  mockCutBeatClips.mockResolvedValue({ files: [], dispose: vi.fn() });
  mockUploadBeatClips.mockResolvedValue([]);
```

Then a new describe block (uses the existing `setupHappyPath`, `makeStructuralInputWithSegments`, `mockOmniOutputToStructuralInput`, `mockGenerateAdaptConcepts`, `baseInput`, `runRemixPipeline` helpers already in this file):

```ts
describe("runRemixPipeline — phase 4 clips", () => {
  function setupWithBeats() {
    setupHappyPath();
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInputWithSegments());
  }

  it("uploads ONLY on the success path and stamps clipPaths on the blueprint", async () => {
    setupWithBeats();
    const dispose = vi.fn();
    mockCutBeatClips.mockResolvedValue({
      files: [{ beatIndex: 0, path: "/t/0.mp4" }],
      dispose,
    });
    mockUploadBeatClips.mockResolvedValue(["bp/0.mp4"]);

    const result = await runRemixPipeline(baseInput);

    expect(result.blueprint).not.toBeNull();
    expect(result.blueprint!.clipPaths).toEqual(["bp/0.mp4"]);
    // Upload keyed by the SAME id stamped on the cards:
    expect(mockUploadBeatClips).toHaveBeenCalledWith(
      result.blueprint!.id,
      [{ beatIndex: 0, path: "/t/0.mp4" }],
    );
    // The temp dir is disposed even on success (the finally owns it):
    expect(dispose).toHaveBeenCalled();
  });

  it("adapt_failed: cuts are disposed and NOTHING is uploaded — the bucket stays clean", async () => {
    setupWithBeats();
    const dispose = vi.fn();
    mockCutBeatClips.mockResolvedValue({
      files: [{ beatIndex: 0, path: "/t/0.mp4" }],
      dispose,
    });
    mockGenerateAdaptConcepts.mockResolvedValue(null);

    const result = await runRemixPipeline(baseInput);

    expect(result.error).toBe("adapt_failed");
    expect(mockUploadBeatClips).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it("a segment-less source never starts a cut", async () => {
    setupHappyPath(); // default structural input: no segments → no beats
    await runRemixPipeline(baseInput);
    expect(mockCutBeatClips).not.toHaveBeenCalled();
  });

  it("a cut failure costs the clips and nothing else — the run still returns its cards", async () => {
    setupWithBeats();
    mockCutBeatClips.mockRejectedValue(new Error("boom"));
    const result = await runRemixPipeline(baseInput);
    expect(result.error).toBeUndefined();
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blueprint!.clipPaths).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/lib/tools/runners/__tests__/remix-runner.test.ts`
Expected: the 4 new tests FAIL (`clipPaths` undefined / `cutBeatClips` never called); every pre-existing test still PASSES.

- [ ] **Step 3: Wire the runner**

Five edits to `src/lib/tools/runners/remix-runner.ts`:

**(a)** Imports, next to the `extractBeatFrames` import:

```ts
import { cutBeatClips, uploadBeatClips } from "@/lib/remix/beat-clips";
import type { CutResult } from "@/lib/remix/beat-clips";
```

**(b)** `RemixPipelineResult.blueprint` (the object type around line 136) gains, after `sourceVideoId`:

```ts
    /**
     * PHASE 4 — storage paths of the clips that LANDED in the `clips` bucket (uploaded only when
     * this blueprint object exists — cut and upload are split exactly so a failed run cannot
     * orphan objects the reaper's clip_uris worklist would never see). [] when cutting failed or
     * was skipped; the route writes this to `remix_blueprints.clip_uris`.
     */
    clipPaths: string[];
```

**(c)** Next to the `framesPromise` declaration (~line 268):

```ts
  // Phase 4: the clip cut reads `signedUrl` too, so it is joined in the same finally. Its
  // UPLOAD, though, happens on the success path only — see (d) below and beat-clips.ts.
  let cutPromise: Promise<CutResult> | null = null;
```

In the phase-3 block right after `framesPromise = …` (~line 320), with the same gate:

```ts
    // ── PHASE 4: BEAT CLIPS — cut now (overlaps adapt), upload only on success ────────────
    // Same fixed-buckets gate as frames: clips cut against fabricated timestamps are real
    // pixels under invented times.
    cutPromise =
      hasBeats && blueprint.from_fixed_buckets !== true
        ? cutBeatClips(signedUrl, blueprint.beats, blueprint.duration_s)
        : null;
```

**(d)** Immediately before the `return` (~line 504), replace the return statement with:

```ts
    // Phase 4: collect the cut (the adapt call has already paid its wall-clock — this await is
    // ~0ms) and upload ONLY when a blueprint is about to exist. The paths must be in hand HERE:
    // the finally runs after this object literal is assembled, so an await placed there could
    // never put paths on the return value.
    const cut = cutPromise ? await cutPromise.catch(() => null) : null;
    const clipPaths =
      cut && cut.files.length > 0 && hasBeats && blocks.length > 0
        ? await uploadBeatClips(blueprintId, cut.files)
        : [];

    return {
      blocks,
      warnings: allWarnings,
      // Null on a segment-less source (nothing to write a sheet against) and on a run whose
      // every card failed validation (a row no card points at is landfill).
      blueprint:
        hasBeats && blocks.length > 0
          ? {
              id: blueprintId,
              payload: blueprint,
              script: scripts,
              // The URL the resolve step returned, falling back to the one the creator pasted.
              sourceVideoId: sourcePostUrl ?? url,
              clipPaths,
            }
          : null,
    };
```

**(e)** In the `finally` (~line 521), between the `framesPromise` join and `cleanup()`:

```ts
    // Phase 4: join the cut (it reads `signedUrl` — budget-capped, so this cannot wait
    // indefinitely) and drop its temp dir. Runs on EVERY path; dispose is idempotent, so the
    // success path having already consumed the files is fine.
    if (cutPromise) {
      const cut = await cutPromise.catch(() => null);
      await cut?.dispose();
    }
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npm test -- src/lib/tools/runners/__tests__/remix-runner.test.ts`
Expected: PASS — all pre-existing tests AND the 4 new ones.

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/lib/tools/runners/remix-runner.ts src/lib/tools/runners/__tests__/remix-runner.test.ts
git commit -m "feat(remix): runner cuts clips in the adapt window, uploads on success only"
```

---

### Task 4: The row write — `clip_uris` through repo and run route

**Files:**
- Modify: `src/lib/remix/blueprint-repo.ts` (`BLUEPRINT_COLUMNS`, `BlueprintRow`)
- Modify: `src/app/api/tools/remix/run/route.ts` (the `insertBlueprint` call ~line 244 and its catch)
- Test: `src/lib/remix/__tests__/blueprint-repo.test.ts`, `src/app/api/tools/remix/run/__tests__/route.test.ts` (additions)

**Interfaces:**
- Consumes: `result.blueprint.clipPaths` (Task 3), `CLIPS_BUCKET` (Task 1).
- Produces: `BlueprintRow.clip_uris: string[]` — Task 5's read route and Task 6's reaper read this column; `BLUEPRINT_COLUMNS` now includes `clip_uris`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/remix/__tests__/blueprint-repo.test.ts`: the shared `SAMPLE_ROW` fixture is deliberately the tripwire for new required fields — add `clip_uris: ["sample-id/0.mp4"]` to it, and add one test to the `insertBlueprint` describe:

```ts
    it("carries clip_uris to the insert — the reaper's worklist starts here", async () => {
      const c = chain({ error: null });
      await insertBlueprint(c.client, SAMPLE_ROW);
      const [row] = c.insert.mock.calls[0] as [Record<string, unknown>];
      expect(row.clip_uris).toEqual(["sample-id/0.mp4"]);
    });
```

And to the column-list test's expectations (the test that asserts `BLUEPRINT_COLUMNS`), extend the expected string to include `clip_uris`.

In `src/app/api/tools/remix/run/__tests__/route.test.ts`, inside `describe("blueprint persistence")`: the existing success test (~line 557) destructures the inserted row — extend it to assert `row.clip_uris`. The runner is mocked in this file, so give its resolved `blueprint` fixture `clipPaths: ["bp/0.mp4"]` and assert:

```ts
      expect(row.clip_uris).toEqual(["bp/0.mp4"]);
```

Add one new test next to the existing "insert throws → cards ship without blueprintId" test (~line 540): mock `insertBlueprint` to throw as that test does, give the runner-mock blueprint `clipPaths: ["bp/0.mp4", "bp/1.mp4"]`, and assert the service client's `storage.from("clips").remove` was called with exactly those paths (extend this file's service-client mock with a `storage.from` spy following the same pattern the reaper test file uses — `storage: { from: vi.fn(() => ({ remove: mockClipsRemove })) }`).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts src/app/api/tools/remix/run/__tests__/route.test.ts`
Expected: new assertions FAIL (`clip_uris` undefined; `remove` never called); tsc will also flag `SAMPLE_ROW` until the type gains the field — that is the point.

- [ ] **Step 3: Implement**

`src/lib/remix/blueprint-repo.ts` — replace the `BLUEPRINT_COLUMNS` doc + value and extend the row type:

```ts
/**
 * The columns `BlueprintRow` declares, as PostgREST wants them.
 *
 * Named explicitly instead of `*` so the type and the table cannot drift silently in the read
 * direction: a column that goes missing answers with a real PostgREST error, where `*` would
 * hand back a row with the field simply `undefined`. `created_at` exists on the table and is
 * deliberately NOT read — nothing here uses it, and a `select("*")` cast to `BlueprintRow`
 * would misdescribe what it returns. `clip_uris` joined in phase 4: the run route writes it,
 * the read route signs it, the retention cron sweeps and empties it.
 */
export const BLUEPRINT_COLUMNS =
  "id, user_id, thread_id, source_video_id, blueprint, script, clip_uris";
```

`BlueprintRow` gains:

```ts
  /**
   * PHASE 4 — storage paths (`<id>/<beatIndex>.mp4`) of this run's clips in the `clips` bucket.
   * Paths, NEVER signed URLs: a signed URL in a durable column is a dead link on day 8 and a
   * live credential in a shared row. [] once the retention cron has swept them (its idempotency
   * marker), and on every run whose cut produced nothing.
   */
  clip_uris: string[];
```

`src/app/api/tools/remix/run/route.ts` — add to imports:

```ts
import { CLIPS_BUCKET } from "@/lib/remix/clip-storage";
```

Extend the `insertBlueprint` call and its catch:

```ts
        if (result.blueprint) {
          try {
            await insertBlueprint(createServiceClient(), {
              id: result.blueprint.id,
              user_id: user.id,
              thread_id: openThread.id,
              source_video_id: result.blueprint.sourceVideoId,
              blueprint: result.blueprint.payload,
              script: result.blueprint.script,
              clip_uris: result.blueprint.clipPaths,
            });
          } catch (bpErr) {
            Sentry.captureException(bpErr, { tags: { route: "api.tools.remix.run" } });
            log.warn("blueprint persist failed — cards will render without beats", {
              error: bpErr instanceof Error ? bpErr.message : String(bpErr),
            });
            for (const b of result.blocks) {
              delete (b.props as { blueprintId?: string }).blueprintId;
              delete (b.props as { blueprintVariant?: number }).blueprintVariant;
            }
            // Phase 4: clips were uploaded on the promise this row would list them. No row ⇒
            // outside the reaper's worklist forever (§5 sweeps rows, not the bucket) — remove
            // them now, best-effort. A failure here is the accepted residual window (spec §10).
            if (result.blueprint.clipPaths.length > 0) {
              try {
                await createServiceClient()
                  .storage.from(CLIPS_BUCKET)
                  .remove(result.blueprint.clipPaths);
              } catch (rmErr) {
                log.warn("orphaned clip cleanup failed", {
                  error: rmErr instanceof Error ? rmErr.message : String(rmErr),
                });
              }
            }
          }
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts src/app/api/tools/remix/run/__tests__/route.test.ts`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/lib/remix/blueprint-repo.ts src/app/api/tools/remix/run/route.ts \
  src/lib/remix/__tests__/blueprint-repo.test.ts src/app/api/tools/remix/run/__tests__/route.test.ts
git commit -m "feat(remix): clip_uris written by the run route, orphans removed on insert failure"
```

---

### Task 5: The read route — `clips` signed fresh on every read

**Files:**
- Modify: `src/app/api/remix/blueprint/[id]/route.ts` (the `Promise.all` ~line 86 and the response ~line 103)
- Test: `src/app/api/remix/blueprint/[id]/__tests__/route.test.ts` (additions)

**Interfaces:**
- Consumes: `signClips` (Task 1), `row.clip_uris` (Task 4).
- Produces: the JSON response gains `clips: Record<number, string>` — Task 7's `RemixBeats` payload reads exactly this field.

- [ ] **Step 1: Write the failing tests**

In the route test file: add the mock next to the filmstrip-storage mock —

```ts
vi.mock("@/lib/remix/clip-storage", () => ({ signClips: vi.fn() }));
```

import it, default it in `beforeEach` (`mockSignClips.mockResolvedValue({})`), add `clip_uris: []` to the `makeRow()` helper, and add:

```ts
  it("serves signed clips for the row's clip_uris, keyed by beat index", async () => {
    signedIn();
    const row = makeRow();
    row.clip_uris = [`${ID}/0.mp4`, `${ID}/3.mp4`];
    mockGetBlueprint.mockResolvedValue(row);
    mockSignClips.mockResolvedValue({ 0: "https://signed/0.mp4", 3: "https://signed/3.mp4" });

    const res = await call();
    const body = await res.json();

    expect(mockSignClips).toHaveBeenCalledWith(row.clip_uris);
    expect(body.clips).toEqual({ "0": "https://signed/0.mp4", "3": "https://signed/3.mp4" });
  });

  it("a pre-lane row (no clip_uris) gets clips: {} — absent-safe", async () => {
    signedIn();
    const row = makeRow();
    delete (row as Partial<typeof row>).clip_uris; // a row read before the column joined the SELECT
    mockGetBlueprint.mockResolvedValue(row);

    const body = await (await call()).json();
    expect(body.clips).toEqual({});
    expect(mockSignClips).toHaveBeenCalledWith([]);
  });

  it("a clip signing fault degrades to {} without touching the 200", async () => {
    signedIn();
    mockGetBlueprint.mockResolvedValue({ ...makeRow(), clip_uris: [`${ID}/0.mp4`] });
    mockSignClips.mockRejectedValue(new Error("storage down"));

    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).clips).toEqual({});
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- "src/app/api/remix/blueprint/[id]/__tests__/route.test.ts"`
Expected: new tests FAIL (`clips` undefined in the body).

- [ ] **Step 3: Implement**

In `src/app/api/remix/blueprint/[id]/route.ts`: import `signClips` from `@/lib/remix/clip-storage`; widen the frames block —

```ts
  // `clips` (phase 4) rides the same contract: signed fresh on every read from the paths the row
  // carries, {} on any fault — a missing clip drops the stage back to its still. `?? []` because
  // the jsonb column predates its readers: a row cached from an older SELECT has no field at all.
  let frames: Record<number, string> = {};
  let scrubFrames: Record<number, string> = {};
  let clips: Record<number, string> = {};
  try {
    [frames, scrubFrames, clips] = await Promise.all([
      signAnalysisFrames(id),
      signScrubFrames(id),
      signClips(row.clip_uris ?? []),
    ]);
  } catch (err) {
    log.warn("frames could not be signed — serving the text sheet", {
      blueprintId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
```

and add `clips,` to the `Response.json({ … })` object.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- "src/app/api/remix/blueprint/[id]/__tests__/route.test.ts"`
Expected: PASS, all tests.

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add "src/app/api/remix/blueprint/[id]/route.ts" "src/app/api/remix/blueprint/[id]/__tests__/route.test.ts"
git commit -m "feat(remix): blueprint route serves signed clips"
```

---

### Task 6: Retention — two independent sweeps in the existing cron

**Files:**
- Modify: `src/app/api/cron/delete-retained-videos/route.ts` (full restructure)
- Test: `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` (restructure + additions)

**Interfaces:**
- Consumes: `remix_blueprints.clip_uris` (Task 4), the `clips` bucket.
- Produces: `CLIP_TTL_DAYS = 7` exported from the route; response shape becomes `{ status, videos: {deleted, nulled, error?}, clips: {deleted, emptied, error?} }` (the old top-level `deleted`/`nulled` move under `videos` — this endpoint has no consumer beyond local invocation and tests).

⚠️ The existing handler early-returns at `paths.length === 0` (the NORMAL night) and 500s on storage failure — a clip block appended after it would be dead code. That is the defect this restructure exists to remove (spec §5). The video sweep's *storage behaviour* stays byte-identical.

- [ ] **Step 1: Restructure the existing tests, add the new ones**

In the existing test file: update every assertion on `body.deleted` / `body.nulled` to `body.videos.deleted` / `body.videos.nulled`. Extend the `mockFromFactory` to serve `remix_blueprints` and the storage mock to key by bucket:

```ts
const mockClipSelect = vi.fn();
const mockClipUpdate = vi.fn();
const mockClipsRemove = vi.fn();
const mockVideosRemove = vi.fn();

const mockFromFactory = vi.fn((table: string) => {
  if (table === "analysis_results") return { select: mockSelect, update: mockUpdate };
  if (table === "remix_blueprints") return { select: mockClipSelect, update: mockClipUpdate };
  return {};
});
// storage.from keyed by bucket:
      storage: {
        from: vi.fn((bucket: string) => ({
          remove: bucket === "clips" ? mockClipsRemove : mockVideosRemove,
        })),
      },
```

Clip-sweep chain helper + defaults (`beforeEach`): `mockClipSelect` returns a chain whose `.lt()` resolves `{ data: [], error: null }`; `mockClipsRemove` resolves `{ error: null }`; `mockClipUpdate` returns `{ in: vi.fn().mockResolvedValue({ error: null }) }`.

```ts
function buildClipSelectChain(resolveWith: {
  data: Array<{ id: string; clip_uris: unknown }> | null;
  error: null | { message: string };
}) {
  const chain = { lt: vi.fn().mockResolvedValue(resolveWith) };
  return vi.fn().mockReturnValue(chain);
}
```

New tests:

```ts
describe("clip sweep (phase 4)", () => {
  it("CLIP_TTL_DAYS is 7 — the ruling's number, findable and asserted", async () => {
    const { CLIP_TTL_DAYS } = await import("../route");
    expect(CLIP_TTL_DAYS).toBe(7);
  });

  it("runs when the video sweep found NOTHING — the dead-code regression", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null })); // no videos
    mockClipSelect.mockImplementation(
      buildClipSelectChain({
        data: [
          { id: "bp-1", clip_uris: ["bp-1/0.mp4", "bp-1/1.mp4"] },
          { id: "bp-2", clip_uris: [] }, // already swept — must be skipped
        ],
        error: null,
      }),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockClipsRemove).toHaveBeenCalledWith(["bp-1/0.mp4", "bp-1/1.mp4"]);
    expect(body.clips.deleted).toBe(2);
    expect(body.clips.emptied).toBe(1);
  });

  it("runs even when the video sweep FAILED, and the response is a 500 that reports both", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: null, error: { message: "pg down" } }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.videos.error).toBeDefined();
    expect(mockClipsRemove).toHaveBeenCalledWith(["bp-1/0.mp4"]);
    expect(body.clips.deleted).toBe(1);
  });

  it("empties clip_uris only after a successful storage delete, and a failed empty still 200s", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );
    const inSpy = vi.fn().mockResolvedValue({ error: { message: "update failed" } });
    mockClipUpdate.mockReturnValue({ in: inSpy });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200); // storage delete succeeded; next run re-sweeps
    expect(inSpy).toHaveBeenCalledWith("id", ["bp-1"]);
    expect(body.clips.emptied).toBe(0);
  });

  it("a clip storage delete failure does NOT empty clip_uris (retry-ability preserved)", async () => {
    mockSelect.mockImplementation(buildSelectChain({ data: [], error: null }));
    mockClipSelect.mockImplementation(
      buildClipSelectChain({ data: [{ id: "bp-1", clip_uris: ["bp-1/0.mp4"] }], error: null }),
    );
    mockClipsRemove.mockResolvedValue({ error: { message: "storage down" } });

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(mockClipUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — old assertions and new tests both fail**

Run: `npm test -- src/app/api/cron/delete-retained-videos/__tests__/route.test.ts`
Expected: FAIL across the board (response shape + missing export).

- [ ] **Step 3: Restructure the route**

Replace the body of `src/app/api/cron/delete-retained-videos/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { CLIPS_BUCKET } from "@/lib/remix/clip-storage";

const log = createLogger({ module: "cron/delete-retained-videos" });

/**
 * The remix-clip retention window (phase 4, owner ruling D2 2026-08-15). This TTL IS the
 * "clips die with the thread" mitigation, resolved to a mechanism that exists — exported so a
 * test can assert it, because a TTL living only as a literal in a query is a mitigation nobody
 * can find.
 */
export const CLIP_TTL_DAYS = 7;

interface VideoSweep { deleted: number; nulled: number; error?: string }
interface ClipSweep { deleted: number; emptied: number; error?: string }

/**
 * GET /api/cron/delete-retained-videos — daily 03:00 UTC (vercel.json), CRON_SECRET auth.
 *
 * TWO independent sweeps, each in its own try/catch — a failure (or an empty night) in one must
 * never skip the other. The original single-body version early-returned when the video sweep
 * found nothing, which is the NORMAL night; anything appended after it would have been dead code.
 *
 *   1. videos: uploaded videos >30d for non-opted-in users (unchanged behaviour, Phase 11/INT-05)
 *   2. clips:  remix_blueprints rows past CLIP_TTL_DAYS — remove clip_uris paths from the
 *              `clips` bucket, then empty the column (the idempotency marker: a failed empty
 *              leaves the row re-sweepable tomorrow).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError as NextResponse;

  const supabase = createServiceClient();
  const videos = await sweepRetainedVideos(supabase);
  const clips = await sweepExpiredClips(supabase);

  const failed = Boolean(videos.error || clips.error);
  return NextResponse.json(
    { status: failed ? "partial" : "completed", videos, clips },
    { status: failed ? 500 : 200 },
  );
}

/** The pre-phase-4 body, verbatim in behaviour: query, batch delete, null-out, same logging. */
async function sweepRetainedVideos(supabase: SupabaseClient): Promise<VideoSweep> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredRows, error: queryError } = await supabase
      .from("analysis_results")
      .select(
        "id, video_storage_path, user_id, creator_profiles!inner(storage_retention_opted_in)"
      )
      .lt("created_at", thirtyDaysAgo)
      .not("video_storage_path", "is", null)
      .eq("creator_profiles.storage_retention_opted_in", false);

    if (queryError) {
      log.error("Retention query failed", { error: queryError.message });
      return { deleted: 0, nulled: 0, error: queryError.message };
    }

    const ids = (expiredRows ?? []).map((r) => r.id as string).filter(Boolean);
    const paths = (expiredRows ?? [])
      .map((r) => r.video_storage_path as string)
      .filter(Boolean);

    if (paths.length === 0) {
      log.info("No expired videos to delete", { thirtyDaysAgo });
      return { deleted: 0, nulled: 0 };
    }

    const { error: deleteError } = await supabase.storage.from("videos").remove(paths);
    if (deleteError) {
      log.error("Storage batch delete failed", { error: deleteError.message });
      return { deleted: 0, nulled: 0, error: deleteError.message };
    }

    // Null out video_storage_path after successful delete (Mode B fix): prevents dangling
    // references. A failed UPDATE logs at ERROR and is NOT a sweep error — the storage delete
    // succeeded and the next run re-nulls (idempotent).
    const { error: nullError } = await supabase
      .from("analysis_results")
      .update({ video_storage_path: null })
      .in("id", ids);

    if (nullError) {
      log.error("retention_null_failed", { error: nullError.message, ids_count: ids.length });
    }

    log.info("Video retention sweep completed", {
      deleted: paths.length,
      nulled: nullError ? 0 : ids.length,
    });
    return { deleted: paths.length, nulled: nullError ? 0 : ids.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Video retention sweep threw", { error: msg });
    return { deleted: 0, nulled: 0, error: msg };
  }
}

/** Phase 4: remove expired remix clips and empty their rows' worklist column. */
async function sweepExpiredClips(supabase: SupabaseClient): Promise<ClipSweep> {
  try {
    const cutoff = new Date(Date.now() - CLIP_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error: queryError } = await supabase
      .from("remix_blueprints")
      .select("id, clip_uris")
      .lt("created_at", cutoff);

    if (queryError) {
      log.error("clip retention query failed", { error: queryError.message });
      return { deleted: 0, emptied: 0, error: queryError.message };
    }

    // Filtered in JS, not PostgREST: jsonb emptiness predicates over the wire are fragile, and
    // the table holds single-digit rows. Thousands of rows would want a partial index or a
    // generated has_clips boolean (spec §5's scale caveat) — not now.
    const rows = (data ?? []).filter(
      (r): r is { id: string; clip_uris: string[] } =>
        Array.isArray(r.clip_uris) && r.clip_uris.length > 0,
    );
    if (rows.length === 0) {
      log.info("No expired clips to delete", { cutoff });
      return { deleted: 0, emptied: 0 };
    }

    const paths = rows.flatMap((r) => r.clip_uris);
    const { error: deleteError } = await supabase.storage.from(CLIPS_BUCKET).remove(paths);
    if (deleteError) {
      // clip_uris deliberately NOT emptied — the rows stay on tomorrow's worklist.
      log.error("clip storage delete failed", { error: deleteError.message });
      return { deleted: 0, emptied: 0, error: deleteError.message };
    }

    const { error: emptyError } = await supabase
      .from("remix_blueprints")
      .update({ clip_uris: [] })
      .in("id", rows.map((r) => r.id));

    if (emptyError) {
      // Storage delete succeeded; a failed empty is re-swept tomorrow (remove([]) of already
      // deleted objects is not an error). ERROR log, not a sweep error.
      log.error("clip_uris empty failed — rows re-swept next run", {
        error: emptyError.message,
        ids_count: rows.length,
      });
    }

    log.info("Clip retention sweep completed", {
      deleted: paths.length,
      emptied: emptyError ? 0 : rows.length,
    });
    return { deleted: paths.length, emptied: emptyError ? 0 : rows.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Clip retention sweep threw", { error: msg });
    return { deleted: 0, emptied: 0, error: msg };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/api/cron/delete-retained-videos/__tests__/route.test.ts`
Expected: PASS — restructured old tests and all 5 new ones.

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/app/api/cron/delete-retained-videos/route.ts \
  src/app/api/cron/delete-retained-videos/__tests__/route.test.ts
git commit -m "feat(remix): clip TTL reaper as an independent second sweep (CLIP_TTL_DAYS=7)"
```

---

### Task 7: The `clips` bucket migration — hand-applied

**Files:**
- Create: `supabase/migrations/20260816120000_clips_bucket.sql`

⚠️ `supabase db push` is UNSAFE here (migration-ledger drift). The file is the record; the application is by hand (SQL editor or `mcp__supabase__execute_sql`). Dev and prod share ONE Supabase project.

- [ ] **Step 1: Write the migration file**

```sql
-- Remix beat clips (phase 4): a PRIVATE bucket for ≤8 muted ≤4s fragments per remix run,
-- keyed clips/<blueprintId>/<beatIndex>.mp4. Audio is stripped from the files themselves (-an).
-- Reaped after CLIP_TTL_DAYS=7 by /api/cron/delete-retained-videos (owner ruling D1/D2
-- 2026-08-15: per-run clips + TTL — NOT the source_video dedupe this table's own comment once
-- proposed; see the spec's §1.2). Reads and writes are service-role only; the read route signs
-- fresh URLs per request and nothing persists them.
insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do update set public = false;
```

- [ ] **Step 2: Apply by hand and verify**

Run via `mcp__supabase__execute_sql` (or paste into the SQL editor), then verify:

```sql
select id, public from storage.buckets where id = 'clips';
```

Expected: one row, `public = false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260816120000_clips_bucket.sql
git commit -m "feat(remix): clips bucket migration (private, hand-applied)"
```

---

### Task 8: The UI — clips play on the scrub stage

**Files:**
- Modify: `src/components/thread/remix-source-viewer.tsx` (props, clip-window helpers, the stage)
- Modify: `src/components/thread/remix-beats.tsx` (`Payload` + the viewer call ~line 162)
- Test: `src/components/thread/__tests__/remix-source-viewer.test.tsx` (additions)

**Interfaces:**
- Consumes: `clips` from Task 5's route payload.
- Produces: `RemixSourceViewerProps.clips?: Record<number, string>`; exported pure helpers `clipWindows`, `windowAt`, `windowAfter` (tested directly).

Design rules from spec §4.2 (all already ruled): one rAF clock leads, the `<video>` follows; the still never leaves (video reveals on `loadeddata` only); src swaps in the uncovered gaps; scrubbing inside a window seeks the paused video; predicted duration `min(4, duration_s)` replaced by `loadedmetadata`; drift re-seek at >0.15s; no autoplay on mount; **no accent**.

- [ ] **Step 1: Write the failing tests**

Add to `remix-source-viewer.test.tsx` (its existing `frames(n)`, `BEATS`, `blueprint()` helpers apply; `BEATS[0]` spans 0–1.8s, `BEATS[1]` 1.8–14s):

```ts
import { clipWindows, windowAt, windowAfter } from "../remix-source-viewer";

describe("clip windows — pure maths", () => {
  const clips = { 0: "https://signed/c0.mp4", 1: "https://signed/c1.mp4" };

  it("builds one window per clip-backed beat, predicted at min(4, duration_s)", () => {
    const w = clipWindows(BEATS, clips, {});
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ beatIndex: 0, start: 0, duration: 1.8 });
    expect(w[1]).toMatchObject({ beatIndex: 1, start: 1.8, duration: 4 }); // 12.2s beat capped
  });

  it("a beat with no clip gets no window", () => {
    const w = clipWindows(BEATS, { 1: "https://signed/c1.mp4" }, {});
    expect(w).toHaveLength(1);
    expect(w[0]!.beatIndex).toBe(1);
  });

  it("a MEASURED duration replaces the prediction — the loadedmetadata clamp", () => {
    const w = clipWindows(BEATS, clips, { 1: 2.5 });
    expect(w[1]!.duration).toBe(2.5);
  });

  it("windowAt is half-open: inside hits, the end does not", () => {
    const w = clipWindows(BEATS, clips, {});
    expect(windowAt(w, 0)?.beatIndex).toBe(0);
    expect(windowAt(w, 1.79)?.beatIndex).toBe(0);
    expect(windowAt(w, 5.79)?.beatIndex).toBe(1); // inside beat 1's 4s window
    expect(windowAt(w, 5.8)).toBeNull();          // past it — uncovered
  });

  it("windowAfter finds the next covered window for gap preloading", () => {
    const w = clipWindows(BEATS, { 1: "https://signed/c1.mp4" }, {});
    expect(windowAfter(w, 0)?.beatIndex).toBe(1);
    expect(windowAfter(w, 10)).toBeNull();
  });
});

describe("RemixSourceViewer — the clip layer", () => {
  it("no clips ⇒ NO video element — every pre-lane sheet stays byte-identical", () => {
    render(<RemixSourceViewer scrubFrames={frames(30)} beats={BEATS} durationS={14} />);
    expect(screen.queryByTestId("remix-clip-video")).toBeNull();
  });

  it("mounts ONE video: muted, playsInline, no controls, hidden until loadeddata", () => {
    render(
      <RemixSourceViewer
        scrubFrames={frames(30)}
        beats={BEATS}
        durationS={14}
        clips={{ 0: "https://signed/c0.mp4" }}
      />,
    );
    const video = screen.getByTestId("remix-clip-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("muted");
    expect(video).not.toHaveAttribute("controls");
    // Playhead starts at 0 — inside beat 0's window — but the clip has not loaded yet:
    expect(video.style.opacity).toBe("0");

    fireEvent.loadedData(video);
    expect(video.style.opacity).toBe("1");
  });

  it("outside every covered window the still shows and the video hides", () => {
    render(
      <RemixSourceViewer
        scrubFrames={frames(30)}
        beats={BEATS}
        durationS={14}
        clips={{ 0: "https://signed/c0.mp4" }}
      />,
    );
    const video = screen.getByTestId("remix-clip-video") as HTMLVideoElement;
    fireEvent.loadedData(video);
    // Seek to the end via the slider's keyboard contract — far past beat 0's 1.8s window:
    fireEvent.keyDown(screen.getByTestId("remix-scrub-strip"), { key: "End" });
    expect(video.style.opacity).toBe("0");
  });
});
```

Note the `muted` caveat: React sets `muted` as a DOM property, not an attribute — if `toHaveAttribute("muted")` fails, assert `expect(video.muted).toBe(true)` instead (and add the attribute explicitly in the JSX via `muted` + `ref` callback if happy-dom needs it). The behaviour under test is "the element is muted", not the serialisation.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/components/thread/__tests__/remix-source-viewer.test.tsx`
Expected: new tests FAIL (no exports, no testid); the pre-existing tests still PASS.

- [ ] **Step 3: Implement**

`src/components/thread/remix-source-viewer.tsx` — additions (existing code unchanged unless shown):

**(a)** Update the header comment's premise paragraph: the flipbook note gains — *"Phase 4: for the ≤8 windows a run's clips cover, the stage overlays ONE `<video>` (muted — the audio track itself is stripped) and the flipbook remains everywhere else. No clips ⇒ this file behaves byte-identically to phase 3."*

**(b)** Pure helpers + types, above the component:

```ts
export interface ClipWindow {
  beatIndex: number;
  url: string;
  start: number;
  duration: number;
}

/**
 * One window per clip-backed beat. `measured` (from loadedmetadata) beats the prediction: a clip
 * the budget truncated must shrink its window rather than freeze on its last frame (spec §4.2).
 */
export function clipWindows(
  beats: BlueprintBeat[],
  clips: Record<number, string>,
  measured: Record<number, number>,
): ClipWindow[] {
  return beats
    .filter((b) => clips[b.index])
    .map((b) => ({
      beatIndex: b.index,
      url: clips[b.index]!,
      start: b.t_start,
      duration: measured[b.index] ?? Math.min(4, Math.max(0, b.duration_s)),
    }));
}

/** The window covering `t`, half-open — at the window's end the stage is back on stills. */
export function windowAt(windows: ClipWindow[], t: number): ClipWindow | null {
  return windows.find((w) => t >= w.start && t < w.start + w.duration) ?? null;
}

/** The next window strictly ahead of `t` — what the gap preloads. */
export function windowAfter(windows: ClipWindow[], t: number): ClipWindow | null {
  let next: ClipWindow | null = null;
  for (const w of windows) {
    if (w.start > t && (!next || w.start < next.start)) next = w;
  }
  return next;
}
```

**(c)** Props: add to `RemixSourceViewerProps`:

```ts
  /**
   * PHASE 4 — `{ beatIndex → signed clip URL }`, ≤8 muted ≤4s fragments. Absent/empty is the
   * normal case (every pre-lane sheet) and must render byte-identically to phase 3.
   */
  clips?: Record<number, string>;
```

…and add `clips,` to the component's destructured parameters (the `export function
RemixSourceViewer({ scrubFrames, beats, … })` signature), or the code in (d) has no `clips`
binding.

**(d)** Inside the component (after the `pct` state), the clip layer state + logic:

```tsx
  // ── PHASE 4: the clip layer ──────────────────────────────────────────────────
  // One <video> over the still. The rAF clock LEADS (pct is the single source of truth); the
  // video follows — seeked into place, drift-corrected past 0.15s, never driving pct.
  const clipMap = clips ?? {};
  const hasClips = Object.keys(clipMap).length > 0;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Measured clip durations (loadedmetadata) — replaces the min(4, duration_s) prediction.
  const [measured, setMeasured] = useState<Record<number, number>>({});
  // Which src has finished loadeddata — the still stays until the CURRENT src is ready.
  const [readySrc, setReadySrc] = useState<string | null>(null);

  const windows = useMemo(
    () => clipWindows(beats, clipMap, measured),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clipMap is derived from `clips`
    [beats, clips, measured],
  );
  const active = hasClips ? windowAt(windows, displayTime) : null;
  // Load the ACTIVE clip; in an uncovered gap, preload the NEXT one — the swap cost lands where
  // a still is showing anyway (spec §4.2).
  const loadWindow = active ?? (hasClips ? windowAfter(windows, displayTime) : null);
  const showVideo = Boolean(active && readySrc === active.url);

  // The element follows the clock: seek into the window, play/pause with the flipbook.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active || readySrc !== active.url) return;
    const target = Math.max(0, displayTime - active.start);
    if (playing) {
      if (Math.abs(video.currentTime - target) > 0.15) video.currentTime = target;
      void video.play().catch(() => {});
    } else {
      video.pause();
      // Scrubbing: the paused frame at exact-time beats the nearest grid still.
      video.currentTime = target;
    }
  }, [active, readySrc, playing, displayTime]);

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const duration = e.currentTarget.duration;
      const w = loadWindow;
      if (!w || !Number.isFinite(duration) || duration <= 0) return;
      setMeasured((m) => (m[w.beatIndex] === duration ? m : { ...m, [w.beatIndex]: duration }));
    },
    [loadWindow],
  );
```

**(e)** The stage markup — inside the existing stage `<div>`, between `<CoverFill …/>` and the time chip:

```tsx
        {hasClips && (
          <video
            ref={videoRef}
            data-testid="remix-clip-video"
            key="clip-stage"
            src={loadWindow?.url}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={(e) => setReadySrc(e.currentTarget.currentSrc || loadWindow?.url || null)}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: showVideo ? 1 : 0, transition: "opacity .12s" }}
          />
        )}
```

(The time chip and play button come after it in the DOM, so they stack above without z-index. `onLoadedData` records the url so `showVideo` cannot flash a stale clip while a swap is in flight.)

`src/components/thread/remix-beats.tsx` — `Payload` gains:

```ts
  /**
   * PHASE 4 — `{ beatIndex → signed clip URL }` for the source viewer's stage. Absent for every
   * pre-lane sheet and whenever cutting failed; the stage then plays the flipbook, unchanged.
   */
  clips?: Record<number, string>;
```

and the viewer call gains `clips={data.clips ?? {}}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/thread/__tests__/remix-source-viewer.test.tsx`
Expected: PASS — all pre-existing viewer/beats tests AND the 8 new ones. If `toHaveAttribute("muted")` fails on the React property/attribute split, switch that one assertion to `video.muted === true` as noted in Step 1.

- [ ] **Step 5: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
git add src/components/thread/remix-source-viewer.tsx src/components/thread/remix-beats.tsx \
  src/components/thread/__tests__/remix-source-viewer.test.tsx
git commit -m "feat(remix): scrub stage plays beat clips — one video, clock leads, stills never leave"
```

---

### Task 9: Full gates + live verification

Nothing here may claim "runs in production" — deploy is OFF.

- [ ] **Step 1: The derive-and-drop tripwire + zero-diff check**

```bash
git diff main -- src/lib/engine/remix/resolve-and-rehost.ts \
  src/app/api/analyze/__tests__/derive-and-drop.test.ts \
  src/app/api/analyze/__tests__/decode-route.test.ts \
  src/lib/engine/__tests__/tiktok-url-branch.test.ts
```

Expected: **empty output**. Any diff here violates the spec (§3) — stop and fix before proceeding.

- [ ] **Step 2: tsc + build + full suite**

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
lsof -ti:3000,3012 | xargs kill -9 2>/dev/null; npm test -- --maxWorkers=3
```

Expected: tsc clean, build clean, suite green. Known flakes (`scraping/resolve-video`, `engine/omni-analysis-*`, `composer-*.tsx` under load) may fail 0–7 — rerun the failing file in isolation and confirm it cannot reach this diff before proceeding.

- [ ] **Step 3: Live remix run through the real UI**

```bash
npm run dev -- --port 3012
```

Signed in at `localhost:3012`: `/feed` → click an `article` → **Remix in the teardown detail** (the tile's Remix is a mouse accelerator that `getByRole` cannot see). **Wait ≥3 minutes** (the run takes ~2.7; a launchd reaper kills idle dev servers after 10 — keep the tab active). Then verify, via a scratchpad script with the service client:

1. the newest `remix_blueprints` row has non-empty `clip_uris` (≤8 paths, `<id>/<beatIndex>.mp4`);
2. the `clips` bucket holds those objects;
3. `GET /api/remix/blueprint/<id>` (with the session cookie) returns `clips` with signed URLs.

- [ ] **Step 4: The delivered-bytes probe — the check no argv assertion can make**

Download ONE clip from the bucket (signed URL from step 3) and probe it:

```bash
curl -s -o /tmp/probe-clip.mp4 "<signedUrl>"
node_modules/ffmpeg-static/ffmpeg -hide_banner -i /tmp/probe-clip.mp4 2>&1 | grep -E "Stream #|Duration"
```

Expected: **exactly one stream** (video, no audio line), **360×640** (or `-2:640`-scaled equivalent), duration ≤ 4.05s. This catches the option-positionality failure class (spec §2.3). Also note the clip's byte size against the 150–300 KB estimate (spec said the live run checks it).

- [ ] **Step 5: Browser measurement of the stage**

Native mobile viewport (one browser context opened AT 390×844 — resizing a loaded page is not the mobile UI). On the remix card's sheet: press Play; confirm the `<video>` layer becomes visible inside a covered window and the still returns outside it (assert via `getComputedStyle(video).opacity`, not a screenshot — ambient animations never settle here; if screenshotting, use `animations: 'disabled'` + tight `clip`). Scrub into a covered window while paused and confirm the frame tracks the playhead.

- [ ] **Step 6: The reaper, invoked locally**

Backdate the live row past the TTL, then invoke with the secret:

```sql
update remix_blueprints set created_at = now() - interval '8 days' where id = '<blueprintId>';
```

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3012/api/cron/delete-retained-videos
```

Expected: `{ status: "completed", videos: {...}, clips: { deleted: N, emptied: 1 } }`; the bucket objects gone; the row's `clip_uris` now `[]`; a second invocation reports `clips: { deleted: 0, emptied: 0 }` (idempotent). Restore `created_at` afterwards if the row should keep rendering its sheet — the clips are gone either way, which is the correct post-TTL state.

- [ ] **Step 7: Commit any verification fixes, then hand off**

Fixes found by steps 3–6 get their own commits (`fix(remix): …`). Then this plan is done: report results (including the clip byte size vs the estimate) and proceed to branch integration — PR to `main` per `superpowers:finishing-a-development-branch`. Re-check `git rev-list --count HEAD..main` before opening the PR (`main` moves), and remember: **merging deploys nothing here — deploy is OFF; do not cite production as evidence.**

---

## Out of scope (deliberately)

- Phase 5 (`revise_remix`) — separate plan; its two prerequisite channels are spec §6.7.
- Reaping `filmstrips` or `remix_blueprints` rows; the `remix_blueprints_source_video_idx` drop.
- `PLATFORM = "tiktok"` hardcode in `use-remix-launch.ts` — separate lane.
- Any frames-path change.
