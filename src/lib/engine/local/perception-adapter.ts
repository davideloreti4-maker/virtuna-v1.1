/**
 * SPIKE — Local-Gemma perception adapter (spike/local-gemma).
 *
 * Gemma 4 (via Ollama) is Text + Image only — it cannot accept `video_url` and
 * cannot hear audio. The DashScope/Qwen path sends a `{type:"video_url"}` content
 * item to a model that natively watches+hears the clip. To run the same engine
 * stages on local Gemma we synthesize that perception out of two local tools:
 *
 *   ffmpeg        → N still frames sampled evenly across the clip (base64 JPEG)
 *   whisper.cpp   → audio transcript (what Omni would have "heard")
 *
 * The output is an OpenAI-format content prefix (image_url items + a transcript
 * text block) that drops in where the `{type:"video_url"}` item used to be. The
 * downstream prompt/JSON schema is unchanged — the stages now reason over discrete
 * frames + a transcript instead of a live video+audio stream.
 *
 * This is the core compatibility shim for the 3 video stages (Omni Read, Apollo,
 * Fold). It is NOT wired into the production path — gated behind LOCAL_GEMMA.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exec = promisify(execFile);

export interface FrameSamplingConfig {
  /** Number of frames sampled evenly across the clip. More = richer but slower
   *  + more vision tokens (Gemma tokenizes each image). 8–12 is a good band. */
  frameCount: number;
  /** Max frame width in px (aspect preserved). Smaller = fewer vision tokens =
   *  faster. 512–768 keeps text/faces legible without blowing the budget. */
  maxWidth: number;
  /** JPEG quality for ffmpeg -q:v (2=best … 31=worst). ~5 is a good balance. */
  jpegQuality: number;
  /** Run whisper.cpp audio transcription. */
  transcribe: boolean;
  /** Absolute path to a whisper ggml model (e.g. ~/.cache/whisper/ggml-base.en.bin). */
  whisperModelPath: string;
  /** Absolute path to the whisper-cli binary. */
  whisperBin?: string;
}

export const DEFAULT_SAMPLING: FrameSamplingConfig = {
  frameCount: 8,
  maxWidth: 640,
  jpegQuality: 5,
  transcribe: true,
  whisperModelPath: join(
    process.env.HOME ?? "",
    ".cache/whisper/ggml-base.en.bin",
  ),
  whisperBin: "whisper-cli",
};

export type ImageContentItem = {
  type: "image_url";
  image_url: { url: string };
};

export interface PerceptionResult {
  /** Base64 data-URL image items, oldest→newest frame. */
  images: ImageContentItem[];
  /** Whisper transcript ("" if transcribe=false or silent). */
  transcript: string;
  /** Clip duration in seconds. */
  durationSec: number;
  /** Seconds offset of each sampled frame, aligned to `images`. */
  timestamps: number[];
  /** Wall-clock cost of the adapter itself (perception isn't free locally). */
  extractMs: number;
  transcribeMs: number;
}

