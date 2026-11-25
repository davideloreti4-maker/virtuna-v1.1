/**
 * edit-preview-vs-render.ts — test 4 of the design: is what the Player shows what the renderer
 * posts? For each frame asked, it renders a still with the real renderer, takes the Player's
 * picture of the same frame in each browser, and measures two things: the share of pixels that
 * are far apart (something drawn elsewhere, or not drawn), and how far the colours are apart on
 * average, in levels of 255. The second is what holds the look: a film rendered warm and shown
 * with no look at all has no pixel far apart, and is 3 levels apart on average.
 *
 * It uses the dev server that is running at 127.0.0.1:3040, or starts one of its own for the run
 * (`edit-dev-server.ts`), bound to this machine only. Each job is a demo edit in `.scratch/media/`
 * by name, and the frames of it to compare.
 *
 * Usage:  pnpm exec tsx scripts/edit-preview-vs-render.ts <out-dir> <demo>:<frame>,<frame> [<demo>:<frames> ...]
 *         e.g.  ... .scratch/stills/pvr demo:4,20,100 demo-push:179,183
 *         EDIT_DEV_URL to use a dev server elsewhere; EDIT_MAX_DIFF=0.004 (the share of pixels that may be far apart);
 *         EDIT_MAX_SHIFT (how many levels the colours may be apart on average; by default 1.2 in Chromium and 2 in WebKit);
 *         EDIT_BROWSERS=chromium,webkit by default (WebKit needs `pnpm exec playwright install webkit` once).
 *         EDIT_KEEP=all keeps every picture; by default only those of frames over a limit are kept (7 MB a frame otherwise).
 *         A third browser, `stand-in`, is Chromium without WebGL 2: there the Player cannot run the
 *         colour pass and shows its stand-in, and how far that is from the render is only reported.
 *
 * Where the limits come from, measured 2026-11-19 on 98 frames of 27 edits in Chromium: on time,
 * at worst 0.26 % of pixels far apart (a label title half-way in) and colours 0.80 levels apart
 * (the decoders alone differ by 0.5: the Player's is the machine's, the renderer's is software).
 * A title or a call-out drawn one frame late: 0.5 to 2.1 % of pixels. A look left out: 2.5 levels or more.
 * WebKit decodes the footage a level less blue than the renderer does and blurs a shadow a little
 * differently (1.0 to 1.7 levels apart on the same frames, nothing an eye sees), so its limit is
 * its own.
 *
 * And in Chromium, the boxes (X91): the box `layout.ts` gives each title, call-out and caption page
 * with the server's measure (`src/lib/edit/measure.ts`) is the box the kit draws, read from the
 * page. On the demo edit (`.scratch/media/demo.json`), 20 made-up strings are set, one after
 * another through the dev page's door, as its title, its call-out and the words of its captions,
 * each string with other settings: every typeface and look, titles from 48 px (the least, K1) to
 * 220, light letters and dark (a label then on its light box), accents that read as letters and
 * accents drawn as a marker behind the word, caption pages of up to 16 words, places at the
 * stage's edges. Held: every box within 1 px, and no title line whose letters run past it by more
 * than kerning does (`PAST_EM`; a marker that took room would). Only the strings in `BOX_UNMEASURED` may be skipped (the table
 * lacks a character of theirs); any other skip fails the run, and so does a run that checked no
 * light label, no marker or no page of more than six words. From string 10 on, the captions and the
 * title carry a weight (X122, 400 to 900; strings 0 to 9 carry none, as every edit made before
 * 2026-11-24), and a run that checked no caption page set as a sentence (plain with a weight: strings
 * 11, 15 and 19) or no title with a weight fails too.
 *
 * It fails, too, when it holds nothing (the final fix wave): with no browser held to the limits
 * (`stand-in` alone), with a limit that is not a number, or with no frame compared.
 */
