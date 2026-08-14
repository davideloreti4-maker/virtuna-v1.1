/**
 * probe-beat-frames.ts — does phase 3 actually cut frames from a REAL video?
 *
 * Everything about `extractBeatFrames` is unit-tested against mocked ffmpeg and mocked storage.
 * That proves the control flow and proves nothing about the two things that can only fail for
 * real: whether ffmpeg can range-seek a Supabase signed URL, and whether the `filmstrips` bucket
 * accepts a write under a blueprint-shaped prefix.
 *
 * THE FAILURE THIS EXISTS TO CATCH: ffmpeg exiting 0 while ignoring `-ss` and handing back frame
 * zero every time. That produces N identical JPEGs, a fully "successful" run, a green log line,
 * and a shoot sheet where every beat shows the same picture. Nothing in the unit tests can see it,
 * and on a real card it reads as a stylistic choice rather than a bug. So this hashes the frames
 * and FAILS if they are not all distinct.
 *
 * Costs nothing: no Apify, no DashScope, no dev server, no auth. One storage read, ≤N writes,
 * and it deletes what it wrote.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
 *     --path "omni-split/59455-447571480576291.mp4"
 */
import { config } from "dotenv";
// MUST precede the imports below — they read process.env at module scope, so without this the
// probe dies on `supabaseUrl is required` before main() ever runs. The handoff documented this
// command for a week while it could not start.
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { extractBeatFrames, SCRUB_FRAME_COUNT } from "@/lib/remix/beat-frames";
import { signAnalysisFrames, signScrubFrames, SCRUB_PREFIX } from "@/lib/engine/filmstrip/storage";
import type { BlueprintBeat } from "@/lib/engine/remix/blueprint";

const argv = process.argv.slice(2);
const arg = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const STORAGE_PATH = arg("--path");
const KEEP = argv.includes("--keep");
/** Write the JPEGs to a directory so they can be opened and looked at. */
const DUMP = arg("--dump");

/** The probe video's real length, so the scrub grid samples the whole thing rather than a slice. */
const DURATION_S = 28.57;

/** Beats shaped like a real merged blueprint: uneven, non-contiguous indices, one long tail. */
function beats(): BlueprintBeat[] {
  const spans: Array<[number, number]> = [
    [0, 3.2],
    [3.2, 9.6],
    [9.6, 17.1],
    [17.1, 24],
  ];
  return spans.map(([t_start, t_end], i) => ({
    index: i,
    t_start,
    t_end,
    duration_s: t_end - t_start,
    role: (["hook", "setup", "turn", "payoff"] as const)[i]!,
    spoken: null,
    spoken_span_s: null,
    on_screen_text: null,
    visual_event: "probe",
    audio_event: "probe",
    cuts: 1,
    weakness: null,
  }));
}

