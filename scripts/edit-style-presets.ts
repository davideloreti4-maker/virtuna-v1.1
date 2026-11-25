/**
 * edit-style-presets.ts — part 3 Task 12's real runs: the six presets (src/lib/edit/style/presets.ts) proved on the owner's
 * take, and a style from words (src/lib/edit/style/words.ts) through the real Qwen. Three modes:
 *
 *   pnpm exec tsx scripts/edit-style-presets.ts presets <user> <take> <out-dir> [<preset id>...]
 *     For each preset (or those named), one after the other: the first cut of the take in it (`firstCut`, with Qwen and the
 *     worker's stills, as `edit-agent-smoke.ts first-cut` makes one), rendered on this Mac, and its sheet.
 *   pnpm exec tsx scripts/edit-style-presets.ts words <out-dir>
 *     The brief's ten phrases and Task 12b's one through `styleOfWords` and the real Qwen: `<out-dir>/words.json` holds, for each, Qwen's
 *     answers as written, the say, the profile, the tokens, the cost and the time.
 *   pnpm exec tsx scripts/edit-style-presets.ts words-cut <user> <take> <out-dir> <n>...
 *     The first cut of the take in phrase number <n>'s style, as `words.json` holds it, rendered, with its sheet: `words-<n>`.
 *
 * Each cut writes into <out-dir>, named after its preset id or `words-<n>`:
 *   - `<name>.json`: the style, the final edit, Qwen's choices and answers, the ops, the findings and errors left, the rounds,
 *     the match, the time and the cost (the ids masked as <user> and <take>);
 *   - `<name>.mp4`: the cut rendered from the take's full copy in .scratch/media/ (`TAKE_FILE`, git-ignored), its demo edit
 *     written beside it as `<name>-demo.json` and removed after the render;
 *   - `<name>-sheet.jpg`: twelve frames, the middle of each twelfth, four across, each 540 by 960;
 *   - `<name>-cuts.jpg`: at each cut and punch-in, the two frames before it and the two from it, a row each, 270 by 480.
 * Before each render it checks the disk and stops under 1.2 GB free. It loads `.env.local` itself and prints no value of it.
 */
import * as nodeModule from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Asset, Edit } from "../src/lib/edit";
import type { Ask } from "../src/lib/edit/agent/model";
import type { StyleProfile } from "../src/lib/edit/style/profile";
import type { stillsOf as StillsOf } from "../src/lib/edit/worker/stills";
import type { Database } from "../src/types/database.types";

/** The owner's take's full copy, as Tasks 4 and 6 kept it in .scratch/media/ (git-ignored). */
const TAKE_FILE = "task6-full.mp4";
const SHEET = { frames: 12, across: 4, w: 540, h: 960 } as const;
const STRIP = { from: -2, to: 1, w: 270, h: 480 } as const;
/** The least free disk a render may start with (the rules: stop under 1.2 GB). */
const LEAST_FREE_BYTES = 1.2 * 1024 ** 3;

/** The brief's ten phrases (Step 6), in its order, and Task 12b's one. */
const PHRASES = [
  "Hormozi style",
  "calm and clean",
  "fast with zooms",
  "like a podcast clip",
  "big captions in the middle",
  "no captions",
  "cinematic and warm",
  "MrBeast style",
  "minimal, black and white",
  "energetic, lots of cuts",
  "normal subtitles, nothing fancy", // Task 12b: must come back as sentences
] as const;

type Hooks = { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown };
type Answer = { text: string; usage: { input: number; output: number }; ms: number; truncated: boolean };

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Free bytes on the disk this runs on. */
function freeBytes(): number {
  const line = execFileSync("df", ["-k", "/"], { encoding: "utf8" }).trim().split("\n").at(-1) ?? "";
  const available = Number(line.split(/\s+/)[3]);
  if (!Number.isFinite(available)) throw new Error(`df gave no free space: ${line}`);
  return available * 1024;
}

