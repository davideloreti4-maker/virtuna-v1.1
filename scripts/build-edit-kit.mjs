#!/usr/bin/env node
// Copies the kit's third-party files out of the pinned openfilm package into public/edit-kit/v1/.
// Run once per kit version; the output is committed, so nothing at run time depends on node_modules.
// text.html is ours and is not touched. usage: node scripts/build-edit-kit.mjs
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("openfilm/package.json"));
const { version } = require("openfilm/package.json");
const out = join(root, "public", "edit-kit", "v1");

const WIPES = ["swipe-blur", "glitch", "flare-whip", "shutter", "rgb-split", "datamosh"];
const SFX = [
  "boom", "buzz", "click", "ding", "drop", "heartbeat", "hit", "kick", "notify", "pop",
  "rain", "riser", "shutter", "swish", "tick", "typing", "whoosh-low", "whoosh", "wind", "zap",
];

for (const dir of ["wipes", "sfx", "fonts"]) mkdirSync(join(out, dir), { recursive: true });
for (const id of WIPES) copyFileSync(join(pkg, "library", "transitions", id, "files", `${id}.html`), join(out, "wipes", `${id}.html`));
for (const name of SFX) copyFileSync(join(pkg, "library", "sounds", `${name}.m4a`), join(out, "sfx", `${name}.m4a`));

const fonts = join(pkg, "studio", "ui", "dist", "assets");
const inter = readdirSync(fonts).find((file) => /^inter-latin-wght-normal-.*\.woff2$/.test(file));
if (!inter) throw new Error("Inter (latin, variable) was not found in the openfilm package");
copyFileSync(join(fonts, inter), join(out, "fonts", "inter-latin-wght.woff2"));

writeFileSync(join(out, "NOTICE.md"), `# Edit kit v1: what is in it and where it came from

- \`text.html\`: written for this project.
- \`fonts/inter-latin-wght.woff2\`: Inter by Rasmus Andersson, SIL Open Font License 1.1
  (https://openfontlicense.org). Copied from openfilm ${version}, which bundles it via
  @fontsource-variable/inter.
- \`wipes/*.html\` and \`sfx/*.m4a\`: from the library of openfilm ${version}
  (https://github.com/openfilm/openfilm), dedicated to the public domain under CC0 1.0. Copied
  unchanged.

A kit version is never edited once an edit has been rendered with it. A change makes v2.
`);
console.log(`kit v1 written to ${out} (from openfilm ${version})`);
