/**
 * edit-agent-proof.ts — part 3 Task 14's proof: the agent's `change` (src/lib/edit/agent/loop.ts) and `firstCut`
 * (first-cut.ts) with their real boundaries, Qwen (`askQwen`) and the worker's stills (`stillsOf`), on one of the creator's ready
 * takes, measured as rates: every request and every first cut is run several times, because Qwen does not answer the same twice.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts first-cut [--style none|preset:<id>|profile:<file>] [--runs <n>] [--name <name>]
 *                                                       [--out <dir>] [--render]
 *     The first cut of the take, <n> times (1 unless told): `<out>/<name>-<k>.json` holds the edit, the say, Qwen's choices, the
 *     rounds, the findings, the match, the time and the cost. With --render, the film on this Mac (`<name>-<k>.mp4`, from the
 *     take's full copy in .scratch/media/) and its sheet of twelve frames, four across, 540 by 960 a cell (`<name>-<k>-sheet.jpg`).
 *     A profile file is a `StyleProfile`, or `{style}` as edit-reference-proof.ts keeps a reference's.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts requests [--tag <tag>] [--base <first cut's json>] [--runs <n>] [--thinking on|off]
 *                                                      [--tokens <n>] [--no-stills] [--force] [<request id>…]
 *     Each request of src/lib/edit/agent/requests.json (or those named), <n> times (3 unless told), each on the same first cut
 *     (`--base`, by default .scratch/task14/first-cut/house-1.json; with a request's `setup` put on it first). For each run,
 *     `<out>/<tag>/<id>-<k>.json`: the rounds (what became of each, its ops, the door's problems, the review's errors, its time,
 *     the model's and the stills' times, its tokens), the whole (ms, tokens, cents, changed, say, ops), the edit, the errors and
 *     warnings left, and the facts a judge needs (each text added or changed: its size, place, colour, typeface and seconds on
 *     screen). The stills the loop drew are kept as `<id>-<k>-seen-<frame>.jpg`. A run already there is not made again (--force).
 *     --thinking and --tokens stand in for `AGENT_LIMITS`' own (X88's measure).
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts sheets [--tag <tag>] [--frames <f,f,f>] [<request id>…]
 *     One sheet a request, for the judge: a row a run, the first cut's frame then up to three frames of the run's edit (the
 *     moments of what it changed, or three across the film, or the frames named), drawn on this Mac at a third of the stage;
 *     and `<id>.txt`, each run's say, ops and facts. Renders one frame at a time.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts summary [--tag <tag>]
 *     The gate table from the runs and the judge's verdicts (`<out>/<tag>/judged.json`: {"<id>": {"<k>": {"asked": bool,
 *     "looks": bool, "why": string}}}): per request and overall, how many runs ended valid and did what was asked, how many look
 *     right, the median seconds without and with stills, and the cents; and of the says, how many name a word of the kit the
 *     creator did not use (`kitTerms`), run to a second sentence or hold a number the request did not.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts words "<phrase>"…
 *     A first cut of the take in each phrase's style through the app's own route (`POST /api/edit/agent`, on a dev server of this
 *     script's own, signed in as the e2e test account): `<out>/words/<n>.json` holds the status, the seconds, the cost, what was
 *     said of the style, the style, the match and the say.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts extra-upload --file <name in .scratch/media> [--name <the take's name>]
 *     Another take, through the app's own routes as the e2e test account: signed for (`POST /api/edit/takes`), put into R2,
 *     said uploaded, and watched until the worker has analysed it. Its ids go to `<out>/extra/ids.json`, for --ids.
 *   pnpm exec tsx scripts/edit-agent-proof.ts extra-delete
 *     That take taken away again: its files in R2 and its rows (its jobs go with its row), then both read to be gone.
 *   pnpm exec tsx scripts/edit-agent-proof.ts extra-left
 *     What the e2e test account holds, counted and with no id: its take rows, its job rows, and its files in R2 by folder.
 *   pnpm exec tsx scripts/edit-agent-proof.ts examples [--base <first cut's json>]
 *     The prompt's quoted examples held against the take's own words (on this Mac only): how many are one of its words or hold
 *     two of them in a row, by the example's number. And every string of requests.json (requests, notes, its own account):
 *     whether it holds a word of the take of four letters or more other than the two it names, or three of the take's words in
 *     a row, by where. Fails (exit 1) on any of them. The same of src/lib/edit/agent/moments.json, whose only words of the
 *     take may be the pointing words it allows.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts moments [--tag <tag>] [--base <first cut's json>] [--runs <n>] [--calls <n>]
 *                                                     [--short-block] [--force] [<id>…]
 *     The moment's proof (slice B, Task 4): each request of src/lib/edit/agent/moments.json (or those named) <n> times (3), run
 *     one round of all of them after another, on the first cut `--base` (by default .scratch/native-default-2/first-cut/
 *     house-1.json), sent with its moment (`change({…, at})`). The frames are printed first, and nothing runs when one is not
 *     the file's. Each run is `<out>/<tag>/<id>-<k>.json` (out by default .scratch/editor/slice-b/proof): the frame, the verdict
 *     of `moment.ts` (`landed`, `stayedWhole`, `stayedPut`), who put each thing added where it is (the model, or code), the
 *     frames the verdict looked at, the calls, and the run as `requests` writes one. --calls (60) caps the model calls of the
 *     tag's folder: no run starts that could pass it, and runs not made are misses. At the end, per id and per group against
 *     its bar, the calls, the median seconds and the cents, also in `<out>/<tag>/summary.md`; again with every run there, only
 *     that. --short-block sends a request that does not point only the block's first line. --runs 0: the frames and the plan.
 *
 *   pnpm exec tsx scripts/edit-agent-proof.ts fixes [--tag <tag>] [--base <first cut's json>] [--runs <n>] [--calls <n>] [--force]
 *                                                   [<code or step>…]
 *     The fixes tried (slice B, Task 10): for each code of `FIX_CODES`, a setup made on the first cut `--base` (as `moments`) by
 *     ops through the door that carries that finding, and the fix `src/components/editor/fixes.ts` offers for it, sent <n> times
 *     (3) as the card sends it, with the finding's frame (`change({…, at})`); and the steps `src/lib/edit/next-steps.ts` offers
 *     after a zoom, on the base with a zoom made here by code at m01's moment ("Hold it longer" also at m04's, `STEP_ZOOMS`). A
 *     setup that does not carry its finding is not tried (its fix stays "Show"). A fix clears when the change was taken and the edit
 *     it made has no finding of its code about the same thing (also `findingKey`'s measure); "Zoom less" lands when the zoom
 *     goes down, "Hold it longer" when more frames are tighter than the base. Each run is `<out>/<tag>/<id>-<k>.json` (out by
 *     default .scratch/editor/slice-b/proof); --calls (110) caps the model calls as in `moments`. At the end, per fix and step
 *     cleared of <n>, kept (2 of 3) or not, the calls and the cents, also in `summary.md`. --runs 0: each setup's finding and
 *     what is sent, and no call.
 *
 * Everywhere: --ids <file> ({"user", "takes": [...]}, by default .scratch/stills-proof/ids.json), --take <index> (0), --out <dir>
 * (.scratch/task14), --take-file <name in .scratch/media> (the take's full copy, for the frames drawn here).
 * It loads `.env.local` itself and prints no value of it; the creator's and the take's ids are written as <user> and <take>, in
 * what it prints and in what it writes. It reads the take's row and writes nothing anywhere but the output folder. A change is one
 * to four calls to Qwen (three rounds and one for the sentence alone) and, while the model's look is off, none to the worker; a
 * first cut one to seven.
 */
import * as nodeModule from "node:module";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, statfsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Analyses, Asset, Edit, Item, Mark, Op, TakeAnalysis } from "../src/lib/edit";
import type { AgentResult, Round, SayBy } from "../src/lib/edit/agent/loop";
import type { Ask, Message } from "../src/lib/edit/agent/model";
import type { Landing, Moment, Put, Whole } from "../src/lib/edit/agent/moment";
import type { Finding, FindingCode } from "../src/lib/edit/review";
import type { StyleProfile } from "../src/lib/edit/style/profile";
import type { stillsOf as StillsOf } from "../src/lib/edit/worker/stills";
import type { Database } from "../src/types/database.types";

type Hooks = { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown };

const REQUESTS = "src/lib/edit/agent/requests.json";
const FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
/** A film's sheet: this many frames, this many across, each this size. */
const SHEET = { frames: 12, across: 4, w: 540, h: 960 } as const;
/** A request's sheet: a row a run, the first cut's frame and up to three of the run's, each a third of the stage. */
const CELL = { w: 360, h: 640, across: 4 } as const;
/** The least free disk a render may start with (the rules: stop under 1.2 GB). */
const LEAST_FREE_BYTES = 1.2 * 1024 ** 3;
/** A new text on screen for less than this is too short to read (the proof's rubric). */
const READ_S = 0.8;

const RequestSchema = z.strictObject({
  id: z.string().regex(/^r\d\d$/),
  request: z.string().min(1).max(500),
  start: z.literal("first-cut"),
  setup: z.enum(["callout-on-mouth", "loose-ends"]).optional(),
  expect: z.enum(["done", "refused"]),
  note: z.string().optional(),
});
type Request = z.infer<typeof RequestSchema>;
const RequestsSchema = z.strictObject({ about: z.string(), takeWords: z.array(z.string().regex(/^\S+$/)).max(2), requests: z.array(RequestSchema) });

const MOMENTS = "src/lib/edit/agent/moments.json";
/** A moment of the take by a word's index (its middle, or ms before it starts or after it ends), or a share of the film. */
const AtSchema = z.union([
  z.strictObject({ in: z.number().int().min(0) }),
  z.strictObject({ before: z.number().int().min(0), ms: z.number().int().min(0) }),
  z.strictObject({ after: z.number().int().min(0), ms: z.number().int().min(0) }),
  z.strictObject({ film: z.number().min(0).lt(1) }),
]);
type At = z.infer<typeof AtSchema>;
/** `frame`: the film frame `at` gives on the proof's base; the mode stops when it computes another. */
const MomentRequestSchema = z.strictObject({
  id: z.string().regex(/^[mn]\d\d$/), request: z.string().min(1).max(500), at: AtSchema, lands: z.enum(["zoom", "cut", "starts", "word", "ends"]), frame: z.number().int().min(0),
});
/** A control: a request of requests.json (`of`) or its own; measured as staying whole (`whole`) or where it named (`put`). */
const ControlSchema = z
  .strictObject({
    id: z.string().regex(/^c\d\d$/), of: z.string().regex(/^r\d\d$/).optional(), request: z.string().min(1).max(500).optional(), at: AtSchema,
    whole: z.enum(["pauses", "look", "title-out", "faster"]).optional(), put: z.enum(["start", "end"]).optional(), frame: z.number().int().min(0),
  })
  .refine((each) => (each.of === undefined) !== (each.request === undefined) && (each.whole === undefined) !== (each.put === undefined), "a control has one of of and request, and one of whole and put");
const MomentsSchema = z.strictObject({ about: z.string(), allowed: z.array(z.string().regex(/^\S+$/)), moments: z.array(MomentRequestSchema), controls: z.array(ControlSchema) });

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** The command line: flags with a value (`--tag x`), flags alone (`--render`), and the rest in order. */
function argsOf(argv: string[], alone: readonly string[]): { flags: Record<string, string>; rest: string[] } {
  const flags: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) rest.push(arg);
    else if (alone.includes(arg)) flags[arg.slice(2)] = "true";
    else flags[arg.slice(2)] = argv[++i] ?? "";
  }
  return { flags, rest };
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const round1 = (value: number): number => Math.round(value * 10) / 10;
const cents4 = (value: number): number => Math.round(value * 10_000) / 10_000;

function freeDisk(): void {
  const stats = statfsSync(".");
  const free = stats.bavail * stats.bsize;
  if (free < LEAST_FREE_BYTES) throw new Error(`only ${(free / 1024 ** 3).toFixed(2)} GB free: under the 1.2 GB a render may start with`);
}

/* ── the take ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

interface Take {
  user: string;
  takeId: string;
  asset: Asset;
  analysis: TakeAnalysis;
  analyses: Analyses;
  /** Ids out: what is printed and written. */
  masked: (text: string) => string;
  /** Ids back in: an edit read from what was written. */
  unmasked: (text: string) => string;
  /** The take's full copy's name in .scratch/media/, for the frames drawn here. */
  file: string;
}

async function takeOf(flags: Record<string, string>): Promise<Take> {
  const ids = JSON.parse(readFileSync(flags.ids ?? ".scratch/stills-proof/ids.json", "utf8")) as { user: string; takes: string[] };
  const takeId = ids.takes[Number(flags.take ?? 0)];
  if (!ids.user || !takeId) throw new Error("the ids file holds no user or no such take");
  const { assetOf } = await import("../src/lib/edit/worker/takes");
  const { bucket } = await import("../src/lib/edit/worker/r2");
  const { analysisOf } = await import("../src/lib/edit/analysis");
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: row, error } = await service.from("edit_takes").select("*").eq("id", takeId).eq("user_id", ids.user).single();
  if (error) throw new Error(`the take could not be read: ${error.message}`);
  const asset = assetOf(row, bucket());
  const analysis = analysisOf(row);
  return {
    user: ids.user, takeId, asset, analysis, analyses: { [asset.id]: analysis },
    masked: (text) => text.replaceAll(ids.user, "<user>").replaceAll(takeId, "<take>"),
    unmasked: (text) => text.replaceAll("<user>", ids.user).replaceAll("<take>", takeId),
    file: flags["take-file"] ?? "task6-full.mp4",
  };
}

/** Qwen, with every answer kept; `thinking` and `tokens` stand in for the loop's own when given. */
function asking(askQwen: Ask, over: { thinking?: boolean; tokens?: number }) {
  const answers: { text: string; usage: { input: number; output: number }; ms: number; truncated: boolean }[] = [];
  const ask: Ask = async (messages, opts) => {
    const asked = await askQwen(messages, { ...opts, thinking: over.thinking ?? opts.thinking, maxTokens: over.tokens ?? opts.maxTokens });
    answers.push({ text: asked.text, usage: asked.usage, ms: asked.ms, truncated: asked.truncated === true });
    return asked;
  };
  return { ask, answers };
}

/* ── what a judge needs of a run ──────────────────────────────────────────────────────────────────────────────────────── */

interface TextFact {
  id: string;
  part: "title" | "callout";
  what: "added" | "changed";
  text: string;
  look: string;
  font: string;
  size: number;
  color: string;
  x: number | null;
  y: number;
  /** The first film frame it shows on, and how long, in seconds. */
  at: number;
  seconds: number;
  /** In the captions' typeface; in the captions' highlight colour or white. */
  captionsFont: boolean;
  captionsColour: boolean;
}

interface Facts {
  film: { before: number; after: number };
  shots: { before: number; after: number };
  /** Each caption setting the run changed, before and after. */
  captions: Record<string, [unknown, unknown]>;
  look: [string, string] | null;
  texts: TextFact[];
  removed: string[];
  /** Texts on screen under `READ_S`. */
  short: string[];
  errorsLeft: string[];
  /** Errors the first cut did not have. */
  newErrors: string[];
  /** Warnings the first cut did not have. */
  newWarnings: string[];
}

