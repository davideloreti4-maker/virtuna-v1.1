/**
 * edit-measure-proof.ts — Task 1's proof (X90): does the server's table (`src/lib/edit/measure.ts`)
 * give a line the width the browser gives it when the kit measures it?
 *
 * The browser measures as the kit does: `measureText` from `@remotion/layout-utils` (the package's
 * own file, served as it is), with `MEASURED_AS`, the kit's font files loaded under the kit's
 * family names and weight ranges, as `loadFont` loads them, on a page in English, as the app's
 * and the renderer's pages are. Every string at every typeface and weight the table holds,
 * without tracking (captions, call-outs) and with the title's -0.01em, at 100 px (the size the kit
 * measures at) and at 44, 31, 20 and 12 px. Held: every one within 0.5 px.
 *
 * A string holding a character outside the tables' character set (one some table lacks, as an emoji)
 * has no table width to compare: review measures such a character with a fallback, by design
 * (`measureWide`). So such strings are left out, by rule, not by name, and the run says how many and
 * which, so a skip cannot grow unseen.
 *
 * And the film's own letters in the two browsers: the lines the typefaces swapped glyphs in
 * before X94 (`SUBSTITUTED`), measured kerned, as the film draws them, with the settings it drew
 * with before X94 and with today's. Held: today, Chromium and WebKit within 0.5 px of each other.
 *
 * The 300 strings: the words of the edit module's test fixtures (`src/lib/edit/__tests__`, all
 * English) and of the worker's word tests (`worker/tests/test_words.py`: English, German,
 * Italian), the titles and call-outs of the kit's demo edits in `.scratch/media/` when they are
 * there, 50 strings mixed at random from the characters every table holds, and everyday words
 * and short lines in the three languages written below, made up, to fill the rest.
 *
 * It serves the page itself, bound to 127.0.0.1 on the first free port from 3000 to 3005, for as
 * long as it runs.
 *
 * Usage:  pnpm exec tsx scripts/edit-measure-proof.ts
 *         EDIT_BROWSERS=chromium,webkit by default.
 *         EDIT_MEASURE_OUT=<file> writes every width more than 0.05 px from the table's there, one JSON line each.
 */
import { chromium, webkit, type Browser } from "@playwright/test";
import type { measureText } from "@remotion/layout-utils";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve, sep } from "node:path";
import { FONT_FILES, MEASURED_AS, SET_AS, type FontId } from "../src/edit/film/fonts";
import { markedWords } from "../src/edit/film/lines";
import { MEASURED_WEIGHTS, measure } from "../src/lib/edit/measure";
import widths from "../src/edit/film/widths.json";

declare global {
  interface Window {
    measureText?: typeof measureText;
  }
}

/** The size the kit measures at (a title's `MEASURED_AT` and a call-out's fit, both in layout.ts). */
const SIZE = 100;
/** Every size held: 100, the smallest the kit is asked for (44), and type the kit shrinks below the top of an optical-size axis. */
const SIZES = [SIZE, 44, 31, 20, 12];
/** The title's letter-spacing (`TITLE_TRACKING_EM` in layout.ts), as CSS and in ems. */
const TRACKING = { css: "-0.01em", em: -0.01 };
const ALLOWED = 0.5;
/** Apart by more than this, a width is counted and written out. */
const NEAR = 0.05;
const CORPUS_SIZE = 300;
const MIXES = 50;

const BROWSERS = {
  chromium: () => chromium.launch({ channel: "chromium" }),
  webkit: () => webkit.launch(),
} as const;
const asked = (process.env.EDIT_BROWSERS ?? "chromium,webkit").split(",") as (keyof typeof BROWSERS)[];
const out = process.env.EDIT_MEASURE_OUT;

/**
 * Lines a typeface set with other glyphs, of other widths, before X94 (2026-11-21). "STRAßE" was
 * set so only by Chromium on a page with no language, on a Mac set to German: the app's and the
 * renderer's pages say English, as this one does.
 */
