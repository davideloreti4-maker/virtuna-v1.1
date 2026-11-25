/**
 * edit-stills-proof.ts — part 3 Task 6's proof: the worker's `POST /stills`, deployed, called through the app's own client
 * (`stillsOf` and `sheetOf`, src/lib/edit/worker/stills.ts) on the first edit of one of the creator's ready takes in R2, as
 * the agent will call it:
 *   1. frames 0, 45 and 300 as stills, twice (the first call is the cold one after a deploy or five idle minutes), then a sheet
 *      of 12 frames spread over the film, warm; with `sheet-first`, the sheet twice instead (a cold sheet, then a warm one);
 *   2. what the worker refuses, each with its own line: a frame past the film's end, seven stills, a file of another
 *      creator's, a wrong secret (the worker's own check), and a call without the workspace's proxy token (Modal's);
 *   3. an engine failure, told as the worker's own (fix round 1, I1): the take's own poster (a JPEG of his, in his takes'
 *      folder, read and never written) given as the take, at frame 45, past the one picture the engine finds in it;
 *   4. `/start` answered while four stills calls wait (I2): it is asked for a job that is not there (404), so nothing starts.
 * Each still and the sheet are written to the output folder, and every call's time to `times.json` there.
 *
 * Usage:  pnpm exec tsx scripts/edit-stills-proof.ts <user> <take> <out-dir> [sheet-first]
 * It loads `.env.local` itself and prints no value of it; the creator's and the take's ids are printed as <user> and
 * <take>, and the worker's address never. It reads the take's row and writes nothing anywhere but the output folder; each
 * call is metered on Modal.
 */
import * as nodeModule from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Edit } from "../src/lib/edit";
import type { Database } from "../src/types/database.types";