async function factsOf(before: Edit, after: Edit, analyses: Analyses): Promise<Facts> {
  const { layout, placed } = await import("../src/lib/edit/derive");
  const { review } = await import("../src/lib/edit/review");
  const { FPS } = await import("../src/lib/edit/time");
  const things = (edit: Edit) => new Map<string, Mark | Item>([...edit.shots.flatMap((shot) => shot.marks), ...edit.items].map((thing) => [thing.id, thing]));
  const [was, is] = [things(before), things(after)];
  const shown = new Map(placed(after).map((place) => [place.thing.id, place]));
  const texts: TextFact[] = [];
  for (const [id, thing] of is) {
    if (thing.part !== "title" && thing.part !== "callout") continue;
    const old = was.get(id);
    if (old && JSON.stringify(old) === JSON.stringify(thing)) continue;
    const place = shown.get(id);
    const colours = [after.captions.highlight, "#ffffff"].filter((colour) => colour !== null).map((colour) => colour.toLowerCase());
    texts.push({
      id, part: thing.part, what: old ? "changed" : "added", text: thing.props.text, look: thing.props.look, font: thing.props.font, size: thing.props.size,
      color: thing.props.color, x: thing.part === "callout" ? thing.props.x : null, y: thing.props.y,
      at: place?.at ?? -1, seconds: place ? Math.round((place.frames / FPS) * 100) / 100 : 0,
      captionsFont: thing.props.font === after.captions.font,
      captionsColour: colours.includes(thing.props.color.toLowerCase()) || (thing.part === "title" && thing.props.accent !== null && colours.includes(thing.props.accent.toLowerCase())),
    });
  }
  const captions: Facts["captions"] = {};
  for (const key of Object.keys(after.captions) as (keyof Edit["captions"])[]) if (before.captions[key] !== after.captions[key]) captions[key] = [before.captions[key], after.captions[key]];
  const line = (finding: Finding) => `${finding.code}: ${finding.says}`;
  const [old, now] = [review(before, analyses), review(after, analyses)];
  const had = new Set(old.map((finding) => `${finding.severity} ${finding.code} ${finding.where.mark ?? ""} ${finding.where.item ?? ""}`));
  const fresh = now.filter((finding) => !had.has(`${finding.severity} ${finding.code} ${finding.where.mark ?? ""} ${finding.where.item ?? ""}`));
  return {
    film: { before: layout(before).frames, after: layout(after).frames },
    shots: { before: before.shots.length, after: after.shots.length },
    captions,
    look: before.look.preset === after.look.preset ? null : [before.look.preset, after.look.preset],
    texts,
    removed: [...was.keys()].filter((id) => !is.has(id)),
    short: texts.filter((text) => text.seconds < READ_S).map((text) => `${text.part} "${text.text}" ${text.seconds} s`),
    errorsLeft: now.filter((finding) => finding.severity === "error").map(line),
    newErrors: fresh.filter((finding) => finding.severity === "error").map(line),
    newWarnings: fresh.filter((finding) => finding.severity === "warn").map(line),
  };
}

/* ── frames drawn on this Mac ─────────────────────────────────────────────────────────────────────────────────────────── */

/** An edit as a demo the renderer reads: the ids made plain ones, the take's file its full copy in .scratch/media/. */
function demoOf(take: Take, edit: Edit, path: string): string {
  const film = JSON.parse(JSON.stringify(edit).replaceAll(take.takeId, "take").replaceAll(take.user, "owner")) as Edit;
  writeFileSync(path, JSON.stringify({ edit: film, files: { take: take.file } }));
  return path;
}

/** One picture with a line of text over its top, scaled to a cell. */
function cell(input: string | null, label: string, output: string, work: string): void {
  const text = join(work, "label.txt");
  writeFileSync(text, label);
  const draw = `drawtext=fontfile=${FONT}:textfile=${text}:x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=5`;
  const source = input ? ["-i", input] : ["-f", "lavfi", "-i", `color=c=0x202020:s=${CELL.w}x${CELL.h}`];
  // One pixel format for every cell: the tile starts over when a frame's format differs from the one before.
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", ...source, "-frames:v", "1", "-vf", `scale=${CELL.w}:${CELL.h},${draw},format=yuvj420p`, "-q:v", "3", output]);
}

/** Cells named cell-000.jpg… in `work`, tiled `across` wide into one JPEG. */
function tile(work: string, count: number, across: number, output: string): void {
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-start_number", "0", "-i", join(work, "cell-%03d.jpg"), "-vf", `tile=${across}x${Math.ceil(count / across)}`, "-frames:v", "1", "-q:v", "3", output]);
}

