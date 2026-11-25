/**
 * edit-still.ts — renders stills of an edit with the real renderer, to look at and to compare
 * with the preview. A tool for people and tests; nothing in the app imports it.
 *
 * Usage:  pnpm exec tsx scripts/edit-still.ts <demo.json> <out-dir> <frame> [<frame> ...]
 *
 * `demo.json` holds `{ "edit": <an edit>, "files": { "<file id>": "<name in .scratch/media>" } }`.
 * The files and the kit are served from this machine only, for the length of the run.
 */
import { join } from "node:path";
import { stillName, withRenderer } from "./edit-render";

async function main(): Promise<void> {
  const [demoPath, outDir, ...frames] = process.argv.slice(2);
  if (!demoPath || !outDir || frames.length === 0 || frames.some((frame) => Number.isNaN(Number(frame)))) throw new Error("usage: edit-still.ts <demo.json> <out-dir> <frame> [<frame> ...]");
  await withRenderer(async ({ still }) => {
    for (const frame of frames.map(Number)) {
      const output = join(outDir, stillName(frame));
      const length = await still(demoPath, frame, output);
      console.log(`${output}  (frame ${frame} of ${length})`);
    }
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