type Hooks = { resolve: (specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown) => unknown };

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const [user, takeId, out, mode] = process.argv.slice(2);
  if (!user || !takeId || !out) throw new Error("usage: edit-stills-proof.ts <user> <take> <out-dir> [sheet-first]");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // in-process; what is already set stays as it is
  // The client is server only (`import "server-only"`), which Next resolves itself and which is no package here: it is given the
  // suite's empty stand-in, as vitest.config.ts does. Node 25 has `registerHooks`; the repo's @types/node (20) does not name it.
  (nodeModule as unknown as { registerHooks: (hooks: Hooks) => void }).registerHooks({
    resolve: (specifier, context, next) =>
      specifier === "server-only" ? { url: pathToFileURL("src/__mocks__/server-only.ts").href, shortCircuit: true } : next(specifier, context),
  });
  const { sheetOf, stillsOf } = await import("../src/lib/edit/worker/stills");
  const { assetOf, firstEdit } = await import("../src/lib/edit/worker/takes");
  const { bucket } = await import("../src/lib/edit/worker/r2");
  const { workerSettings } = await import("../src/lib/edit/worker/jobs");
  const { filmFrames } = await import("../src/lib/edit");

  const masked = (text: string) => text.replaceAll(user, "<user>").replaceAll(takeId, "<take>");
  const service = createClient<Database>(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: take, error } = await service.from("edit_takes").select("*").eq("id", takeId).eq("user_id", user).single();
  if (error) throw new Error(`the take could not be read: ${error.message}`);
  const edit = firstEdit(assetOf(take, bucket()));
  const length = filmFrames(edit);
  mkdirSync(out, { recursive: true });
  console.log(JSON.stringify({ take: "<take>", ms: take.facts && (take.facts as { ms?: number }).ms, filmFrames: length }));

  const times: Record<string, unknown>[] = [];
  async function timed<T>(call: string, work: () => Promise<T>): Promise<T> {
    const started = performance.now();
    const done = await work();
    const seconds = Math.round((performance.now() - started) / 100) / 10;
    times.push({ call, seconds });
    console.log(JSON.stringify({ call, seconds }));
    return done;
  }
  async function refused(call: string, work: () => Promise<unknown>): Promise<void> {
    const started = performance.now();
    const line = await work().then(() => null, (failure: unknown) => masked(failure instanceof Error ? failure.message : String(failure)));
    const seconds = Math.round((performance.now() - started) / 100) / 10;
    times.push({ call, seconds, refused: line });
    console.log(JSON.stringify({ call, seconds, refused: line }));
    if (line === null) throw new Error(`${call}: not refused`);
  }
  const write = (name: string, jpeg: string) => writeFileSync(join(out, name), Buffer.from(jpeg, "base64"));
  const spread = Array.from({ length: 12 }, (_, i) => Math.round((i * (length - 1)) / 11));

  if (mode === "sheet-first") {
    write("sheet-cold.jpg", await timed("sheet of 12, cold", () => sheetOf(user, edit, spread)));
    write("sheet.jpg", await timed("sheet of 12, warm", () => sheetOf(user, edit, spread)));
  } else {
    for (const label of ["cold", "warm"]) {
      const stills = await timed(`stills 0, 45, 300, ${label}`, () => stillsOf(user, edit, [0, 45, 300]));
      for (const still of stills) write(`still-${String(still.frame).padStart(4, "0")}-${label}.jpg`, still.jpeg);
    }
    write("sheet.jpg", await timed("sheet of 12, warm", () => sheetOf(user, edit, spread)));
    await refused("a frame past the film's end", () => stillsOf(user, edit, [0, length]));
    await refused("seven stills", () => stillsOf(user, edit, [0, 1, 2, 3, 4, 5, 6]));
    const elsewhere: Edit = structuredClone(edit);
    const [first] = elsewhere.assets;
    if (!first || !("bucket" in first.at)) throw new Error("the first edit's first file is not a take");
    first.at = { ...first.at, path: first.at.path.replace(user, "00000000-0000-4000-8000-000000000000") };
    await refused("a file of another creator's", () => stillsOf(user, elsewhere, [0]));
    const secret = need("EDIT_WORKER_SECRET");
    process.env.EDIT_WORKER_SECRET = "not-the-secret";
    await refused("a wrong secret", () => stillsOf(user, edit, [0]));
    process.env.EDIT_WORKER_SECRET = secret;
    const proxy = need("EDIT_WORKER_PROXY_SECRET");
    process.env.EDIT_WORKER_PROXY_SECRET = "not-the-token";
    await refused("no proxy token", () => stillsOf(user, edit, [0]));
    process.env.EDIT_WORKER_PROXY_SECRET = proxy;
    const posterAsTake: Edit = structuredClone(edit);
    const [take0] = posterAsTake.assets;
    if (!take0 || !("bucket" in take0.at)) throw new Error("the first edit's first file is not a take");
    take0.at = { ...take0.at, path: take0.at.path.replace(/full\.mp4$/, "poster.jpg") };
    await refused("an engine failure (the poster as the take, frame 45)", () => stillsOf(user, posterAsTake, [45]));

    // Four stills calls in flight (two drawing, two waiting for a stills machine), then `/start` beside them.
    const worker = workerSettings();
    const waiting = Array.from({ length: 4 }, (_, i) => timed(`stills call ${i + 1} of 4 in flight`, () => stillsOf(user, edit, [0])));
    await new Promise((done) => setTimeout(done, 1500));
    const asked = performance.now();
    const start = await fetch(`${worker.url}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${worker.secret}`, "Modal-Key": worker.proxy.key, "Modal-Secret": worker.proxy.secret, "Content-Type": "application/json" },
      body: JSON.stringify({ job: "00000000-0000-4000-8000-000000000000" }),
    });
    const startSeconds = Math.round((performance.now() - asked) / 100) / 10;
    times.push({ call: "/start beside four stills calls", seconds: startSeconds, status: start.status });
    console.log(JSON.stringify({ call: "/start beside four stills calls", seconds: startSeconds, status: start.status }));
    await Promise.all(waiting);
  }
  writeFileSync(join(out, "times.json"), JSON.stringify({ at: new Date().toISOString(), filmFrames: length, times }, null, 1));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