/** Qwen, each answer kept as it was written. */
async function recordingAsk(): Promise<{ ask: Ask; answers: Answer[] }> {
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const answers: Answer[] = [];
  const ask: Ask = async (messages, opts) => {
    const asked = await askQwen(messages, opts);
    answers.push({ text: asked.text, usage: asked.usage, ms: asked.ms, truncated: asked.truncated === true });
    return asked;
  };
  return { ask, answers };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  // The stills' client is server only (`import "server-only"`): given the suite's empty stand-in, as edit-agent-smoke.ts does.
  (nodeModule as unknown as { registerHooks: (hooks: Hooks) => void }).registerHooks({
    resolve: (specifier, context, next) =>
      specifier === "server-only" ? { url: pathToFileURL("src/__mocks__/server-only.ts").href, shortCircuit: true } : next(specifier, context),
  });
  if (mode === "words" && args[0]) return wordsRun(args[0]);
  const [user, takeId, out, ...rest] = args;
  if ((mode === "presets" || mode === "words-cut") && user && takeId && out) return cutsRun(mode, user, takeId, out, rest);
  throw new Error("usage: edit-style-presets.ts presets <user> <take> <out-dir> [<id>...] | words <out-dir> | words-cut <user> <take> <out-dir> <n>...");
}

/** The ten phrases through `styleOfWords` and the real Qwen, into `<out>/words.json`. */
async function wordsRun(out: string) {
  const { styleOfWords } = await import("../src/lib/edit/style/words");
  const { calculateCost } = await import("../src/lib/engine/qwen/cost");
  const { QWEN_REASONING_MODEL } = await import("../src/lib/engine/qwen/client");
  mkdirSync(out, { recursive: true });
  const results = [];
  for (const [i, words] of PHRASES.entries()) {
    const { ask, answers } = await recordingAsk();
    const started = Date.now();
    let made: { style: StyleProfile; say: string } | null = null;
    let error: string | null = null;
    try {
      made = await styleOfWords(words, ask);
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown);
    }
    const tokens = answers.reduce((sum, one) => ({ input: sum.input + one.usage.input, output: sum.output + one.usage.output }), { input: 0, output: 0 });
    const cents = answers.reduce((sum, one) => sum + calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: one.usage.input, completion_tokens: one.usage.output }), 0);
    const result = { n: i + 1, words, model: QWEN_REASONING_MODEL, rounds: answers.length, ms: Date.now() - started, tokens, cents: Math.round(cents * 10_000) / 10_000, say: made?.say ?? null, error, answers, style: made?.style ?? null };
    results.push(result);
    console.log(JSON.stringify({ n: result.n, words, rounds: result.rounds, ms: result.ms, cents: result.cents, answer: answers.at(-1)?.text ?? null, error }));
  }
  writeFileSync(join(out, "words.json"), JSON.stringify(results, null, 1));
}

/** The creator's take's row, read with the service key. */
async function readTake(user: string, takeId: string) {
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: take, error } = await service.from("edit_takes").select("*").eq("id", takeId).eq("user_id", user).single();
  if (error) throw new Error(`the take could not be read: ${error.message}`);
  return take;
}