import { chromium, webkit, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { pagesFor, type CaptionPage } from "../src/edit/film/pages";
import { accentFill, calloutBox, captionPages, lumaOf, sentenceSet, titleBox, LIGHT_LETTERS, type Box, type CalloutProps, type CaptionWord, type Measure, type TitleProps } from "../src/edit/film/layout";
import { applyOps, captionFrames, layout, parseEdit, placed, runWords, type Edit } from "../src/lib/edit";
import { measure, type FontId } from "../src/lib/edit/measure";
import { withDevServer } from "./edit-dev-server";
import { stillName, withRenderer } from "./edit-render";

const allowed = Number(process.env.EDIT_MAX_DIFF ?? "0.004");
const shiftAsked = process.env.EDIT_MAX_SHIFT ? Number(process.env.EDIT_MAX_SHIFT) : null;
const asked = (process.env.EDIT_BROWSERS ?? "chromium,webkit").split(",");
// A limit that is not a number would pass every frame (a comparison with NaN is false): refused before anything runs.
if (!(Number.isFinite(allowed) && allowed >= 0)) throw new Error(`EDIT_MAX_DIFF is ${JSON.stringify(process.env.EDIT_MAX_DIFF)}: a share of pixels, 0 or more`);
if (shiftAsked !== null && !(Number.isFinite(shiftAsked) && shiftAsked >= 0)) throw new Error(`EDIT_MAX_SHIFT is ${JSON.stringify(process.env.EDIT_MAX_SHIFT)}: levels of 255, 0 or more`);
const keepAll = process.env.EDIT_KEEP === "all";

interface Job {
  demo: string;
  frames: number[];
}

/**
 * The browsers a preview is compared in. Chromium is the full browser, not Playwright's headless
 * shell: the shell has no WebGL 2, which every browser a person uses has. The shell is the
 * `stand-in` browser for exactly that reason.
 */
const BROWSERS = {
  chromium: { launch: () => chromium.launch({ channel: "chromium" }), held: true, shift: 1.2 },
  webkit: { launch: () => webkit.launch(), held: true, shift: 2 },
  "stand-in": { launch: () => chromium.launch(), held: false, shift: Infinity },
} as const;

/**
 * The Player's picture of each frame of one demo. After a seek the Player draws the words at once
 * and the footage when its frame is decoded, so a picture counts once two in a row are the same.
 * A picture that never comes (footage left black) is not waited for: it shows as a difference.
 */
async function previewOf(browser: Browser, base: string, held: boolean, job: Job, outDir: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${base}/dev-edit?bare=1&demo=${job.demo}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev server's own badge is not part of the film
  await page.waitForFunction(() => Boolean(window.__editPlayer), undefined, { timeout: 30_000 });
  for (const frame of job.frames) {
    await page.evaluate((to) => {
      window.__editPlayer?.pause();
      window.__editPlayer?.seekTo(to);
    }, frame);
    await page.waitForTimeout(300);
    let before = await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    for (let tries = 0; tries < 40; tries++) {
      await page.waitForTimeout(250);
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } });
      const same = shot.equals(before);
      before = shot;
      if (same) break;
    }
    writeFileSync(join(outDir, stillName(frame)), before);
  }
  const shown = await page.getAttribute("#edit-stage", "data-colour");
  await page.close();
  if (errors.length > 0) throw new Error(`${job.demo}: the page reported: ${errors.join(" | ")}`);
  // A browser held to the limits must be running the colour pass itself. The stand-in browser shows the stand-in where an edit has a look, and is exact where it has none.
  if (held && shown !== "exact") throw new Error(`${job.demo}: the Player's colour is ${shown}: this browser cannot run the colour pass, so its picture is not what is being proved`);
}

/* ── the boxes (X91) ──────────────────────────────────────────────────────────────────────────── */

/** Made up. Each is set as the title, the call-out and the captions' words: at most 40 characters, a call-out's longest. */
const BOX_STRINGS = [
  "Back in five", "Three things nobody tells you", "Donaudampfschifffahrt", "Guarda fino alla fine", "Das ist wirklich großartig",
  "before -> after", "1080x1920 at 30 fps", "Wait for it...", "Ça va? Très bien!", "fifty fine fish",
  "Größe zählt nicht", "I", "Make it *pop* now", "Wow 👋", "Perché no?",
  "The quick brown fox jumps over the dog", "€5 – that’s it", "Supercalifragilistic", "ok", "Pick ONE thing & do it",
];
/** How far a box the kit draws may be from `layout.ts`'s, in px, on each of its four numbers. */
const BOX_ALLOWED = 1;
/**
 * How far a title's letters may run past their line, in ems of its size: the line is the letters' unkerned width, and kerning
 * draws some a hair wider ("fifty fine fish" at 120 px, 2 px past, 2026-11-23). A marker that took room would add 0.2 em.
 */
