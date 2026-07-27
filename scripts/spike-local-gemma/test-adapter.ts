/**
 * SPIKE test — exercise the perception adapter on a real local video.
 * Usage: npx tsx scripts/spike-local-gemma/test-adapter.ts "<path-to-mp4>"
 */
import { writeFileSync } from "node:fs";
import {
  videoToFramesAndTranscript,
  buildPerceptionTextBlock,
} from "../../src/lib/engine/local/perception-adapter";

const videoPath = process.argv[2];
if (!videoPath) {
  console.error("pass a video path");
  process.exit(1);
}

(async () => {
  console.log(`[adapter] sampling: ${videoPath}`);
  const p = await videoToFramesAndTranscript(videoPath, {
    frameCount: 8,
    maxWidth: 640,
  });

  console.log(`\n=== RESULT ===`);
  console.log(`duration:      ${p.durationSec.toFixed(1)}s`);
  console.log(`frames:        ${p.images.length} @ [${p.timestamps.join(", ")}]s`);
  console.log(`extract time:  ${p.extractMs}ms (${Math.round(p.extractMs / p.images.length)}ms/frame)`);
  console.log(`transcribe:    ${p.transcribeMs}ms`);
  const firstB64 = p.images[0]!.image_url.url.split(",")[1] ?? "";
  console.log(`frame[0] size: ${Math.round((firstB64.length * 0.75) / 1024)}KB (base64 ${Math.round(firstB64.length / 1024)}KB)`);
  console.log(`\n--- transcript ---\n${p.transcript || "(empty)"}`);
  console.log(`\n--- perception text block ---\n${buildPerceptionTextBlock(p)}`);

  // dump first frame to eyeball quality
  const buf = Buffer.from(firstB64, "base64");
  writeFileSync("/tmp/spike-frame0.jpg", buf);
  console.log(`\n[wrote /tmp/spike-frame0.jpg for visual check]`);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
