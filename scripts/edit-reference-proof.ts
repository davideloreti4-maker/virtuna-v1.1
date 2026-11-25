/**
 * edit-reference-proof.ts — part 3 Task 11's real run: references fetched by their links, read into a style and dropped, through
 * the app's own routes on a dev server of this script's own, signed in as the e2e test account, one reference at a time:
 *   1. `POST /api/edit/references {url}`: the link fetched (Apify, through Remix's `resolveAndRehost`), put into R2 and its
 *      analysis started on the worker in reference mode;
 *   2. its analysis watched as a creator would (`GET /api/edit/references/<id>`, its stage in a creator's words) and through the
 *      job's own row (the worker's stages, each timed from when it was first seen);
 *   3. once it is ready and before it is read: its analysis kept, and from R2 the sheet the worker made of it (Task 9c: what Qwen
 *      judges, its SHA-1 against the one the route logs) and its source as uploaded, for the frames with the reader's boxes (the
 *      worker keeps no copy of a reference; the source is deleted in a `finally`, whatever becomes of the run);
 *   4. the read (`GET` once ready): its style, and the route's one log line of the read (each step's seconds: the sheet read from
 *      R2, the judgement, the drop; the judgement itself; the sheet's SHA-1);
 *   5. a second `GET` (404), and nothing of it left: R2 listed under its folder, its job and take rows read with the service key;
 *      and the sweep's two reads (`oldReferences`) asked of the real database as the creator, what they gave.
 * Each reference's evidence goes to `<out>/ref-<n>/` (git-ignored: the frames show other people): `sheet.jpg`, `frame-<ms>.jpg`
 * (three moments with the reader's lines boxed by what this script takes each to be: caption, title, other or unread),
 * `profile.json`, `text.json`, `judgement.json`, `measures.json`, `times.json`, and `analysis.json` (the worker's measures, kept so
 * the frames can be redrawn without another run). The dev server's output is `<out>/dev.log`.
 *
 * Usage:  pnpm exec tsx scripts/edit-reference-proof.ts [--out <dir>] [--stop <n>] <n>…   (each n from 1 to 5; out .scratch/task11/run2)
 * With `--stop <n>`, reference n is also sent and stopped mid-analysis, as the page stops a read (`proveStop`).
 * The links are read from `.superpowers/sdd/2026-11-21-edit-agent/references.md` (git-ignored) and never printed: a reference is
 * "reference <n>". It loads `.env.local` itself and prints no value of it, nor an id. Each reference is one Apify run, one
 * analysis on Modal and one judgement (two Qwen calls): run it on purpose.
 */
import * as nodeModule from "node:module";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import type { TakeAnalysis, TextLine } from "../src/lib/edit/analysis";
import type { StyleProfile, TextRead } from "../src/lib/edit/style";
import type { Database } from "../src/types/database.types";

type Hooks = { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown };
type Db = SupabaseClient<Database>;

/** The references this run made and has not yet seen gone: dropped with the service key whatever ends the run (D minor 6). */
const unread = new Set<string>();

/** Where the evidence goes: `--out <dir>`, by default the second run's folder. */
let OUT = ".scratch/task11/run2";
const REFERENCES = ".superpowers/sdd/2026-11-21-edit-agent/references.md";
const PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
const FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
/** The boxes' colours by what a line is taken to be. */
const ROLE_COLOURS = { caption: "0x34d399", title: "0xfbbf24", other: "0x60a5fa", unread: "0x9ca3af" } as const;
type Role = keyof typeof ROLE_COLOURS;

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
const seconds = (from: number, to = performance.now()) => Math.round(to - from) / 1000;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The link of reference `n`, from the git-ignored list; never printed. */
function linkOf(n: number): string {
  const row = readFileSync(REFERENCES, "utf8").split("\n").find((each) => each.startsWith(`| ${n} |`));
  const link = row?.split("|")[3]?.trim();
  if (!link?.startsWith("https://")) throw new Error(`reference ${n} has no link in the list`);
  return link;
}

