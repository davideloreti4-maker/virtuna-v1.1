/**
 * edit-style-truth.ts — part 3's ground truth for styles (Task 9, remade in Task 9b, X101): six films made from the owner's take
 * with known style profiles, each analysed as a reference (its text measured by the worker), its style read from the measures
 * and its sheet judged by Qwen, and the style read back compared with the one it was made from, against the gates on what a
 * viewer sees (`GATES`).
 *
 * One film at a time (the disk is small), from the worktree root:
 *   pnpm exec tsx scripts/edit-style-truth.ts make                 the six edits (.scratch/media/style-truth-<n>.json) and their targets
 *   pnpm exec tsx scripts/edit-style-truth.ts render <n>           film n, rendered on this Mac into .scratch/media/style-truth-<n>.mp4
 *   modal volume put edit-dev-media .scratch/media/style-truth-<n>.mp4 style-truth-<n>.mp4
 *   modal run worker/dev.py::analyse_demo --name style-truth-<n>.mp4 --reference --out .scratch/task9b/analysis-<n>.json
 *   pnpm exec tsx scripts/edit-style-truth.ts read <n>             its sheet drawn and judged (one call to Qwen), its result written
 *   pnpm exec tsx scripts/edit-style-truth.ts table                the six against the gates
 *
 * The sheet is the reference as one shot, captions off, the natural look (spec §12.2, step 3), its frames drawn by the kit on
 * this Mac and put together by the worker's own `sheet_of` (worker/store.py), as `/stills` does with a sheet. The owner's take
 * and its analysis are read from .scratch/ (git-ignored): `.scratch/media/take.mp4` and Task 8's
 * `.scratch/task8/take-analysis.json`. Everything written goes to .scratch/. `read` loads `.env.local` itself (Qwen's key)
 * and prints no value of it, nor the words on the frames (the owner's take's own).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TakeAnalysisSchema, newEdit, type Analyses, type Asset, type Edit, type Op } from "../src/lib/edit";
import { applyOps } from "../src/lib/edit/ops";
import { punchIns, tighten } from "../src/lib/edit/recipes";
import { judgeSheet, matchOf, measuresOf, profileOf, seenOf, sheetFrames, styleOfReference, textOf, type Judgement, type Profile, type StyleProfile, type TextRead } from "../src/lib/edit/style";
import { distance } from "../src/lib/edit/style/text";
import { FPS } from "../src/lib/edit/time";
import { withRenderer } from "./edit-render";

const DIR = ".scratch/task9b";
const MEDIA = ".scratch/media";
const TAKE_ANALYSIS = ".scratch/task8/take-analysis.json";
/** Copies of the take, one after another: three make a film of 34 to 36 s at every pause here. */
const COPIES = 3;

/** The six profiles: four caption looks at three heights, the three fonts, a title or none, three looks (film 6 mono), punch-ins at 6 and 12 a minute. */
const TRUTH: Omit<StyleProfile, "source" | "notMatched">[] = [
  {
    pace: { pauseMs: 200, cutsPerMin: null },
    captions: { on: true, look: "pill", font: "tiktok", size: 72, y: 0.8, maxWords: 3, highlight: "#ffe14a" },
    title: { on: true, y: 0.16, frames: 60, look: "bold", size: 120 },
    punchIns: null,
    look: { preset: "natural" },
  },
  {
    pace: { pauseMs: 300, cutsPerMin: null },
    captions: { on: true, look: "highlight", font: "montserrat", size: 80, y: 0.62, maxWords: 2, highlight: "#ffe14a" },
    title: null,
    punchIns: { perMin: 6, zoom: 1.2 },
    look: { preset: "natural" },
  },
  {
    pace: { pauseMs: 150, cutsPerMin: null },
    captions: { on: true, look: "pop", font: "inter", size: 76, y: 0.3, maxWords: 3, highlight: "#4ade80" },
    title: { on: true, y: 0.14, frames: 90, look: "label", size: 110 },
    punchIns: { perMin: 12, zoom: 1.25 },
    look: { preset: "warm" },
  },
  {
    pace: { pauseMs: 250, cutsPerMin: null },
    captions: { on: true, look: "highlight", font: "tiktok", size: 72, y: 0.8, maxWords: 3, highlight: "#4ade80" },
    title: { on: true, y: 0.2, frames: 75, look: "outline", size: 130 },
    punchIns: null,
    look: { preset: "warm" },
  },
  {
    pace: { pauseMs: 180, cutsPerMin: null },
    captions: { on: true, look: "pop", font: "montserrat", size: 84, y: 0.62, maxWords: 4, highlight: "#ffe14a" },
    title: null,
    punchIns: { perMin: 6, zoom: 1.25 },
    look: { preset: "warm" },
  },
  {
    pace: { pauseMs: 350, cutsPerMin: null },
    captions: { on: true, look: "pill", font: "inter", size: 70, y: 0.3, maxWords: 2, highlight: "#ffe14a" },
    title: null,
    punchIns: { perMin: 12, zoom: 1.2 },
    look: { preset: "mono" },
  },
];
/** A made-up hook for the titled films. */
const HOOK = "Three things nobody tells you";