const PAST_EM = 0.05;
/** The strings the server's table cannot measure (it has no emoji), skipped in every part. Any other skip fails the run. */
const BOX_UNMEASURED = ["Wow 👋"];
const FONTS_ROUND = ["tiktok", "inter", "montserrat"] as const;
const pick = <T,>(list: readonly T[], i: number): T => list[i % list.length] as T;

/** A string the server's table cannot measure. */
class Unmeasured extends Error {}
/** The server's measure for one typeface, as `review` will take it. */
const tableMeasure = (font: FontId): Measure => (text, weight, size, trackingEm) => {
  const width = measure(text, font, weight, size, trackingEm);
  if (width === null) throw new Unmeasured(text);
  return width;
};

/**
 * The operations that set string `i` everywhere, each part with settings of its own. Within a part
 * the lists of settings have lengths with no common factor, so no two settings move in step: every
 * typeface meets every look, and the places at the stage's edges meet every size and page length.
 */
function boxOps(edit: Edit, text: string, i: number): unknown[] {
  const words = text.split(" ");
  const take = edit.assets.find((asset) => asset.kind === "video" && (asset.words?.length ?? 0) > 0);
  const said = take && take.kind === "video" ? (take.words ?? []) : [];
  return [
    // 3 typefaces, 3 looks (a new one every 3 strings), 7 sizes from the least (48), 5 places, light and dark letters, three accents:
    // so a label meets dark letters (its light box) and an accent that does not hold on its box (a marker), and one that does.
    {
      op: "item.set", id: "hook",
      props: {
        text, font: pick(FONTS_ROUND, i), look: pick(["bold", "label", "outline"], Math.floor(i / 3)), size: pick([48, 84, 120, 64, 160, 220, 96], i), y: pick([0, 0.16, 0.5, 1, 0.3], i),
        color: pick(["#ffffff", "#111111"], i), accent: pick(["#ffe14a", "#b91c1c", null], i + 1),
        ...(i >= 10 && { weight: pick([500, 600, 900, 400, 700], i) }), // from string 10 on; a weight set stays for the strings after it
      },
    },
    // 3 typefaces, 2 looks, 7 sizes, 11 places across, 5 down.
    {
      op: "mark.set", id: "name",
      props: { text, font: pick(FONTS_ROUND, i + 2), look: pick(["pop", "label"], i), size: pick([44, 90, 150, 200, 120, 64, 180], i), x: pick([0, 0.5, 0.9, 1, 0.1, 0.7, 0.3, 0.95, 0.05, 0.6, 0.2], i), y: pick([0, 0.2, 0.6, 1, 0.45], i) },
    },
    // 4 looks, 3 typefaces, 7 sizes, 5 places, 11 widths, 13 page lengths up to 16 (K1).
    {
      op: "captions.set", look: pick(["pill", "pop", "highlight", "plain"], i), font: pick(FONTS_ROUND, i + 1), size: pick([44, 72, 110, 160, 200, 130, 90], i), y: pick([0, 0.8, 1, 0.3, 0.74], i),
      width: pick([0.86, 0.6, 1, 0.7, 0.5, 0.9, 0.75, 0.8, 0.65, 0.95, 0.55], i), maxWords: pick([16, 2, 6, 4, 1, 12, 2, 6, 16, 4, 5, 12, 6], i),
      ...(i >= 10 && { weight: pick([600, 400, 500, 900, 700], i) }), // from string 10 on: plain at 11, 15 and 19 is set as a sentence
    },
    ...said.map((_, index) => ({ op: "word.set", asset: take?.id, index, text: pick(words, index) })),
  ];
}

/** The caption page shown on a film frame: its run's pages and which one, or null. Its run's captions stop where a transition out of it begins (`captionFrames`, as Film.tsx). */
function captionAt(edit: Edit, frame: number): { pages: CaptionPage[]; at: number } | null {
  const lay = layout(edit);
  for (const [r, run] of lay.runs.entries()) {
    const shown = captionFrames(edit, lay, r).frames;
    if (frame < run.at || frame >= run.at + shown) continue;
    const pages = pagesFor(edit.captions, runWords(edit, run), run.frames);
    const at = pages.findIndex((page) => frame - run.at >= page.from && frame - run.at < page.to);
    return at >= 0 ? { pages, at } : null;
  }
  return null;
}