const SUBSTITUTED = ["first", "Guarda fino alla fine", "before -> after", "a -> b", "<- back", "a => b", "3x4", "1080x1920", "STRAßE", "Ŀ ŀl"];

/** The settings a job is measured with: as the kit measures, or as the film draws (kerned, `OWN` in Film.tsx) before X94 and now. */
const STYLES = {
  before: { ...MEASURED_AS, fontKerning: "auto", fontFeatureSettings: "normal", fontVariantLigatures: "normal", fontVariationSettings: "normal" },
  drawn: { ...MEASURED_AS, fontKerning: "auto", ...SET_AS },
  measured: MEASURED_AS,
};

/** Made up: everyday words and short lines a creator says, in English, German and Italian. */
const EVERYDAY = [
  ...SUBSTITUTED,
  "„So geht’s“", "‚ja‘", "«ciao»", "‹oui›", "GROẞ", "»Achtung«",
  // English
  "first", "office", "affiliate", "fluffy", "workflow", "fifteen", "fiction", "effect", "offline", "fly",
  "the", "and", "you", "this", "that", "what", "really", "never", "always", "every", "today", "tomorrow",
  "creator", "video", "watch", "follow", "subscribe", "comment", "like", "share", "story", "hook", "ending",
  "don’t", "can’t", "it’s", "you’re", "we’ll", "I’ve", "here’s", "that’s why", "“no way”", "‘really’",
  "Wait…", "OK!", "Why?", "100%", "#1", "$9.99", "12:30", "3x faster", "2026", "10–20", "before -> after",
  "Stop scrolling", "Watch till the end", "Here is the trick", "Nobody tells you this", "Part 2",
  "my morning routine", "five tips • one minute", "It works — really", "best camera settings", "Q&A",
  "WAIT", "WHAT", "NO WAY", "HOW TO", "DIY", "TL;DR", "e.g.", "vs.", "(yes)", "[link]", "@you", "50/50",
  // German
  "Größe", "Grüße", "Straße", "fließend", "Fußball", "weiß", "heißt", "müssen", "können", "möchte",
  "für", "über", "Übung", "Äpfel", "Öl", "Mädchen", "Brücke", "Glück", "zurück", "Frühstück",
  "natürlich", "schön", "Käse", "Bäckerei", "Tschüss", "Effekt", "Briefe", "öffnen", "schaffen", "Schiff",
  "häufig", "Kaffee", "Auflage", "Aufführung", "Hoffnung", "eigentlich", "wirklich", "heute", "morgen", "nicht",
  "Das ist", "Schau bis zum Ende", "So geht’s", "Was ist das?", "Ich hab’s", "„genau“", "3,5 Millionen",
  "50 € gespart", "Tipp Nr. 1", "ÜBERRASCHUNG", "GRÖẞTE",
  // Italian
  "perché", "così", "città", "più", "già", "però", "caffè", "università", "è", "qualità",
  "virtù", "lunedì", "finché", "affinché", "fiducia", "fiore", "affetto", "ufficio", "difficile", "figlio",
  "fine", "l’amore", "dell’anno", "un’idea", "c’è", "quest’anno", "perciò", "dov’è", "Però", "È vero",
  "Guarda fino alla fine", "Ecco il trucco", "Non ci credo", "Che cosa?", "andiamo", "sempre", "oggi", "domani",
  "ragazzi", "grazie", "allora", "davvero", "bellissimo", "settimana", "€ 5,00", "5€", "PERCHÉ", "CITTÀ",
  // More of each, so that the corpus is full without the demo edits (a checkout has no `.scratch/`).
  "honestly", "literally", "game changer", "save this", "link in bio", "day 1 of 30", "the secret is…", "wait for it",
  "you won’t believe", "POV:", "storytime", "hot take", "unpopular opinion", "5 mistakes", "don’t skip this",
  "ehrlich gesagt", "Spar dir das", "Link in der Bio", "Tag 1 von 30", "Das Geheimnis ist…", "Warte ab", "Fehler Nr. 3",
  "unglaublich", "Überraschung!", "Schritt für Schritt", "Bitte nicht überspringen", "Wusstest du?", "größer", "Füße", "Mühe",
  "onestamente", "salvalo", "link nella bio", "giorno 1 di 30", "il segreto è…", "aspetta", "errore n° 3",
  "incredibile", "passo dopo passo", "non saltarlo", "lo sapevi?", "perché no?", "così così", "ventitré", "tutto qui",
];