/**
 * The gates (Task 9b's brief), on what a viewer sees: the pace's quiet share within 20 % of the film's own (X104, round 2), on
 * at least 5 of 6 (the pause in ms is recorded beside it); the captions' place within 0.02, their size within
 * 12 %, their look right, their highlight none where none and else within RGB distance 48, their words a page right or one
 * less, their font right in at least 5 of 6; a title there or not, right in 6 of 6, and where there its length within 0.5 s,
 * its place within 0.03, its size within 15 % and its look right; punch-ins there or not, right in 6 of 6 (their rate is
 * recorded); film 6 read mono, and no other film.
 */
const GATES = { quiet: 0.2, quietFilms: 5, captionY: 0.02, captionSize: 0.12, highlight: 48, fonts: 5, titleFrames: 15, titleY: 0.03, titleSize: 0.15 } as const;

/** The owner's take: its file in the edit, and its analysis. */
function theTake(): { asset: Asset; analyses: Analyses } {
  const found = JSON.parse(readFileSync(TAKE_ANALYSIS, "utf8")) as { ms: number; facts: { full: { w: number; h: number; sound: boolean } }; words: Extract<Asset, { kind: "video" }>["words"] };
  const asset: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "dev/take.mp4" }, ms: found.ms, w: found.facts.full.w, h: found.facts.full.h, sound: found.facts.full.sound, words: found.words };
  return { asset, analyses: { take: TakeAnalysisSchema.parse(found) } };
}

function through(edit: Edit, ops: Op[], library: readonly Asset[]): Edit {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, library);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
}

/** The take `COPIES` times, each copy split at its pauses between words, so the recipes have cuts to work at. */
function copies(asset: Asset, analyses: Analyses): Edit {
  if (asset.kind !== "video") throw new Error("the take is not a video");
  const edit = newEdit(asset);
  const inner = analyses.take!.pauses.filter((pause) => pause.startMs > 0 && pause.endMs < asset.ms);
  const ops: Op[] = [];
  let last = edit.shots[0]!.id;
  for (let k = 1; k <= COPIES; k++) {
    if (k > 1) {
      ops.push({ op: "shot.insert", after: last, shot: { id: `c${k}`, asset: asset.id, startMs: 0, endMs: asset.ms } });
      last = `c${k}`;
    }
    const copy = last;
    inner.forEach((pause, j) => {
      ops.push({ op: "shot.split", id: last, atMs: pause.cutMs, newId: `${copy}-p${j + 1}` });
      last = `${copy}-p${j + 1}`;
    });
  }
  return through(edit, ops, [asset]);
}