/** Where a caption page's place is decided by a taller page of its run: at the stage's top or bottom edge, and how far from where the page alone would sit; or nowhere (null, as for text the table cannot measure). */
function heldBy(captions: Edit["captions"], pages: readonly (readonly CaptionWord[])[], at: number): { edge: "top" | "bottom"; by: number } | null {
  const page = pages[at];
  if (!page) return null;
  try {
    const [inRun, byItself] = [captionPages(captions, pages, tableMeasure(captions.font))[at], captionPages(captions, [page], tableMeasure(captions.font))[0]];
    return inRun && byItself && inRun.y !== byItself.y ? { edge: captions.y < 0.5 ? "top" : "bottom", by: Math.abs(inRun.y - byItself.y) } : null;
  } catch (error) {
    if (error instanceof Unmeasured) return null;
    throw error;
  }
}

/**
 * The caption page to check: the first shown from frame `from` on (then from the film's start),
 * or, if one is shown anywhere, the first whose place a taller page of its run decides. That hold
 * is what keeps a run's pages from jumping near the stage's edges, and what a page alone gets wrong.
 */
function captionCase(edit: Edit, from: number): { frame: number; pages: CaptionPage[]; at: number; held: ReturnType<typeof heldBy> } | null {
  const frames = layout(edit).frames;
  let first: { frame: number; pages: CaptionPage[]; at: number; held: null } | null = null;
  for (let step = 0; step < frames; step++) {
    const frame = (from + step) % frames;
    const shown = captionAt(edit, frame);
    if (!shown) continue;
    const held = heldBy(edit.captions, shown.pages.map((page) => page.words), shown.at);
    if (held) return { frame, ...shown, held };
    first ??= { frame, ...shown, held: null };
  }
  return first;
}