/** A film's sheet: the middle frame of each twelfth, four across. */
function filmSheet(video: string, frames: number, output: string): number[] {
  const picked = Array.from({ length: SHEET.frames }, (_, i) => Math.floor(((i + 0.5) * frames) / SHEET.frames));
  const select = `select='${picked.map((frame) => `eq(n\\,${frame})`).join("+")}',scale=${SHEET.w}:${SHEET.h},tile=${SHEET.across}x${SHEET.frames / SHEET.across}`;
  execFileSync("ffmpeg", ["-nostdin", "-y", "-v", "error", "-i", video, "-vf", select, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", output]);
  return picked;
}

/* ── a first cut ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

async function styleOf(spec: string | undefined): Promise<{ style: StyleProfile | undefined; name: string }> {
  if (!spec || spec === "none") return { style: undefined, name: "house" };
  const { StyleProfileSchema } = await import("../src/lib/edit/style/profile");
  if (spec.startsWith("preset:")) {
    const { presetOf } = await import("../src/lib/edit/style/presets");
    const preset = presetOf(spec.slice("preset:".length));
    if (!preset) throw new Error(`there is no preset ${spec.slice("preset:".length)}`);
    return { style: preset.profile, name: preset.id };
  }
  if (spec.startsWith("profile:")) {
    const read = JSON.parse(readFileSync(spec.slice("profile:".length), "utf8")) as { style?: unknown };
    return { style: StyleProfileSchema.parse(read.style ?? read), name: "styled" };
  }
  throw new Error("--style is none, preset:<id> or profile:<file>");
}

async function firstCuts(flags: Record<string, string>): Promise<void> {
  const take = await takeOf(flags);
  const { AGENT_LIMITS } = await import("../src/lib/edit/agent/loop");
  const { firstCut } = await import("../src/lib/edit/agent/first-cut");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { stillsOf } = await import("../src/lib/edit/worker/stills");
  const { layout } = await import("../src/lib/edit/derive");
  const { withRenderer } = await import("./edit-render");
  const { style, name: styleName } = await styleOf(flags.style);
  const out = flags.out ?? ".scratch/task14/first-cut";
  const name = flags.name ?? styleName;
  const runs = Number(flags.runs ?? 1);
  mkdirSync(out, { recursive: true });
  const say = (line: unknown) => console.log(take.masked(JSON.stringify(line)));

  for (let k = 1; k <= runs; k++) {
    const file = join(out, `${name}-${k}.json`);
    if (existsSync(file) && !flags.force) {
      say({ firstCut: `${name}-${k}`, kept: "already there" });
      continue;
    }
    const { ask, answers } = asking(askQwen, {});
    const drawn: number[][] = [];
    const stills: typeof StillsOf = async (who, edit, frames, stopping) => {
      const got = await stillsOf(who, edit, frames, stopping);
      drawn.push([...frames]);
      return got;
    };
    const result = await firstCut({ asset: take.asset, analysis: take.analysis, user: take.user, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask, stills });
    const frames = layout(result.edit).frames;
    const errors = result.findings.filter((finding) => finding.severity === "error");
    const title = result.edit.items.find((item) => item.part === "title");
    const record = {
      name: `${name}-${k}`, style: style ?? null, takeMs: take.asset.kind === "video" ? take.asset.ms : null, ms: result.ms, cents: cents4(result.cost), tokens: result.tokens,
      rounds: result.rounds.map(roundOf), choices: result.choices, say: result.say, ops: result.ops.length, film: { frames, seconds: Math.round((frames / 30) * 100) / 100 },
      shots: result.edit.shots.length, punched: result.edit.shots.filter((shot) => shot.framing.from.zoom > 1).length, captions: result.edit.captions,
      title: title?.part === "title" ? { text: title.props.text, y: title.props.y, size: title.props.size, look: title.props.look, frames: title.frames } : null,
      look: result.edit.look.preset, errorsLeft: errors.map((finding) => `${finding.code}: ${finding.says}`),
      warnings: result.findings.filter((finding) => finding.severity === "warn").map((finding) => `${finding.code}: ${finding.says}`),
      match: result.match, stills: drawn, answers, edit: result.edit,
    };
    writeFileSync(file, take.masked(JSON.stringify(record, null, 1)));
    say({ firstCut: record.name, seconds: round1(result.ms / 1000), cents: record.cents, rounds: result.rounds.map((round) => round.outcome), film: record.film, shots: record.shots, punched: record.punched, captions: `${record.captions.look} ${record.captions.size}px y${record.captions.y} ${record.captions.maxWords}w`, title: record.title, look: record.look, errorsLeft: record.errorsLeft, warnings: record.warnings.length, match: result.match ? { matched: result.match.fields.filter((field) => field.verdict === "matched").length, near: result.match.fields.filter((field) => field.verdict === "near").length, not: result.match.fields.filter((field) => field.verdict === "not").map((field) => field.field), notMatched: result.match.notMatched.length } : null, say: result.say });

    if (flags.render) {
      freeDisk();
      const demo = demoOf(take, result.edit, join(out, `${name}-${k}-demo.json`));
      const video = join(out, `${name}-${k}.mp4`);
      const started = Date.now();
      try {
        await withRenderer(({ film }) => film(demo, video));
      } finally {
        rmSync(demo, { force: true });
      }
      const sheet = join(out, `${name}-${k}-sheet.jpg`);
      const picked = filmSheet(video, frames, sheet);
      say({ firstCut: record.name, rendered: video, seconds: round1((Date.now() - started) / 1000), sheet, frames: picked });
    }
  }
}

const roundOf = (round: Round) => ({
  n: round.n, outcome: round.outcome, ops: round.ops, refused: round.refused,
  errors: round.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} frame=${finding.where.frame} ${finding.says}`),
  stills: round.stills, ms: round.ms, askMs: round.askMs, stillsMs: round.stillsMs, tokens: round.tokens, error: round.error, stillsError: round.stillsError,
});

/* ── the requests ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

function requestsOf(only: string[]): Request[] {
  const all = RequestsSchema.parse(JSON.parse(readFileSync(REQUESTS, "utf8"))).requests;
  const unknown = only.filter((id) => !all.some((request) => request.id === id));
  if (unknown.length > 0) throw new Error(`${REQUESTS} has no ${unknown.join(", ")}`);
  return only.length > 0 ? all.filter((request) => only.includes(request.id)) : all;
}

/** The first cut the requests are made on, as `first-cut` wrote it. */
function baseOf(take: Take, flags: Record<string, string>): Edit {
  const file = flags.base ?? ".scratch/task14/first-cut/house-1.json";
  if (!existsSync(file)) throw new Error(`${file} is not there: make the first cut first (first-cut --runs 1)`);
  return (JSON.parse(take.unmasked(readFileSync(file, "utf8"))) as { edit: Edit }).edit;
}

/** What a request's `setup` puts on the first cut before it is asked. */
async function setUp(take: Take, base: Edit, request: Request): Promise<Edit> {
  if (!request.setup) return base;
  const { applyOps } = await import("../src/lib/edit/ops");
  const { framingAt } = await import("../src/lib/edit/derive");
  const { faceOnStage } = await import("../src/lib/edit/stage");
  const { STAGE } = await import("../src/lib/edit/doc");
  if (request.setup === "loose-ends") {
    // The film runs to its take's own ends again, as before the first cut trimmed them: there is dead air to cut at both.
    const [first, last] = [base.shots[0], base.shots.at(-1)];
    const clip = last && base.assets.find((asset) => asset.id === last.asset);
    if (!first || !last || clip?.kind !== "video") throw new Error("the first cut has no take at its ends to let run");
    const loose = applyOps(base, [{ op: "shot.trim", id: first.id, startMs: 0 }, { op: "shot.trim", id: last.id, endMs: clip.ms }], [take.asset]);
    if (!loose.ok) throw new Error(`the setup was refused: ${loose.problems.map((problem) => problem.message).join("; ")}`);
    return loose.edit;
  }
  // A call-out over the mouth while "Claude" is said: one the creator would ask to have moved.
  const words = take.asset.kind === "video" ? (take.asset.words ?? []) : [];
  const word = words.find((each) => /claude/i.test(each.text));
  const shot = word && base.shots.find((each) => each.asset === take.asset.id && each.startMs <= word.startMs && word.startMs < each.endMs);
  const sample = word && [...take.analysis.faces].reverse().find((each) => each.ms <= word.startMs + 400 && each.mouth);
  if (!word || !shot || !sample || take.asset.kind !== "video") throw new Error("the take has no word, shot or mouth for the call-out to sit on");
  const mouth = faceOnStage(sample, take.asset, framingAt(shot, word.startMs + 400)).mouth;
  if (!mouth) throw new Error("no mouth where the call-out is to sit");
  const y = Math.round(((mouth.y + mouth.h / 2) / STAGE.h) * 100) / 100;
  const made = applyOps(base, [{ op: "mark.add", shot: shot.id, mark: { id: "co1", part: "callout", atMs: word.startMs, lenMs: 1200, props: { text: "New tool", font: base.captions.font, look: "pop", x: 0.5, y, size: 120, color: base.captions.highlight ?? "#ffffff" } } }], [take.asset]);
  if (!made.ok) throw new Error(`the setup was refused: ${made.problems.map((problem) => problem.message).join("; ")}`);
  return made.edit;
}

interface RunRecord {
  id: string;
  run: number;
  tag: string;
  request: string;
  expect: Request["expect"];
  thinking: boolean;
  maxTokens: number;
  stillsAsked: boolean;
  ms: number;
  cents: number;
  tokens: { input: number; output: number };
  changed: boolean;
  say: string;
  /** Whose sentence `say` is: the model's as its answer had it, the model's when asked again, or the code's. Absent in records made before the last correction. */
  sayBy?: SayBy;
  rounds: ReturnType<typeof roundOf>[];
  outcomes: string[];
  /** True when the loop drew stills and showed them. */
  drew: boolean;
  truncated: boolean[];
  ops: Op[];
  facts: Facts;
  before: Edit;
  edit: Edit;
}

async function runRequests(flags: Record<string, string>, only: string[]): Promise<void> {
  const take = await takeOf(flags);
  const { AGENT_LIMITS, change } = await import("../src/lib/edit/agent/loop");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { stillsOf } = await import("../src/lib/edit/worker/stills");
  const tag = flags.tag ?? "run";
  const out = join(flags.out ?? ".scratch/task14", tag);
  const runs = Number(flags.runs ?? 3);
  const thinking = flags.thinking === undefined ? AGENT_LIMITS.thinking : flags.thinking === "on";
  const maxTokens = flags.tokens === undefined ? AGENT_LIMITS.maxTokens : Number(flags.tokens);
  mkdirSync(out, { recursive: true });
  const say = (line: unknown) => console.log(take.masked(JSON.stringify(line)));
  const base = baseOf(take, flags);
  say({ tag, thinking, maxTokens, stills: !flags["no-stills"], runs });

  for (const request of requestsOf(only)) {
    const before = await setUp(take, base, request);
    for (let k = 1; k <= runs; k++) {
      const file = join(out, `${request.id}-${k}.json`);
      if (existsSync(file) && !flags.force) continue;
      const { ask, answers } = asking(askQwen, { thinking, tokens: maxTokens });
      const stills: typeof StillsOf = async (who, drawn, frames, stopping) => {
        const got = await stillsOf(who, drawn, frames, stopping);
        for (const still of got) writeFileSync(join(out, `${request.id}-${k}-seen-${String(still.frame).padStart(4, "0")}.jpg`), Buffer.from(still.jpeg, "base64"));
        return got;
      };
      let result: AgentResult;
      try {
        result = await change({ edit: before, analyses: take.analyses, request: request.request, library: [take.asset], user: take.user, deadlineMs: Date.now() + AGENT_LIMITS.changeMs, stills: !flags["no-stills"] }, { ask, stills });
      } catch (error) {
        say({ id: request.id, run: k, failed: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const record: RunRecord = {
        id: request.id, run: k, tag, request: request.request, expect: request.expect, thinking, maxTokens, stillsAsked: !flags["no-stills"],
        ms: result.ms, cents: cents4(result.cost), tokens: result.tokens, changed: result.changed, say: result.say, sayBy: result.sayBy,
        rounds: result.rounds.map(roundOf), outcomes: result.rounds.map((round) => round.outcome), drew: result.rounds.some((round) => round.stills.length > 0),
        truncated: answers.map((answer) => answer.truncated), ops: result.ops, facts: await factsOf(before, result.edit, take.analyses), before, edit: result.edit,
      };
      writeFileSync(file, take.masked(JSON.stringify(record, null, 1)));
      writeFileSync(join(out, `${request.id}-${k}-answers.json`), take.masked(JSON.stringify(answers, null, 1)));
      say({
        id: request.id, run: k, s: round1(result.ms / 1000), outcomes: record.outcomes, drew: record.drew, changed: record.changed, cents: record.cents,
        newErrors: record.facts.newErrors.length, short: record.facts.short, ops: result.ops.map((op) => op.op), say: result.say,
      });
    }
  }
}

function recordsOf(dir: string, only: string[]): RunRecord[] {
  if (!existsSync(dir)) throw new Error(`${dir} is not there`);
  return readdirSync(dir)
    .filter((name) => /^r\d\d-\d+\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as RunRecord)
    .filter((record) => only.length === 0 || only.includes(record.id));
}

/* ── the sheets ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

async function sheets(flags: Record<string, string>, only: string[]): Promise<void> {
  const take = await takeOf(flags);
  const { framesToDraw } = await import("../src/lib/edit/agent/loop");
  const { layout } = await import("../src/lib/edit/derive");
  const { withRenderer } = await import("./edit-render");
  const tag = flags.tag ?? "run";
  const out = join(flags.out ?? ".scratch/task14", tag);
  const records = recordsOf(out, only).map((record) => JSON.parse(take.unmasked(JSON.stringify(record))) as RunRecord);
  const ids = [...new Set(records.map((record) => record.id))];
  const named = (flags.frames ?? "").split(",").filter(Boolean).map(Number).filter((frame) => Number.isInteger(frame) && frame >= 0);
  freeDisk();
  const work = mkdtempSync(join(tmpdir(), "edit-agent-proof-"));
  try {
    await withRenderer(async ({ still }) => {
      for (const id of ids) {
        const sheet = join(out, `${id}.jpg`);
        if (existsSync(sheet) && !flags.force) continue;
        const mine = records.filter((record) => record.id === id);
        const notes: string[] = [`${id}: ${mine[0]?.request ?? ""}   (expect ${mine[0]?.expect ?? ""})`, ""];
        let cells = 0;
        const put = (input: string | null, label: string) => cell(input, label, join(work, `cell-${String(cells++).padStart(3, "0")}.jpg`), work);
        for (const record of mine) {
          const last = Math.max(0, layout(record.edit).frames - 1);
          // What the run changed that is seen, as the loop would draw it, the changed things before the film's middle; else
          // three moments across the film.
          const drawn = record.changed ? framesToDraw(record.edit, record.ops) : [];
          const seen = [...drawn.filter((frame) => !frame.says.startsWith("the middle")), ...drawn.filter((frame) => frame.says.startsWith("the middle"))].map((frame) => frame.frame);
          const across = [0.15, 0.5, 0.85].map((share) => Math.floor(share * last));
          const frames = (named.length > 0 ? named : seen.length > 0 ? seen : across).slice(0, CELL.across - 1);
          const first = frames[0] ?? 0;
          const png = join(work, "frame.png");
          const draw = async (edit: Edit, frame: number, label: string) => {
            const demo = demoOf(take, edit, join(work, "demo.json"));
            await still(demo, Math.min(frame, Math.max(0, layout(edit).frames - 1)), png);
            put(png, label);
          };
          await draw(record.before, first, `${id}-${record.run} before f${first}`);
          for (const frame of frames) await draw(record.edit, frame, `${id}-${record.run} after f${frame} (${(frame / 30).toFixed(1)}s)`);
          for (let blank = frames.length; blank < CELL.across - 1; blank++) put(null, "");
          notes.push(
            `run ${record.run}: ${record.changed ? "changed" : "NOT changed"} · ${record.outcomes.join(" > ")} · ${round1(record.ms / 1000)} s${record.drew ? " with stills" : ""} · ${record.cents} c`,
            `  say: ${record.say}`,
            `  ops: ${JSON.stringify(record.ops)}`,
            `  facts: ${JSON.stringify({ ...record.facts, errorsLeft: undefined })}`,
            `  errors left: ${record.facts.errorsLeft.join(" | ") || "none"}`,
            ...record.rounds.filter((round) => round.outcome !== "changed" && round.outcome !== "no change").map((round) => `  round ${round.n} ${round.outcome}: ${JSON.stringify(round.ops)} ${round.errors.join(" | ")}${round.refused ? ` ${JSON.stringify(round.refused)}` : ""}${round.error ?? ""}`),
            "",
          );
        }
        tile(work, cells, CELL.across, sheet);
        for (const name of readdirSync(work)) if (name.startsWith("cell-")) rmSync(join(work, name));
        writeFileSync(join(out, `${id}.txt`), take.masked(notes.join("\n")));
        console.log(`${id}: ${basename(sheet)} (${mine.length} runs)`);
      }
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/* ── the summary ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

type Judged = Record<string, Record<string, { asked: boolean; looks: boolean; why?: string }>>;

async function summary(flags: Record<string, string>, only: string[]): Promise<void> {
  const { kitTerms, sentencesOf } = await import("../src/lib/edit/agent/loop");
  const tag = flags.tag ?? "run";
  const out = join(flags.out ?? ".scratch/task14", tag);
  const records = recordsOf(out, only);
  const judgedFile = join(out, "judged.json");
  const judged: Judged = existsSync(judgedFile) ? (JSON.parse(readFileSync(judgedFile, "utf8")) as Judged) : {};
  const ids = [...new Set(records.map((record) => record.id))];
  const seconds = (ms: number | null) => (ms === null ? "-" : (ms / 1000).toFixed(1));
  const rows = ids.map((id) => {
    const mine = records.filter((record) => record.id === id);
    const verdicts = mine.map((record) => judged[id]?.[String(record.run)]);
    // Valid: through the door (every accepted edit is) with no error the first cut did not have.
    const valid = mine.filter((record) => record.facts.newErrors.length === 0).length;
    const done = mine.filter((record, i) => record.facts.newErrors.length === 0 && verdicts[i]?.asked === true).length;
    const looks = mine.filter((_, i) => verdicts[i]?.looks === true).length;
    return {
      id, expect: mine[0]?.expect ?? "done", runs: mine.length, valid, done, looks, unjudged: verdicts.filter((verdict) => !verdict).length,
      changed: mine.filter((record) => record.changed).length,
      plain: median(mine.filter((record) => !record.drew).map((record) => record.ms)), drawn: median(mine.filter((record) => record.drew).map((record) => record.ms)),
      cents: cents4(mine.reduce((sum, record) => sum + record.cents, 0) / Math.max(1, mine.length)),
      rounds: round1(mine.reduce((sum, record) => sum + record.rounds.length, 0) / Math.max(1, mine.length)),
      why: mine.flatMap((record, i) => (verdicts[i] && (!verdicts[i].asked || !verdicts[i].looks) && verdicts[i].why ? [`${record.run}: ${verdicts[i].why}`] : [])),
    };
  });
  const lines = ["| id | expect | runs | valid | did what was asked | looks right | changed | median s (no stills) | median s (stills) | rounds | cents | why not |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const row of rows) lines.push(`| ${row.id} | ${row.expect} | ${row.runs} | ${row.valid} | ${row.done} | ${row.looks} | ${row.changed} | ${seconds(row.plain)} | ${seconds(row.drawn)} | ${row.rounds} | ${row.cents} | ${row.why.join("; ")} |`);
  const of = (expect: Request["expect"]) => rows.filter((row) => row.expect === expect);
  const sum = (list: typeof rows, key: "runs" | "valid" | "done" | "looks" | "unjudged") => list.reduce((total, row) => total + row[key], 0);
  const share = (n: number, total: number) => (total === 0 ? "-" : `${n}/${total} (${Math.round((100 * n) / total)} %)`);
  const [done, refused] = [of("done"), of("refused")];
  const plain = records.filter((record) => !record.drew).map((record) => record.ms);
  const drawn = records.filter((record) => record.drew).map((record) => record.ms);
  lines.push(
    "",
    `done requests: valid ${share(sum(done, "valid"), sum(done, "runs"))}; valid and did what was asked ${share(sum(done, "done"), sum(done, "runs"))}; look right ${share(sum(done, "looks"), sum(done, "runs"))}`,
    `refused requests: refused as asked ${share(sum(refused, "done"), sum(refused, "runs"))}`,
    `unjudged runs: ${sum(rows, "unjudged")}`,
    `median change: ${seconds(median(plain))} s without stills (${plain.length} runs, worst ${seconds(plain.length ? Math.max(...plain) : null)}), ${seconds(median(drawn))} s with stills (${drawn.length} runs, worst ${seconds(drawn.length ? Math.max(...drawn) : null)})`,
    `cost: ${cents4(records.reduce((total, record) => total + record.cents, 0) / Math.max(1, records.length))} c a change on average, ${cents4(records.reduce((total, record) => total + record.cents, 0))} c for ${records.length} runs`,
    `tokens: ${Math.round(records.reduce((total, record) => total + record.tokens.input, 0) / Math.max(1, records.length))} in, ${Math.round(records.reduce((total, record) => total + record.tokens.output, 0) / Math.max(1, records.length))} out a change on average`,
  );
  // The says: how many name a word of the kit the creator did not use, how many run to a second sentence or hold a number the
  // request did not, and how long they are.
  const kit = records.map((record) => kitTerms(record.say, record.request));
  const named = new Map<string, number>();
  for (const term of kit.flat()) named.set(term, (named.get(term) ?? 0) + 1);
  const numbers = (text: string) => new Set(text.match(/\d+(?:\.\d+)?/g) ?? []);
  const figures = records.filter((record) => [...numbers(record.say)].some((number) => !numbers(record.request).has(number))).length;
  const words = records.map((record) => record.say.trim().split(/\s+/).length);
  lines.push(
    `says: ${kit.filter((terms) => terms.length > 0).length} of ${records.length} name a kit term${named.size > 0 ? ` (${[...named].map(([term, count]) => `${term} ${count}`).join(", ")})` : ""}; ${records.filter((record) => sentencesOf(record.say) > 1).length} run to more than one sentence; ${figures} hold a number the creator did not use; ${median(words) ?? "-"} words at the middle, ${words.length ? Math.max(...words) : "-"} the longest`,
  );
  // Whose sentence each say is, and how many calls a change took at most (three rounds and one for the sentence alone).
  const by = (whose: SayBy) => records.filter((record) => record.sayBy === whose).length;
  if (records.some((record) => record.sayBy !== undefined)) lines.push(`says by: the model's own ${by("model")}, the model's when asked again ${by("model, asked again")}, the code's ${by("code")}; most calls in a change ${Math.max(...records.map((record) => record.rounds.length))}`);
  const text = lines.join("\n");
  writeFileSync(join(out, "summary.md"), `${text}\n`);
  console.log(text);
}

/* ── the moment's proof (slice B, Task 4) ─────────────────────────────────────────────────────────────────────────────── */

/** The most model calls one change makes: three rounds and one for the sentence alone. */
const MOST_CALLS_A_RUN = 4;
/**
 * The bars, as shares of the runs planned (with three runs each: 15 of 18, 7 of 9, 14 of 15): the requests that point land; those
 * with no pointing word land, by the model's own placing or code's move; the controls about the whole video stay whole; a
 * control that names another place stays there in every run.
 */
const BARS = { pointing: 15 / 18, tag: 7 / 9, whole: 14 / 15, put: 1 } as const;
type Group = keyof typeof BARS;
const GROUP_SAYS: Record<Group, string> = {
  pointing: "requests with a pointing word that land",
  tag: "requests with no pointing word that land (the tag alone)",
  whole: "controls about the whole video that stay whole",
  put: "controls that name another place and stay there",
};
/** The parts a request makes appear on a moment, as `moment.ts` counts them. */
const APPEARING = new Set(["title", "callout", "cutaway", "sound"]);

interface MomentJob {
  id: string;
  group: Group;
  request: string;
  at: At;
  /** The film frame of the base, as the file writes it. */
  frame: number;
  measure: { lands: Landing } | { whole: Whole } | { put: Put };
}

/**
 * A hand that put a thing where it is, in the loop's order (S17): the model's own ops; code making an end card readable
 * (`readableEnds`); code's move off the film's first frame (S15, `offTheStart`); code's start hold (H1, `snapToMoment`).
 * The first run's records (before S17) wrote "code moved" for the frame-0 move and "code held" for the start hold.
 */
type Hand = "model" | "code's readable end" | "code's frame-0 move" | "code's start hold";

/** A thing the run added that appears: where the model's own ops put its first frame, where it is in the edit, and who put it there. */
interface Placing {
  id: string;
  part: string;
  model: number | null;
  final: number;
  frames: number;
  /** The hands, joined with "+": "model" when no code move changed its first frame. */
  by: string;
}

interface MomentRecord {
  id: string;
  run: number;
  tag: string;
  group: Group;
  request: string;
  base: string;
  atForm: At;
  at: number;
  moment: { frame: number; start: number; shot: string; ms: number; word: number | null; how: string | null };
  measure: string;
  /** `landed`, `stayedWhole` or `stayedPut` of `moment.ts`, on the base and the run's edit. */
  verdict: boolean;
  placings: Placing[];
  /** For a zoom: whose zoom it is that the measure judged ("model", or "code's zoom here"); null when no zoom landed. */
  zoomBy?: string | null;
  /** Why a miss is not the tag's: the first cut's own title at the place the request named collided with the new one. */
  note?: string | null;
  detail: string;
  /** The model calls the run made, counted by the asking wrapper. */
  calls: number;
  shortBlock: boolean;
  /** Why the run made no change at all: it failed (the cap, an error). */
  failed: string | null;
  ms: number;
  cents: number;
  tokens: { input: number; output: number };
  changed: boolean;
  say: string;
  sayBy: SayBy | null;
  rounds: ReturnType<typeof roundOf>[];
  outcomes: string[];
  truncated: boolean[];
  ops: Op[];
  facts: Facts | null;
  edit: Edit | null;
}

function momentJobs(pointsAt: (request: string) => boolean, only: string[]): MomentJob[] {
  const file = MomentsSchema.parse(JSON.parse(readFileSync(MOMENTS, "utf8")));
  const requests = RequestsSchema.parse(JSON.parse(readFileSync(REQUESTS, "utf8"))).requests;
  const jobs: MomentJob[] = [
    ...file.moments.map((each): MomentJob => ({ id: each.id, group: pointsAt(each.request) ? "pointing" : "tag", request: each.request, at: each.at, frame: each.frame, measure: { lands: each.lands } })),
    ...file.controls.map((each): MomentJob => {
      const request = each.request ?? requests.find((other) => other.id === each.of)?.request;
      if (!request) throw new Error(`${REQUESTS} has no ${each.of ?? "request"} for ${each.id}`);
      const measure = each.put ? { put: each.put } : each.whole ? { whole: each.whole } : null;
      if (!measure) throw new Error(`${each.id} has no measure`);
      return { id: each.id, group: each.put ? "put" : "whole", request, at: each.at, frame: each.frame, measure };
    }),
  ];
  const unknown = only.filter((id) => !jobs.some((job) => job.id === id));
  if (unknown.length > 0) throw new Error(`${MOMENTS} has no ${unknown.join(", ")}`);
  return only.length > 0 ? jobs.filter((job) => only.includes(job.id)) : jobs;
}

/**
 * The film frame a moment of the file gives on `edit`: a share of the film, floored; else the take's moment (the middle of word i,
 * or ms before it starts or after it ends) on the first shot whose stretch of the take holds it (`frameOf`). Null where none does.
 */
async function frameFor(take: Take, edit: Edit, at: At): Promise<number | null> {
  const { filmFrames, frameOf } = await import("../src/lib/edit/derive");
  if ("film" in at) return Math.floor(filmFrames(edit) * at.film);
  const asset = edit.assets.find((each) => each.id === take.asset.id);
  const words = asset?.kind === "video" ? (asset.words ?? []) : [];
  const word = words["in" in at ? at.in : "before" in at ? at.before : at.after];
  if (!word) return null;
  const ms = "in" in at ? (word.startMs + word.endMs) / 2 : "before" in at ? word.startMs - at.ms : word.endMs + at.ms;
  const shot = edit.shots.find((each) => each.asset === take.asset.id && each.startMs <= ms && ms < each.endMs);
  return shot ? frameOf(edit, shot.id, ms) : null;
}

/** The moment's block cut to its first line, for a request that does not point (`--short-block`, the brief's fallback). */
const shortened = (messages: Message[]): Message[] =>
  messages.map((message) => (message.role === "user" && typeof message.content === "string" ? { ...message, content: message.content.replace(/\n\nmoment:\n([^\n]*)[\s\S]*?(?=\n\nrequest:\n)/, "\n\nmoment:\n$1") } : message));

/** The moments the loop hands its moves for a request (S17): `pointed` when it points; `tagged` when it points or names no other place. */
async function pointersOf(request: string, here: Moment): Promise<{ pointed: Moment | null; tagged: Moment | null }> {
  const { namesAnotherPlace, pointsAt } = await import("../src/lib/edit/agent/moment");
  const pointed = pointsAt(request) ? here : null;
  return { pointed, tagged: pointed !== null || !namesAnotherPlace(request) ? here : null };
}

/**
 * Who put each thing the run added where it is, and whose zoom it is. Each accepted round's own ops are replayed on the base in
 * the loop's order (`change`, S17), one stage at a time, and a thing's first frame read after each: the model's own (its ops
 * through the moves, as the model's own words are read, with no moment); after `readableEnds`; after the moves with the moment
 * the loop gives them (the zoom here: `pointed`, else `tagged` when the answer zooms one shot); after `offTheStart`; and in the
 * run's edit, where what is left is the code's moves after the door (the start hold). A stage that moved its first frame is that
 * stage's hand. A round after an accepted one is replayed on the edit the stages before the door made, not the code's last.
 * The zoom is the model's when its own ops already land it, the code's zoom here when only the loop's moves do.
 */
async function attributionOf(take: Take, before: Edit, result: AgentResult, request: string, here: Moment): Promise<{ placings: Placing[]; zoomBy: string | null }> {
  const { placed } = await import("../src/lib/edit/derive");
  const { applyOps } = await import("../src/lib/edit/ops");
  const { readableEnds, withMoves, withPunctuation } = await import("../src/lib/edit/agent/loop");
  const { landed, offTheStart } = await import("../src/lib/edit/agent/moment");
  const { pointed, tagged } = await pointersOf(request, here);
  const library = [take.asset];
  const had = new Set([...before.shots.flatMap((shot) => shot.marks), ...before.items].map((thing) => thing.id));
  /** Per new thing: its first frame after each stage, in order: own, readable, moves, lifted. */
  const stages = new Map<string, (number | null)[]>();
  let modelZooms = false;
  let codeZooms = false;
  let on = before;
  for (const round of result.rounds) {
    if (round.outcome !== "changed") continue;
    const tried = (ops: readonly unknown[], moment: Moment | null): { ops: unknown[]; edit: Edit } | null => {
      const made = withMoves(on, take.analyses, ops, library, moment);
      const door = made.ok ? applyOps(on, made.ops, library) : null;
      return made.ok && door?.ok ? { ops: made.ops, edit: door.edit } : null;
    };
    const punctuated = withPunctuation(on, round.ops);
    const readable = readableEnds(on, punctuated);
    const zoomed = new Set(readable.flatMap((op) => (typeof op === "object" && op !== null && (op as { op?: unknown }).op === "shot.zoom" ? [(op as { id?: unknown }).id] : [])));
    const zoomMoment = pointed ?? (zoomed.size === 1 ? tagged : null);
    const own = tried(punctuated, null);
    const ended = tried(readable, null);
    const moves = tried(readable, zoomMoment);
    const lift = moves ? offTheStart(on, moves.ops, here, take.analyses, request, library) : null;
    const liftedDoor = lift && lift.moved.length > 0 ? applyOps(on, lift.ops, library) : null;
    const lifted = liftedDoor?.ok ? liftedDoor.edit : (moves?.edit ?? null);
    if (own && landed("zoom", here, before, own.edit)) modelZooms = true;
    if (zoomMoment !== null && zoomed.size > 0) codeZooms = true;
    const firstFrame = (edit: Edit | null | undefined, id: string): number | null => (edit ? (placed(edit).find((place) => place.thing.id === id)?.at ?? null) : null);
    const fresh = new Set([own?.edit, ended?.edit, moves?.edit, lifted].flatMap((edit) => (edit ? placed(edit).map((place) => place.thing.id) : [])));
    for (const id of fresh) {
      if (had.has(id) || stages.has(id)) continue;
      stages.set(id, [firstFrame(own?.edit, id), firstFrame(ended?.edit, id), firstFrame(moves?.edit, id), firstFrame(lifted, id)]);
    }
    if (lifted) on = lifted;
  }
  const placings = placed(result.edit)
    .filter((place) => APPEARING.has(place.thing.part) && !had.has(place.thing.id))
    .map((place): Placing => {
      const [own = null, readable = null, moves = null, lifted = null] = stages.get(place.thing.id) ?? [];
      if ([own, readable, moves, lifted].every((frame) => frame === null)) return { id: place.thing.id, part: place.thing.part, model: null, final: place.at, frames: place.frames, by: "unknown" };
      const hands: Hand[] = [];
      if (readable !== null && readable !== own) hands.push("code's readable end");
      if (lifted !== null && lifted !== (moves ?? readable)) hands.push("code's frame-0 move");
      if (place.at !== (lifted ?? moves ?? readable ?? own)) hands.push("code's start hold");
      return { id: place.thing.id, part: place.thing.part, model: own, final: place.at, frames: place.frames, by: hands.length > 0 ? hands.join("+") : own === null ? "unknown" : "model" };
    });
  const zoomBy = landed("zoom", here, before, result.edit) ? (modelZooms ? "model" : codeZooms ? "code's zoom here" : "unknown") : null;
  return { placings, zoomBy };
}

/**
 * True when a miss of a control that names the start comes from the first cut's own title there, not from the tag: a round was
 * refused by the review for two titles at once, or one text on another, on a frame the first cut's own title shows on; and
 * nothing the run added starts within NEAR of the moment.
 */
async function collidedWithOwnTitle(before: Edit, result: AgentResult, here: Moment): Promise<boolean> {
  const { placed } = await import("../src/lib/edit/derive");
  const { NEAR } = await import("../src/lib/edit/agent/moment");
  const own = placed(before).filter((place) => place.thing.part === "title");
  const had = new Set(placed(before).map((place) => place.thing.id));
  const collided = result.rounds.some((round) => round.findings.some((finding) => finding.severity === "error" && (finding.code === "two-titles" || finding.code === "on-text") && own.some((place) => place.at <= finding.where.frame && finding.where.frame < place.at + place.frames)));
  const pulled = placed(result.edit).some((place) => !had.has(place.thing.id) && Math.abs(place.at - here.frame) <= NEAR);
  return collided && !pulled;
}

/**
 * The rounds in which the model's own ops ended a title of the first cut on the moment (its last frame within ON of the paused
 * frame or of the moment's start), and whether the run's edit still ends it there. S17 (4) took the end numbers out of the block
 * for a request that does not point, because the model did this unasked in 4 of 6 control runs.
 */
async function titleEndedOnMoment(before: Edit, rounds: { ops: unknown[] }[], edit: Edit | null, moment: { frame: number; start: number }): Promise<{ rounds: number; kept: boolean }> {
  const { placed } = await import("../src/lib/edit/derive");
  const { ON } = await import("../src/lib/edit/agent/moment");
  const titles = before.items.filter((item) => item.part === "title" && item.anchor === "start");
  const onIt = (end: number) => Math.abs(end - moment.frame) <= ON || Math.abs(end - moment.start) <= ON;
  const ended = rounds.filter((round) =>
    round.ops.some((op) => {
      const set = op as { op?: unknown; id?: unknown; at?: unknown; frames?: unknown };
      const title = set.op === "item.set" ? titles.find((item) => item.id === set.id) : undefined;
      return title !== undefined && typeof set.frames === "number" && onIt((typeof set.at === "number" ? set.at : title.at) + set.frames);
    }),
  ).length;
  const was = new Map(placed(before).map((place) => [place.thing.id, place.at + place.frames]));
  const kept = edit !== null && placed(edit).some((place) => titles.some((item) => item.id === place.thing.id) && onIt(place.at + place.frames) && !onIt(was.get(place.thing.id) ?? -99));
  return { rounds: ended, kept };
}

/** What the measure looked at, in frames and indexes, for the table: never a word's text. */
async function detailOf(job: MomentJob, moment: Moment, before: Edit, after: Edit, placings: Placing[], zoomBy: string | null): Promise<string> {
  const { filmFrames, framingAt, momentAt, placed } = await import("../src/lib/edit/derive");
  const { ON } = await import("../src/lib/edit/agent/moment");
  const things = placings.map((each) => `${each.part} ${each.model ?? "?"}>${each.final} ${each.frames}f ${each.by}`).join(", ") || "nothing added";
  const zoomOn = (edit: Edit, frame: number): number | null => {
    const here = momentAt(edit, frame);
    const shot = here ? edit.shots.find((each) => each.id === here.shot) : undefined;
    return here && shot ? framingAt(shot, here.ms).zoom : null;
  };
  const film = `film ${filmFrames(before)}>${filmFrames(after)}`;
  if ("put" in job.measure) return `${things}; ${film}`;
  if ("whole" in job.measure) {
    switch (job.measure.whole) {
      case "pauses":
        return film;
      case "look":
        return `look ${before.look.preset ?? "none"}>${after.look.preset ?? "none"}; shots with a look of their own ${after.shots.filter((shot) => shot.look !== null).length}`;
      case "title-out":
        return `titles placed ${placed(after).filter((place) => place.thing.part === "title").length}`;
      case "faster":
        return `speeds ${[...new Set(after.shots.map((shot) => shot.speed))].join(",")}`;
    }
  }
  switch (job.measure.lands) {
    case "starts":
      return `window ${moment.start - ON}..${moment.frame + ON}; ${things}`;
    case "ends": {
      const title = placed(before).find((place) => (place.thing.part === "title" || place.thing.part === "callout") && place.at <= moment.frame && moment.frame < place.at + place.frames);
      const now = title && placed(after).find((place) => place.thing.id === title.thing.id);
      return title ? `${title.thing.part} ends ${title.at + title.frames}>${now ? now.at + now.frames : "gone"} (frame ${moment.frame})` : "nothing showing";
    }
    case "word": {
      const words = (edit: Edit) => edit.assets.flatMap((asset) => (asset.kind === "video" && asset.id === moment.take ? (asset.words ?? []) : []));
      const [was, is] = [words(before), words(after)];
      const changed = was.flatMap((word, i) => ((word.stress === true) !== (is[i]?.stress === true) ? [`w${i}`] : []));
      return `stress changed ${changed.join(",") || "none"} (w${moment.word?.index ?? "?"} asked)`;
    }
    case "cut": {
      const take = after.assets.find((asset) => asset.id === moment.take);
      const word = moment.word && take?.kind === "video" ? take.words?.[moment.word.index] : undefined;
      const middle = word ? (word.startMs + word.endMs) / 2 : null;
      const gone = middle !== null && !after.shots.some((shot) => shot.asset === moment.take && shot.startMs <= middle && middle < shot.endMs);
      return `${film}; w${moment.word?.index ?? "?"} ${gone ? "cut" : "kept"}`;
    }
    case "zoom": {
      const frames = Math.max(filmFrames(before), filmFrames(after));
      const tighter = Array.from({ length: frames }, (_, f) => f).find((f) => {
        const [was, is] = [zoomOn(before, f), zoomOn(after, f)];
        return was !== null && is !== null && is > was + 0.01;
      });
      return `tighter from ${tighter ?? "nowhere"} (frame ${moment.frame}); shots ${after.shots.map((shot) => shot.id).join(",")}${zoomBy ? `; zoom by ${zoomBy}` : ""}`;
    }
  }
}

/**
 * A say as it is printed: a quoted text that is not the request's own (the made-up text it asked for) written ‹quote›, since the
 * model quotes the words it hangs a thing on; then every word of the take of four letters or more but the allowed ones ‹w›.
 */
function sayMasker(base: Edit, allowed: readonly string[]): (say: string, request: string) => string {
  const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
  const spaced = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim();
  const taken = new Set(base.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []) : [])).map((word) => plain(word.text)).filter((word) => word.length >= 4 && !allowed.includes(word)));
  return (say, request) =>
    say
      .replace(/"([^"]*)"|“([^”]*)”|(?<=^|\s)'([^']+)'(?=[\s.,;:!?]|$)/g, (whole, a?: string, b?: string, c?: string) => (spaced(request).includes(spaced(a ?? b ?? c ?? "")) && spaced(a ?? b ?? c ?? "") !== "" ? whole : "‹quote›"))
      .replace(/[\p{L}\p{N}']+/gu, (token) => (taken.has(plain(token)) ? "‹w›" : token));
}

function momentRecordsOf(dir: string): MomentRecord[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^[mnc]\d\d-\d+\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as MomentRecord);
}

async function runMoments(flags: Record<string, string>, only: string[]): Promise<void> {
  const take = await takeOf(flags);
  const { AGENT_LIMITS, change } = await import("../src/lib/edit/agent/loop");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { landed, momentFor, pointsAt, stayedPut, stayedWhole } = await import("../src/lib/edit/agent/moment");
  const tag = flags.tag ?? "moments";
  const out = join(flags.out ?? ".scratch/editor/slice-b/proof", tag);
  const runs = Number(flags.runs ?? 3);
  const cap = Number(flags.calls ?? 60);
  const shortBlock = flags["short-block"] === "true";
  const baseFile = flags.base ?? ".scratch/native-default-2/first-cut/house-1.json";
  const base = baseOf(take, { ...flags, base: baseFile });
  const jobs = momentJobs(pointsAt, only);
  const mask = sayMasker(base, MomentsSchema.parse(JSON.parse(readFileSync(MOMENTS, "utf8"))).allowed);
  const say = (line: unknown) => console.log(take.masked(JSON.stringify(line)));
  if (!Number.isInteger(runs) || runs < 0 || !Number.isInteger(cap) || cap < 0) throw new Error("--runs and --calls are whole numbers");

  // The frames, printed, and held to the file's: on another base the moments are other footage, and nothing is run.
  const moments = new Map<string, Moment>();
  const wrong: string[] = [];
  for (const job of jobs) {
    const frame = await frameFor(take, base, job.at);
    const moment = frame === null ? null : momentFor(base, take.analyses, frame);
    say({ id: job.id, group: job.group, frame, file: job.frame, start: moment?.start ?? null, shot: moment?.shot ?? null, word: moment?.word ? `w${moment.word.index} ${moment.word.how}` : null });
    if (moment && frame === job.frame) moments.set(job.id, moment);
    else wrong.push(job.id);
  }
  if (wrong.length > 0) throw new Error(`the frames of ${wrong.join(", ")} are not the file's on this base: nothing is run`);

  const plan = Array.from({ length: runs }, (_, i) => i + 1).flatMap((k) => jobs.map((job) => ({ job, k })));
  const fileOf = (id: string, k: number) => join(out, `${id}-${k}.json`);
  // The cap holds for the tag's folder: the calls its records made already count.
  let calls = momentRecordsOf(out).reduce((sum, record) => sum + record.calls, 0);
  say({ tag, base: baseFile, runs, jobs: jobs.length, planned: plan.length, there: plan.filter(({ job, k }) => existsSync(fileOf(job.id, k))).length, calls, cap, shortBlock, mostCallsARun: MOST_CALLS_A_RUN });
  if (runs === 0) {
    say({ plan: jobs.map((job) => ({ id: job.id, group: job.group, measure: Object.values(job.measure)[0], request: job.request, frame: job.frame })) });
    return;
  }
  mkdirSync(out, { recursive: true });

  const notMade: string[] = [];
  for (const { job, k } of plan) {
    const file = fileOf(job.id, k);
    if (existsSync(file) && !flags.force) continue;
    // No run starts that could pass the cap: a change makes at most MOST_CALLS_A_RUN calls.
    if (calls + MOST_CALLS_A_RUN > cap) {
      notMade.push(`${job.id}-${k}`);
      continue;
    }
    const moment = moments.get(job.id);
    if (!moment) throw new Error(`no moment for ${job.id}`);
    const { ask: asked, answers } = asking(askQwen, {});
    let made = 0;
    const ask: Ask = async (messages, opts) => {
      if (calls >= cap) throw new Error(`the cap of ${cap} model calls is reached`);
      calls += 1;
      made += 1;
      return asked(shortBlock && !pointsAt(job.request) ? shortened(messages) : messages, opts);
    };
    // The model's look is off (`AGENT_LIMITS.look`): no stills are drawn, and none may be asked of the worker here.
    const stills: typeof StillsOf = async () => {
      throw new Error("no stills in the moment's proof");
    };
    const record: MomentRecord = {
      id: job.id, run: k, tag, group: job.group, request: job.request, base: baseFile, atForm: job.at, at: job.frame,
      moment: { frame: moment.frame, start: moment.start, shot: moment.shot, ms: moment.ms, word: moment.word?.index ?? null, how: moment.word?.how ?? null },
      measure: Object.values(job.measure)[0] as string, verdict: false, placings: [], detail: "", calls: 0, shortBlock, failed: null,
      ms: 0, cents: 0, tokens: { input: 0, output: 0 }, changed: false, say: "", sayBy: null, rounds: [], outcomes: [], truncated: [], ops: [], facts: null, edit: null,
    };
    try {
      const result = await change({ edit: base, analyses: take.analyses, request: job.request, library: [take.asset], user: take.user, deadlineMs: Date.now() + AGENT_LIMITS.changeMs, at: job.frame }, { ask, stills });
      record.verdict = "lands" in job.measure ? landed(job.measure.lands, moment, base, result.edit) : "whole" in job.measure ? stayedWhole(job.measure.whole, base, result.edit, take.analyses) : stayedPut(job.measure.put, moment, base, result.edit);
      const attributed = await attributionOf(take, base, result, job.request, moment);
      [record.placings, record.zoomBy] = [attributed.placings, attributed.zoomBy];
      record.note = !record.verdict && "put" in job.measure && job.measure.put === "start" && (await collidedWithOwnTitle(base, result, moment)) ? "collision with the first cut's own title, not the tag" : null;
      record.detail = await detailOf(job, moment, base, result.edit, record.placings, record.zoomBy);
      Object.assign(record, {
        ms: result.ms, cents: cents4(result.cost), tokens: result.tokens, changed: result.changed, say: result.say, sayBy: result.sayBy,
        rounds: result.rounds.map(roundOf), outcomes: result.rounds.map((round) => round.outcome), truncated: answers.map((answer) => answer.truncated),
        ops: result.ops, facts: await factsOf(base, result.edit, take.analyses), edit: result.edit,
      });
    } catch (error) {
      record.failed = error instanceof Error ? error.message : String(error);
    }
    record.calls = made;
    writeFileSync(file, take.masked(JSON.stringify(record, null, 1)));
    writeFileSync(join(out, `${job.id}-${k}-answers.json`), take.masked(JSON.stringify(answers, null, 1)));
    say({ id: job.id, run: k, verdict: record.verdict, by: record.placings.map((each) => each.by), detail: record.detail, s: round1(record.ms / 1000), calls: made, total: calls, cents: record.cents, outcomes: record.outcomes, failed: record.failed, say: mask(record.say, record.request) });
  }
  if (notMade.length > 0) say({ notMade: notMade.length, why: `the next could pass the cap of ${cap} calls` });
  await momentsSummary(out, jobs, runs, cap, mask, base);
}

/** Per id and per group against its bar, from the tag's records; the runs planned that are not there count as misses. */
async function momentsSummary(out: string, jobs: MomentJob[], runs: number, cap: number, mask: (say: string, request: string) => string, base: Edit): Promise<void> {
  const records = momentRecordsOf(out).filter((record) => record.run <= runs && jobs.some((job) => job.id === record.id));
  const notMade = jobs.flatMap((job) => Array.from({ length: runs }, (_, i) => i + 1).filter((k) => !records.some((record) => record.id === job.id && record.run === k)).map((k) => `${job.id}-${k}`));
  const short = (text: string, most: number) => (text.length > most ? `${text.slice(0, most - 1)}…` : text);
  const verdictOf = (record: MomentRecord) => (record.failed ? `failed: ${record.failed}` : record.verdict ? "yes" : record.note ? `no (${record.note})` : "no");
  const hands = (record: MomentRecord) => [...record.placings.map((each) => each.by), ...(record.zoomBy ? [`zoom: ${record.zoomBy}`] : [])];
  // The first cut's own title ended on the moment by the model's own ops: unasked where the run adds nothing at the moment and
  // does not ask to end it; making room where it adds a thing there ("starts"); asked in "End the title here" ("ends").
  const ended = await Promise.all(records.map(async (record) => ({ record, ...(await titleEndedOnMoment(base, record.rounds, record.edit, record.moment)) })));
  const lands = (record: MomentRecord) => jobs.find((job) => job.id === record.id)?.measure;
  const kind = (record: MomentRecord) => {
    const measure = lands(record);
    return measure && "lands" in measure && measure.lands === "starts" ? "making room" : measure && "lands" in measure && measure.lands === "ends" ? "asked" : "unasked";
  };
  const lines = [
    "| id | run | verdict | who placed it | frames | say (shortened) | calls | cents | s |",
    "|---|---|---|---|---|---|---|---|---|",
    ...records.map((record) => `| ${record.id} | ${record.run} | ${verdictOf(record)} | ${hands(record).join(", ") || "-"} | ${record.detail.replaceAll("|", "/")} | ${short(mask(record.say, record.request), 90).replaceAll("|", "/")} | ${record.calls} | ${record.cents} | ${round1(record.ms / 1000)} |`),
    "",
    "| id | group | measure | request | yes | of |",
    "|---|---|---|---|---|---|",
    ...jobs.map((job) => `| ${job.id} | ${job.group} | ${Object.values(job.measure)[0] as string} | ${job.request} | ${records.filter((record) => record.id === job.id && record.verdict).length} | ${runs} |`),
    "",
  ];
  for (const group of Object.keys(BARS) as Group[]) {
    const mine = jobs.filter((job) => job.group === group);
    if (mine.length === 0) continue;
    const planned = mine.length * runs;
    const yes = records.filter((record) => record.group === group && record.verdict);
    const bar = Math.ceil(BARS[group] * planned - 1e-9);
    const each = group === "put" ? ` (${mine.map((job) => `${job.id} ${yes.filter((record) => record.id === job.id).length} of ${runs}`).join(", ")})` : "";
    const by = new Map<string, number>();
    for (const record of yes) for (const hand of new Set(hands(record))) by.set(hand, (by.get(hand) ?? 0) + 1);
    const placed = by.size > 0 ? `; of those, by hand: ${[...by].map(([hand, count]) => `${hand} ${count}`).join(", ")}` : "";
    lines.push(`${GROUP_SAYS[group]}: ${yes.length} of ${planned}, bar ${bar}: ${yes.length >= bar ? "met" : "MISSED"}${each}${placed}`);
  }
  const seconds = median(records.filter((record) => record.failed === null).map((record) => record.ms));
  const calls = records.reduce((sum, record) => sum + record.calls, 0);
  const endedLine = (["unasked", "making room", "asked"] as const).map((which) => {
    const mine = ended.filter((each) => kind(each.record) === which);
    const did = mine.filter((each) => each.rounds > 0);
    return `${which} ${did.length} of ${mine.length} runs (${did.map((each) => `${each.record.id}-${each.record.run}${each.kept ? " kept" : ""}`).join(", ") || "none"})`;
  });
  lines.push(
    `the model ended the first cut's own title on the moment, in any round: ${endedLine.join("; ")}`,
    `calls: ${calls} of the cap ${cap}; runs not made: ${notMade.length > 0 ? notMade.join(", ") : "none"}; failed: ${records.filter((record) => record.failed !== null).length}`,
    `median change: ${seconds === null ? "-" : (seconds / 1000).toFixed(1)} s; cost ${cents4(records.reduce((sum, record) => sum + record.cents, 0))} c for ${records.length} runs (calculateCost)`,
  );
  const text = lines.join("\n");
  writeFileSync(join(out, "summary.md"), `${text}\n`);
  console.log(text);
}

/* ── the fixes tried (slice B, Task 10) ───────────────────────────────────────────────────────────────────────────────── */

/** The codes a setup is made for, in the brief's order: on each, the fix `fixes.ts` offers for its finding is tried. */
const FIX_CODES = ["soft-zoom", "on-face", "under-buttons", "short-text", "text-fits", "two-titles", "caption-rows", "cut-outside-pause"] as const satisfies readonly FindingCode[];
/** The setups' texts, made up: `examples` holds them to no word of the take. */
const SETUP_TEXTS = { short: "Short one", long: "This title is far too long to fit on the screen at any size people could read", second: "Second one" } as const;
/**
 * The zooms here the steps after a zoom are tried on: each made by code (`zoomHere`) at the moment of a request of moments.json,
 * to `zoom`, a push. m01's (the brief's) gets every zoom step. Its piece runs to the film's end, where nothing is left to hold a
 * zoom over, so "Hold it longer" is also tried on m04's, whose piece ends at the next cut (`suffix` names those runs).
 */
const STEP_ZOOMS: readonly { of: string; zoom: number; only: string | null; suffix: string }[] = [
  { of: "m01", zoom: 1.25, only: null, suffix: "" },
  { of: "m04", zoom: 1.25, only: "Hold it longer", suffix: "-m04" },
];
/** What each step's measure is, by its label in `next-steps.ts`. */
const STEP_MEASURES: Record<string, "less" | "longer"> = { "Zoom less": "less", "Hold it longer": "longer" };
/** Where the short and the long title of the setups start, and how long each shows: film frames of the base. */
const SETUP_TITLE = { at: 120, short: 12, long: 60 } as const;
/** The heights the captions are tried at for `on-face`, in order: the first that gives it. */
const ON_FACE_YS = [0.45, 0.35, 0.55] as const;
/** A fix stays on its button, and a step stays offered, when it did what it says in this many runs of three (E18). */
const KEEP_BAR = 2;
/** Findings about the footage and not a text: one of these is about the film, whatever shot it names. */
const FILM_CODES = new Set<FindingCode>(["soft-zoom", "cut-outside-pause", "fade-both", "empty-start", "no-analysis"]);
/** A framing this much tighter than the base's is seen to differ (`moment.ts`'s `SEEN`). */
const ZOOM_SEEN = 0.01;

/** A fix to try (`kind` "fix", on a setup that carries its finding) or a step after a zoom (`kind` "step", on the zoom here). */
interface FixJob {
  /** The finding's code, or the step's name ("step-zoom-less"). */
  id: string;
  kind: "fix" | "step";
  label: string;
  request: string;
  /** The film frame of `setup` it is sent with: the finding's (as the card sends it, inside the film), or the step's own. */
  at: number;
  setup: Edit;
  setupOps: Op[];
  /** For a fix, the finding its setup carries. */
  target: Finding | null;
  /** For a step, the piece the zoom here made: its id, its first and last film frames, the zoom it gets to. */
  piece: { id: string; first: number; last: number; to: number } | null;
  /** For a step, its measure: the zoom goes down, or more frames are tighter than the base. */
  step: "less" | "longer" | null;
}

interface FixRecord {
  id: string;
  kind: FixJob["kind"];
  run: number;
  tag: string;
  label: string;
  request: string;
  at: number;
  base: string;
  setupOps: Op[];
  target: { code: string; severity: string; where: Finding["where"]; key: string; thing: string } | null;
  piece: FixJob["piece"];
  /** Cleared (a fix: no finding of its code left about the same thing) or landed (a step); false when nothing changed. */
  verdict: boolean;
  /** A fix only: no finding left with the same `findingKey`, the brief's own measure; null for a step. */
  byKey: boolean | null;
  detail: string;
  calls: number;
  failed: string | null;
  ms: number;
  cents: number;
  tokens: { input: number; output: number };
  changed: boolean;
  say: string;
  sayBy: SayBy | null;
  rounds: ReturnType<typeof roundOf>[];
  outcomes: string[];
  truncated: boolean[];
  ops: Op[];
  /** What the review finds in the edit made: code, severity, where and key. */
  findings: { code: string; severity: string; where: Finding["where"]; key: string }[];
  edit: Edit | null;
}

/** What a finding is about across a fix: two titles at once, or the footage, are the film's; else its item, its mark or the captions. */
function thingKeyOf(finding: Finding): string {
  if (finding.code === "two-titles") return "(titles)";
  if (FILM_CODES.has(finding.code)) return "(film)";
  return finding.where.item ?? finding.where.mark ?? "(captions)";
}

/** Every mark and item of an edit, by id. */
const thingsById = (edit: Edit): Map<string, Mark | Item> => new Map([...edit.shots.flatMap((shot) => shot.marks), ...edit.items].map((thing) => [thing.id, thing]));

/**
 * The findings of the edit made that are still the target's: of its code and about the same thing, or about a thing of the same
 * part that the setup did not have (the thing taken out and put back under another id).
 */
function stillThere(target: Finding, setup: Edit, after: Edit, found: readonly Finding[]): Finding[] {
  const [had, has] = [thingsById(setup), thingsById(after)];
  const part = had.get(target.where.item ?? target.where.mark ?? "")?.part;
  return found.filter((finding) => {
    if (finding.code !== target.code) return false;
    if (thingKeyOf(finding) === thingKeyOf(target)) return true;
    const id = finding.where.item ?? finding.where.mark;
    return part !== undefined && id !== undefined && !had.has(id) && has.get(id)?.part === part;
  });
}

/** An op as it is printed and written in a detail: every text written as its length, never its words. */
function opLine(op: unknown): string {
  return JSON.stringify(op, (key, value: unknown) => (key === "text" && typeof value === "string" ? `<${value.length} letters>` : value));
}

/** The zoom of the framing on a film frame of `edit`, and the base's own framing of the same moment of the take; null where either shows none. */
async function zoomsOn(base: Edit, edit: Edit, frame: number): Promise<{ is: number; was: number } | null> {
  const { framingAt, momentAt } = await import("../src/lib/edit/derive");
  const here = momentAt(edit, frame);
  const shot = here ? edit.shots.find((each) => each.id === here.shot) : undefined;
  const was = shot && here ? base.shots.find((each) => each.asset === shot.asset && each.startMs <= here.ms && here.ms < each.endMs) : undefined;
  return here && shot && was ? { is: framingAt(shot, here.ms).zoom, was: framingAt(was, here.ms).zoom } : null;
}

/** How many frames of `edit` show the take tighter than the base shows the same moment of it. */
async function framesAbove(base: Edit, edit: Edit): Promise<number> {
  const { filmFrames } = await import("../src/lib/edit/derive");
  let count = 0;
  for (let frame = 0; frame < filmFrames(edit); frame++) {
    const zooms = await zoomsOn(base, edit, frame);
    if (zooms && zooms.is > zooms.was + ZOOM_SEEN) count += 1;
  }
  return count;
}

/** The zoom a framing gets to: its move's end, else its own (`moment.ts`'s `targetOf`). */
const targetZoom = (framing: Edit["shots"][number]["framing"]): number => framing.move?.to.zoom ?? framing.from.zoom;

/**
 * The setup of a code on the base, made by ops through the door (`applyOps`) and checked to carry its finding (`review`): the ops,
 * the edit and the finding (about the captions for a captions setup); or why it could not be made. The words by index, the frames
 * by the base's layout; the label that stays to the end is the base's title, taken out first where a second title would be
 * another finding. A title added takes the label's other props: the parts have no defaults of their own.
 */
async function setupOf(code: (typeof FIX_CODES)[number], take: Take, base: Edit): Promise<{ ops: Op[]; edit: Edit; finding: Finding; tried: string } | { none: string }> {
  const { applyOps } = await import("../src/lib/edit/ops");
  const { review, zoomLimit } = await import("../src/lib/edit/review");
  const library = [take.asset];
  const label = base.items.find((item) => item.part === "title" && item.anchor === "start" && item.frames === null);
  const labelProps = label?.part === "title" ? label.props : null;
  const title = (id: string, text: string, frames: number): Op | null =>
    labelProps ? { op: "item.add", item: { id, part: "title", anchor: "start", at: SETUP_TITLE.at, frames, props: { ...labelProps, text } } } : null;
  const withoutLabel: Op[] = label ? [{ op: "item.remove", id: label.id }] : [];
  /** The finding of `code` the edit made by `ops` carries, the captions' own for a captions setup. */
  const made = (ops: Op[], captions: boolean): { ops: Op[]; edit: Edit; finding: Finding } | { none: string } => {
    const door = applyOps(base, ops, library);
    if (!door.ok) return { none: `the door refused the setup: ${door.problems.map((problem) => problem.message).join("; ")}` };
    const finding = review(door.edit, take.analyses).find((each) => each.code === code && (!captions || thingKeyOf(each) === "(captions)"));
    return finding ? { ops, edit: door.edit, finding } : { none: `the setup does not carry ${code}` };
  };
  const tries = (each: { ops: Op[] | null; captions: boolean; tried: string }[]) => {
    let last: { none: string } = { none: `no setup for ${code}` };
    for (const { ops, captions, tried } of each) {
      if (!ops) return { none: "the base has no label title to take its props from" };
      const got = made(ops, captions);
      if ("finding" in got) return { ...got, tried };
      last = got;
    }
    return last;
  };
  switch (code) {
    case "soft-zoom": {
      const first = base.shots[0];
      if (!first || take.asset.kind !== "video") return { none: "the base has no shot of the take" };
      const zoom = Math.min(3, Math.round((zoomLimit(take.asset) + 0.3) * 1000) / 1000);
      return tries([{ ops: [{ op: "shot.set", id: first.id, framing: { from: { zoom, x: 0, y: 0 }, move: null } }], captions: false, tried: `shot ${first.id} still at zoom ${zoom}` }]);
    }
    case "on-face":
      return tries(ON_FACE_YS.map((y) => ({ ops: [{ op: "captions.set", y }], captions: true, tried: `captions y ${y}` })));
    case "under-buttons":
      return tries([{ ops: [{ op: "captions.set", y: 0.93 }], captions: true, tried: "captions y 0.93" }]);
    case "short-text": {
      const add = title("t-short", SETUP_TEXTS.short, SETUP_TITLE.short);
      return tries([{ ops: add && [...withoutLabel, add], captions: false, tried: `label out; a title at ${SETUP_TITLE.at} for ${SETUP_TITLE.short} frames` }]);
    }
    case "text-fits": {
      // The brief's long title first. The kit sets a title of up to 80 letters in three lines at 48 px or more, so it never has
      // to set one smaller: then the captions, narrowed until a word of the take no longer fits its row at 44 px.
      const add = title("t-long", SETUP_TEXTS.long, SETUP_TITLE.long);
      return tries([
        { ops: add && [...withoutLabel, add], captions: false, tried: `label out; a title of ${SETUP_TEXTS.long.length} letters at ${SETUP_TITLE.at} for ${SETUP_TITLE.long} frames` },
        ...[0.15, 0.1].map((width) => ({ ops: [{ op: "captions.set", width } satisfies Op], captions: true, tried: `the title cannot carry it; captions width ${width}` })),
      ]);
    }
    case "two-titles": {
      const add = title("t-second", SETUP_TEXTS.second, SETUP_TITLE.long);
      return tries([{ ops: add && [add], captions: false, tried: `a second title at ${SETUP_TITLE.at} for ${SETUP_TITLE.long} frames over the label` }]);
    }
    case "caption-rows":
      return tries([
        { ops: [{ op: "captions.set", maxWords: 12, width: 0.5 }], captions: true, tried: "captions 12 words a page, width 0.5" },
        { ops: [{ op: "captions.set", maxWords: 12, width: 0.5, size: base.captions.size + 16 }], captions: true, tried: `captions 12 words a page, width 0.5, size ${base.captions.size + 16}` },
        // The take's pages break at its sentences, so 12 words a page set four rows nowhere: the most words, and narrower.
        { ops: [{ op: "captions.set", maxWords: 16, width: 0.4, size: base.captions.size + 16 }], captions: true, tried: `captions 16 words a page, width 0.4, size ${base.captions.size + 16}` },
      ]);
    case "cut-outside-pause": {
      const first = base.shots[0];
      const clip = first && base.assets.find((asset) => asset.id === first.asset);
      const words = clip?.kind === "video" ? (clip.words ?? []) : [];
      const index = first ? words.findLastIndex((word) => first.startMs <= (word.startMs + word.endMs) / 2 && (word.startMs + word.endMs) / 2 < first.endMs) : -1;
      const word = words[index];
      if (!first || !word) return { none: "the base's first shot shows no word" };
      const middle = Math.round((word.startMs + word.endMs) / 2);
      return tries([{ ops: [{ op: "shot.trim", id: first.id, endMs: middle }], captions: false, tried: `shot ${first.id} ends in the middle of w${index}, its last word` }]);
    }
  }
}

/**
 * The jobs: each code's setup and its fix as `fixes.ts` offers it for the setup's finding, sent at the finding's frame; then the
 * steps `next-steps.ts` offers after a zoom here, on the base with that zoom made by code at `STEP_ZOOM`'s moment. A setup that
 * cannot be made, or a finding with no fix, is not tried, with why.
 */
async function fixJobs(take: Take, base: Edit, only: string[]): Promise<{ jobs: FixJob[]; notTried: { id: string; why: string }[] }> {
  const { applyOps } = await import("../src/lib/edit/ops");
  const { filmFrames } = await import("../src/lib/edit/derive");
  const { fixOf } = await import("../src/components/editor/fixes");
  const { nextSteps } = await import("../src/lib/edit/next-steps");
  const { momentFor, zoomHere } = await import("../src/lib/edit/agent/moment");
  const jobs: FixJob[] = [];
  const notTried: { id: string; why: string }[] = [];
  for (const code of FIX_CODES) {
    const setup = await setupOf(code, take, base);
    if ("none" in setup) {
      notTried.push({ id: code, why: setup.none });
      continue;
    }
    const fix = fixOf(setup.finding, setup.edit);
    if (!fix) {
      notTried.push({ id: code, why: "fixes.ts offers no fix for it (Show only)" });
      continue;
    }
    jobs.push({ id: code, kind: "fix", label: fix.label, request: fix.request, at: Math.min(setup.finding.where.frame, filmFrames(setup.edit) - 1), setup: setup.edit, setupOps: setup.ops, target: setup.finding, piece: null, step: null });
  }
  const moments = MomentsSchema.parse(JSON.parse(readFileSync(MOMENTS, "utf8"))).moments;
  for (const zoom of STEP_ZOOMS) {
    const of = moments.find((each) => each.id === zoom.of);
    const moment = of ? momentFor(base, take.analyses, of.frame) : null;
    const zoomed = moment ? zoomHere(base, take.analyses, moment, zoom.zoom, false, [take.asset]) : null;
    const door = zoomed && "ops" in zoomed ? applyOps(base, zoomed.ops, [take.asset]) : null;
    if (!moment || !zoomed || "none" in zoomed || !door?.ok) {
      notTried.push({ id: `steps${zoom.suffix}`, why: `no zoom here at ${zoom.of}'s moment: ${zoomed && "none" in zoomed ? zoomed.none : door && !door.ok ? door.problems.map((problem) => problem.message).join("; ") : "no moment"}` });
      continue;
    }
    const set = zoomed.ops.at(-1);
    const piece = { id: set?.op === "shot.set" ? set.id : moment.shot, first: zoomed.first, last: zoomed.last, to: zoomed.to };
    for (const step of nextSteps(base, door.edit).filter((each) => each.kind === "zoom" && (zoom.only === null || each.label === zoom.only))) {
      const measure = STEP_MEASURES[step.label];
      if (!measure) throw new Error(`next-steps.ts offers a zoom step "${step.label}" that this proof has no measure for`);
      if (step.request === null || step.at === null) continue;
      const id = `step-${step.label.toLowerCase().replace(/[^a-z]+/g, "-")}${zoom.suffix}`;
      jobs.push({ id, kind: "step", label: step.label, request: step.request, at: step.at, setup: door.edit, setupOps: zoomed.ops, target: null, piece, step: measure });
    }
  }
  const unknown = only.filter((id) => !jobs.some((job) => job.id === id) && !notTried.some((each) => each.id === id));
  if (unknown.length > 0) throw new Error(`no fix or step ${unknown.join(", ")}`);
  return only.length > 0 ? { jobs: jobs.filter((job) => only.includes(job.id)), notTried: notTried.filter((each) => only.includes(each.id)) } : { jobs, notTried };
}

/**
 * Whether a run did what its button says, and what the measure looked at. A fix clears its finding: the change was taken and the
 * edit it made has no finding of its code about the same thing (`stillThere`), which also holds `findingKey`'s own measure (`byKey`:
 * no finding with the target's key). "Zoom less" lands when the zoom the piece gets to went down; "Hold it longer" when more frames
 * show the take tighter than the base shows the same moment.
 */
async function verdictOf(job: FixJob, base: Edit, result: AgentResult): Promise<{ verdict: boolean; byKey: boolean | null; detail: string }> {
  const { findingKey } = await import("../src/lib/edit/kept");
  const { momentAt } = await import("../src/lib/edit/derive");
  if (job.target) {
    const left = stillThere(job.target, job.setup, result.edit, result.findings);
    const key = findingKey(job.target);
    const byKey = result.changed && !result.findings.some((finding) => findingKey(finding) === key);
    const says = left.map((finding) => `${finding.code} ${finding.severity} @${finding.where.frame} ${findingKey(finding)}`).join(", ");
    return { verdict: result.changed && left.length === 0, byKey, detail: `${result.changed ? "taken" : "not taken"}; left: ${says || "none"}` };
  }
  const piece = job.piece;
  if (!piece) return { verdict: false, byKey: null, detail: "no piece" };
  if (job.step === "less") {
    // The piece by its id, else the shot on its first frame.
    const here = momentAt(result.edit, job.at);
    const now = result.edit.shots.find((shot) => shot.id === piece.id) ?? result.edit.shots.find((shot) => shot.id === here?.shot);
    const was = job.setup.shots.find((shot) => shot.id === piece.id);
    const [before, after] = [was ? targetZoom(was.framing) : null, now ? targetZoom(now.framing) : null];
    const lower = before !== null && after !== null && after < before - 1e-9;
    return { verdict: result.changed && lower, byKey: null, detail: `piece ${piece.id}${now && now.id !== piece.id ? ` (now ${now.id})` : ""} gets to ${before ?? "?"} > ${after ?? "gone"}` };
  }
  const [was, is] = [await framesAbove(base, job.setup), await framesAbove(base, result.edit)];
  return { verdict: result.changed && is > was, byKey: null, detail: `frames tighter than the base ${was} > ${is}` };
}

function fixRecordsOf(dir: string): FixRecord[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^[a-z][a-z0-9-]*-\d+\.json$/.test(name))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as FixRecord);
}