async function main() {
  if (!STORAGE_PATH) throw new Error('pass --path "<videos-bucket-key>"');

  const supabase = createServiceClient();

  // A throwaway prefix, marked so a leaked object is obviously a probe artefact and not a card's.
  const blueprintId = `probe${Date.now().toString(36)}`.slice(0, 12);

  const signed = await supabase.storage.from("videos").createSignedUrl(STORAGE_PATH, 3600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`could not sign ${STORAGE_PATH}: ${signed.error?.message ?? "no url"}`);
  }
  console.log(`source   : ${STORAGE_PATH}`);
  console.log(`prefix   : ${blueprintId}\n`);

  const t0 = Date.now();
  const persisted = await extractBeatFrames(signed.data.signedUrl, blueprintId, beats(), DURATION_S);
  const ms = Date.now() - t0;

  console.log(
    `persisted: ${persisted.beatFrames}/4 beat + ${persisted.scrubFrames}/${SCRUB_FRAME_COUNT} ` +
      `scrub frames in ${(ms / 1000).toFixed(1)}s\n`,
  );

  // Read them back the way the ROUTE does — re-signing each prefix, not reusing write-time URLs.
  const beatFrames = await signAnalysisFrames(blueprintId);
  const scrubFrames = await signScrubFrames(blueprintId);

  /** Fetch, validate and hash one set. Returns its digests keyed by index. */
  async function readBack(
    label: string,
    frames: Record<number, string>,
    filePrefix: string,
  ): Promise<Map<number, string>> {
    const indices = Object.keys(frames).map(Number).sort((a, b) => a - b);
    console.log(`re-signed ${label}: ${indices.length} frame(s) [${indices.slice(0, 8).join(", ")}${indices.length > 8 ? ", …" : ""}]`);

    const digests = new Map<number, string>();
    for (const idx of indices) {
      const res = await fetch(frames[idx]!);
      const buf = Buffer.from(await res.arrayBuffer());
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[buf.length - 2] === 0xff;
      const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
      digests.set(idx, hash);
      // `--dump <dir>` writes the JPEGs out so a human can LOOK at them. Distinct hashes prove
      // ffmpeg honoured the seek; they do not prove the frames are of the video rather than of a
      // codec error, and this repo's standing lesson is to believe the picture over the assertion.
      if (DUMP) writeFileSync(`${DUMP}/${filePrefix}-${String(idx).padStart(2, "0")}.jpg`, buf);
      if (!isJpeg) throw new Error(`${label} ${idx} is not a JPEG — the bucket holds something else`);
    }
    return digests;
  }

  const beatDigests = await readBack("beat ", beatFrames, "real-beat");
  const scrubDigests = await readBack("scrub", scrubFrames, "real-scrub");

  if (!KEEP) {
    const paths = [
      ...[...beatDigests.keys()].map((i) => `${blueprintId}/${i}.jpg`),
      ...[...scrubDigests.keys()].map((i) => `${blueprintId}/${SCRUB_PREFIX}/${i}.jpg`),
    ];
    await supabase.storage.from("filmstrips").remove(paths);
    console.log(`\ncleaned up ${paths.length} probe object(s)`);
  }

  // ── the verdicts ──────────────────────────────────────────────────────────
  const uniqueBeat = new Set(beatDigests.values()).size;
  const uniqueScrub = new Set(scrubDigests.values()).size;
  console.log(`\ndistinct beat frames : ${uniqueBeat}/${beatDigests.size}`);
  console.log(`distinct scrub frames: ${uniqueScrub}/${scrubDigests.size}`);

  if (persisted.beatFrames === 0) throw new Error("FAIL — extracted no beat frames from a real video");
  if (persisted.scrubFrames === 0) throw new Error("FAIL — extracted no scrub frames from a real video");
  if (uniqueBeat !== beatDigests.size || uniqueScrub !== scrubDigests.size) {
    throw new Error(
      `FAIL — frames are not all distinct (beat ${uniqueBeat}/${beatDigests.size}, ` +
        `scrub ${uniqueScrub}/${scrubDigests.size}). ffmpeg is ignoring the seek and returning ` +
        `the same frame; the strip would scrub through one still and look deliberate.`,
    );
  }

  // ── The keyspace check ────────────────────────────────────────────────────
  //
  // NOT byte-identity between the two sets at the same index. That was this probe's first
  // formulation and it is wrong: with a 115-frame grid, beat 0 (sampled 0.40s) and scrub 0
  // (sampled 0.476s) round to the SAME grid frame, so identical bytes there are expected and
  // harmless — both sets legitimately point at one moment of the video. Asserting on it reported
  // a collision on a perfectly correct run.
  //
  // What a real collision looks like: ~30 scrub frames written FLAT would overwrite beat frames
  // 0-7 and leave `signAnalysisFrames` returning 30 keys instead of the beats'. So the check is
  // on the SHAPE of what the beat reader returns after both sets have been written.
  const beatKeys = [...beatDigests.keys()].sort((a, b) => a - b);
  const expectedBeatKeys = beats().map((b) => b.index);
  if (JSON.stringify(beatKeys) !== JSON.stringify(expectedBeatKeys)) {
    throw new Error(
      `FAIL — the beat reader returned [${beatKeys.join(", ")}] but the blueprint has beats ` +
        `[${expectedBeatKeys.join(", ")}]. The scrub set has leaked into the beat keyspace, and ` +
        `the sheet would render scrub frames on beat rows with nothing erroring.`,
    );
  }
  if (scrubDigests.size !== SCRUB_FRAME_COUNT) {
    throw new Error(
      `FAIL — expected ${SCRUB_FRAME_COUNT} scrub frames, read back ${scrubDigests.size}.`,
    );
  }

  console.log("\nPASS — both sets real, all distinct, no keyspace collision, round-tripped.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