function make(): void {
  const { asset, analyses } = theTake();
  mkdirSync(DIR, { recursive: true });
  const library = [asset];
  const targets = TRUTH.map((truth, i) => {
    const n = i + 1;
    let edit = copies(asset, analyses);
    edit = through(edit, tighten(edit, analyses, { pauseMs: truth.pace.pauseMs }), library);
    if (truth.punchIns) edit = through(edit, punchIns(edit, analyses, truth.punchIns), library);
    const ops: Op[] = [{ op: "captions.set", ...truth.captions }, { op: "look.set", preset: truth.look.preset }];
    if (truth.title) {
      const { y, frames, look, size } = truth.title;
      ops.push({ op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames, props: { text: HOOK, font: "tiktok", look, y, size, color: "#ffffff", accent: null } } });
    }
    edit = through(edit, ops, library);
    writeFileSync(join(MEDIA, `style-truth-${n}.json`), JSON.stringify({ edit, files: { take: "take.mp4" } }));
    const made = profileOf(edit, analyses);
    console.log(`film ${n}: ${edit.shots.length} shots, ${(made.pace.cutsPerMin ?? 0).toFixed(1)} cuts a minute, made ${JSON.stringify(made)}`);
    return { n, truth, made };
  });
  writeFileSync(join(DIR, "targets.json"), JSON.stringify(targets, null, 1));
}