async function runFixes(flags: Record<string, string>, only: string[]): Promise<void> {
  const take = await takeOf(flags);
  const { AGENT_LIMITS, change } = await import("../src/lib/edit/agent/loop");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { review } = await import("../src/lib/edit/review");
  const { findingKey } = await import("../src/lib/edit/kept");
  const { sentenceOf } = await import("../src/components/editor/fixes");
  const tag = flags.tag ?? "fixes";
  const out = join(flags.out ?? ".scratch/editor/slice-b/proof", tag);
  const runs = Number(flags.runs ?? 3);
  const cap = Number(flags.calls ?? 110);
  if (!Number.isInteger(runs) || runs < 0 || !Number.isInteger(cap) || cap < 0) throw new Error("--runs and --calls are whole numbers");
  const baseFile = flags.base ?? ".scratch/native-default-2/first-cut/house-1.json";
  const base = baseOf(take, { ...flags, base: baseFile });
  const mask = sayMasker(base, MomentsSchema.parse(JSON.parse(readFileSync(MOMENTS, "utf8"))).allowed);
  const say = (line: unknown) => console.log(take.masked(JSON.stringify(line)));
  const { jobs, notTried } = await fixJobs(take, base, only);

  // Each setup, its finding and what is sent: printed before anything runs. The findings the base has are left out of "new".
  const had = new Set(review(base, take.analyses).map((finding) => `${finding.code} ${thingKeyOf(finding)} ${finding.severity}`));
  say({ base: baseFile, findings: review(base, take.analyses).map((finding) => `${finding.code} ${finding.severity} @${finding.where.frame} ${findingKey(finding)}`) });
  for (const job of jobs) {
    const found = review(job.setup, take.analyses);
    const fresh = found.filter((finding) => !had.has(`${finding.code} ${thingKeyOf(finding)} ${finding.severity}`)).map((finding) => `${finding.code} ${finding.severity} @${finding.where.frame} ${findingKey(finding)}`);
    const target = job.target ? { code: job.target.code, severity: job.target.severity, frame: job.target.where.frame, key: findingKey(job.target), thing: thingKeyOf(job.target), sentence: sentenceOf(job.target, job.setup) } : null;
    say({ id: job.id, kind: job.kind, setup: job.setupOps.map(opLine), target, piece: job.piece, label: job.label, request: job.request, at: job.at, newInSetup: fresh });
  }
  for (const each of notTried) say({ id: each.id, notTried: each.why });

  const plan = Array.from({ length: runs }, (_, i) => i + 1).flatMap((k) => jobs.map((job) => ({ job, k })));
  const fileOf = (id: string, k: number) => join(out, `${id}-${k}.json`);
  // The cap holds for the tag's folder: the calls its records made already count.
  let calls = fixRecordsOf(out).reduce((sum, record) => sum + record.calls, 0);
  say({ tag, runs, jobs: jobs.length, planned: plan.length, there: plan.filter(({ job, k }) => existsSync(fileOf(job.id, k))).length, calls, cap, mostCallsARun: MOST_CALLS_A_RUN });
  if (runs === 0) return;
  mkdirSync(out, { recursive: true });

  const notMade: string[] = [];
  for (const { job, k } of plan) {
    const file = fileOf(job.id, k);
    if (existsSync(file) && !flags.force) continue;
    if (calls + MOST_CALLS_A_RUN > cap) {
      notMade.push(`${job.id}-${k}`);
      continue;
    }
    const { ask: asked, answers } = asking(askQwen, {});
    let made = 0;
    const ask: Ask = async (messages, opts) => {
      if (calls >= cap) throw new Error(`the cap of ${cap} model calls is reached`);
      calls += 1;
      made += 1;
      return asked(messages, opts);
    };
    // The model's look is off (`AGENT_LIMITS.look`): no stills are drawn, and none may be asked of the worker here.
    const stills: typeof StillsOf = async () => {
      throw new Error("no stills in the fixes' proof");
    };
    const record: FixRecord = {
      id: job.id, kind: job.kind, run: k, tag, label: job.label, request: job.request, at: job.at, base: baseFile, setupOps: job.setupOps,
      target: job.target ? { code: job.target.code, severity: job.target.severity, where: job.target.where, key: findingKey(job.target), thing: thingKeyOf(job.target) } : null,
      piece: job.piece, verdict: false, byKey: null, detail: "", calls: 0, failed: null, ms: 0, cents: 0, tokens: { input: 0, output: 0 }, changed: false, say: "", sayBy: null,
      rounds: [], outcomes: [], truncated: [], ops: [], findings: [], edit: null,
    };
    try {
      // As the route sends it (`changeEdit`): the edit shown, the request and the frame, the take as the library.
      const result = await change({ edit: job.setup, analyses: take.analyses, request: job.request, library: [take.asset], user: take.user, deadlineMs: Date.now() + AGENT_LIMITS.changeMs, at: job.at }, { ask, stills });
      Object.assign(record, await verdictOf(job, base, result), {
        ms: result.ms, cents: cents4(result.cost), tokens: result.tokens, changed: result.changed, say: result.say, sayBy: result.sayBy,
        rounds: result.rounds.map(roundOf), outcomes: result.rounds.map((round) => round.outcome), truncated: answers.map((answer) => answer.truncated), ops: result.ops,
        findings: result.findings.map((finding) => ({ code: finding.code, severity: finding.severity, where: finding.where, key: findingKey(finding) })), edit: result.edit,
      });
    } catch (error) {
      record.failed = error instanceof Error ? error.message : String(error);
    }
    record.calls = made;
    writeFileSync(file, take.masked(JSON.stringify(record, null, 1)));
    writeFileSync(join(out, `${job.id}-${k}-answers.json`), take.masked(JSON.stringify(answers, null, 1)));
    say({ id: job.id, run: k, verdict: record.verdict, byKey: record.byKey, detail: record.detail, s: round1(record.ms / 1000), calls: made, total: calls, cents: record.cents, outcomes: record.outcomes, failed: record.failed, say: mask(record.say, record.request) });
  }
  if (notMade.length > 0) say({ notMade: notMade.length, why: `the next could pass the cap of ${cap} calls` });
  fixesSummary(out, jobs, notTried, runs, cap, mask);
}

