/**
 * edit-dev-server.ts — the dev server for the edit tool's scripts: the one that is running, or
 * one of the script's own for as long as the script runs. Always bound to this machine only: the
 * dev page serves the take in `.scratch/media/`, which is nobody else's to fetch.
 */
import { spawn } from "node:child_process";

/**
 * Runs `work` with a dev server to talk to: the one at `EDIT_DEV_URL` if that is set, else the
 * one already at the port (3040 unless asked), else one started here and stopped again afterwards.
 * Started here, it gets placeholders for the two values the app's session guard needs, unless the
 * environment has them; the dev page itself needs neither. `name` is what the address calls this
 * machine: a page whose cookies or CORS are for `localhost` asks for that.
 */
export async function withDevServer<T>(work: (base: string) => Promise<T>, { port = 3040, name = "127.0.0.1" }: { port?: number; name?: "127.0.0.1" | "localhost" } = {}): Promise<T> {
  const own = `http://${name}:${port}`;
  const base = process.env.EDIT_DEV_URL ?? own;
  const up = () => fetch(`${base}/dev-edit`).then((response) => response.ok, () => false);
  if (await up()) return work(base);
  if (process.env.EDIT_DEV_URL) throw new Error(`no dev server at ${base}`);

  console.log(`starting a dev server at ${own} for this run, bound to 127.0.0.1`);
  const server = spawn("pnpm", ["exec", "next", "dev", "-H", "127.0.0.1", "--port", String(port)], {
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399", NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder", ...process.env },
    stdio: "ignore",
    detached: true, // its own process group, so that it and what it starts can be stopped together
  });
  const stop = () => {
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  process.once("exit", stop);
  try {
    for (let waited = 0; waited < 180 && !(await up()); waited++) await new Promise((done) => setTimeout(done, 500));
    if (!(await up())) throw new Error("the dev server did not come up in a minute and a half");
    return await work(base);
  } finally {
    stop();
  }
}
