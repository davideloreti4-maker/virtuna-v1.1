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
 * ── Two sets, one pass ──────────────────────────────────────────────────────────────────────
 * A remix sheet needs frames for two different jobs, and they are not the same samples:
 *
 *   BEAT frames  — one per beat, sampled a quarter INTO the beat (see `sampleAt`). Rendered beside
 *                  the instruction for that beat.
 *   SCRUB frames — ~30 on an even TIME grid. Rendered as the strip the playhead drags across.
 *
 * Both come from a single `extractFramesAtTimes` pass, because the cost of getting frames out of a
 * remote video is the connection and the sequential read, not the number of frames: measured
 * 2026-08-14, 115 frames in one pass (5.5s) is cheaper than 4 frames as individual seeks (15.6s).
 *
 * ── Storage ─────────────────────────────────────────────────────────────────────────────────
 * Reuses the `filmstrips` bucket. Beat frames keep their original flat path
 * `<blueprintId>/<beatIndex>.jpg` — moving them would strand every frame already written — and
 * scrub frames go to `<blueprintId>/scrub/<i>.jpg`. That subfolder is what stops ~30 scrub frames
 * keyed `0..29` from overwriting beat frames `0..7` in a shared integer keyspace, which would
 * render the wrong picture on the wrong beat with nothing erroring. See `SCRUB_PREFIX`.
 *
 * ⚠️ RETENTION: nothing deletes `remix_blueprints` rows today, and these frames inherit that. This
 * lane makes each run ~4x bigger (≤8 beat + ≤30 scrub JPEGs). A reaper is owed and is NOT built
 * here; the bucket held 48 objects total when this was written.
 */
import { extractFramesAtTimes } from "@/lib/engine/filmstrip/extract-grid";
import { uploadFrameAndGetSignedUrl, uploadScrubFrame } from "@/lib/engine/filmstrip/storage";
import { createLogger } from "@/lib/logger";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const log = createLogger({ module: "remix.beat-frames" });

/** Hard cap on frames per run. `buildBlueprint` merges to 8 beats, so this is a backstop. */
export const MAX_BEAT_FRAMES = 8;

/**
 * How many evenly-spaced stills the scrub strip gets.
 *
 * ⚠️ This is NOT `MAX_BEAT_FRAMES` raised. Raising that constant does nothing on its own, because
 * `buildBlueprint` merges to `MAX_BEATS = 8` — there is never a 9th beat for a 9th beat-frame to
 * describe. A scrub strip needs samples on a TIME grid, which is a different thing from a sample
 * per beat, so it gets its own count and its own keyspace.
 *
 * 30 is chosen for the surface, not for the budget: at a 390px viewport the strip's content box is
 * ~358px, so 30 portrait cells are ~12px wide. That reads as a filmstrip texture showing position
 * and rate of visual change, which is the job — the stage above it shows the actual frame. More
 * cells would be sub-pixel; far fewer would scrub in visible jumps. The budget does not constrain
 * this: measured, 30 frames and 115 frames cost the same single pass (~5s).
 */
export const SCRUB_FRAME_COUNT = 30;

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
 * Evenly-spaced sample times across the whole video, for the scrub strip.
 *
 * Offset by half a step so the first cell is not frame zero (very often a black or title frame)
 * and the last is not the final frame (very often a cut to black or an end card). The strip is
 * meant to represent the video, and both ends of a raw grid systematically misrepresent it.
 */
function scrubTimes(durationS: number, count: number): number[] {
  const step = durationS / count;
  return Array.from({ length: count }, (_, i) => (i + 0.5) * step);
}

/**
 * Extract and persist BOTH frame sets for a remix source, from a single pass over the video.
 *
 * Never throws — a sheet with no frames is exactly the phase-1 sheet, which is a complete product
 * on its own, and this runs inside the runner's `finally` ahead of `cleanup()`.
 *
 * @returns how many of each set persisted. Zero of either is a normal outcome, not an error.
 */
export async function extractBeatFrames(
  videoUrl: string,
  blueprintId: string,
  beats: BlueprintBeat[],
  durationS: number,
): Promise<{ beatFrames: number; scrubFrames: number }> {
  const none = { beatFrames: 0, scrubFrames: 0 };
  if (beats.length === 0) return none;

  const targets = beats.slice(0, MAX_BEAT_FRAMES);
  const startedAt = Date.now();

  // The duration the blueprint reports is the honest one, but a degenerate blueprint can carry 0.
  // The beats themselves always span the video, so their tail is a sound fallback — without it a
  // bad duration would silently cost the whole strip.
  const span = Math.max(durationS, ...targets.map((b) => b.t_end), 0);
  if (span <= 0) {
    log.warn("no usable duration for frame extraction", { blueprintId, durationS });
    return none;
  }

  const beatTimes = targets.map(sampleAt);
  const scrub = scrubTimes(span, SCRUB_FRAME_COUNT);

  try {
    // ONE pass for both sets. Two passes would mean two downloads of the same object, and the
    // download IS the cost — measured, the frame count barely moves it.
    const frames = await extractFramesAtTimes(videoUrl, span, [...beatTimes, ...scrub]);
    const beatBuffers = frames.slice(0, beatTimes.length);
    const scrubBuffers = frames.slice(beatTimes.length);

    let beatFrames = 0;
    let scrubFrames = 0;

    // Uploads are sequential and budget-checked for the same reason the old extraction was: this
    // whole job is awaited before `cleanup()` drops the temp mp4, so an unbounded loop here would
    // hold the source open past the run. On timeout we keep what landed.
    const overBudget = () => Date.now() - startedAt > EXTRACT_BUDGET_MS;

    for (const [i, beat] of targets.entries()) {
      if (overBudget()) break;
      const buffer = beatBuffers[i];
      if (!buffer || buffer.length === 0) continue;
      // The beat's OWN index, never the loop counter — `beats` is already merged and can carry a
      // non-contiguous set, so a positional key would offset every frame onto the wrong beat.
      const uri = await uploadFrameAndGetSignedUrl(blueprintId, beat.index, buffer);
      if (uri) beatFrames += 1;
    }

    for (const [i, buffer] of scrubBuffers.entries()) {
      if (overBudget()) break;
      if (!buffer || buffer.length === 0) continue;
      const uri = await uploadScrubFrame(blueprintId, i, buffer);
      if (uri) scrubFrames += 1;
    }

    log.info("remix frames persisted", {
      blueprintId,
      beatFrames,
      ofBeats: targets.length,
      scrubFrames,
      ofScrub: scrub.length,
      ms: Date.now() - startedAt,
    });
    return { beatFrames, scrubFrames };
  } catch (err) {
    // Both collaborators contract to never throw; this catch exists so a future edit to either
    // cannot take the whole remix run down with it.
    log.error("remix frame extraction failed", {
      blueprintId,
      error: err instanceof Error ? err.message : String(err),
    });
    return none;
  }
}