/** Per fix and step, how many runs of `runs` did what the button says, kept or not, from the tag's records; a run not made is a miss. */
function fixesSummary(out: string, jobs: FixJob[], notTried: { id: string; why: string }[], runs: number, cap: number, mask: (say: string, request: string) => string): void {
  const records = fixRecordsOf(out).filter((record) => record.run <= runs);
  const ids = [...new Set([...jobs.map((job) => job.id), ...records.map((record) => record.id)])];
  const short = (text: string, most: number) => (text.length > most ? `${text.slice(0, most - 1)}…` : text);
  const verdict = (record: FixRecord) => (record.failed ? `failed: ${record.failed}` : record.verdict ? "yes" : "no");
  const lines = [
    "| id | run | verdict | by key | what was measured | outcomes | say (shortened) | calls | cents | s |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...records.map((record) => `| ${record.id} | ${record.run} | ${verdict(record)} | ${record.byKey === null ? "-" : record.byKey ? "yes" : "no"} | ${record.detail.replaceAll("|", "/")} | ${record.outcomes.join(", ")} | ${short(mask(record.say, record.request), 90).replaceAll("|", "/")} | ${record.calls} | ${record.cents} | ${round1(record.ms / 1000)} |`),
    "",
    "| id | button | request | did it, of | kept |",
    "|---|---|---|---|---|",
    ...ids.map((id) => {
      const mine = records.filter((record) => record.id === id);
      const yes = mine.filter((record) => record.verdict).length;
      const first = mine[0] ?? jobs.find((job) => job.id === id);
      return `| ${id} | ${first?.label ?? "-"} | ${first?.request ?? "-"} | ${yes} of ${runs} | ${yes >= KEEP_BAR ? "kept" : first?.kind === "step" ? "removed" : "Show only"} |`;
    }),
    ...notTried.map((each) => `| ${each.id} | - | - | not tried: ${each.why} | Show only |`),
    "",
  ];
  const notMade = ids.flatMap((id) => Array.from({ length: runs }, (_, i) => i + 1).filter((k) => !records.some((record) => record.id === id && record.run === k)).map((k) => `${id}-${k}`));
  const seconds = median(records.filter((record) => record.failed === null).map((record) => record.ms));
  lines.push(
    `calls: ${records.reduce((sum, record) => sum + record.calls, 0)} of the cap ${cap}; runs not made: ${notMade.length > 0 ? notMade.join(", ") : "none"}; failed: ${records.filter((record) => record.failed !== null).length}`,
    `median change: ${seconds === null ? "-" : (seconds / 1000).toFixed(1)} s; cost ${cents4(records.reduce((sum, record) => sum + record.cents, 0))} c for ${records.length} runs (calculateCost)`,
  );
  const text = lines.join("\n");
  writeFileSync(join(out, "summary.md"), `${text}\n`);
  console.log(text);
}

