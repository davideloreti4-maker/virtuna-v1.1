/**
 * extract-grid.ts — many frames from one remote video, in ONE ffmpeg pass.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────────────────
 * `extractFrameAtTimestamp` spawns one ffmpeg per frame with `-ss` before `-i`. Against a LOCAL
 * file that is the fast path; against a REMOTE signed URL it is N TCP+TLS handshakes, N moov-atom
 * reads and N range seeks. Measured against a real Supabase-signed mp4 on 2026-08-14:
 *
 *     per-frame spawn :  4 frames in 15.6s   (3.9 s/frame)
 *     single pass     :  8 frames in  7.0s
 *                       30 frames in  4.7s
 *                      115 frames in  5.5s   (0.05 s/frame)
 *
 * The cost is the connection and the sequential read, so it is ~O(1) in the frame count: 115
 * frames is CHEAPER than 4 of the old ones. That is what makes a dense scrub strip affordable,
 * and it is why the beat frames come from the same pass rather than from their own seeks.
 *
 * `extractFrameAtTimestamp` is NOT replaced — the analyze/filmstrip path still uses it, and this
 * module is additive.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.filmstrip.extract-grid" });

/**
 * Target spacing of the internal grid. 0.25s keeps the rounding error under an eighth of a second
 * on any video short enough to matter, which is what lets a beat frame be sampled a quarter into
 * a ≥1s beat without the chosen frame sliding onto the cut at its start.
 */
const GRID_INTERVAL_S = 0.25;

/**
 * Ceiling on grid frames, so a long source cannot fill the temp dir. Above this the grid simply
 * gets coarser — which is safe, because a video long enough to hit the cap has correspondingly
 * long beats (buildBlueprint merges to at most 8 regardless of duration).
 */
const MAX_GRID_FRAMES = 240;

/** Whole-pass ceiling. A hung ffmpeg must not hold the source open past the runner's cleanup(). */
const PASS_TIMEOUT_MS = 40_000;

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
      log.warn("ffmpeg grid pass timed out", { timeoutMs });
      done(null);
    }, timeoutMs);

    // stderr is drained but discarded — ffmpeg writes its whole banner there and an unread pipe
    // fills its buffer and deadlocks the child on a long encode.
    proc.stderr.on("data", () => {});
    proc.on("close", done);
    proc.on("error", (err) => {
      log.error("ffmpeg grid spawn failed", { error: err.message });
      done(null);
    });
  });
}

/**
 * Extract one frame for each requested timestamp, using a single sequential read of the source.
 *
 * WHICH frame a requested time gets: the first grid frame **at or after** it, never before. A
 * caller asking for a moment inside a beat must not be handed the frame preceding it, because the
 * boundary it would slide onto is a CUT — a dissolve or the tail of the previous shot. Rounding to
 * nearest would allow exactly that on a coarse grid; rounding forward cannot.
 *
 * Never throws — every caller is inside the remix runner's `finally`, whose one job is guaranteeing
 * the temp mp4 gets dropped.
 *
 * @returns an array parallel to `times`; an entry is null when nothing landed for it.
 */
export async function extractFramesAtTimes(
  videoUrl: string,
  durationS: number,
  times: number[],
): Promise<Array<Buffer | null>> {
  if (times.length === 0) return [];
  if (!Number.isFinite(durationS) || durationS <= 0) {
    log.warn("grid extraction skipped — no usable duration", { durationS });
    return times.map(() => null);
  }
  if (!ffmpegPath) {
    log.error("ffmpeg-static binary not available on this platform");
    return times.map(() => null);
  }

  const count = Math.min(MAX_GRID_FRAMES, Math.max(8, Math.ceil(durationS / GRID_INTERVAL_S)));
  const fps = count / durationS;

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "remix-grid-"));

    const code = await runFfmpeg(
      [
        "-i", videoUrl,
        "-vf", `fps=${fps.toFixed(6)}`,
        "-q:v", "4",
        "-fps_mode", "vfr",
        join(dir, "f-%04d.jpg"),
      ],
      PASS_TIMEOUT_MS,
    );

    // A non-zero exit still leaves whatever frames it wrote before failing, and a partial strip is
    // a better outcome than none. So the exit code is logged, not obeyed.
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    if (files.length === 0) {
      log.warn("grid pass produced no frames", { code, durationS, count });
      return times.map(() => null);
    }

    const out: Array<Buffer | null> = [];
    // Small cache: beat frames and scrub frames routinely resolve to the same grid index, and
    // reading the same JPEG twice is pure waste.
    const cache = new Map<number, Buffer | null>();

    for (const t of times) {
      const idx = Math.min(files.length - 1, Math.max(0, Math.ceil(t * fps)));
      if (!cache.has(idx)) {
        try {
          const buf = await readFile(join(dir, files[idx]!));
          cache.set(idx, buf.length > 0 ? buf : null);
        } catch {
          cache.set(idx, null);
        }
      }
      out.push(cache.get(idx) ?? null);
    }

    log.info("grid pass complete", {
      code,
      durationS,
      gridFrames: files.length,
      requested: times.length,
      resolved: out.filter(Boolean).length,
    });
    return out;
  } catch (err) {
    log.error("grid extraction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return times.map(() => null);
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