/** The first port of 3000 to 3005 nothing listens on (`lsof` exits 1 when nothing does). */
function freePort(): number {
  for (const port of PORTS) {
    try {
      execFileSync("lsof", ["-ti", `:${port}`], { stdio: "pipe" });
    } catch {
      return port;
    }
  }
  throw new Error("no port from 3000 to 3005 is free");
}

/** A dev server of this script's own, bound to this machine, its output into dev.log; stopped by `stop`. */
async function devServer(): Promise<{ base: string; stop: () => void }> {
  const port = freePort();
  const base = `http://127.0.0.1:${port}`;
  const log = createWriteStream(join(OUT, "dev.log"), { flags: "a" });
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
  const up = () => fetch(`${base}/api/edit/references/00000000-0000-4000-8000-000000000000`).then(() => true, () => false);
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

/** The test account signed in: its session's cookies as `@supabase/ssr` reads them, its id, and a client reading as it. */
async function signIn(): Promise<{ cookie: string; user: string; session: Db }> {
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
  const cookie = (value.match(/.{1,3180}/g) ?? []).map((chunk, i) => `sb-${ref}-auth-token.${i}=${chunk}`).join("; ");
  const session = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token.access_token}` } } });
  return { cookie, user: token.user.id, session };
}

/** R2 with the keys loaded from .env.local (r2.ts is the app's, server only): a signed read, and a folder's keys. */
function r2() {
  const keys = { account: need("R2_ACCOUNT_ID"), keyId: need("R2_ACCESS_KEY_ID"), secret: need("R2_SECRET_ACCESS_KEY"), bucket: need("R2_BUCKET") };
  const client = new AwsClient({ accessKeyId: keys.keyId, secretAccessKey: keys.secret, service: "s3", region: "auto" });
  const list = async (folder: string): Promise<string[]> => {
    const url = new URL(`https://${keys.account}.eu.r2.cloudflarestorage.com/${keys.bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", folder);
    const response = await client.fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`R2 answered ${response.status} to a list`);
    return [...(await response.text()).matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => match[1]!);
  };
  return { keys, list };
}

/**
 * The dev server's log line of `what` for reference `id`, as the logger writes it in development (`[time] INFO what {json}`),
 * waited for up to 5 s: the server's output reaches the file a moment after its answer.
 */
async function logged(what: string, id: string): Promise<Record<string, unknown> | null> {
  for (let tries = 0; tries < 20; tries++) {
    const last = readFileSync(join(OUT, "dev.log"), "utf8").split("\n").filter((line) => line.includes(` ${what} `) && line.includes(id)).at(-1);
    if (last) return JSON.parse(last.slice(last.indexOf("{"))) as Record<string, unknown>;
    await pause(250);
  }
  return null;
}

/** What a line of a moment is taken to be, from what `textOf` read: the title's letters on while it is; other held text; the caption band; else unread. */
function roleOf(line: TextLine, ms: number, text: TextRead): Role {
  const key = (value: string) => (value.match(/[\p{L}\p{N}]/gu) ?? []).join("").toLowerCase();
  const mine = key(line.text);
  if (text.title && ms >= text.title.fromMs && ms <= text.title.toMs && mine !== "" && key(text.title.text).includes(mine)) return "title";
  if (text.other.some((other) => mine !== "" && (key(other).startsWith(mine) || mine.startsWith(key(other))))) return "other";
  const middle = line.box.y + line.box.h / 2;
  if (text.captions && Math.abs(middle - text.captions.y) <= 0.075) return "caption";
  return "unread";
}