/** What the page shows for one part on one frame: its box (the union of the boxes of `inner`, or of the element itself, at rest) and its letters. */
async function drawnBox(page: Page, frame: number, part: string, inner: string | null, letters: string): Promise<Box & { past?: number }> {
  await page.evaluate((to) => {
    window.__editPlayer?.pause();
    window.__editPlayer?.seekTo(to);
  }, frame);
  const selector = `[data-edit-film] [data-part="${part}"]`;
  // Drawn once the frame is shown with these letters (spaces and asterisks aside).
  await page.waitForFunction(
    ({ selector, letters }) => {
      const found = document.querySelectorAll(selector);
      return found.length === 1 && (found[0]?.textContent ?? "").replace(/[\s*]/g, "") === letters;
    },
    { selector, letters: letters.replace(/[\s*]/g, "") },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(100);
  return page.evaluate(
    ({ selector, inner }) => {
      const film = document.querySelector("[data-edit-film]")?.getBoundingClientRect();
      const element = document.querySelector<HTMLElement>(selector);
      if (!film || !element) throw new Error(`nothing drawn at ${selector}`);
      const scale = film.width / 1080;
      // In the film's own pixels. (No named functions in here: the script's compiler names them with a helper the page does not have.)
      if (inner) {
        // A title's box is its lines' box; and how far its letters run past a line's own width at most (a marker that took room would).
        const lines = [...element.querySelectorAll<HTMLElement>(inner)];
        const rects = lines.map((each) => each.getBoundingClientRect());
        const [left, top] = [(Math.min(...rects.map((r) => r.left)) - film.left) / scale, (Math.min(...rects.map((r) => r.top)) - film.top) / scale];
        const [right, bottom] = [(Math.max(...rects.map((r) => r.right)) - film.left) / scale, (Math.max(...rects.map((r) => r.bottom)) - film.top) / scale];
        const past = Math.max(0, ...lines.map((each) => each.scrollWidth - each.clientWidth));
        return { x: left, y: top, w: right - left, h: bottom - top, past };
      }
      // One element: its centre as drawn (a scale about the centre keeps it), its size as laid out (before the scale).
      const rect = element.getBoundingClientRect();
      const [cx, cy] = [(rect.left + rect.width / 2 - film.left) / scale, (rect.top + rect.height / 2 - film.top) / scale];
      return { x: cx - element.offsetWidth / 2, y: cy - element.offsetHeight / 2, w: element.offsetWidth, h: element.offsetHeight };
    },
    { selector, inner },
  );
}

const apartBy = (one: Box, other: Box) => Math.max(Math.abs(one.x - other.x), Math.abs(one.y - other.y), Math.abs(one.w - other.w), Math.abs(one.h - other.h));
const shownBox = (box: Box) => `${box.x.toFixed(2)},${box.y.toFixed(2)} ${box.w.toFixed(2)}×${box.h.toFixed(2)}`;

/** The boxes cross-check in one browser: gives the lines to print and what failed. */
async function boxesIn(browser: Browser, base: string): Promise<{ lines: string[]; problems: string[] }> {
  const demo = JSON.parse(readFileSync(".scratch/media/demo.json", "utf8")) as { edit: unknown };
  let edit = parseEdit(demo.edit);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${base}/dev-edit?bare=1&demo=demo`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__editPlayer && window.__editApply), undefined, { timeout: 30_000 });
  const tally = () => ({ worst: 0, at: "", skipped: [] as string[], checked: 0 });
  const parts = { title: tally(), callout: tally(), captions: tally() };
  const problems: string[] = [];
  const crossed = { top: 0, bottom: 0, most: 0 };
  /**
   * What the box check must have drawn at least once: a label on its light box, a marker, a page of more than six words (K1);
   * a caption page set as a sentence and a title with a weight (the native default, X122, X124).
   */
  const drew = { lightLabel: 0, marker: 0, longPage: 0, mostWords: 0, mostPast: 0, sentencePage: 0, weightedTitle: 0 };
  /** Holds one part's box from `layout.ts` against the one drawn; a string the table cannot measure is counted as skipped. True when checked. */
  const check = (part: keyof typeof parts, text: string, ours: () => Box | undefined, drawn: Box): boolean => {
    const each = parts[part];
    let box: Box | undefined;
    try {
      box = ours();
    } catch (error) {
      if (!(error instanceof Unmeasured)) throw error;
      each.skipped.push(text);
      return false;
    }
    if (!box) throw new Error(`${part}: no box laid out for ${JSON.stringify(text)}`);
    const apart = apartBy(box, drawn);
    const said = `${JSON.stringify(text)}: layout.ts ${shownBox(box)}, drawn ${shownBox(drawn)}`;
    each.checked += 1;
    if (each.at === "" || !(apart <= each.worst)) [each.worst, each.at] = [apart, said];
    if (!(apart <= BOX_ALLOWED)) problems.push(`${part} ${said}: ${apart} px apart`); // NaN fails too
    return true;
  };
  try {
    for (const [i, text] of BOX_STRINGS.entries()) {
      const ops = boxOps(edit, text, i);
      const result = applyOps(edit, ops, edit.assets);
      if (!result.ok) throw new Error(`the boxes' string ${i}: ${JSON.stringify(result.problems)}`);
      edit = result.edit;
      if (!(await page.evaluate((given) => window.__editApply?.(given) ?? false, ops))) throw new Error(`the dev page refused the boxes' string ${i}`);

      const hook = placed(edit).find((place) => place.thing.id === "hook");
      const name = placed(edit).find((place) => place.thing.id === "name");
      if (!hook || hook.thing.part !== "title" || !name || name.thing.part !== "callout") throw new Error("the demo edit has no hook title or name call-out");
      const titleProps = hook.thing.props as TitleProps;
      const calloutProps = name.thing.props as CalloutProps;
      // At rest: the title has come in (10 frames) and the call-out too (12), and neither is going out.
      const drawnTitle = await drawnBox(page, hook.at + 30, "title", "[data-line]", text);
      if (check("title", text, () => titleBox(titleProps, tableMeasure(titleProps.font)), drawnTitle) && titleProps.weight !== undefined) drew.weightedTitle += 1;
      drew.mostPast = Math.max(drew.mostPast, drawnTitle.past ?? 0);
      if (!((drawnTitle.past ?? 0) <= Math.max(BOX_ALLOWED, PAST_EM * titleProps.size))) problems.push(`title ${JSON.stringify(text)}: its letters run ${drawnTitle.past} px past a line, more than ${PAST_EM} em`);
      if (titleProps.look === "label" && lumaOf(titleProps.color) < LIGHT_LETTERS) drew.lightLabel += 1;
      if (titleProps.look === "label" && text.includes("*") && accentFill(titleProps.accent ?? titleProps.color, titleProps.color, 0.78) === "block") drew.marker += 1;
      check("callout", text, () => calloutBox(calloutProps, tableMeasure(calloutProps.font)), await drawnBox(page, name.at + 16, "callout", null, text));
      // A caption page, the first whose place a taller page of its run decides if there is one.
      const shown = captionCase(edit, pick([20, 60, 100, 150, 192, 230, 262], i));
      if (!shown) throw new Error(`no caption page on the film for the boxes' string ${i}`);
      const { frame, pages, at, held } = shown;
      const words = pages[at]?.words ?? [];
      drew.mostWords = Math.max(drew.mostWords, words.length);
      if (words.length > 6) drew.longPage += 1;
      const drawnPage = await drawnBox(page, frame, "captions", null, words.map((word) => word.text).join(""));
      if (check("captions", text, () => captionPages(edit.captions, pages.map((each) => each.words), tableMeasure(edit.captions.font))[at], drawnPage) && sentenceSet(edit.captions)) drew.sentencePage += 1;
      if (held) [crossed[held.edge], crossed.most] = [crossed[held.edge] + 1, Math.max(crossed.most, held.by)];
    }
  } finally {
    await page.close();
  }
  if (errors.length > 0) throw new Error(`the boxes: the page reported: ${errors.join(" | ")}`);
  const summary = Object.entries(parts).map(
    ([part, each]) => `  ${part}: ${each.checked} boxes, at worst ${each.worst.toFixed(3)} px apart (${each.at}); ${each.skipped.length} skipped, the table cannot measure them${each.skipped.length ? `: ${each.skipped.map((text) => JSON.stringify(text)).join(", ")}` : ""}`,
  );
  summary.push(`  caption pages whose place a taller page of their run decides: ${crossed.top} at the top, ${crossed.bottom} at the bottom; alone, one would sit up to ${crossed.most} px from where it is drawn`);
  summary.push(`  drawn: ${drew.lightLabel} labels on their light box, ${drew.marker} with a marker, ${drew.longPage} caption pages of more than six words (the most ${drew.mostWords}); title letters at most ${drew.mostPast} px past a line`);
  summary.push(`  drawn with a weight: ${drew.sentencePage} caption pages set as a sentence (plain with a weight), ${drew.weightedTitle} titles`);
  if (drew.lightLabel === 0) problems.push("no label on its light box was drawn");
  if (drew.marker === 0) problems.push("no marker was drawn");
  if (drew.longPage === 0) problems.push("no caption page of more than six words was drawn");
  if (drew.sentencePage === 0) problems.push("no caption page set as a sentence (plain with a weight) was drawn");
  if (drew.weightedTitle === 0) problems.push("no title with a weight was drawn");
  // Only the strings the table is known not to measure may be skipped, and every other string is checked.
  for (const [part, each] of Object.entries(parts)) {
    const unexpected = each.skipped.filter((text) => !BOX_UNMEASURED.includes(text));
    if (unexpected.length > 0) problems.push(`${part}: skipped, not expected: ${unexpected.map((text) => JSON.stringify(text)).join(", ")}`);
    if (each.checked < BOX_STRINGS.length - BOX_UNMEASURED.length) problems.push(`${part}: only ${each.checked} boxes checked of ${BOX_STRINGS.length - BOX_UNMEASURED.length}`);
  }
  for (const edge of ["top", "bottom"] as const) if (crossed[edge] === 0) problems.push(`no caption page held by a taller page at the ${edge}: the hold is not crossed there`);
  return { lines: [...summary, ...problems.map((problem) => `  FAILED: ${problem}`)], problems };
}

