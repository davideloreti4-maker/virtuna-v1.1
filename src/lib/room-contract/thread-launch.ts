/**
 * Seam 4 — the launch handoff (THE-CONTRACT.md §3, corrected 2026-07-05).
 *
 * The ONE contract point between a surface (the start page's embedded composer) and
 * the thread. A surface composes an intent — `{ input, verb, audience }` — and hands
 * it off; this builds the URL that carries it into the real thread host.
 *
 * ⚠️ There is no `/thread/:id` route (the contract's aspirational target). The thread
 * lives on `/home` (one open thread, switched in place). So the honest handoff is a
 * `/home?…` URL carrying the verb + seed text (+ optional audience + a run flag). The
 * /home Composer consumes it on mount (see composer.tsx — the seed inlet): it maps the
 * verb → its default skill, pre-fills the field, and — when `run=1` and the verb is
 * runnable — fires the skill once (the explicit surface send IS the fire, so this is
 * honesty-spine-safe, never a silent auto-fire).
 *
 * Pure: no routing side-effects. The caller `router.push()`es the result.
 */

import type { Verb } from "./types";

export interface ThreadLaunchParams {
  /** The composed input (a topic for Make/Ask, a TikTok URL for Test). */
  input: string;
  /** Make · Test · Ask — the three-verb collapse (THE-CONTRACT.md §2). */
  verb: Verb;
  /** The active audience to carry into the thread. Optional — /home falls back to the
   *  user-level last-used audience when absent (forward-ready for the Seam-3 graft). */
  audienceId?: string | null;
  /** Run the skill on arrival. Default false = pre-fill only (the safe fallback). When
   *  true, /home fires the runnable verb once; non-runnable verbs degrade to pre-fill. */
  run?: boolean;
}

/** The real thread host. No `/thread/:id` route exists — the thread is `/home`. */
export const THREAD_LAUNCH_PATH = "/home";

/** Query-param keys the /home seed inlet reads. Kept here so both sides share one SSOT. */
export const LAUNCH_PARAM = {
  verb: "v",
  seed: "seed",
  audience: "aud",
  run: "run",
} as const;

/**
 * Build the `/home?…` handoff URL from a surface's composed intent. Trims the seed and
 * omits empty params so a bare launch is just `/home?v=Make`. Special characters in the
 * seed (URLs, quotes, newlines) are percent-encoded and round-trip via URLSearchParams.
 */
export function buildThreadLaunchHref({
  input,
  verb,
  audienceId,
  run,
}: ThreadLaunchParams): string {
  const params = new URLSearchParams();
  params.set(LAUNCH_PARAM.verb, verb);
  const seed = input.trim();
  if (seed) params.set(LAUNCH_PARAM.seed, seed);
  if (audienceId) params.set(LAUNCH_PARAM.audience, audienceId);
  if (run) params.set(LAUNCH_PARAM.run, "1");
  const qs = params.toString();
  return qs ? `${THREAD_LAUNCH_PATH}?${qs}` : THREAD_LAUNCH_PATH;
}