/** A frame of the full copy at `ms`, with each line of that moment boxed in its role's colour and named, as a JPEG. */
function boxedFrame(video: string, ms: number, lines: TextLine[], text: TextRead, out: string): Role[] {
  const roles = lines.map((line) => roleOf(line, ms, text));
  // Boxes are shares of the picture as shown: drawn on the frame scaled to 720 wide, by its own width and height.
  const draws = lines.flatMap((line, i) => {
    const colour = ROLE_COLOURS[roles[i]!];
    const [x, y, w, h] = [line.box.x, line.box.y, line.box.w, line.box.h].map((share) => share.toFixed(4));
    return [
      `drawbox=x=iw*${x}:y=ih*${y}:w=iw*${w}:h=ih*${h}:color=${colour}:t=4`,
      `drawtext=fontfile=${FONT}:text='${roles[i]} ${line.score.toFixed(2)}':x=w*${x}:y=max(0\\,h*${y}-34):fontsize=26:fontcolor=${colour}:box=1:boxcolor=black@0.6`,
    ];
  });
  const filter = ["scale=720:-2", ...draws, `drawtext=fontfile=${FONT}:text='${(ms / 1000).toFixed(2)} s':x=16:y=16:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6`].join(",");
  execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-ss", (ms / 1000).toFixed(3), "-i", video, "-frames:v", "1", "-vf", filter, "-q:v", "3", out]);
  return roles;
}

interface Times {
  [step: string]: number | string | Record<string, number> | null | undefined;
}

/**
 * A read the page stops (`--stop <n>`): the link sent, and once its analysis is under way the page's `DELETE`, as
 * `src/app/dev-edit/agent/reference.ts` sends it when the creator moves on. Then, for as long as the worker could still write to
 * it (45 s), R2 and the rows are read again: nothing of it may be left, nor come back. Into `<out>/stop-<n>/result.json`.
 */
async function proveStop(n: number, base: string, who: Awaited<ReturnType<typeof signIn>>, service: Db): Promise<void> {
  const out = join(OUT, `stop-${n}`);
  mkdirSync(out, { recursive: true });
  const storage = r2();
  const headers = { cookie: who.cookie, "content-type": "application/json" };
  const say = (line: string) => console.log(`reference ${n} (stopped): ${line}`);
  const posted = await fetch(`${base}/api/edit/references`, { method: "POST", headers, body: JSON.stringify({ url: linkOf(n) }) });
  const { id } = (await posted.json()) as { id?: string };
  if (posted.status !== 202 || !id) return say(`refused ${posted.status}`);
  unread.add(id);
  let stage: string | null = null;
  for (let tries = 0; tries < 240 && !(stage && stage !== "fetching" && stage !== "copies"); tries++) {
    const { data: job } = await who.session.from("edit_jobs").select("status,stage").eq("take_id", id).maybeSingle();
    stage = job?.status === "running" ? (job.stage ?? null) : null;
    if (!stage) await pause(500);
  }
  const stopped = await fetch(`${base}/api/edit/references/${id}`, { method: "DELETE", headers: { cookie: who.cookie } });
  say(`stopped at its ${stage} stage: the DELETE answered ${stopped.status}`);
  const seen: { at: number; objects: number; takeRows: number; jobRows: number }[] = [];
  for (const at of [1, 15, 30, 45]) {
    await pause(at === 1 ? 1000 : 15_000);
    const objects = (await storage.list(`u/${who.user}/takes/${id}/`)).length;
    const { data: takes } = await service.from("edit_takes").select("id").eq("id", id);
    const { data: jobs } = await service.from("edit_jobs").select("id").eq("take_id", id);
    seen.push({ at, objects, takeRows: takes?.length ?? -1, jobRows: jobs?.length ?? -1 });
  }
  const again = await fetch(`${base}/api/edit/references/${id}`, { headers });
  const result = { stage, deleteStatus: stopped.status, seen, getAfter: again.status };
  writeFileSync(join(out, "result.json"), JSON.stringify(result, null, 1));
  say(JSON.stringify(result));
  if (seen.every((each) => each.objects === 0 && each.takeRows === 0 && each.jobRows === 0) && again.status === 404) unread.delete(id);
}