/* ── through the app's own routes ─────────────────────────────────────────────────────────────────────────────────────── */

const PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** A dev server of this script's own, bound to this machine, its output into `<out>/dev.log`; stopped by `stop`. */
async function devServer(out: string): Promise<{ base: string; stop: () => void }> {
  const port = PORTS.find((each) => {
    try {
      execFileSync("lsof", ["-ti", `:${each}`], { stdio: "pipe" });
      return false;
    } catch {
      return true; // lsof exits 1 when nothing listens
    }
  });
  if (port === undefined) throw new Error("no port from 3000 to 3005 is free");
  const base = `http://127.0.0.1:${port}`;
  mkdirSync(out, { recursive: true });
  const log = createWriteStream(join(out, "dev.log"), { flags: "a" });
  const server: ChildProcess = spawn("pnpm", ["exec", "next", "dev", "-H", "127.0.0.1", "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  const stop = () => {
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  process.once("exit", stop);
  const up = () => fetch(`${base}/api/edit/takes`).then(() => true, () => false);
  // Only its own server: one that stops (another `next dev` holds this worktree's lock) must not leave the run talking to another's.
  const stopped = () => server.exitCode !== null || server.signalCode !== null;
  for (let waited = 0; waited < 240 && !stopped() && !(await up()); waited++) await pause(500);
  if (stopped()) throw new Error("the dev server stopped before it was up: another `next dev` holds this worktree's lock (see dev.log)");
  if (!(await up())) {
    stop();
    throw new Error("the dev server did not come up in two minutes");
  }
  return { base, stop };
}

/** The test account signed in: its session's cookies as `@supabase/ssr` reads them, and its id. */
async function signIn(): Promise<{ cookie: string; user: string }> {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  const anon = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: need("E2E_USER_EMAIL"), password: need("E2E_USER_PASSWORD") }),
  });
  if (!response.ok) throw new Error(`the test account could not sign in: Supabase answered ${response.status}`);
  const token = (await response.json()) as { access_token: string; user: { id: string } };
  const value = `base64-${Buffer.from(JSON.stringify(token)).toString("base64url")}`;
  const ref = new URL(url).hostname.split(".")[0];
  return { cookie: (value.match(/.{1,3180}/g) ?? []).map((chunk, i) => `sb-${ref}-auth-token.${i}=${chunk}`).join("; "), user: token.user.id };
}

