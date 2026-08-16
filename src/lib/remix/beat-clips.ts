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
 * A NON-ZERO exit still leaves whatever outputs completed before it failed — for that case the
 * exit code is logged, not obeyed, and what "landed" is decided by `stat`. A NULL code (spawn
 * error or timeout SIGKILL) instead discards everything, deliberately: a kill can truncate the
 * output mid-write, and a moov-less mp4 that uploads but never fires `loadeddata` is worse than
 * no clip at all (the stage falls back to the still either way).
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

    // null code = spawn error OR timeout kill. Outputs may exist but are untrustworthy —
    // deliberately discarded (see the doc comment above); dispose() removes them with the dir.
    if (code === null) {
      return { files: [], dispose };
    }

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
