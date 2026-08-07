/**
 * WHY A RUN FAILED, AND WHAT WE ARE ENTITLED TO SAY ABOUT IT.
 *
 * Two rules, both learned the expensive way:
 *
 * 1. CAUSE BEATS SKILL. `thread-turn.tsx` used to key its error copy by skill alone, so an
 *    Explore run that died offline said "Check the handle or niche" — accusing a handle that is
 *    fine. That is the same defect PR #449 fixed in calibrate, where the client overwrote three
 *    honest server reasons with "Account not found. Check the handle", an accusation the route's
 *    own comment notes "costs the creator another paid scrape to act on". A wrong diagnosis is
 *    not a smaller error than no diagnosis; it is the one the user spends money acting on.
 *
 * 2. NEVER DIAGNOSE WHAT YOU CANNOT SEE. A fetch TypeError is NOT proof of being offline — CORS,
 *    DNS and an unreachable host produce the identical error with the radio up. So the offline
 *    verdict requires `navigator.onLine === false` as corroboration. The converse is never used:
 *    `onLine === true` does not mean reachable (a captive portal reports online while dropping
 *    everything), so nothing here claims connectivity — only the negative is special-cased.
 *
 * The cause reaches the glass as a SENTINEL STRING because `live.error` is typed `string | null`
 * (thread-turn.tsx:106) — an Error object cannot survive that trip.
 */

export type RunFailureCause = "offline" | "session";

/**
 * What a hook writes into its `error` state. Namespaced so it can never collide with a real
 * engine message, and so a sentinel leaking to the glass is obvious rather than plausible.
 */
export const RUN_FAILURE_SENTINEL: Record<RunFailureCause, string> = {
  offline: "maven:run-failure/offline",
  session: "maven:run-failure/session",
};

/** The user pressed Stop, or the component unmounted. Not a failure; it must draw nothing. */
export function isAbort(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { name?: unknown }).name === "AbortError";
}

/**
 * Identified by a FLAG rather than `instanceof`, so the check survives module duplication —
 * the same reason `isCreditWallRefusal` works this way.
 */
function isSessionRefusal(err: unknown): boolean {
  return (
    !!err && typeof err === "object" && (err as { sessionExpired?: unknown }).sessionExpired === true
  );
}

export function classifyRunFailure(err: unknown): RunFailureCause | null {
  if (isAbort(err)) return null;
  if (isSessionRefusal(err)) return "session";

  const isNetworkTypeError = err instanceof TypeError;
  const browserSaysOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (isNetworkTypeError && browserSaysOffline) return "offline";

  return null;
}

/**
 * THE WHOLE CATCH POLICY, IN ONE CALL — what a stream hook should put in its `error` state.
 *
 * Returns `null` when the failure must draw NOTHING (an abort is the user's own Stop). Otherwise
 * returns the sentinel when the cause is nameable, and the error's own message when it is not.
 *
 * It exists because eight stream hooks would otherwise carry eight copies of the same four lines,
 * and eight copies drift. That drift is invisible by construction: a hook that quietly stops
 * classifying does not fail — it just renders the generic "dropped out" again, which is the exact
 * defect this module was written to remove.
 */
export function resolveRunError(err: unknown, fallback: string): string | null {
  if (isAbort(err)) return null;

  const cause = classifyRunFailure(err);
  if (cause) return RUN_FAILURE_SENTINEL[cause];

  return err instanceof Error ? err.message : fallback;
}

type Copy = { headline: string; body: string; retryLabel: string };

/** Cause copy — outranks every skill's copy, because the cause is the more specific truth. */
const CAUSE_COPY: Record<RunFailureCause, Copy> = {
  offline: {
    headline: "You’re offline.",
    body: "That run never left the device — nothing was charged. It’ll work once you’re back on.",
    retryLabel: "Retry once you’re back online",
  },
  session: {
    headline: "You’ve been signed out.",
    body: "Your session ended before that run started — nothing was charged. Sign in again to pick up where you left off.",
    retryLabel: "Retry after signing in",
  },
};

/**
 * Per-skill copy, moved here verbatim from `thread-turn.tsx` so cause and skill resolve in one
 * place. The generative skills share the default; these two fail on an EXTERNAL fetch, which the
 * generic "the generation or SIM-1 pass dropped out" would misdescribe.
 */
const SKILL_COPY: Record<string, Copy> = {
  explore: {
    headline: "Couldn’t reach that source.",
    body: "Check the handle or niche and try again — nothing was charged.",
    retryLabel: "Retry the Explore pull",
  },
  account: {
    headline: "Couldn’t read that account.",
    body: "Check the handle and try again — nothing was charged.",
    retryLabel: "Retry the account read",
  },
};

const DEFAULT_COPY: Copy = {
  headline: "Couldn’t finish that run.",
  body: "The generation or SIM-1 pass dropped out. Tap to retry — nothing was charged.",
  retryLabel: "Retry the run",
};

/** Cause first, skill second, default last. */
export function runErrorCopy(error: string | null | undefined, skill: string): Copy {
  for (const cause of Object.keys(CAUSE_COPY) as RunFailureCause[]) {
    if (error === RUN_FAILURE_SENTINEL[cause]) return CAUSE_COPY[cause];
  }
  return SKILL_COPY[skill] ?? DEFAULT_COPY;
}