async function main(): Promise<void> {
  const [outDir, ...wanted] = process.argv.slice(2);
  const jobs: Job[] = wanted.map((job) => {
    const [demo = "", frames = ""] = job.split(":");
    return { demo, frames: frames.split(",").map(Number) };
  });
  if (!outDir || jobs.length === 0 || jobs.some((job) => !/^[a-z0-9-]+$/.test(job.demo) || job.frames.length === 0 || job.frames.some(Number.isNaN))) {
    throw new Error("usage: edit-preview-vs-render.ts <out-dir> <demo>:<frame>,<frame> [<demo>:<frames> ...]");
  }
  const notKnown = asked.filter((engine) => !(engine in BROWSERS));
  if (notKnown.length > 0) throw new Error(`unknown browser: ${notKnown.join(", ")}. Known: ${Object.keys(BROWSERS).join(", ")}`);
  if (!asked.some((engine) => BROWSERS[engine as keyof typeof BROWSERS].held)) throw new Error(`no browser held to the limits among ${asked.join(", ")}: the stand-in is only reported, so nothing would be proved`);
  for (const job of jobs) for (const folder of ["render", "diff", ...asked]) mkdirSync(join(outDir, job.demo, folder), { recursive: true });

  await withRenderer(async ({ still }) => {
    for (const job of jobs) for (const frame of job.frames) await still(`.scratch/media/${job.demo}.json`, frame, join(outDir, job.demo, "render", stillName(frame)));
  });

  const worst: string[] = [];
  const failed = new Set<string>(); // the render of a frame is kept if any browser's picture of it is over a limit
  let compared = 0; // frames compared in a browser held to the limits
  let boxProblems: string[] = [];
  await withDevServer(async (base) => {
    if (asked.includes("chromium")) {
      const browser = await BROWSERS.chromium.launch();
      try {
        const { lines, problems } = await boxesIn(browser, base);
        boxProblems = problems;
        console.log(`chromium: the boxes of ${BOX_STRINGS.length} strings, layout.ts with the server's measure against the kit as drawn (${BOX_ALLOWED} px allowed):\n${lines.join("\n")}`);
      } finally {
        await browser.close();
      }
    }
    for (const engine of asked as (keyof typeof BROWSERS)[]) {
      const { launch, held, shift: ownShift } = BROWSERS[engine];
      const allowedShift = shiftAsked ?? ownShift;
      let [most, mostShift] = [0, 0];
      const browser = await launch();
      try {
        for (const job of jobs) await previewOf(browser, base, held, job, join(outDir, job.demo, engine));
      } finally {
        await browser.close();
      }
      for (const job of jobs) {
        for (const frame of job.frames) {
          const render = PNG.sync.read(readFileSync(join(outDir, job.demo, "render", stillName(frame))));
          const preview = PNG.sync.read(readFileSync(join(outDir, job.demo, engine, stillName(frame))));
          const diff = new PNG({ width: render.width, height: render.height });
          const share = pixelmatch(render.data, preview.data, diff.data, render.width, render.height, { threshold: 0.1 }) / (render.width * render.height);
          let apart = 0;
          for (let i = 0; i < render.data.length; i += 4) for (let c = 0; c < 3; c++) apart += Math.abs((render.data[i + c] ?? 0) - (preview.data[i + c] ?? 0));
          const shift = apart / (render.width * render.height * 3);
          [most, mostShift] = [Math.max(most, share), Math.max(mostShift, shift)];
          const over = held && !(share <= allowed && shift <= allowedShift); // NaN is over
          if (held) compared += 1;
          if (over) failed.add(`${job.demo}/${frame}`);
          if (over || keepAll) writeFileSync(join(outDir, job.demo, "diff", `${engine}-${stillName(frame)}`), PNG.sync.write(diff));
          else rmSync(join(outDir, job.demo, engine, stillName(frame)));
          console.log(`${engine} ${job.demo} frame ${frame}: ${(share * 100).toFixed(3)} % of pixels far apart, colours ${shift.toFixed(2)} levels apart${held ? (over ? "  <-- over the limit" : "") : "  (the stand-in: reported, not held to the limits)"}`);
        }
      }
      worst.push(`${engine}: at worst ${(most * 100).toFixed(3)} % of pixels far apart${held ? ` (${(allowed * 100).toFixed(1)} % allowed)` : ""} and colours ${mostShift.toFixed(2)} levels apart${held ? ` (${allowedShift} allowed)` : ""}`);
    }
  });
  if (!keepAll) for (const job of jobs) for (const frame of job.frames) if (!failed.has(`${job.demo}/${frame}`)) rmSync(join(outDir, job.demo, "render", stillName(frame)));
  console.log(worst.join("\n"));
  // One verdict: nothing is said to agree while anything failed.
  const failures = [
    ...(compared === 0 ? ["no frame was compared in a browser held to the limits"] : []),
    ...(failed.size > 0 ? [`preview and render differ on ${failed.size} frame${failed.size === 1 ? "" : "s"}: ${[...failed].join(", ")}`] : []),
    ...(boxProblems.length > 0 ? [`the boxes: ${boxProblems.join("; ")}`] : []),
  ];
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(`preview and render agree (${compared} frames compared in the browsers held)`);
  if (asked.includes("chromium")) console.log("the kit draws the boxes layout.ts gives");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
