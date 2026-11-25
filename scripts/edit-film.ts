/**
 * edit-film.ts — renders a whole demo edit with the real renderer, to watch and to listen to. A
 * tool for people and tests; nothing in the app imports it.
 *
 * Usage:  pnpm exec tsx scripts/edit-film.ts <demo.json> <out.mp4 | out.wav> [<demo.json> <out> ...]
 *
 * `.mp4` is the film with its sound; `.wav` is its sound alone. `demo.json` is as in edit-render.ts.
 */
import { withRenderer } from "./edit-render";

async function main(): Promise<void> {
  const jobs = process.argv.slice(2);
  if (jobs.length === 0 || jobs.length % 2 !== 0 || jobs.some((job, i) => i % 2 === 1 && !/\.(mp4|wav)$/.test(job))) throw new Error("usage: edit-film.ts <demo.json> <out.mp4 | out.wav> [<demo.json> <out> ...]");
  await withRenderer(async ({ film }) => {
    for (let i = 0; i < jobs.length; i += 2) {
      const [demoPath = "", output = ""] = [jobs[i], jobs[i + 1]];
      const started = Date.now();
      const frames = await film(demoPath, output);
      console.log(`${output}  (${frames} frames, ${(frames / 30).toFixed(2)} s of film, rendered in ${((Date.now() - started) / 1000).toFixed(1)} s)`);
    }
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