/** A first cut in each phrase's style, through the route. */
async function words(flags: Record<string, string>, phrases: string[]): Promise<void> {
  if (phrases.length === 0) throw new Error('usage: edit-agent-proof.ts words "<phrase>"…');
  const out = join(flags.out ?? ".scratch/task14", "words");
  const ids = JSON.parse(readFileSync(flags.ids ?? ".scratch/stills-proof/ids.json", "utf8")) as { user: string; takes: string[] };
  const take = ids.takes[Number(flags.take ?? 0)];
  const who = await signIn();
  if (who.user !== ids.user || !take) throw new Error("the ids file's take is not the test account's");
  const { base, stop } = await devServer(out);
  try {
    const headers = { cookie: who.cookie, "content-type": "application/json" }; // no Origin: a call from this machine, not a page
    await fetch(`${base}/api/edit/agent`, { method: "POST", headers, body: "{}" }); // the route compiled before anything is timed
    for (const [i, phrase] of phrases.entries()) {
      const started = performance.now();
      const response = await fetch(`${base}/api/edit/agent`, { method: "POST", headers, body: JSON.stringify({ takes: [take], firstCut: true, style: { words: phrase } }) });
      const seconds = round1((performance.now() - started) / 1000);
      const answer = (await response.json()) as { error?: string; say?: string; styleSay?: string | null; style?: StyleProfile | null; cost?: number; rounds?: unknown[]; findings?: Finding[]; match?: { fields: { field: string; verdict: string }[]; notMatched: string[] } | null; edit?: Edit };
      const record = {
        phrase, status: response.status, seconds, error: answer.error ?? null, cents: answer.cost === undefined ? null : cents4(answer.cost), rounds: answer.rounds?.length ?? null,
        styleSay: answer.styleSay ?? null, style: answer.style ?? null, say: answer.say ?? null,
        errorsLeft: (answer.findings ?? []).filter((finding) => finding.severity === "error").map((finding) => finding.code),
        match: answer.match ? { matched: answer.match.fields.filter((field) => field.verdict === "matched").length, near: answer.match.fields.filter((field) => field.verdict === "near").length, not: answer.match.fields.filter((field) => field.verdict === "not").map((field) => field.field), notMatched: answer.match.notMatched } : null,
      };
      const text = JSON.stringify({ ...record, edit: answer.edit ?? null }, null, 1).replaceAll(ids.user, "<user>").replaceAll(take, "<take>");
      writeFileSync(join(out, `${i + 1}.json`), text);
      console.log(JSON.stringify({ ...record, style: record.style ? { source: record.style.source, pace: record.style.pace, captions: record.style.captions, title: record.style.title, punchIns: record.style.punchIns, look: record.style.look } : null }));
    }
  } finally {
    stop();
  }
}

