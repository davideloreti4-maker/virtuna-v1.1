/**
 * Filmstrip keyframe extraction (D-09).
 *
 * Spawns ffmpeg-static to pull one JPEG frame at the segment t_start from a
 * remote video URL. Graceful-degradation contract: never throws, returns null
 * on any failure so the pipeline can proceed without filmstrip data.
 */
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.filmstrip.extract" });

/**
 * Extract a single JPEG frame at `tStartSeconds` from `videoUrl`.
 *
 * Uses: ffmpeg -ss <t_start> -i <url> -frames:v 1 -q:v 4 -f image2 pipe:1
 *
 * @returns JPEG Buffer on success, null on any failure (graceful degradation).
 */
export async function extractFrameAtTimestamp(
  videoUrl: string,
  tStartSeconds: number,
): Promise<Buffer | null> {
  if (!ffmpegPath) {
    log.error("ffmpeg-static binary not available on this platform", { videoUrl, tStartSeconds });
    return null;
  }

  return new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = [];

    const proc = spawn(ffmpegPath!, [
      "-ss", String(tStartSeconds),
      "-i", videoUrl,
      "-frames:v", "1",
      "-q:v", "4",
      "-f", "image2",
      "pipe:1",
    ]);

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        log.error("ffmpeg non-zero exit", { code, tStartSeconds, videoUrl });
        resolve(null);
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    proc.on("error", (err) => {
      log.error("ffmpeg spawn error", { error: err.message, tStartSeconds, videoUrl });
      resolve(null);
    });
  });
}
