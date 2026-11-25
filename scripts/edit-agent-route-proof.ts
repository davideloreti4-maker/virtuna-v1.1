/**
 * edit-agent-route-proof.ts — part 3 Task 13a's real run: `POST /api/edit/agent` called for real, through the app's own route on
 * a dev server of this script's own (127.0.0.1, a port from 3000 to 3005), signed in as the e2e test account, on its newest ready
 * take that is not a reference, with Qwen and the worker's stills as they are:
 *   1. a first cut with no style (the house style);
 *   2. a first cut in the preset `clean`;
 *   3. a first cut in the words "fast with zooms";
 *   4. the change "make the captions bigger" on the first cut's edit; and while it is out, a second call (a first cut), which
 *      the route is to refuse with a 409;
 *   5. the change "make it black and white" on the first cut's edit: a change the review lets through, whose stills (the middle
 *      of the film) the worker draws for real, through the route's `agentDeps.stills`.
 * For each call it prints the status, the seconds, the cost, the rounds, the errors left, the match and the says, a say's quoted
 * words (a title's, which are the take's own) told only by their count. Each answer goes whole to `.scratch/task13a/<n>-<name>.json`
 * and the lot to `summary.json` (git-ignored); the dev server's output, with the route's and the agent's log lines, to
 * `.scratch/task13a/dev.log`.
 *
 * Usage:  pnpm exec tsx scripts/edit-agent-route-proof.ts
 * It loads `.env.local` itself and prints no value of it, nor an id. The three first cuts are one to six Qwen calls each; the
 * change one to three, and one call to the worker's stills (metered on Modal), as may a first cut's last resort: run it on purpose.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

type Db = SupabaseClient<Database>;

const OUT = ".scratch/task13a";
const PORTS = [3000, 3001, 3002, 3003, 3004, 3005];
/** A reference's row is a temporary take of the creator's: named after its handle, or this (`LINK_NAME`). */
const isReference = (name: string) => name.startsWith("@") || name === "reference.mp4";

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
const seconds = (from: number, to = performance.now()) => Math.round(to - from) / 1000;
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

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
  const up = () => fetch(`${base}/api/edit/agent`).then(() => true, () => false);
  for (let waited = 0; waited < 240 && !(await up()); waited++) await pause(500);
  if (!(await up())) {
    stop();
    throw new Error("the dev server did not come up in two minutes");
  }
  return { base, stop };
}