async function render(n: number): Promise<void> {
  const output = join(MEDIA, `style-truth-${n}.mp4`);
  await withRenderer(async ({ film }) => {
    const started = Date.now();
    const frames = await film(join(MEDIA, `style-truth-${n}.json`), output);
    console.log(`${output}: ${frames} frames (${(frames / FPS).toFixed(2)} s), rendered in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  });
}

/** The reference's frames drawn by the kit (one shot, captions off, natural) and put on one sheet by the worker's own code. */
async function sheetOfFilm(n: number, ms: number, size: { w: number; h: number }, frames: number[]): Promise<Buffer> {
  const reference: Asset = { id: "ref", kind: "video", origin: "uploaded", at: { bucket: "edit-media", path: "dev/ref.mp4" }, ms, ...size, sound: true, words: null };
  const edit = through(newEdit(reference), [{ op: "captions.set", on: false }, { op: "look.set", preset: "natural" }], [reference]);
  const demo = join(MEDIA, `style-truth-${n}-sheet.json`);
  writeFileSync(demo, JSON.stringify({ edit, files: { ref: `style-truth-${n}.mp4` } }));
  const folder = join(DIR, `sheet-${n}`);
  mkdirSync(folder, { recursive: true });
  await withRenderer(async ({ still }) => {
    for (const frame of frames) await still(demo, frame, join(folder, `${String(frame).padStart(4, "0")}.png`));
  });
  const pngs = frames.map((frame) => resolve(folder, `${String(frame).padStart(4, "0")}.png`));
  const compose = "import sys, pathlib, tempfile, store\nwith tempfile.TemporaryDirectory() as work:\n    sys.stdout.buffer.write(store.sheet_of([pathlib.Path(p).read_bytes() for p in sys.argv[1:]], pathlib.Path(work)))";
  return execFileSync("uv", ["run", "python", "-c", compose, ...pngs], { cwd: "worker", env: { ...process.env, PYTHONPATH: "." }, maxBuffer: 64 << 20 });
}

interface Gate {
  made: string;
  read: string;
  pass: boolean;
}
interface Result {
  n: number;
  measures: ReturnType<typeof measuresOf>;
  text: TextRead;
  judgement: Judgement | null;
  frames: number[];
  read: StyleProfile;
  made: Profile;
  gates: Record<string, Gate>;
  fields: ReturnType<typeof matchOf>["fields"];
  /** Each call's tokens, time and cost in cents (`calculateCost` counts in cents). */
  usage: { input: number; output: number; cents: number; ms: number }[];
}

const share = (read: number, made: number): string => `${read} (${(((read - made) / made) * 100).toFixed(1)} %)`;

/** The film's style read back against the one it was made from, gate by gate (`GATES`; the font's and the look's over the six in `table`). */
function gatesOf(n: number, made: Profile, style: StyleProfile): Record<string, Gate> {
  const [want, got] = [made.captions, style.captions];
  const on = got.on;
  const gates: Record<string, Gate> = {
    quiet: {
      made: String(made.pace.quiet ?? "none"), read: style.pace.quiet === undefined || style.pace.quiet === null ? "none" : share(style.pace.quiet, made.pace.quiet ?? 0),
      pass: made.pace.quiet != null && style.pace.quiet != null && Math.abs(style.pace.quiet - made.pace.quiet) <= GATES.quiet * made.pace.quiet + 1e-9,
    },
    pauseMs: { made: `${made.pace.pauseMs} ms`, read: `${style.pace.pauseMs} ms`, pass: true }, // recorded, not gated (X104)
    captionY: { made: String(want.y), read: on ? String(got.y) : "off", pass: on && Math.abs(got.y - want.y) <= GATES.captionY + 1e-9 },
    captionSize: { made: `${want.size}`, read: on ? share(got.size, want.size) : "off", pass: on && Math.abs(got.size - want.size) <= GATES.captionSize * want.size },
    captionLook: { made: want.look, read: on ? got.look : "off", pass: on && got.look === want.look },
    captionHighlight: {
      made: want.highlight ?? "none", read: on ? (got.highlight ?? "none") : "off",
      pass: on && (want.highlight === null ? got.highlight === null : got.highlight !== null && distance(got.highlight, want.highlight) <= GATES.highlight),
    },
    captionWords: { made: String(want.maxWords), read: on ? String(got.maxWords) : "off", pass: on && (got.maxWords === want.maxWords || got.maxWords === want.maxWords - 1) },
    captionFont: { made: want.font, read: on ? got.font : "off", pass: on && got.font === want.font },
    title: { made: made.title?.on ? "there" : "none", read: style.title?.on ? "there" : "none", pass: Boolean(made.title?.on) === Boolean(style.title?.on) },
    punchIns: {
      made: made.punchIns ? `${made.punchIns.perMin}/min ×${made.punchIns.zoom}` : "none", read: style.punchIns ? `${style.punchIns.perMin}/min ×${style.punchIns.zoom}` : "none",
      pass: (made.punchIns === null) === (style.punchIns === null),
    },
    look: { made: made.look.preset, read: style.look.preset, pass: n === 6 ? style.look.preset === "mono" : style.look.preset !== "mono" },
  };
  if (made.title?.on && style.title?.on) {
    const [a, b] = [made.title, style.title];
    gates.titleLength = { made: `${(a.frames / FPS).toFixed(2)} s`, read: `${(b.frames / FPS).toFixed(2)} s`, pass: Math.abs(b.frames - a.frames) <= GATES.titleFrames };
    gates.titleY = { made: String(a.y), read: String(b.y), pass: Math.abs(b.y - a.y) <= GATES.titleY + 1e-9 };
    gates.titleSize = { made: String(a.size), read: share(b.size, a.size), pass: Math.abs(b.size - a.size) <= GATES.titleSize * a.size };
    gates.titleLook = { made: a.look, read: b.look, pass: b.look === a.look };
  }
  return gates;
}

async function read(n: number): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { calculateCost } = await import("../src/lib/engine/qwen/cost");
  const { QWEN_REASONING_MODEL } = await import("../src/lib/engine/qwen/client");
  const found = JSON.parse(readFileSync(join(DIR, `analysis-${n}.json`), "utf8")) as { ms: number; facts: { source: { w: number; h: number } } };
  const analysis = TakeAnalysisSchema.parse(found);
  const measures = measuresOf(analysis, found.ms);
  const text = textOf(analysis, found.ms);
  const frames = sheetFrames(analysis, found.ms);
  // The sheet is drawn once: its frames follow from the analysis alone, so a second judgement reuses it.
  const drawn = join(DIR, `sheet-${n}.jpg`);
  const sheet = existsSync(drawn) ? readFileSync(drawn) : await sheetOfFilm(n, found.ms, { w: found.facts.source.w, h: found.facts.source.h }, frames);
  writeFileSync(drawn, sheet);
  const usage: Result["usage"] = [];
  const answers: string[] = [];
  const judgement = await judgeSheet(sheet.toString("base64"), frames, seenOf(analysis, found.ms), async (messages, opts) => {
    const asked = await askQwen(messages, opts);
    answers.push(asked.text);
    usage.push({ ...asked.usage, ms: asked.ms, cents: calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: asked.usage.input, completion_tokens: asked.usage.output }) });
    return asked;
  });
  const style = styleOfReference(measures, text, judgement, `truth ${n}`);
  const targets = JSON.parse(readFileSync(join(DIR, "targets.json"), "utf8")) as { n: number; made: Profile }[];
  const made = targets.find((target) => target.n === n)!.made;
  const { analyses } = theTake();
  const edit = (JSON.parse(readFileSync(join(MEDIA, `style-truth-${n}.json`), "utf8")) as { edit: Edit }).edit;
  const result: Result = { n, measures, text, judgement, frames, read: style, made, gates: gatesOf(n, made, style), fields: matchOf(style, edit, analyses).fields, usage };
  // The answers and the title's text hold no words of the owner's take, but the sheet's captions do: they stay in .scratch/.
  writeFileSync(join(DIR, `result-${n}.json`), JSON.stringify({ ...result, answers }, null, 1));
  const { title, ...captionsRead } = text;
  console.log(JSON.stringify({ n, gates: result.gates, measures, captions: captionsRead.captions, title: title && { ...title, text: undefined }, judgement, notMatched: style.notMatched, usage }, null, 1));
}

function table(): void {
  const results = [1, 2, 3, 4, 5, 6].filter((n) => existsSync(join(DIR, `result-${n}.json`))).map((n) => JSON.parse(readFileSync(join(DIR, `result-${n}.json`), "utf8")) as Result);
  const names = ["quiet", "pauseMs", "captionY", "captionSize", "captionLook", "captionHighlight", "captionWords", "captionFont", "title", "titleLength", "titleY", "titleSize", "titleLook", "punchIns", "look"];
  const cell = (gate: Gate | undefined) => (gate ? `${gate.made} → ${gate.read} ${gate.pass ? "ok" : "**MISS**"}` : "–");
  console.log(`| film | ${names.join(" | ")} | extras judged |`);
  console.log(`|---|${names.map(() => "---").join("|")}|---|`);
  for (const result of results) console.log(`| ${result.n} | ${names.map((name) => cell(result.gates[name])).join(" | ")} | ${result.judgement ? result.judgement.extras.map((extra) => extra.kind).join(", ") || "none" : "no judgement"} |`);
  const counts = names.map((name) => {
    const judged = results.filter((result) => result.gates[name]);
    return `${name} ${judged.filter((result) => result.gates[name]!.pass).length}/${judged.length}`;
  });
  console.log(`\n${counts.join(", ")}`);
  const fonts = results.filter((result) => result.gates.captionFont?.pass).length;
  const quiet = results.filter((result) => result.gates.quiet?.pass).length;
  const counted = new Set(["captionFont", "quiet", "pauseMs"]);
  console.log(`font gate (at least ${GATES.fonts} of 6): ${fonts >= GATES.fonts ? "pass" : "FAIL"}; quiet gate (at least ${GATES.quietFilms} of 6): ${quiet >= GATES.quietFilms ? "pass" : "FAIL"}; every other gate on every film: ${results.every((result) => Object.entries(result.gates).every(([name, gate]) => counted.has(name) || gate.pass)) ? "pass" : "FAIL"}`);
  const usage = results.flatMap((result) => result.usage);
  console.log(`Qwen: ${usage.length} calls, ${usage.reduce((sum, each) => sum + each.input, 0)} in, ${usage.reduce((sum, each) => sum + each.output, 0)} out, $${(usage.reduce((sum, each) => sum + each.cents, 0) / 100).toFixed(5)}`);
}

async function main(): Promise<void> {
  const [step, which] = process.argv.slice(2);
  const n = Number(which);
  if (step === "make") return make();
  if (step === "table") return table();
  if ((step === "render" || step === "read") && n >= 1 && n <= TRUTH.length) return step === "render" ? render(n) : read(n);
  throw new Error("usage: edit-style-truth.ts make | render <n> | read <n> | table");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
