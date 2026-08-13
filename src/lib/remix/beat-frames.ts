/**
 * Beat frames (remix phase 3) — one real keyframe from the SOURCE video per beat row.
 *
 * Why this is the answer to "show me the video": a remix card's payoff is a shot list, and a shot
 * list that says *"0–3.2s · HOOK — tight crop, talking head"* next to the actual frame the source
 * used is a different instruction from the same words alone. One cover image at the top of the card
 * shows the video exists; a frame per beat shows what the beat WAS.
 *
 * ── Where the bytes come from ────────────────────────────────────────────────────────────────
 * The remix runner holds `signedUrl` — a live Supabase signed URL to the rehosted source mp4 —
 * from the Resolve step until `cleanup()` fires in its `finally` (T-03-02 derive-and-drop). That
 * window is the ONLY time the video is reachable, so extraction runs inside it. The runner starts
 * this without awaiting it and awaits it in the `finally` before `cleanup()`, so the ~50s adapt
 * call pays for the extraction wall-clock instead of the creator waiting for it twice.
 *
 * ⚠️ THE SOURCE MP4 IS STILL DROPPED. This derives stills and keeps those; it does not retain the
 * video, and `video_storage_path` is still never set for a scraped source. That is a smaller claim
 * than phase 4's clips (which need the D7 policy reversal), and it is deliberately kept smaller.
 *
 * ── Storage ─────────────────────────────────────────────────────────────────────────────────
 * Reuses the `filmstrips` bucket via `uploadFrameAndGetSignedUrl`, whose first argument is a PATH
 * PREFIX, not an analyses FK — so a `blueprintId` slots in with no schema change, and
 * `signAnalysisFrames` re-signs the same prefix on read. Nothing here writes to `analyses`.
 *
 * ⚠️ RETENTION: nothing deletes `remix_blueprints` rows today, and these frames inherit that. They
 * accumulate at ≤MAX_BEAT_FRAMES JPEGs per remix run. A reaper is owed and is NOT built here.
 */
import { extractFrameAtTimestamp } from "@/lib/engine/filmstrip/extract";
import { uploadFrameAndGetSignedUrl } from "@/lib/engine/filmstrip/storage";
import { createLogger } from "@/lib/logger";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const log = createLogger({ module: "remix.beat-frames" });

/** Hard cap on frames per run. `buildBlueprint` merges to 8 beats, so this is a backstop. */
export const MAX_BEAT_FRAMES = 8;

/**
 * Whole-job ceiling. Extraction is awaited before `cleanup()`, so a hung ffmpeg would hold the
 * temp mp4 open past the run — the one way this feature could damage the invariant it lives
 * inside. On timeout we keep whatever landed and let cleanup proceed.
 */
const EXTRACT_BUDGET_MS = 45_000;

/**
 * WHERE inside the beat to sample.
 *
 * NOT `t_start`. A beat boundary is a CUT — the frame sitting exactly on it is very often the
 * transition itself: a dissolve, a black frame, or the tail of the previous shot. The filmstrip
 * path samples `t_start` because its segments are perception windows, not edit boundaries; beats
 * are the opposite by construction (`cuts` counts the boundaries the beat absorbed).
 *
 * A quarter into the beat, capped at 400ms so a long beat still shows its OPENING image rather
 * than its middle — the creator is matching the shot the source cut TO.
 */
function sampleAt(beat: BlueprintBeat): number {
  const offset = Math.min(0.4, Math.max(beat.duration_s, 0) * 0.25);
  return Math.max(0, beat.t_start + offset);
}

/**
 * Extract and persist one frame per beat. Never throws — a sheet with no frames is exactly the
 * phase-1 sheet, which is a complete product on its own.
 *
 * @returns how many frames were persisted (0 is a normal outcome, not an error).
 */
export async function extractBeatFrames(
  videoUrl: string,
  blueprintId: string,
  beats: BlueprintBeat[],
): Promise<number> {
  if (beats.length === 0) return 0;

  const targets = beats.slice(0, MAX_BEAT_FRAMES);
  const startedAt = Date.now();
  let persisted = 0;

  try {
    for (const beat of targets) {
      if (Date.now() - startedAt > EXTRACT_BUDGET_MS) {
        log.warn("beat-frame extraction hit its budget — keeping what landed", {
          blueprintId,
          persisted,
          of: targets.length,
        });
        break;
      }

      // Sequential, not Promise.all: each frame spawns an ffmpeg that range-seeks the same remote
      // object, and eight concurrent seeks against one signed URL is how you turn a graceful
      // degrade into a rate-limited one. ≤8 frames of a ≤3-minute video is seconds of work, and it
      // overlaps the adapt call anyway.
      const buffer = await extractFrameAtTimestamp(videoUrl, sampleAt(beat));
      if (!buffer || buffer.length === 0) continue;

      const uri = await uploadFrameAndGetSignedUrl(blueprintId, beat.index, buffer);
      if (uri) persisted += 1;
    }
  } catch (err) {
    // extractFrameAtTimestamp and uploadFrameAndGetSignedUrl both contract to never throw; this
    // catch exists so a future edit to either cannot take the whole remix run down with it.
    log.error("beat-frame extraction failed", {
      blueprintId,
      persisted,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("beat frames persisted", {
    blueprintId,
    persisted,
    of: targets.length,
    ms: Date.now() - startedAt,
  });
  return persisted;
}
