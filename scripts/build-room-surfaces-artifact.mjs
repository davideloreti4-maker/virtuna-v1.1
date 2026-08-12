#!/usr/bin/env node
/**
 * Make the room-surfaces mockup (overview · arm · start) publishable as an Artifact.
 *
 *   node scripts/build-room-surfaces-artifact.mjs [out.html]
 *
 * Same reason as build-insights-review-artifact.mjs: a published Artifact runs under a strict
 * CSP (no CDN fonts), and the type is part of what is being judged. This inlines the two Google
 * faces as data: URIs and strips the document skeleton the publisher supplies itself. No image
 * inlining here — this mockup draws everything (dots, glyphs) inline.
 *
 * ⚠️ SEPARATE artifact from the insights drill. Never publish this output to the drill's URL.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const MOCKUP = `${ROOT}docs/mockups/room-surfaces-2026-08-02.html`;
const OUT = process.argv[2] || `${process.env.TMPDIR || "/tmp"}/room-surfaces-review.html`;

const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..600" +
  "&family=Newsreader:opsz,wght@6..72,400&display=swap";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const gf = await (await ctx.request.get(FONT_CSS, { headers: { "user-agent": UA } })).text();
let fontFaces = "";
for (const blk of gf.split("@font-face").slice(1).map((s) => s.split("}")[0])) {
  if (!/unicode-range:[^;]*U\+0000-00FF/.test(blk)) continue; // latin only
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
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "Room surfaces review";
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const body = html.match(/<body>([\s\S]*?)<script>/)[1];
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
if (body.includes("http") && /src="http|href="http/.test(body)) throw new Error("external ref survived in body");

writeFileSync(
  OUT,
  `<title>${title}</title>\n<style>\n${fontFaces}\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`,
);
console.log(`\n-> ${OUT}  ${(statSync(OUT).size / 1024).toFixed(0)}KB`);