/** A random number from 0 to 1, the same every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The characters every table holds. */
function shared(): string[] {
  const fonts = Object.keys(FONT_FILES) as FontId[];
  return Object.keys(widths.inter["700"].advances).filter((character) => fonts.every((font) => MEASURED_WEIGHTS[font].every((weight) => measure(character, font, weight, 1) !== null)));
}

function corpus(): { strings: string[]; from: string } {
  const fixtures = new Set<string>();
  const dir = "src/lib/edit/__tests__";
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts")).sort()) {
    for (const [, said] of readFileSync(join(dir, file), "utf8").matchAll(/\btext: "([^"\\]*)"/g)) if (said !== undefined) fixtures.add(said);
  }
  const worker = new Set<string>();
  for (const [, given, spoken = ""] of readFileSync("worker/tests/test_words.py", "utf8").matchAll(/^\s+\("([^"]+)", "(?:en|de|it)", \[([^\]]*)\]\),$/gm)) {
    if (given !== undefined) worker.add(given);
    for (const [, word] of spoken.matchAll(/"([^"]+)"/g)) if (word !== undefined) worker.add(word);
  }
  const demos = new Set<string>();
  const media = ".scratch/media";
  if (existsSync(media)) {
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        const item = node as { part?: unknown; props?: { text?: unknown } };
        if ((item.part === "title" || item.part === "callout") && typeof item.props?.text === "string") {
          // A title is measured as the kit measures it: its words without the asterisks that mark them.
          demos.add(item.part === "title" ? markedWords(item.props.text).map((word) => word.text).join(" ") : item.props.text);
        }
        Object.values(node).forEach(walk);
      }
    };
    for (const file of readdirSync(media).filter((name) => /^demo.*\.json$/.test(name)).sort()) walk(JSON.parse(readFileSync(join(media, file), "utf8")));
  }
  const characters = shared();
  const random = seeded(20261121);
  const mixes = new Set<string>();
  while (mixes.size < MIXES) {
    const length = 4 + Math.floor(random() * 21);
    mixes.add(Array.from({ length }, () => (random() < 0.15 ? " " : (characters[Math.floor(random() * characters.length)] ?? "a"))).join(""));
  }
  const strings = new Set<string>([...fixtures, ...worker, ...demos, ...mixes]);
  const before = strings.size;
  for (const line of EVERYDAY) if (strings.size < CORPUS_SIZE) strings.add(line);
  if (strings.size !== CORPUS_SIZE) throw new Error(`the corpus holds ${strings.size} strings, not ${CORPUS_SIZE}`);
  return {
    strings: [...strings],
    from: `${fixtures.size} from the edit fixtures, ${worker.size} from the worker's word tests, ${demos.size} titles and call-outs of the demo edits${existsSync(media) ? "" : " (no .scratch/media here)"}, ${mixes.size} mixes, ${strings.size - before} everyday words and lines`,
  };
}

/** The first port from 3000 to 3005 that nothing on this machine holds. */
function freePort(): number {
  const held = (port: number) => {
    try {
      return execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" }).trim() !== "";
    } catch {
      return false; // lsof finds nothing and says so by failing
    }
  };
  for (let port = 3000; port <= 3005; port++) if (!held(port)) return port;
  throw new Error("no free port from 3000 to 3005");
}

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><body><script type="module">import { measureText } from "/layout-utils.mjs"; window.measureText = measureText;</script></body>`;
const FONT_DIR = resolve("public/edit");
const LAYOUT_UTILS = resolve("node_modules/@remotion/layout-utils/dist/esm/index.mjs");

/** Serves the page, `@remotion/layout-utils` and the kit's fonts, on 127.0.0.1 only, while `work` runs. */
async function withPage<T>(work: (base: string) => Promise<T>): Promise<T> {
  const port = freePort();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const send = (type: string, body: Buffer | string) => response.writeHead(200, { "content-type": type }).end(body);
    if (path === "/") return send("text/html; charset=utf-8", PAGE);
    if (path === "/layout-utils.mjs") return send("text/javascript", readFileSync(LAYOUT_UTILS));
    const file = resolve(FONT_DIR, `.${path}`);
    if (path.startsWith("/fonts/") && file.startsWith(FONT_DIR + sep) && existsSync(file)) return send("font/ttf", readFileSync(file));
    response.writeHead(404).end();
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", done);
  });
  console.log(`serving the page at http://127.0.0.1:${port}, for this run`);
  try {
    return await work(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((done) => server.close(done));
  }
}

