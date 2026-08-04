/**
 * Get an audio-only mp3 in front of omni: extract, park, sign, and clean up after.
 *
 * ffmpeg reads the SIGNED VIDEO URL DIRECTLY and writes mp3 to stdout — the mp4 is never
 * written to /tmp. That matters on Vercel (bounded /tmp, bounded memory) and it is safe here
 * in a way it would not be for frame extraction: this is one sequential pass over the stream,
 * not N seeks, and mp3 is a streamable output container (mp4 would need a seekable file).
 * `api/filmstrip/extract` already proves ffmpeg-static can read these signed URLs in prod.
 *
 * ⚠️ `ffmpeg-static` is in next.config.ts `serverExternalPackages` and, until now, was reached
 * from exactly ONE module behind exactly ONE route. This file is reached from the engine
 * pipeline instead, so the binary is pulled in via a DYNAMIC import: it stays out of the
 * static module graph of every route that imports the pipeline, and is resolved only on the
 * first split run. The prod build — not tsc, not vitest — is the gate that proves this.
 */

import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";

const log = createLogger({ module: "engine.qwen.split.audio-track" });

/** The bucket created for this path: PRIVATE, audio/mpeg only, 50MB. `videos` rejects audio
 *  mime types and `covers` is public — the spike parked it in `covers`, which is not shippable. */
export const AUDIO_BUCKET = "audio";

/** Hard ceiling on the extracted mp3. At 16kHz mono a 3-minute video lands around 350KB, so
 *  this is a runaway guard, not a working limit. */
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

/** ffmpeg is on the critical path now, so it gets its own budget rather than inheriting the
 *  omni call's. Download + transcode of a short-form clip is seconds; this bounds the tail. */
export const AUDIO_EXTRACT_TIMEOUT_MS = Number(process.env.AUDIO_EXTRACT_TIMEOUT_MS) || 45_000;

/** Signed-URL lifetime handed to DashScope. Mirrors the video path's 1 hour. */
const SIGNED_URL_TTL_S = 3600;

/**
 * Extract the audio track of `videoUrl` as a mono 16kHz mp3 Buffer.
 *
 * Graceful-degradation contract, matching `extractFrameAtTimestamp`: NEVER throws, returns
 * null on any failure. A null here means the caller falls back to the unified omni read —
 * a slower, dearer read is a far better outcome than a failed one.
 */
export async function extractAudioTrack(
  videoUrl: string,
  timeoutMs: number = AUDIO_EXTRACT_TIMEOUT_MS,
): Promise<Buffer | null> {
  // Dynamic import — see the header note. `.default` because ffmpeg-static is a CJS module
  // exporting the binary path as its default export.
  let ffmpegPath: string | null = null;
  try {
    const mod = (await import("ffmpeg-static")) as unknown as { default: string | null };
    ffmpegPath = mod.default ?? null;
  } catch (err) {
    log.error("split: ffmpeg-static could not be loaded", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
  if (!ffmpegPath) {
    log.error("split: ffmpeg-static binary not available on this platform");
    return null;
  }

  return new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    let stderrTail = "";

    const proc = spawn(ffmpegPath!, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", videoUrl,
      "-vn",                       // the whole point: drop the video stream entirely
      "-acodec", "libmp3lame",
      "-ar", "16000",              // omni does not need music-grade audio to transcribe speech
      "-ac", "1",
      "-f", "mp3",                 // explicit container — stdout has no filename to infer from
      "pipe:1",
    ]);

    const finish = (result: Buffer | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      log.error("split: audio extraction timed out", { timeoutMs });
      proc.kill("SIGKILL");
      finish(null);
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_AUDIO_BYTES) {
        log.error("split: extracted audio exceeded the size ceiling", { bytes, MAX_AUDIO_BYTES });
        proc.kill("SIGKILL");
        finish(null);
        return;
      }
      chunks.push(chunk);
    });

    // ffmpeg writes diagnostics to stderr; keep the tail so a failure is debuggable rather
    // than a bare exit code.
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-500);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        log.error("split: ffmpeg non-zero exit", { code, stderr: stderrTail });
        finish(null);
        return;
      }
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) {
        // A zero-byte mp3 on a clean exit means the source had NO audio stream at all. That is
        // a real property of the video, not an error — but omni has nothing to listen to, so
        // the split cannot run and the caller falls back.
        log.warn("split: source produced no audio track (silent video?)", { stderr: stderrTail });
        finish(null);
        return;
      }
      log.info("split: audio extracted", { bytes: buf.length });
      finish(buf);
    });

    proc.on("error", (err) => {
      log.error("split: ffmpeg spawn error", { error: err.message });
      finish(null);
    });
  });
}

export interface ParkedAudio {
  signedUrl: string;
  path: string;
}

/**
 * Upload the mp3 to the private `audio` bucket and mint a short-lived signed URL for DashScope.
 * Returns null on any failure (caller falls back to the unified read).
 */
export async function parkAudioAndSign(audio: Buffer): Promise<ParkedAudio | null> {
  const path = `split/${randomUUID()}.mp3`;
  try {
    const supabase = createServiceClient();
    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, audio, { contentType: "audio/mpeg", upsert: false });
    if (upErr) {
      log.error("split: audio upload failed", { error: upErr.message, path });
      return null;
    }
    const { data, error: signErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_S);
    if (signErr || !data?.signedUrl) {
      log.error("split: audio signing failed", { error: signErr?.message, path });
      // The object uploaded but is unusable — drop it now rather than orphan it.
      void supabase.storage.from(AUDIO_BUCKET).remove([path]).catch(() => {});
      return null;
    }
    return { signedUrl: data.signedUrl, path };
  } catch (err) {
    log.error("split: audio park threw", { error: err instanceof Error ? err.message : String(err), path });
    return null;
  }
}

/**
 * Delete a parked mp3. Fire-and-forget and never throws: the derived audio is disposable, and
 * a cleanup failure must never fail a Read the user is waiting on. Orphans are bounded by the
 * bucket being private and derived — nothing downstream ever reads it again.
 */
export function dropParkedAudio(path: string): void {
  try {
    const supabase = createServiceClient();
    void supabase.storage
      .from(AUDIO_BUCKET)
      .remove([path])
      .catch((err: unknown) => {
        log.warn("split: parked audio cleanup failed", { path, error: err instanceof Error ? err.message : String(err) });
      });
  } catch (err) {
    log.warn("split: parked audio cleanup threw", { path, error: err instanceof Error ? err.message : String(err) });
  }
}
