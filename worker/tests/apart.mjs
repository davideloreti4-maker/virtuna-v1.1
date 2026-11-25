// node apart.mjs <a.png> <b.png> — how far two pictures of one size are apart, by the measure of the
// kit's other picture tests (scripts/edit-preview-vs-render.ts) and of test 3: the share of pixels far
// apart (pixelmatch at 0.1) and how many levels of 255 the colours are apart on average.
// Prints {"farApart": share, "levels": n}. Uses the repo's own pixelmatch and pngjs.
import { readFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const [a, b] = process.argv.slice(2, 4).map((path) => PNG.sync.read(readFileSync(path)));
if (!a || !b || a.width !== b.width || a.height !== b.height) throw new Error("two pictures of one size are needed");
const pixels = a.width * a.height;
const far = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
let levels = 0;
for (let i = 0; i < a.data.length; i += 4) for (let c = 0; c < 3; c++) levels += Math.abs(a.data[i + c] - b.data[i + c]);
console.log(JSON.stringify({ farApart: far / pixels, levels: levels / (pixels * 3) }));