interface Job {
  text: string;
  font: FontId;
  weight: number;
  size: number;
  tracked: boolean;
  /** Measured as the kit measures, or drawn as the film draws, before X94 or now. */
  as: keyof typeof STYLES;
}

/** Each job's width as the browser's `measureText` gives it, with the job's settings. */
async function inBrowser(browser: Browser, base: string, jobs: Job[]): Promise<number[]> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base);
  await page.waitForFunction(() => typeof window.measureText === "function", undefined, { timeout: 30_000 });
  const fonts = Object.values(FONT_FILES).map(({ family, file, weight }) => ({ family, url: `${base}/${file}`, weight }));
  await page.evaluate(async (faces) => {
    for (const { family, url, weight } of faces) {
      const face = new FontFace(family, await (await fetch(url)).arrayBuffer(), { weight });
      await face.load();
      document.fonts.add(face);
    }
  }, fonts);
  const given = jobs.map((job) => ({ text: job.text, family: FONT_FILES[job.font].family, weight: job.weight, size: job.size, spacing: job.tracked ? TRACKING.css : undefined, as: job.as }));
  const found = await page.evaluate(
    ({ given, styles }) =>
      given.map((job) => {
        const measured = window.measureText;
        if (!measured) throw new Error("measureText is not on the page");
        return measured({ text: job.text, fontFamily: job.family, fontWeight: job.weight, fontSize: job.size, letterSpacing: job.spacing, validateFontIsLoaded: true, additionalStyles: styles[job.as] }).width;
      }),
    { given, styles: STYLES },
  );
  await page.close();
  if (errors.length > 0) throw new Error(`the page reported: ${errors.join(" | ")}`);
  return found;
}

const shown = (job: Job) => `${JSON.stringify(job.text)} ${job.font} ${job.weight} at ${job.size}${job.tracked ? " tracked" : ""}`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;

