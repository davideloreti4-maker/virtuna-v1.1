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
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServiceClient } from "@/lib/supabase/service";
import { extractBeatFrames } from "@/lib/remix/beat-frames";
import { signAnalysisFrames } from "@/lib/engine/filmstrip/storage";
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
  const persisted = await extractBeatFrames(signed.data.signedUrl, blueprintId, beats());
  const ms = Date.now() - t0;

  console.log(`persisted: ${persisted}/4 frames in ${(ms / 1000).toFixed(1)}s\n`);

  // Read them back the way the ROUTE does — re-signing the prefix, not reusing write-time URLs.
  const frames = await signAnalysisFrames(blueprintId);
  const indices = Object.keys(frames).map(Number).sort((a, b) => a - b);
  console.log(`re-signed: [${indices.join(", ")}]`);

  const digests = new Map<number, string>();
  for (const idx of indices) {
    const res = await fetch(frames[idx]!);
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[buf.length - 2] === 0xff;
    const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
    digests.set(idx, hash);
    // `--dump <dir>` writes the JPEGs out so a human can LOOK at them. Distinct hashes prove
    // ffmpeg honoured -ss; they do not prove the frames are of the video rather than of a codec
    // error, and this repo's standing lesson is to believe the picture over the assertion.
    if (DUMP) writeFileSync(`${DUMP}/real-beat-${idx}.jpg`, buf);
    console.log(
      `  beat ${idx}: ${String(buf.length).padStart(7)} bytes  jpeg=${isJpeg ? "yes" : "NO"}  sha=${hash}`,
    );
    if (!isJpeg) throw new Error(`beat ${idx} is not a JPEG — the bucket holds something else`);
  }

  if (!KEEP) {
    await supabase.storage
      .from("filmstrips")
      .remove(indices.map((i) => `${blueprintId}/${i}.jpg`));
    console.log(`\ncleaned up ${indices.length} probe object(s)`);
  }

  // ── the verdicts ──────────────────────────────────────────────────────────
  const unique = new Set(digests.values()).size;
  console.log(`\ndistinct frames: ${unique}/${digests.size}`);

  if (persisted === 0) throw new Error("FAIL — extracted nothing from a real video");
  if (unique !== digests.size) {
    throw new Error(
      `FAIL — ${digests.size} frames but only ${unique} distinct. ffmpeg is ignoring -ss and ` +
        `returning the same frame; every beat would show the same picture.`,
    );
  }
  console.log("\nPASS — real frames, all distinct, round-tripped through re-signing.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