async function probeDurationSec(videoPath: string): Promise<number> {
  const { stdout } = await exec("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** Even sample offsets: midpoints of N equal segments → never grabs a black
 *  first/last frame, always representative of each region of the clip. */
function evenTimestamps(durationSec: number, n: number): number[] {
  if (durationSec <= 0) return Array.from({ length: n }, () => 0);
  return Array.from({ length: n }, (_, i) =>
    +(durationSec * ((i + 0.5) / n)).toFixed(3),
  );
}

async function extractFrame(
  videoPath: string,
  tsSec: number,
  outPath: string,
  cfg: FrameSamplingConfig,
): Promise<void> {
  // -ss BEFORE -i = fast input seek. -frames:v 1 = single frame. scale keeps
  // aspect (-1 height). -q:v sets JPEG quality.
  await exec("ffmpeg", [
    "-nostdin", "-loglevel", "error", "-y",
    "-ss", String(tsSec),
    "-i", videoPath,
    "-frames:v", "1",
    "-vf", `scale=${cfg.maxWidth}:-1`,
    "-q:v", String(cfg.jpegQuality),
    outPath,
  ]);
}

async function transcribeAudio(
  videoPath: string,
  tmp: string,
  cfg: FrameSamplingConfig,
): Promise<string> {
  const wav = join(tmp, "audio.wav");
  // whisper.cpp wants 16kHz mono PCM wav.
  await exec("ffmpeg", [
    "-nostdin", "-loglevel", "error", "-y",
    "-i", videoPath,
    "-vn", "-ar", "16000", "-ac", "1",
    wav,
  ]);
  // -nt: no timestamps, -np: no progress prints. -ng: no GPU → run on CPU.
  // whisper.cpp 1.8.x has a ggml-metal assert that crashes the binary on *exit*
  // (after transcription, during Metal device finalize — ref llama.cpp PR 17869).
  // That non-zero exit makes execFile reject even though stdout already holds the
  // transcript. -ng sidesteps the Metal path entirely (base.en on M4 CPU is still
  // ~1-2s for a short clip); the catch below salvages stdout if any exit still trips.
  try {
    const { stdout } = await exec(cfg.whisperBin ?? "whisper-cli", [
      "-m", cfg.whisperModelPath,
      "-f", wav,
      "-nt", "-np", "-ng",
    ]);
    return stdout.replace(/\s+/g, " ").trim();
  } catch (err) {
    const salvaged = (err as { stdout?: string })?.stdout ?? "";
    if (salvaged.trim()) return salvaged.replace(/\s+/g, " ").trim();
    throw err;
  }
}

/**
 * Sample a local video file into base64 frames + an audio transcript, ready to
 * splice into an OpenAI-format content array in place of a `video_url` item.
 */
export async function videoToFramesAndTranscript(
  videoPath: string,
  config: Partial<FrameSamplingConfig> = {},
): Promise<PerceptionResult> {
  const cfg: FrameSamplingConfig = { ...DEFAULT_SAMPLING, ...config };
  const tmp = await mkdtemp(join(tmpdir(), "numen-perception-"));
  try {
    const durationSec = await probeDurationSec(videoPath);
    const timestamps = evenTimestamps(durationSec, cfg.frameCount);

    const t0 = performance.now();
    const images: ImageContentItem[] = [];
    // Sequential ffmpeg calls — N is small (8–12) and parallel seeks thrash disk.
    for (let i = 0; i < timestamps.length; i++) {
      const out = join(tmp, `f${i}.jpg`);
      await extractFrame(videoPath, timestamps[i]!, out, cfg);
      const b64 = (await readFile(out)).toString("base64");
      images.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${b64}` },
      });
    }
    const extractMs = Math.round(performance.now() - t0);

    let transcript = "";
    let transcribeMs = 0;
    if (cfg.transcribe) {
      const t1 = performance.now();
      try {
        transcript = await transcribeAudio(videoPath, tmp, cfg);
      } catch {
        transcript = ""; // silent/no-audio clip — degrade, don't throw
      }
      transcribeMs = Math.round(performance.now() - t1);
    }

    return { images, transcript, durationSec, timestamps, extractMs, transcribeMs };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * The text block that travels with the frames — tells the model the frames are a
 * sampled proxy for a video, gives the per-frame timeline (so segment/timestamp
 * reasoning still works), and carries the transcript (the lost audio channel).
 */
export function buildPerceptionTextBlock(p: PerceptionResult): string {
  const grid = p.timestamps
    .map((t, i) => `  frame ${i + 1}: ${t.toFixed(1)}s`)
    .join("\n");
  return [
    `[VIDEO PERCEPTION — the clip (${p.durationSec.toFixed(1)}s) was sampled into`,
    `${p.images.length} still frames + an audio transcript, because this model cannot`,
    `watch video directly. Treat the frames as a time-ordered storyboard.]`,
    ``,
    `Frame timeline (evenly sampled):`,
    grid,
    ``,
    p.transcript
      ? `AUDIO TRANSCRIPT (whisper):\n"${p.transcript}"`
      : `AUDIO TRANSCRIPT: (none — silent clip or no speech detected)`,
  ].join("\n");
}

/**
 * Full content prefix that replaces a single `{type:"video_url"}` item:
 * [ ...frame images, perception text block ].
 * Callers append their own stage instruction text after this.
 */
export function buildPerceptionContent(
  p: PerceptionResult,
): Array<ImageContentItem | { type: "text"; text: string }> {
  return [...p.images, { type: "text", text: buildPerceptionTextBlock(p) }];
}