/** Another take, uploaded and analysed through the app's own routes. */
async function extraUpload(flags: Record<string, string>): Promise<void> {
  const out = join(flags.out ?? ".scratch/task14", "extra");
  const file = join(".scratch/media", flags.file ?? "");
  if (!flags.file || !existsSync(file)) throw new Error("usage: edit-agent-proof.ts extra-upload --file <name in .scratch/media>");
  if (existsSync(join(out, "ids.json"))) throw new Error(`a take is up for ${out} already: take it away first (extra-delete), or its ids would be written over`);
  const bytes = statSync(file).size;
  const who = await signIn();
  const { base, stop } = await devServer(out);
  try {
    const headers = { cookie: who.cookie, "content-type": "application/json" };
    const times: Record<string, number> = {};
    let started = performance.now();
    const signedFor = await fetch(`${base}/api/edit/takes`, { method: "POST", headers, body: JSON.stringify({ name: flags.name ?? "task14-extra.mp4", bytes, type: "video/mp4" }) });
    const made = (await signedFor.json()) as { take?: { id: string }; uploadUrl?: string; error?: string };
    if (signedFor.status !== 201 || !made.take || !made.uploadUrl) throw new Error(`the take was not signed for: ${signedFor.status} ${made.error ?? ""}`);
    const id = made.take.id;
    writeFileSync(join(out, "ids.json"), JSON.stringify({ user: who.user, takes: [id] }));
    const put = await fetch(made.uploadUrl, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(bytes) }, body: readFileSync(file) });
    if (!put.ok) throw new Error(`R2 answered ${put.status} to the upload`);
    times.upload = round1((performance.now() - started) / 1000);
    started = performance.now();
    const said = await fetch(`${base}/api/edit/takes/${id}/uploaded`, { method: "POST", headers, body: "{}" });
    if (said.status !== 202) throw new Error(`the upload was not taken: ${said.status} ${JSON.stringify(await said.json())}`);
    let status = "analysing";
    for (let tries = 0; tries < 300 && status !== "ready" && status !== "failed"; tries++) {
      await pause(2000);
      const seen = (await fetch(`${base}/api/edit/takes/${id}`, { headers }).then((response) => response.json())) as { take?: { status: string; error: string | null } };
      status = seen.take?.status ?? status;
      if (status === "failed") throw new Error(`the take's analysis failed: ${seen.take?.error ?? ""}`);
    }
    if (status !== "ready") throw new Error("the take was not analysed in ten minutes");
    times.analysis = round1((performance.now() - started) / 1000);
    console.log(JSON.stringify({ extra: "ready", bytes, ...times }));
  } finally {
    stop();
  }
}

/** That take taken away again, with nothing left of it. */
async function extraDelete(flags: Record<string, string>): Promise<void> {
  const file = join(flags.out ?? ".scratch/task14", "extra", "ids.json");
  const ids = JSON.parse(readFileSync(file, "utf8")) as { user: string; takes: string[] };
  const { dropReference } = await import("../src/lib/edit/style/reference");
  const { folderOf, objectsUnder } = await import("../src/lib/edit/worker/r2");
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  for (const id of ids.takes) {
    // The drop a reference gets: its files under its own folder, then its row (its jobs go with it).
    await dropReference(service, ids.user, id);
    const objects = await objectsUnder(folderOf(ids.user, { take: id }));
    const { data: takes } = await service.from("edit_takes").select("id").eq("id", id);
    const { data: jobs } = await service.from("edit_jobs").select("id").eq("take_id", id);
    console.log(JSON.stringify({ extra: "deleted", left: { objects: objects.length, takeRows: takes?.length ?? null, jobRows: jobs?.length ?? null } }));
    if (objects.length > 0 || (takes?.length ?? 1) > 0 || (jobs?.length ?? 1) > 0) throw new Error("something of the take is left");
  }
  rmSync(file);
}

/**
 * What the e2e test account holds, counted: its take rows and its files in R2 by folder (a take's own, its films, anything
 * else), with no id printed. For the proof's record that a take taken away left nothing outside its own folder and rows: the
 * worker's stills are answered in the response and stored nowhere (worker/store.py, `stills_request`).
 */
async function extraLeft(): Promise<void> {
  const who = await signIn();
  const { objectsUnder } = await import("../src/lib/edit/worker/r2");
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: takes } = await service.from("edit_takes").select("id, status").eq("user_id", who.user);
  const { data: jobs } = await service.from("edit_jobs").select("id, take_id").eq("user_id", who.user);
  const rows = new Set((takes ?? []).map((take) => take.id));
  const objects = await objectsUnder(`u/${who.user}/`);
  const takeOf = (key: string) => /\/takes\/([^/]+)\//.exec(key)?.[1] ?? null;
  const held = objects.filter((key) => takeOf(key) !== null);
  console.log(JSON.stringify({
    takeRows: rows.size, jobRows: jobs?.length ?? null, jobsOfNoTake: (jobs ?? []).filter((job) => job.take_id !== null && !rows.has(job.take_id)).length,
    objects: objects.length, underATakeWithARow: held.filter((key) => rows.has(takeOf(key) ?? "")).length, underATakeWithNoRow: held.filter((key) => !rows.has(takeOf(key) ?? "")).length,
    films: objects.filter((key) => key.includes("/films/")).length, elsewhere: objects.filter((key) => takeOf(key) === null && !key.includes("/films/")).length,
  }));
}

/**
 * The prompt's examples held against the take's own words, here on this Mac (the words are in no file of the repo): every text
 * the prompt quotes, and how many are a word of the take or hold two of its words in a row. Prints counts and which example by
 * its number, never the words.
 */
async function examples(flags: Record<string, string>): Promise<void> {
  const { systemPrompt, ONLY, closingMessage } = await import("../src/lib/edit/agent/prompt");
  const base = JSON.parse(readFileSync(flags.base ?? ".scratch/task14/first-cut/house-1.json", "utf8")) as { edit: Edit };
  const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
  const words = base.edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []) : [])).map((word) => plain(word.text)).filter(Boolean);
  const told = [systemPrompt(), ONLY, closingMessage()].join("\n");
  const quoted = [...told.matchAll(/"([^"\n]{2,160})"|“([^”\n]{2,160})”/g)].map((match) => plain(match[1] ?? match[2] ?? ""));
  // Two words in a row count when one of them is a word of four letters or more: "in the" is everyone's.
  const pairs = new Set(words.slice(0, -1).flatMap((word, i) => (Math.max(word.length, words[i + 1]?.length ?? 0) >= 4 ? [`${word} ${words[i + 1]}`] : [])));
  const hits = quoted.flatMap((example, i) => {
    const tokens = example.split(" ");
    const isWord = tokens.length === 1 && example.length >= 4 && words.includes(example);
    const holdsTwo = tokens.slice(0, -1).some((token, k) => pairs.has(`${token} ${tokens[k + 1]}`));
    return isWord || holdsTwo ? [{ example: i + 1, isWord, holdsTwo }] : [];
  });
  // The requests' own file, every string of it (the requests, their notes, what it says of itself), against the take: the
  // only words of the take of four letters or more it may hold are the ones it names (`takeWords`), and no three of the take's
  // words in a row. Told by where, never by the word: the committed test cannot hold the take's words, so this is the count.
  const file = RequestsSchema.parse(JSON.parse(readFileSync(REQUESTS, "utf8")));
  const named = new Set(file.takeWords.map(plain));
  const taken = new Set(words.filter((word) => word.length >= 4));
  const strings: [string, string][] = [["about", file.about], ...file.requests.flatMap((each): [string, string][] => [[`${each.id} request`, each.request], ...(each.note ? [[`${each.id} note`, each.note] as [string, string]] : [])])];
  const others = strings.flatMap(([where, text]) => (plain(text).split(" ").some((token) => taken.has(token) && !named.has(token)) ? [where] : []));
  const runs = strings.flatMap(([where, text]) => (threeInARow(plain(text).split(" "), words) ? [where] : []));
  const missing = [...named].filter((word) => !words.includes(word)).length;
  // The moments' file the same way, every string of it: no word of the take of four letters or more but the pointing words it
  // allows (each of which must point, `pointsAt`), and no three of the take's words in a row. By where, never by the word.
  const { pointsAt } = await import("../src/lib/edit/agent/moment");
  const moments = MomentsSchema.parse(JSON.parse(readFileSync(MOMENTS, "utf8")));
  const allowed = new Set(moments.allowed.map(plain));
  const notPointing = [...allowed].filter((word) => !pointsAt(word));
  const momentStrings: [string, string][] = [
    ["about", moments.about],
    ...moments.moments.map((each): [string, string] => [`${each.id} request`, each.request]),
    ...moments.controls.flatMap((each): [string, string][] => (each.request ? [[`${each.id} request`, each.request]] : [])),
  ];
  const momentOthers = momentStrings.flatMap(([where, text]) => (plain(text).split(" ").some((token) => taken.has(token) && !allowed.has(token)) ? [where] : []));
  const momentRuns = momentStrings.flatMap(([where, text]) => (threeInARow(plain(text).split(" "), words) ? [where] : []));
  // What the fixes' proof sends and makes up (Task 10): every fix request `fixes.ts` has, of the captions, a title and a call-out;
  // the zoom steps' requests of `next-steps.ts`; the setups' texts. The same rule as the moments' file, its pointing words allowed.
  const fixStrings = await fixesStrings(base.edit);
  const fixOthers = fixStrings.flatMap(([where, text]) => (plain(text).split(" ").some((token) => taken.has(token) && !allowed.has(token)) ? [where] : []));
  const fixRuns = fixStrings.flatMap(([where, text]) => (threeInARow(plain(text).split(" "), words) ? [where] : []));
  console.log(JSON.stringify({
    examples: quoted.length, takeWords: words.length, hits,
    requestsFile: { strings: strings.length, named: named.size, namedNotInTheTake: missing, holdsAnotherWordOfTheTake: others, holdsThreeInARow: runs },
    momentsFile: { strings: momentStrings.length, allowed: allowed.size, allowedNotPointing: notPointing.length, holdsAnotherWordOfTheTake: momentOthers, holdsThreeInARow: momentRuns },
    fixes: { strings: fixStrings.length, holdsAnotherWordOfTheTake: fixOthers, holdsThreeInARow: fixRuns },
  }));
  if (hits.length > 0 || others.length > 0 || runs.length > 0 || missing > 0 || notPointing.length > 0 || momentOthers.length > 0 || momentRuns.length > 0 || fixOthers.length > 0 || fixRuns.length > 0) process.exitCode = 1;
}

/** Every code the review has, so that each fix of `fixes.ts` is read: a code added to the review fails to compile here. */
const ALL_CODES = Object.keys({
  "on-face": 1, "under-buttons": 1, "on-text": 1, "text-fits": 1, "two-titles": 1, "cut-outside-pause": 1, "empty-start": 1,
  "short-text": 1, "mark-hidden": 1, "fade-both": 1, "soft-zoom": 1, "caption-rows": 1, unmeasured: 1, "no-analysis": 1,
} satisfies Record<FindingCode, 1>) as FindingCode[];

/**
 * The strings the fixes' proof sends or makes up, by where: each fix request `fixes.ts` gives, of the captions, of a title and of a
 * call-out (on the first cut with one of each added), the requests of the zoom steps `next-steps.ts` offers after a zoom, and the
 * setups' texts. `edit` is the first cut as written, its ids masked.
 */
async function fixesStrings(edit: Edit): Promise<[string, string][]> {
  const { applyOps } = await import("../src/lib/edit/ops");
  const { fixOf } = await import("../src/components/editor/fixes");
  const { nextSteps } = await import("../src/lib/edit/next-steps");
  // The ids a written first cut masks are not ids the door takes: plain ones stand in.
  const plainEdit = JSON.parse(JSON.stringify(edit).replaceAll("<take>", "take").replaceAll("<user>", "user")) as Edit;
  const [first] = plainEdit.shots;
  const label = plainEdit.items.find((item) => item.part === "title");
  if (!first || label?.part !== "title") throw new Error("the first cut has no shot or no title to name the fixes' things by");
  const things = applyOps(plainEdit, [
    { op: "item.add", item: { id: "t-named", part: "title", anchor: "start", at: SETUP_TITLE.at, frames: SETUP_TITLE.long, props: { ...label.props, text: SETUP_TEXTS.second } } },
    { op: "mark.add", shot: first.id, mark: { id: "c-named", part: "callout", atMs: first.startMs + 500, lenMs: 1000, props: { text: SETUP_TEXTS.short, font: label.props.font, look: "pop", x: 0.5, y: 0.4, size: 64, color: "#ffffff" } } },
  ], plainEdit.assets);
  if (!things.ok) throw new Error(`the fixes' things were refused: ${things.problems.map((problem) => problem.message).join("; ")}`);
  const wheres: [string, Finding["where"]][] = [["captions", { frame: 0 }], ["title", { frame: 0, item: "t-named" }], ["call-out", { frame: 0, shot: first.id, mark: "c-named" }]];
  const requests = new Map<string, string>();
  for (const code of ALL_CODES) {
    for (const [thing, where] of wheres) {
      const fix = fixOf({ code, severity: "warn", where, says: "" }, things.edit);
      if (fix && !requests.has(fix.request)) requests.set(fix.request, `fix ${code} of the ${thing}`);
    }
  }
  const zoomed = applyOps(plainEdit, [{ op: "shot.set", id: first.id, framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }], plainEdit.assets);
  if (!zoomed.ok) throw new Error("the zoom for the steps was refused");
  const steps = nextSteps(plainEdit, zoomed.edit).flatMap((step): [string, string][] => (step.request ? [[`step ${step.label}`, step.request]] : []));
  return [...[...requests].map(([request, where]): [string, string] => [where, request]), ...steps, ...Object.entries(SETUP_TEXTS).map(([name, text]): [string, string] => [`setup text ${name}`, text])];
}

/** True when `tokens` hold three words of the take in a row, in the take's order. */
function threeInARow(tokens: readonly string[], words: readonly string[]): boolean {
  return tokens.some((_, i) => words.some((__, j) => tokens[i] === words[j] && tokens[i + 1] === words[j + 1] && tokens[i + 2] === words[j + 2] && words[j + 2] !== undefined));
}

/* ── main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const [mode, ...argv] = process.argv.slice(2);
  const { flags, rest } = argsOf(argv, ["--render", "--no-stills", "--force", "--short-block"]);
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  // The app's clients are server only (`import "server-only"`), which Next resolves itself: here the suite's empty stand-in.
  (nodeModule as unknown as { registerHooks: (hooks: Hooks) => void }).registerHooks({
    resolve: (specifier, context, next) => (specifier === "server-only" ? { url: pathToFileURL("src/__mocks__/server-only.ts").href, shortCircuit: true } : next(specifier, context)),
  });
  if (mode === "first-cut") return firstCuts(flags);
  if (mode === "requests") return runRequests(flags, rest);
  if (mode === "sheets") return sheets(flags, rest);
  if (mode === "summary") return summary(flags, rest);
  if (mode === "words") return words(flags, rest);
  if (mode === "extra-upload") return extraUpload(flags);
  if (mode === "extra-delete") return extraDelete(flags);
  if (mode === "extra-left") return extraLeft();
  if (mode === "examples") return examples(flags);
  if (mode === "moments") return runMoments(flags, rest);
  if (mode === "fixes") return runFixes(flags, rest);
  throw new Error("usage: edit-agent-proof.ts first-cut | requests | sheets | summary | words | extra-upload | extra-delete | extra-left | examples | moments | fixes (see the file's header)");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