async function main(): Promise<void> {
  const { strings: all, from } = corpus();
  console.log(`${all.length} strings: ${from}`);
  // Left out by rule: a string with a character some table lacks has no table width to compare (measure gives null).
  const tabled = new Set(shared());
  const untabled = (text: string) => [...new Set([...text.normalize("NFC")].filter((character) => !tabled.has(character)))];
  const left = all.filter((text) => untabled(text).length > 0);
  const strings = all.filter((text) => untabled(text).length === 0);
  console.log(`left out, ${left.length} of ${all.length}: a character the tables do not hold, so no table width to compare${left.length > 0 ? `: ${left.map((text) => `${JSON.stringify(text)} (${untabled(text).join(" ")})`).join(", ")}` : ""}`);
  const fonts = Object.keys(FONT_FILES) as FontId[];
  const held: Job[] = SIZES.flatMap((size) =>
    strings.flatMap((text) => fonts.flatMap((font) => MEASURED_WEIGHTS[font].flatMap((weight) => [false, true].map((tracked) => ({ text, font, weight, size, tracked, as: "measured" as const }))))),
  );
  const drawn: Job[] = (["before", "drawn"] as const).flatMap((as) => SUBSTITUTED.flatMap((text) => fonts.map((font) => ({ text, font, weight: 800, size: SIZE, tracked: false, as }))));
  const jobs = [...held, ...drawn];

  let over = 0;
  const drawnIn: Record<string, number[]> = {};
  if (out) writeFileSync(out, "");
  await withPage(async (base) => {
    for (const engine of asked) {
      const launch = BROWSERS[engine];
      if (!launch) throw new Error(`unknown browser: ${engine}. Known: ${Object.keys(BROWSERS).join(", ")}`);
      const browser = await launch();
      let found: number[];
      try {
        found = await inBrowser(browser, base, jobs);
      } finally {
        await browser.close();
      }
      drawnIn[engine] = found.slice(held.length);
      const apart = held.map((job, i) => {
        const browserWidth = found[i] ?? Number.NaN;
        const ours = measure(job.text, job.font, job.weight, job.size, job.tracked ? TRACKING.em : 0);
        return { job, browserWidth, ours, apart: ours === null ? Number.POSITIVE_INFINITY : browserWidth - ours };
      });
      if (out) for (const each of apart) if (!(Math.abs(each.apart) <= NEAR)) appendFileSync(out, `${JSON.stringify({ browser: engine, ...each.job, browserWidth: each.browserWidth, table: each.ours })}\n`);
      const outside = apart.filter((each) => !(Math.abs(each.apart) <= ALLOWED));
      over += outside.length;
      const worst = [...apart].sort((a, b) => Math.abs(b.apart) - Math.abs(a.apart));
      const near = apart.filter((each) => Math.abs(each.apart) > NEAR).length;
      const failing = new Set(outside.map((each) => each.job.text));
      console.log(`\n${engine}: ${apart.length} widths at ${SIZES.join(", ")} px; at worst ${Math.abs(worst[0]?.apart ?? 0).toFixed(4)} px apart; ${near} more than ${NEAR} px apart; ${outside.length} more than ${ALLOWED} px apart`);
      console.log(`${engine}: ${strings.length - failing.size} of ${strings.length} strings within ${ALLOWED} px in every typeface, weight, tracking and size`);
      const perSize = SIZES.map((size) => `${size} px ${Math.max(...apart.filter((each) => each.job.size === size).map((each) => Math.abs(each.apart))).toFixed(4)}`);
      console.log(`${engine}: at worst, by size: ${perSize.join("; ")}`);
      console.log(`${engine}: the worst five (browser − table):`);
      for (const each of worst.slice(0, 5)) console.log(`  ${shown(each.job)}: browser ${each.browserWidth.toFixed(4)}, table ${each.ours === null ? "null" : each.ours.toFixed(4)}, ${signed(each.apart)} px`);
      for (const each of outside.slice(0, 20)) console.log(`  over the limit: ${shown(each.job)}: browser ${each.browserWidth.toFixed(4)}, table ${each.ours === null ? "null" : each.ours.toFixed(4)}`);
    }
  });

  // The kit's own two browsers: the strings the typefaces swapped glyphs in, drawn (kerned) as the film drew them before X94 and as it draws them now.
  let split = 0;
  const [one, two] = asked;
  if (one && two) {
    console.log(`\nthe film's letters, drawn at ${SIZE} px, weight 800: ${one} − ${two}, before X94 → now`);
    for (let i = 0; i < drawn.length / 2; i++) {
      const [before, now] = [i, i + drawn.length / 2];
      const job = drawn[i];
      const gap = (at: number) => (drawnIn[one]?.[at] ?? Number.NaN) - (drawnIn[two]?.[at] ?? Number.NaN);
      if (!job) continue;
      if (!(Math.abs(gap(now)) <= ALLOWED)) split++;
      console.log(`  ${JSON.stringify(job.text)} ${job.font}: ${signed(gap(before))} → ${signed(gap(now))} px`);
    }
  }
  if (over > 0) throw new Error(`${over} widths are more than ${ALLOWED} px from the browser's`);
  if (split > 0) throw new Error(`${split} of the film's lines are drawn more than ${ALLOWED} px apart in ${one} and ${two}`);
  console.log(`\nthe table measures as the browser does: every width within ${ALLOWED} px, in ${asked.join(" and ")}${one && two ? `, and the film draws those lines alike in both` : ""}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
