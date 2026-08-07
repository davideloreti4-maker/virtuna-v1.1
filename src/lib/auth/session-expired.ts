/**
 * THE SESSION ENDED, ANNOUNCED FROM ANYWHERE — the client half of the 401.
 *
 * A deliberate 1:1 mirror of lib/billing/credit-wall.ts, so the two refusals are learned once:
 * one event constant, a one-line report at each fetch site, one listener mounted in the (app)
 * providers, and a throwable for the sites that need to unwind.
 *
 * ⚠️ IT DOES NOT NAVIGATE. `AuthGuard` (components/app/auth-guard.tsx:42) is the declared single
 * owner of the post-logout redirect — WR-04 (Sidebar.tsx:757) records what two competing router
 * calls did to the landing route. This module only says the session is gone; the listener explains
 * it and offers a LINK, and the user stays exactly where they are.
 *
 * Staying put is also what rescues an unsent draft. Every piece of composer state is local
 * `useState` (composer.tsx:378-488, 769) with zero localStorage writes, so it survives precisely
 * as long as nothing unmounts it, and only a route change unmounts it. There is no persistence
 * mechanism here because not navigating already is one.
 *
 * WHY THIS GAP EXISTS AT ALL: supabase-js fires `onAuthStateChange` when IT notices, typically on
 * a failed token refresh. A refresh token revoked server-side — or a route that refuses for its
 * own reasons — produces a 401 the client library never sees, while the client still believes it
 * is signed in. That request used to die into the generic "the generation or SIM-1 pass dropped
 * out", which is both wrong and un-actionable.
 *
 * Client-safe: no server imports. No-ops outside the browser.
 */

export const SESSION_EXPIRED_EVENT = "maven:session-expired";

/**
 * THE SENTENCE, for the surfaces that render a string rather than resolving copy by cause.
 *
 * The stream hooks never need this — they carry the cause as a sentinel and `run-failure.ts` owns
 * their wording. But a third of the refusable fetch sites are not hooks: they set a local error
 * string, and they set it from the response body. On a 401 that body is `{ error: "Unauthorized" }`
 * (the api/tools route handlers), so the creator reads the slug **Unauthorized** — the same class as
 * `credit_quota_exceeded` appearing in a failure line, which is what the credit wall was built to
 * stop.
 *
 * Deliberately does NOT say "refresh the page". The composer's older `ERROR_SESSION_EXPIRED` does,
 * and a refresh unmounts the composer and destroys the unsent draft — the exact loss this lane is
 * built to avoid.
 */
export const SESSION_EXPIRED_MESSAGE =
  "You’ve been signed out. Sign in again to run this — nothing was charged.";

/** Announce a session already known to be dead. Carries no payload — there is nothing to say. */
export function raiseSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/**
 * The one-liner for fetch sites: announce the dead session iff this response is the 401.
 * Returns true when it was, so the caller can stop rather than inventing its own diagnosis.
 *
 * Unlike `reportCredit402`, this takes no body: a 401 needs no corroborating payload, and the
 * route's own `{ error: "Unauthorized" }` slug is not a sentence anyone should read.
 */
export function reportSession401(status: number): boolean {
  if (status !== 401) return false;
  raiseSessionExpired();
  return true;
}

/**
 * The refusal as a throwable — how a fetch site unwinds while telling the truth about why.
 *
 * ⚠️ THIS IS NOT `CreditWallRefusal`, despite the shape. That one exists to draw NOTHING: the wall
 * dialog is the entire UI, and the inline error underneath it offered a retry that got the same
 * 402 forever. This one is the opposite — it exists to draw the RIGHT thing. `run-failure.ts`
 * already classifies the `sessionExpired` flag as the "session" cause, so a hook that lets this
 * reach `resolveRunError` renders "You've been signed out… nothing was charged" with a retry
 * labelled "Retry after signing in", instead of the generic engine copy. The dialog explains and
 * offers the way back; the failed turn stays honest about itself once the dialog is dismissed.
 *
 * So do NOT add an `isSessionExpiredRefusal` early-return to a hook catch that calls
 * `resolveRunError`. That would suppress the copy this flag exists to trigger.
 *
 * Identified by a FLAG, not `instanceof`, to survive module duplication — the same reason
 * `isCreditWallRefusal` works this way, and the reason `run-failure.ts` re-declares the check
 * rather than importing it.
 */
export class SessionExpiredRefusal extends Error {
  readonly sessionExpired = true;
  /**
   * Defaults to the readable sentence, not a slug. The hooks discard this message (they resolve
   * copy from the cause), but the bespoke surfaces render `err.message` straight into the UI —
   * so the default has to be something a person can read.
   */
  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredRefusal";
  }
}

/**
 * Was this thrown by a fetch site that already announced the dead session?
 *
 * For the bespoke error surfaces — a toast, a local `setError(err.message)` — that do not route
 * through `resolveRunError` and would otherwise render "session expired" raw or, worse, a generic
 * accusation of their own.
 */
export function isSessionExpiredRefusal(err: unknown): boolean {
  return (
    !!err && typeof err === "object" && (err as { sessionExpired?: unknown }).sessionExpired === true
  );
}
