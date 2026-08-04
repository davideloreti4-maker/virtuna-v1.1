#!/usr/bin/env node
/**
 * Make the insights-drill mockup publishable as an Artifact.
 *
 *   node scripts/build-insights-review-artifact.mjs [out.html]
 *
 * WHY. A published Artifact runs under a strict CSP: no CDN fonts, no external images, no
 * relative paths. The mockup is authored the readable way — a <link> to Google Fonts and
 * <img src="reference-2026-08-01/*.png"> — so publishing it as-is gives you a page with
 * silently-substituted typography (which matters here: the type is part of what is being
 * judged) and two empty hero boxes. This inlines both, and strips the document skeleton the
 * publisher supplies itself.
 *
 * It only ever TRANSFORMS the mockup — every pixel of the design, including the review
 * scaffolding column, lives in that one file. Edit the mockup, re-run this, republish.
 *
 * Three traps already handled. Do not "simplify" them away:
 *
 *  1. A file:// canvas is TAINTED and toDataURL() throws. The PNG is read in Node and handed
 *     to the page as a data: URI, which does not taint.
 *  2. PNG heroes cost ~397KB of base64; JPEG q0.92 costs ~79KB and is indistinguishable on
 *     these two figures (a 3D render and soft node blobs). Pre-cropping to the visible window
 *     is most of that saving.
 *  3. CROP below is tied to the mockup's hero framing. If `hero()` in the mockup changes its
 *     img width/left/top, these numbers must change with it — see handoff §9 for the geometry.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const MOCKUP = `${ROOT}docs/mockups/insights-rev6-hero-restored-2026-08-01.html`;
const REF = `${ROOT}docs/mockups/reference-2026-08-01/`;
const OUT = process.argv[2] || `${process.env.TMPDIR || "/tmp"}/insights-review.html`;

// Latin subset only. Inter is requested as a VARIABLE face (400..600) on purpose: three static
// weights cost 142KB, one variable file costs 47KB.
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..600" +
  "&family=Newsreader:opsz,wght@6..72,400&display=swap";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

/** The visible window of each hero, in NATIVE (2x) pixels of the reference screenshots. */
const CROP = {
  "shipped-video-The-brain.png": { x: 64, y: 224, w: 772, h: 526 },
  "shipped-video-The-audience.png": { x: 214, y: 350, w: 472, h: 320 },
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent("<body></body>");

const heroes = {};
for (const [file, c] of Object.entries(CROP)) {
  const src = `data:image/png;base64,${readFileSync(REF + file).toString("base64")}`;
  heroes[file] = await page.evaluate(
    async ([src, x, y, w, h]) => {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
      return cv.toDataURL("image/jpeg", 0.92);
    },
    [src, c.x, c.y, c.w, c.h],
  );
  console.log(`  ${file} ${c.w}x${c.h} -> ${(heroes[file].length / 1024).toFixed(0)}KB`);
}

const gf = await (await ctx.request.get(FONT_CSS, { headers: { "user-agent": UA } })).text();
let fontFaces = "";
for (const blk of gf.split("@font-face").slice(1).map((s) => s.split("}")[0])) {
  if (!/unicode-range:[^;]*U\+0000-00FF/.test(blk)) continue; // latin only, skip latin-ext
  const url = (blk.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  if (!url) continue;
  const fam = (blk.match(/font-family:\s*'([^']+)'/) || [])[1];
  const wt = (blk.match(/font-weight:\s*([^;]+);/) || [])[1] || "400";
  const buf = await (await ctx.request.get(url)).body();
  fontFaces +=
    `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wt};font-display:swap;` +
    `src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}\n`;
  console.log(`  ${fam} ${wt} -> ${(buf.length / 1024).toFixed(0)}KB`);
}
await browser.close();

const html = readFileSync(MOCKUP, "utf8");
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "Insights review";
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script>/)[1];
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const fill = "width:100%;height:100%;object-fit:cover;display:block";
for (const file of Object.keys(CROP)) {
  const re = new RegExp(`src="reference-2026-08-01/${file.replace(/\./g, "\\.")}" style="[^"]*"`);
  if (!re.test(js)) throw new Error(`hero <img> for ${file} not found — CROP is out of date`);
  js = js.replace(re, `src="${heroes[file]}" style="${fill}"`);
}
if (js.includes("reference-2026-08-01")) throw new Error("an image reference survived inlining");

// No <!DOCTYPE>/<html>/<head>/<body> — the Artifact publisher supplies that skeleton.
writeFileSync(
  OUT,
  `<title>${title}</title>\n<style>\n${fontFaces}\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`,
);
console.log(`\n-> ${OUT}  ${(statSync(OUT).size / 1024).toFixed(0)}KB`);
console.log("Publish with the Artifact tool, passing the existing URL to keep the same link.");
