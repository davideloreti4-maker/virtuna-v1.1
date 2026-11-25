/**
 * edit-bundle.ts — bundles the film into `worker/.bundle/` for the render image (X40). Run it
 * before the worker is deployed or run on Modal; the image holds the bundle, never the repo.
 *
 * Usage:  pnpm exec tsx scripts/edit-bundle.ts
 *
 * The bundle's public folder is an empty one: the app's own (11 MB) has no place in a render, and
 * the kit's files are not in the bundle either. `worker/render/render.mjs` serves them beside it,
 * from `public/edit`, as `edit-render.ts` does here.
 */
import { bundle } from "@remotion/bundler";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function main(): Promise<void> {
  const outDir = resolve("worker/.bundle");
  const empty = mkdtempSync(join(tmpdir(), "edit-public-"));
  const started = Date.now();
  try {
    rmSync(outDir, { recursive: true, force: true });
    await bundle({ entryPoint: resolve("src/edit/film/root.tsx"), outDir, publicDir: empty });
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
  console.log(`${outDir}  (bundled in ${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
