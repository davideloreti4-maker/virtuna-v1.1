/**
 * keep-alive.ts — keep the serverless function alive until `work` is done, after the response.
 *
 * A Test simulation's work runs INSIDE its streaming request (/api/analyze, SSE branch), and the
 * result card is added at its end. A client that disconnects (a closed tab) must not end that: the
 * run is billed, and the card belongs in the chat it was started in. `after()` (next/server) hands
 * the promise to the platform (`waitUntil` on Vercel), so the function lives until it settles. The
 * promise is never rejected into the platform: a failure here was already logged by its owner.
 *
 * Outside a request scope (unit tests calling a route handler directly) `after` throws: the work
 * still runs, nothing is registered.
 */
import { after } from "next/server";

export function keepAlive(work: Promise<unknown>): void {
  try {
    after(work.then(() => undefined, () => undefined));
  } catch {
    /* no request scope: nothing to extend */
  }
}