/** The first cuts, in the presets or in phrases' styles, one after the other: see the file's header. */
async function cutsRun(mode: "presets" | "words-cut", user: string, takeId: string, out: string, rest: string[]) {
  const { AGENT_LIMITS } = await import("../src/lib/edit/agent/loop");
  const { firstCut } = await import("../src/lib/edit/agent/first-cut");
  const { stillsOf } = await import("../src/lib/edit/worker/stills");
  const { assetOf } = await import("../src/lib/edit/worker/takes");
  const { bucket } = await import("../src/lib/edit/worker/r2");
  const { analysisOf } = await import("../src/lib/edit/analysis");
  const { layout } = await import("../src/lib/edit/derive");
  const { PRESETS } = await import("../src/lib/edit/style/presets");
  const { QWEN_REASONING_MODEL } = await import("../src/lib/engine/qwen/client");
  const { withRenderer } = await import("./edit-render");

  const masked = (text: string) => text.replaceAll(user, "<user>").replaceAll(takeId, "<take>");
  const say = (line: unknown) => console.log(masked(JSON.stringify(line)));

  // What to cut: the presets named (or all six), or the phrases numbered, their styles as words.json holds them.
  let todo: { name: string; style: StyleProfile }[];
  if (mode === "presets") {
    const unknown = rest.filter((id) => !PRESETS.some((preset) => preset.id === id));
    if (unknown.length > 0) throw new Error(`no preset ${unknown.join(", ")}`);
    todo = PRESETS.filter((preset) => rest.length === 0 || rest.includes(preset.id)).map((preset) => ({ name: preset.id, style: preset.profile }));
  } else {
    const made = JSON.parse(readFileSync(join(out, "words.json"), "utf8")) as { n: number; style: StyleProfile | null }[];
    todo = rest.map((n) => {
      const style = made.find((one) => one.n === Number(n))?.style;
      if (!style) throw new Error(`words.json has no style for phrase ${n}`);
      return { name: `words-${n}`, style };
    });
  }
  if (todo.length === 0) throw new Error("nothing to cut");

  const take = await readTake(user, takeId);
  const asset: Asset = assetOf(take, bucket());
  const analysis = analysisOf(take);
  mkdirSync(out, { recursive: true });

  await withRenderer(async ({ film: render }) => {
    for (const { name, style } of todo) {
      const { ask, answers } = await recordingAsk();
      const drawn: number[][] = [];
      const stills: typeof StillsOf = async (who, edit, frames, stopping) => {
        const got = await stillsOf(who, edit, frames, stopping);
        drawn.push([...frames]);
        return got;
      };
      say({ cut: name, model: QWEN_REASONING_MODEL, takeMs: asset.kind === "video" ? asset.ms : null, style });
      const result = await firstCut({ asset, analysis, user, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask, stills });
      const frames = layout(result.edit).frames;
      const errors = result.findings.filter((finding) => finding.severity === "error");
      const cents = Math.round(result.cost * 10_000) / 10_000;
      const offStyle = (result.match?.fields ?? []).filter((field) => field.verdict !== "matched");
      say({ cut: name, ms: result.ms, cents, rounds: result.rounds.map((round) => round.outcome), choices: result.choices, say: result.say, frames, errorsLeft: errors.map((finding) => finding.code), offStyle, drawn });

      // The film, on this Mac, from the take's full copy: the ids made plain ones so the demo edit stays valid.
      const free = freeBytes();
      if (free < LEAST_FREE_BYTES) throw new Error(`only ${(free / 1024 ** 3).toFixed(2)} GB free: stopping before rendering ${name}`);
      const film = JSON.parse(JSON.stringify(result.edit).replaceAll(takeId, "take").replaceAll(user, "owner")) as Edit;
      const demo = join(out, `${name}-demo.json`);
      writeFileSync(demo, JSON.stringify({ edit: film, files: { take: TAKE_FILE } }));
      const video = join(out, `${name}.mp4`);
      const started = Date.now();
      const length = await render(demo, video);
      rmSync(demo);
      const rendered = { frames: length, seconds: Math.round((Date.now() - started) / 100) / 10, freeGbBefore: Math.round((free / 1024 ** 3) * 100) / 100 };
      say({ cut: name, rendered: video, ...rendered });

      // The sheet: the middle frame of each twelfth of the film, four across.
      const picked = Array.from({ length: SHEET.frames }, (_, i) => Math.floor(((i + 0.5) * frames) / SHEET.frames));
      const select = `select='${picked.map((frame) => `eq(n\\,${frame})`).join("+")}',scale=${SHEET.w}:${SHEET.h},tile=${SHEET.across}x${SHEET.frames / SHEET.across}`;
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vf", select, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", join(out, `${name}-sheet.jpg`)]);

      // The strips: at each shot's first frame after the first (a cut, a punch-in, a way back out), two frames before and two from it.
      const lay = layout(result.edit);
      const boundaries = lay.shots.slice(1).map((shot, i) => ({ at: shot.at, zoom: result.edit.shots[i + 1]?.framing.from.zoom ?? 1 }));
      const around = [...new Set(boundaries.flatMap(({ at }) => Array.from({ length: STRIP.to - STRIP.from + 1 }, (_, k) => Math.min(frames - 1, Math.max(0, at + STRIP.from + k)))))].sort((a, b) => a - b);
      if (around.length > 0) {
        const across = STRIP.to - STRIP.from + 1;
        const tile = `select='${around.map((frame) => `eq(n\\,${frame})`).join("+")}',scale=${STRIP.w}:${STRIP.h},tile=${across}x${Math.ceil(around.length / across)}`;
        execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vf", tile, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", join(out, `${name}-cuts.jpg`)]);
      }

      writeFileSync(join(out, `${name}.json`), masked(JSON.stringify({
        name, style, model: QWEN_REASONING_MODEL, ms: result.ms, cents, tokens: result.tokens, choices: result.choices, say: result.say,
        ops: result.ops, findings: result.findings, errorsLeft: errors, rounds: result.rounds, match: result.match, film: { frames, seconds: frames / 30 },
        rendered, sheet: { frames: picked, across: SHEET.across }, boundaries, stills: drawn, answers, edit: result.edit,
      }, null, 1)));
    }
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