/** The test account signed in: its session's cookies as `@supabase/ssr` reads them, and a client reading as it. */
async function signIn(): Promise<{ cookie: string; session: Db }> {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  const anon = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: need("E2E_USER_EMAIL"), password: need("E2E_USER_PASSWORD") }),
  });
  if (!response.ok) throw new Error(`the test account could not sign in: Supabase answered ${response.status}`);
  const token = (await response.json()) as { access_token: string };
  const value = `base64-${Buffer.from(JSON.stringify(token)).toString("base64url")}`;
  const ref = new URL(url).hostname.split(".")[0];
  const cookie = (value.match(/.{1,3180}/g) ?? []).map((chunk, i) => `sb-${ref}-auth-token.${i}=${chunk}`).join("; ");
  const session = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token.access_token}` } } });
  return { cookie, session };
}

interface Answer {
  say?: string;
  ops?: unknown[];
  edit?: { captions?: { size?: number } } & Record<string, unknown>;
  findings?: { severity: string; code: string }[];
  rounds?: number;
  ms?: number;
  cost?: number;
  changed?: boolean;
  match?: { fields: { field: string; verdict: string }[]; notMatched: string[] } | null;
  style?: { source: { kind: string; name: string | null } } | null;
  styleSay?: string | null;
  error?: string;
}
interface Called {
  name: string;
  status: number;
  seconds: number;
  startedAt: number;
  endedAt: number;
  answer: Answer;
}

/** A say with its quoted words (a title's: the take's own words) told only by their count. */
const told = (say: string | null | undefined): string | null =>
  say == null ? null : say.replace(/"([^"]*)"/g, (_, words: string) => `"<${words.split(/\s+/).filter(Boolean).length} words>"`);

const started = performance.now();
async function call(base: string, cookie: string, name: string, body: unknown): Promise<Called> {
  const from = performance.now();
  const response = await fetch(`${base}/api/edit/agent`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  const answer = (await response.json()) as Answer;
  return { name, status: response.status, seconds: seconds(from), startedAt: seconds(started, from), endedAt: seconds(started), answer };
}

/** One call in a line or a few, and its answer whole to its file. */
function report(n: number, called: Called): Record<string, unknown> {
  const { answer } = called;
  writeFileSync(join(OUT, `${n}-${called.name}.json`), JSON.stringify({ status: called.status, seconds: called.seconds, answer }, null, 1));
  const verdicts = answer.match ? ["matched", "near", "not"].map((verdict) => `${verdict} ${answer.match!.fields.filter((field) => field.verdict === verdict).length}`).join(", ") : null;
  const errors = answer.findings?.filter((finding) => finding.severity === "error").map((finding) => finding.code) ?? [];
  const line = {
    call: `${n} ${called.name}`, status: called.status, seconds: called.seconds, cost: answer.cost ?? null, rounds: answer.rounds ?? null,
    changed: answer.changed ?? null, ops: answer.ops?.length ?? null, errorsLeft: errors, match: verdicts,
    notMatched: answer.match?.notMatched ?? null, styleSource: answer.style?.source.kind ?? null, captionsSize: answer.edit?.captions?.size ?? null,
    say: told(answer.say), styleSay: told(answer.styleSay), error: answer.error ?? null,
  };
  console.log(JSON.stringify(line));
  return line;
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  mkdirSync(OUT, { recursive: true });
  const who = await signIn();
  const { data: takes, error } = await who.session.from("edit_takes").select("id,name,status,created_at").eq("status", "ready").order("created_at", { ascending: false });
  if (error) throw new Error(`the test account's takes could not be read: ${error.message}`);
  const take = takes?.find((row) => !isReference(row.name))?.id;
  if (!take) throw new Error("the test account has no ready take");
  console.log(`the test account has ${takes?.length ?? 0} ready takes; the newest that is not a reference is used`);

  const { base, stop } = await devServer();
  const lines: Record<string, unknown>[] = [];
  try {
    // The route compiled before anything is timed: a dev server compiles a route on its first call.
    const warm = await fetch(`${base}/api/edit/agent`, { method: "POST", headers: { cookie: who.cookie, "content-type": "application/json" }, body: "{}" });
    console.log(`warmed: ${warm.status} ${JSON.stringify(await warm.json())}`);

    const house = await call(base, who.cookie, "first-cut-house", { takes: [take], firstCut: true });
    lines.push(report(1, house));
    lines.push(report(2, await call(base, who.cookie, "first-cut-clean", { takes: [take], firstCut: true, style: { preset: "clean" } })));
    lines.push(report(3, await call(base, who.cookie, "first-cut-words", { takes: [take], firstCut: true, style: { words: "fast with zooms" } })));
    if (house.status !== 200 || !house.answer.edit) throw new Error("the first cut gave no edit to change");

    const changing = call(base, who.cookie, "change-bigger-captions", { takes: [take], edit: house.answer.edit, request: "make the captions bigger" });
    await pause(1500);
    const second = await call(base, who.cookie, "second-while-out", { takes: [take], firstCut: true });
    const changed = await changing;
    lines.push(report(4, changed));
    lines.push({ ...report(5, second), changeOutFrom: changed.startedAt, changeOutTo: changed.endedAt, secondAt: second.startedAt, secondWhileOut: second.endedAt < changed.endedAt });
    console.log(`the second call came at ${second.startedAt} s and was answered at ${second.endedAt} s; the change was out from ${changed.startedAt} s to ${changed.endedAt} s`);
    console.log(`captions size: ${house.answer.edit.captions?.size} before, ${changed.answer.edit?.captions?.size} after`);
    lines.push(report(6, await call(base, who.cookie, "change-black-and-white", { takes: [take], edit: house.answer.edit, request: "make it black and white" })));
  } finally {
    stop();
    writeFileSync(join(OUT, "summary.json"), JSON.stringify(lines, null, 1));
  }
  const cost = lines.reduce((sum, line) => sum + (typeof line.cost === "number" ? line.cost : 0), 0);
  console.log(`Qwen in all: ${cost.toFixed(4)} cents over the calls answered 200`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
