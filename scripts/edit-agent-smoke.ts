/**
 * edit-agent-smoke.ts — part 3 Task 7's smoke run: the agent's `change` (src/lib/edit/agent/loop.ts) with its real boundaries,
 * Qwen (`askQwen`) and the worker's stills (`stillsOf`), on the first edit of one of the creator's ready takes in R2. Three
 * requests, each on that same first edit, one after the other:
 *   1. "make the captions bigger"
 *   2. "add a call-out 'Claude' when I say Claude"
 *   3. "make it black and white"
 * For each it prints every round (what became of it, its ops, the door's problems, the errors the review found, the frames drawn,
 * its time, the model's and the stills' times, its tokens) and the whole (rounds, ms, tokens, cost, changed, say, and the ops
 * accepted that the request did not ask for); and writes the model's answers, the result and the stills the loop drew to
 * <out-dir>/<n>/, and the take's analysis to <out-dir>. When the loop did not draw the edit it ends with (a repair after the
 * stills, or a change in the last round), it is drawn here too (`after-*.jpg`), so it can be looked at.
 *
 * Usage:  pnpm exec tsx scripts/edit-agent-smoke.ts <user> <take> <out-dir> [<request number>...]
 * It loads `.env.local` itself and prints no value of it; the creator's and the take's ids are printed as <user> and <take>, in
 * what it prints and what it writes. It reads the take's row and writes nothing anywhere but the output folder. Each request
 * is one to three calls to Qwen and at most two to the worker (metered on Modal).
 *
 * Part 3 Task 10's first cut (src/lib/edit/agent/first-cut.ts), with the same boundaries, on the same take:
 *   pnpm exec tsx scripts/edit-agent-smoke.ts first-cut <user> <take> <out-dir> [<targets.json> <n>] [--prefix=<p>]
 * With no style (the house style), or with Task 9's ground-truth profile number <n> from <targets.json> (its `truth`, as the
 * preset "truth <n>", nothing unmatched). Into <out-dir> it writes, named `none` or `truth<n>` after `<p>` (none by default):
 *   - `<name>.json`: the final edit, Qwen's choices and answers, the ops applied, the findings left, the rounds, the match, the
 *     time and the cost;
 *   - `<name>.mp4`: the first cut rendered on this Mac (`edit-render.ts`), from the take's full copy in .scratch/media/
 *     (`TAKE_FILE`), with `<name>-demo.json` its demo edit (the ids made `take` and `owner`);
 *   - `<name>-sheet.jpg`: twelve frames of it, the middle of each twelfth, four across, each 540 by 960 (ffmpeg's `tile`);
 *   - `<name>-cuts.jpg`: at each cut and punch-in (each shot's first frame after the first), the two frames before it and the
 *     two from it, a row each, 270 by 480;
 *   - the stills the follow-up change drew, if it drew any, in `<name>-stills/`.
 * One to three calls to Qwen for the choices, one to three more and at most one call to the worker if the review finds errors.
 */
import * as nodeModule from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Asset, Edit } from "../src/lib/edit";
import type { Ask } from "../src/lib/edit/agent/model";
import type { Op } from "../src/lib/edit/ops";
import type { StyleProfile } from "../src/lib/edit/style/profile";
import type { stillsOf as StillsOf } from "../src/lib/edit/worker/stills";
import type { Database } from "../src/types/database.types";

/** The owner's take's full copy, as Tasks 4 and 6 kept it in .scratch/media/ (git-ignored): what the first cut is rendered from. */
const TAKE_FILE = "task6-full.mp4";
/** The first cut's sheet: this many frames, this many across, each this size. */
const SHEET = { frames: 12, across: 4, w: 540, h: 960 } as const;
/** The strip at each cut: the frames from two before it to one after it, each this size. */
const STRIP = { from: -2, to: 1, w: 270, h: 480 } as const;

type Hooks = { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown };

/** The three requests, each with the ops it asks for: an accepted op outside them is a change the creator did not ask for. */
const REQUESTS: { text: string; asks: (op: Op) => boolean }[] = [
  { text: "make the captions bigger", asks: (op) => op.op === "captions.set" && Object.keys(op).every((key) => key === "op" || key === "size") },
  { text: "add a call-out 'Claude' when I say Claude", asks: (op) => op.op === "mark.add" && op.mark.part === "callout" },
  { text: "make it black and white", asks: (op) => op.op === "look.set" },
];

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const firstCuts = process.argv[2] === "first-cut";
  const [user, takeId, out, ...only] = process.argv.slice(firstCuts ? 3 : 2);
  if (!user || !takeId || !out) throw new Error("usage: edit-agent-smoke.ts [first-cut] <user> <take> <out-dir> [<request number>... | <targets.json> <n>]");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  // The stills' client is server only (`import "server-only"`), which Next resolves itself and which is no package here: it is
  // given the suite's empty stand-in, as vitest.config.ts does. Node 25 has `registerHooks`; the repo's @types/node does not name it.
  (nodeModule as unknown as { registerHooks: (hooks: Hooks) => void }).registerHooks({
    resolve: (specifier, context, next) =>
      specifier === "server-only" ? { url: pathToFileURL("src/__mocks__/server-only.ts").href, shortCircuit: true } : next(specifier, context),
  });
  if (firstCuts) return firstCutRun(user, takeId, out, only);
  const { AGENT_LIMITS, change, framesToDraw } = await import("../src/lib/edit/agent/loop");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { systemPrompt, requestMessage } = await import("../src/lib/edit/agent/prompt");
  const { contextOf } = await import("../src/lib/edit/agent/context");
  const { stillsOf } = await import("../src/lib/edit/worker/stills");
  const { assetOf, firstEdit } = await import("../src/lib/edit/worker/takes");
  const { bucket } = await import("../src/lib/edit/worker/r2");
  const { analysisOf } = await import("../src/lib/edit/analysis");
  const { filmFrames } = await import("../src/lib/edit");
  const { review } = await import("../src/lib/edit/review");
  const { QWEN_REASONING_MODEL } = await import("../src/lib/engine/qwen/client");

  const masked = (text: string) => text.replaceAll(user, "<user>").replaceAll(takeId, "<take>");
  const say = (line: unknown) => console.log(masked(JSON.stringify(line)));
  const take = await readTake(user, takeId);
  const asset = assetOf(take, bucket());
  const edit = firstEdit(asset);
  const analyses = { [asset.id]: analysisOf(take) };
  const library = [asset];
  const findings = review(edit, analyses);
  const opening = requestMessage(contextOf(edit, analyses, findings, library), "");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "analysis.json"), masked(JSON.stringify(analyses[asset.id]))); // the take's pauses and faces, to replay a request
  say({
    model: QWEN_REASONING_MODEL, limits: AGENT_LIMITS, filmFrames: filmFrames(edit), words: asset.kind === "video" ? asset.words?.length ?? 0 : 0,
    firstEditErrors: findings.filter((finding) => finding.severity === "error").map((finding) => finding.code),
    systemChars: systemPrompt().length, contextChars: opening.length,
  });

  for (const [i, { text: request, asks }] of REQUESTS.entries()) {
    if (only.length > 0 && !only.includes(String(i + 1))) continue;
    const folder = join(out, String(i + 1));
    mkdirSync(folder, { recursive: true });
    const answers: { text: string; usage: { input: number; output: number }; ms: number; truncated: boolean }[] = [];
    const ask: Ask = async (messages, opts) => {
      const asked = await askQwen(messages, opts);
      answers.push({ text: asked.text, usage: asked.usage, ms: asked.ms, truncated: asked.truncated === true });
      return asked;
    };
    const drawnFrom: { edit: Edit; frames: number[] }[] = [];
    const stills: typeof stillsOf = async (who, drawn, frames, stopping) => {
      const got = await stillsOf(who, drawn, frames, stopping);
      drawnFrom.push({ edit: structuredClone(drawn), frames: [...frames] });
      for (const still of got) writeFileSync(join(folder, `frame-${String(still.frame).padStart(4, "0")}.jpg`), Buffer.from(still.jpeg, "base64"));
      return got;
    };

    say({ request: i + 1, asked: request });
    const result = await change({ edit, analyses, request, library, user, deadlineMs: Date.now() + AGENT_LIMITS.changeMs }, { ask, stills });
    for (const round of result.rounds) {
      say({
        round: round.n, outcome: round.outcome, ops: round.ops, refused: round.refused,
        errors: round.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} frame=${finding.where.frame} ${finding.says}`),
        stills: round.stills, ms: round.ms, askMs: round.askMs, stillsMs: round.stillsMs, tokens: round.tokens, error: round.error, stillsError: round.stillsError,
      });
    }
    say({
      request: i + 1, rounds: result.rounds.length, ms: result.ms, tokens: result.tokens, cents: Math.round(result.cost * 10_000) / 10_000,
      changed: result.changed, say: result.say, truncated: answers.map((one) => one.truncated), unrequested: result.ops.filter((op) => !asks(op)),
      errorsAfter: result.findings.filter((finding) => finding.severity === "error").map((finding) => finding.code),
    });

    // The final edit, drawn here when the loop did not draw it: a repair after the stills changed it again (the stills are shown
    // once), or the round that changed it was the last, with none left to show them to. The frames are the loop's, or else the
    // ones the loop would draw for all the ops accepted (`framesToDraw`); a change of nothing seen is not drawn.
    const last = drawnFrom.at(-1);
    const frames = last?.frames ?? framesToDraw(result.edit, result.ops).map((one) => one.frame);
    if (result.changed && frames.length > 0 && (!last || !isDeepStrictEqual(last.edit, result.edit))) {
      const started = performance.now();
      const after = await stillsOf(user, result.edit, frames);
      for (const still of after) writeFileSync(join(folder, `after-${String(still.frame).padStart(4, "0")}.jpg`), Buffer.from(still.jpeg, "base64"));
      say({ request: i + 1, after: frames, seconds: Math.round((performance.now() - started) / 100) / 10 });
    }
    writeFileSync(join(folder, "answers.json"), masked(JSON.stringify(answers, null, 1)));
    writeFileSync(join(folder, "result.json"), masked(JSON.stringify({ request, ...result }, null, 1)));
  }
}

/** The creator's take's row, read with the service key. */
async function readTake(user: string, takeId: string) {
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: take, error } = await service.from("edit_takes").select("*").eq("id", takeId).eq("user_id", user).single();
  if (error) throw new Error(`the take could not be read: ${error.message}`);
  return take;
}

/** The first cut of the take, with no style or with Task 9's ground-truth profile number `n`: see the file's header. */
async function firstCutRun(user: string, takeId: string, out: string, args: string[]) {
  const prefix = args.find((arg) => arg.startsWith("--prefix="))?.slice("--prefix=".length) ?? "";
  const [targets, n] = args.filter((arg) => !arg.startsWith("--"));
  const { AGENT_LIMITS } = await import("../src/lib/edit/agent/loop");
  const { firstCut } = await import("../src/lib/edit/agent/first-cut");
  const { askQwen } = await import("../src/lib/edit/agent/model");
  const { stillsOf } = await import("../src/lib/edit/worker/stills");
  const { assetOf } = await import("../src/lib/edit/worker/takes");
  const { bucket } = await import("../src/lib/edit/worker/r2");
  const { analysisOf } = await import("../src/lib/edit/analysis");
  const { StyleProfileSchema } = await import("../src/lib/edit/style/profile");
  const { layout } = await import("../src/lib/edit/derive");
  const { QWEN_REASONING_MODEL } = await import("../src/lib/engine/qwen/client");
  const { withRenderer } = await import("./edit-render");

  const masked = (text: string) => text.replaceAll(user, "<user>").replaceAll(takeId, "<take>");
  const say = (line: unknown) => console.log(masked(JSON.stringify(line)));
  const take = await readTake(user, takeId);
  const asset: Asset = assetOf(take, bucket());
  const analysis = analysisOf(take);

  let style: StyleProfile | undefined;
  if (targets) {
    const found = (JSON.parse(readFileSync(targets, "utf8")) as { n: number; truth: object }[]).find((target) => target.n === Number(n));
    if (!found) throw new Error(`${targets} has no profile number ${n}`);
    style = StyleProfileSchema.parse({ source: { kind: "preset", name: `truth ${n}` }, ...found.truth, notMatched: [] });
  }
  const name = `${prefix}${style ? `truth${n}` : "none"}`;
  mkdirSync(out, { recursive: true });

  const answers: { text: string; usage: { input: number; output: number }; ms: number; truncated: boolean }[] = [];
  const ask: Ask = async (messages, opts) => {
    const asked = await askQwen(messages, opts);
    answers.push({ text: asked.text, usage: asked.usage, ms: asked.ms, truncated: asked.truncated === true });
    return asked;
  };
  const drawn: number[][] = [];
  const stills: typeof StillsOf = async (who, edit, frames, stopping) => {
    const got = await stillsOf(who, edit, frames, stopping);
    drawn.push([...frames]);
    mkdirSync(join(out, `${name}-stills`), { recursive: true });
    for (const still of got) writeFileSync(join(out, `${name}-stills`, `frame-${String(still.frame).padStart(4, "0")}.jpg`), Buffer.from(still.jpeg, "base64"));
    return got;
  };

  say({ firstCut: name, model: QWEN_REASONING_MODEL, takeMs: asset.kind === "video" ? asset.ms : null, words: asset.kind === "video" ? asset.words?.length ?? 0 : 0, style: style ?? null });
  const result = await firstCut({ asset, analysis, user, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask, stills });
  const frames = layout(result.edit).frames;
  const errors = result.findings.filter((finding) => finding.severity === "error");
  for (const round of result.rounds) {
    say({ round: round.n, outcome: round.outcome, ops: round.ops, refused: round.refused, errors: round.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} frame=${finding.where.frame} ${finding.says}`), stills: round.stills, ms: round.ms, askMs: round.askMs, tokens: round.tokens, error: round.error, stillsError: round.stillsError });
  }
  const cents = Math.round(result.cost * 10_000) / 10_000;
  say({ firstCut: name, ms: result.ms, cents, tokens: result.tokens, choices: result.choices, say: result.say, ops: result.ops.length, frames, errorsLeft: errors.map((finding) => finding.code), drawn });

  // The film, on this Mac, from the take's full copy: the ids made plain ones so the demo edit stays valid.
  const film = JSON.parse(JSON.stringify(result.edit).replaceAll(takeId, "take").replaceAll(user, "owner")) as Edit;
  const demo = join(out, `${name}-demo.json`);
  writeFileSync(demo, JSON.stringify({ edit: film, files: { take: TAKE_FILE } }));
  const video = join(out, `${name}.mp4`);
  const rendered = await withRenderer(async ({ film: render }) => {
    const started = Date.now();
    const length = await render(demo, video);
    return { frames: length, seconds: Math.round((Date.now() - started) / 100) / 10 };
  });
  say({ firstCut: name, rendered: video, ...rendered });

  // The sheet: the middle frame of each twelfth of the film, four across.
  const picked = Array.from({ length: SHEET.frames }, (_, i) => Math.floor(((i + 0.5) * frames) / SHEET.frames));
  const select = `select='${picked.map((frame) => `eq(n\\,${frame})`).join("+")}',scale=${SHEET.w}:${SHEET.h},tile=${SHEET.across}x${SHEET.frames / SHEET.across}`;
  const sheet = join(out, `${name}-sheet.jpg`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vf", select, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", sheet]);
  say({ firstCut: name, sheet, frames: picked });

  // The strips: at each shot's first frame after the first (a cut, a punch-in, a way back out), two frames before and two from it.
  const lay = layout(result.edit);
  const boundaries = lay.shots.slice(1).map((shot, i) => ({ at: shot.at, zoom: result.edit.shots[i + 1]?.framing.from.zoom ?? 1 }));
  const around = boundaries.flatMap(({ at }) => Array.from({ length: STRIP.to - STRIP.from + 1 }, (_, k) => Math.min(frames - 1, Math.max(0, at + STRIP.from + k))));
  if (around.length > 0) {
    const across = STRIP.to - STRIP.from + 1;
    // ffmpeg's select gives each frame once: two cuts closer than four frames would share a row.
    const pick = [...new Set(around)].sort((a, b) => a - b);
    const tile = `select='${pick.map((frame) => `eq(n\\,${frame})`).join("+")}',scale=${STRIP.w}:${STRIP.h},tile=${across}x${Math.ceil(pick.length / across)}`;
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vf", tile, "-frames:v", "1", "-fps_mode", "vfr", "-q:v", "3", join(out, `${name}-cuts.jpg`)]);
  }
  say({ firstCut: name, boundaries });

  writeFileSync(join(out, `${name}.json`), masked(JSON.stringify({
    style: style ?? null, model: QWEN_REASONING_MODEL, ms: result.ms, cents, tokens: result.tokens, choices: result.choices, say: result.say,
    ops: result.ops, findings: result.findings, errorsLeft: errors, rounds: result.rounds, match: result.match, film: { frames, seconds: frames / 30 },
    rendered, sheet: { frames: picked, across: SHEET.across }, boundaries, stills: drawn, answers, edit: result.edit,
  }, null, 1)));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