async function proveOne(n: number, base: string, who: Awaited<ReturnType<typeof signIn>>, service: Db): Promise<void> {
  const out = join(OUT, `ref-${n}`);
  mkdirSync(out, { recursive: true });
  const { oldReferences } = await import("../src/lib/edit/style/reference");
  const { TakeAnalysisSchema } = await import("../src/lib/edit/analysis");
  const { textOf, measuresOf } = await import("../src/lib/edit/style");
  const storage = r2();
  const headers = { cookie: who.cookie, "content-type": "application/json" }; // no Origin: a call from this machine, not a page
  const times: Times = {};
  const say = (line: string) => console.log(`reference ${n}: ${line}`);

  // 1. The link.
  let started = performance.now();
  const posted = await fetch(`${base}/api/edit/references`, { method: "POST", headers, body: JSON.stringify({ url: linkOf(n) }) });
  times.post = seconds(started);
  const answer = (await posted.json()) as { id?: string; error?: string };
  if (posted.status !== 202 || !answer.id) {
    say(`refused ${posted.status}: ${answer.error ?? "no id"}`);
    writeFileSync(join(out, "times.json"), JSON.stringify({ ...times, refused: { status: posted.status, error: answer.error ?? null } }, null, 1));
    return;
  }
  const id = answer.id;
  unread.add(id);
  const fetchedLine = await logged("a reference was fetched", id);
  times.fetched = (fetchedLine?.seconds as Record<string, number> | undefined) ?? null;
  times.bytes = (fetchedLine?.bytes as number | undefined) ?? null;
  say(`fetched and started in ${times.post} s (${JSON.stringify(times.fetched)})`);

  // 2. The analysis, watched.
  const analysing = performance.now();
  const firstSeen: Record<string, number> = {};
  const creatorSeen: Record<string, number> = {};
  let take: Database["public"]["Tables"]["edit_takes"]["Row"] | null = null;
  for (let tries = 0; tries < 1200; tries++) {
    const { data: row } = await who.session.from("edit_takes").select("*").eq("id", id).maybeSingle();
    const { data: job } = await who.session.from("edit_jobs").select("*").eq("take_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const stage = job?.status === "running" ? (job.stage ?? "claimed") : (job?.status ?? "none");
    firstSeen[stage] ??= seconds(analysing);
    if (job?.status === "failed" || row?.status === "failed") {
      const seen = await fetch(`${base}/api/edit/references/${id}`, { headers }).then((response) => response.json());
      say(`its analysis failed: ${JSON.stringify(seen)}`);
      writeFileSync(join(out, "times.json"), JSON.stringify({ ...times, analysis: firstSeen, failed: seen }, null, 1));
      return;
    }
    if (row?.status === "ready" && job?.status === "done") {
      take = row;
      break;
    }
    // The creator's view, until the sheet is being stored: after that a poll could find it done and read it before step 3.
    if (!["loudness", "storing"].includes(stage)) {
      const seen = (await fetch(`${base}/api/edit/references/${id}`, { headers }).then((response) => response.json())) as { status?: string; stage?: string };
      // A poll that found it done read and dropped it before the evidence below could be kept: said at once, not waited out.
      if (seen.status === "ready" || seen.status === "failed") throw new Error(`reference ${n} was read by a creator's poll before its evidence was kept (${seen.status}); run it again`);
      if (seen.stage) creatorSeen[seen.stage] ??= seconds(analysing);
    }
    await pause(500);
  }
  if (!take) throw new Error(`reference ${n} was not analysed in ten minutes`);
  times.analysis = seconds(analysing);
  times.workerStagesFirstSeen = firstSeen;
  times.creatorStagesFirstSeen = creatorSeen;
  say(`analysed in ${times.analysis} s; the worker's stages first seen at ${JSON.stringify(firstSeen)}`);

  // 3. Before the read: the analysis kept; from R2 the sheet the worker made, and what is left of the reference there (since the
  // final fix wave the worker deletes a reference's source once its analysis is written: then there are no boxed frames to draw).
  const facts = take.facts as { ms: number };
  writeFileSync(join(out, "analysis.json"), JSON.stringify({ ms: facts.ms, facts: take.facts, ...(take.analysis as object) }));
  const analysis: TakeAnalysis = TakeAnalysisSchema.parse(take.analysis);
  const named = (take.analysis as { files?: { sheet?: string } }).files?.sheet;
  const { signed } = await import("../src/lib/edit/worker/signing");
  const get = async (key: string) => Buffer.from(await (await fetch(await signed(storage.keys, "GET", key, 600))).arrayBuffer());
  const source = join(out, "source.mp4");
  try {
    let sheetSha1: string | null = null;
    if (named) {
      const sheet = await get(named);
      writeFileSync(join(out, "sheet.jpg"), sheet);
      sheetSha1 = createHash("sha1").update(sheet.toString("base64")).digest("hex");
    } else say("its analysis names no sheet");
    const atReady = (await storage.list(`u/${who.user}/takes/${id}/`)).map((key) => key.split("/").at(-1));
    times.filesAtReady = atReady.join(", ");
    if (atReady.includes("source")) writeFileSync(source, await get(`u/${who.user}/takes/${id}/source`));
    say(`in R2 once it is analysed: ${atReady.join(", ") || "nothing"}`);

    // 4. The read.
    started = performance.now();
    const reading = await fetch(`${base}/api/edit/references/${id}`, { headers });
    times.read = seconds(started);
    const read = (await reading.json()) as { status: string; style?: StyleProfile; judged?: boolean; error?: string };
    const readLine = await logged("a reference was read", id);
    const steps = (readLine?.seconds as Record<string, number> | undefined) ?? null;
    times.readSteps = steps;
    times.sheet = steps?.sheet ?? null; // read from R2
    times.judgement = steps?.judgement ?? null;
    times.drop = steps?.drop ?? null;
    if (read.status !== "ready" || !read.style) throw new Error(`reference ${n} was not read: ${reading.status} ${JSON.stringify(read)}`);
    writeFileSync(join(out, "profile.json"), JSON.stringify({ style: read.style, judged: read.judged }, null, 1));
    writeFileSync(
      join(out, "judgement.json"),
      JSON.stringify({ judged: readLine?.judged ?? null, judgement: readLine?.judgement ?? null, sheetMs: analysis.sheet?.ms ?? null, sheetSha1: readLine?.sheet ?? null, downloadedSheetSha1: sheetSha1, sameSheet: sheetSha1 !== null && sheetSha1 === readLine?.sheet, unsheeted: readLine?.unsheeted ?? null }, null, 1),
    );
    const text = textOf(analysis, facts.ms);
    writeFileSync(join(out, "text.json"), JSON.stringify(text, null, 1));
    writeFileSync(join(out, "measures.json"), JSON.stringify(measuresOf(analysis, facts.ms), null, 1));
    say(`read in ${times.read} s (${JSON.stringify(steps)}), judged ${read.judged}, the sheet judged is the one stored: ${sheetSha1 === readLine?.sheet}`);

    // 5. Gone: a second GET, R2, the rows; and the sweep's two reads, as the creator, against the real database.
    const again = await fetch(`${base}/api/edit/references/${id}`, { headers });
    const objects = await storage.list(`u/${who.user}/takes/${id}/`);
    const { data: takes } = await service.from("edit_takes").select("id").eq("id", id);
    const { data: jobs } = await service.from("edit_jobs").select("id").eq("take_id", id);
    const swept = await oldReferences(who.session, who.user);
    const unswept = readFileSync(join(OUT, "dev.log"), "utf8").split("\n").filter((line) => line.includes("left-over references could not be read")).length;
    const left = {
      secondGet: again.status, objects: objects.length, takeRows: takes?.length ?? null, jobRows: jobs?.length ?? null,
      sweep: { oldReferences: swept.ids.length, failedReads: swept.failed, sweepErrorsInDevLog: unswept },
    };
    say(`left: ${JSON.stringify(left)}`);
    if (left.secondGet === 404 && left.objects === 0 && left.takeRows === 0) unread.delete(id);

    // The frames with the reader's lines, from the source: one in the opening, two later, each a moment with text.
    const withText = (analysis.text ?? []).filter((sample) => sample.lines.length > 0);
    const opening = withText.find((sample) => sample.ms < 3000) ?? withText[0];
    const later = withText.filter((sample) => sample.ms >= 3000);
    const picked = [opening, later[Math.floor(later.length / 3)], later[Math.floor((2 * later.length) / 3)]].filter((sample, i, all) => sample && all.indexOf(sample) === i);
    const drawn = !existsSync(source) ? [] : picked.map((sample) => {
      const name = `frame-${String(sample!.ms).padStart(6, "0")}.jpg`;
      return { name, ms: sample!.ms, roles: boxedFrame(source, sample!.ms, sample!.lines, text, join(out, name)) };
    });

    const total = Number(times.post) + Number(times.analysis) + Number(times.read);
    writeFileSync(join(out, "times.json"), JSON.stringify({ ...times, creatorWaitsAbout: Math.round(total * 10) / 10, ms: facts.ms, left, frames: drawn }, null, 1));
    say(`a creator waits about ${Math.round(total)} s for a ${(facts.ms / 1000).toFixed(1)} s reference; frames ${drawn.map((each) => each.name).join(", ")}`);
  } finally {
    rmSync(source, { force: true }); // another person's video, whatever became of the run: derive and drop (X96)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const at = args.indexOf("--out");
  if (at >= 0) {
    OUT = args[at + 1] ?? OUT;
    args.splice(at, 2);
  }
  const stopAt = args.indexOf("--stop");
  const stops: number[] = [];
  if (stopAt >= 0) stops.push(Number(args.splice(stopAt, 2)[1]));
  const ns = args.map(Number);
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1 || n > 5)) throw new Error("usage: edit-reference-proof.ts <n>… (each from 1 to 5)");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  // The app's clients are server only (`import "server-only"`), which Next resolves itself: here the suite's empty stand-in.
  (nodeModule as unknown as { registerHooks: (hooks: Hooks) => void }).registerHooks({
    resolve: (specifier, context, next) => (specifier === "server-only" ? { url: pathToFileURL("src/__mocks__/server-only.ts").href, shortCircuit: true } : next(specifier, context)),
  });
  mkdirSync(OUT, { recursive: true });
  const who = await signIn();
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { base, stop } = await devServer();
  try {
    // Each route compiled once before anything is timed: a dev server compiles a route on its first call.
    const headers = { cookie: who.cookie, "content-type": "application/json" }; // no Origin: a call from this machine, not a page
    await fetch(`${base}/api/edit/references`, { method: "POST", headers, body: "{}" });
    await fetch(`${base}/api/edit/references/00000000-0000-4000-8000-000000000000`, { headers });
    for (const n of ns) {
      try {
        await proveOne(n, base, who, service);
      } catch (error) {
        console.error(`reference ${n}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    for (const n of stops) {
      try {
        await proveStop(n, base, who, service);
      } catch (error) {
        console.error(`reference ${n} (stopped): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    stop();
    // Whatever ended the run, nothing of a reference it made is left: each not seen gone is dropped as the app drops one.
    const { dropReference } = await import("../src/lib/edit/style/reference");
    for (const id of unread) await dropReference(service, who.user, id);
    if (unread.size > 0) console.log(`dropped ${unread.size} reference(s) this run did not see gone`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
