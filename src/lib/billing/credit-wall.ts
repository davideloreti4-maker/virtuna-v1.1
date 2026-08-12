/**
 * THE WALL, RAISED FROM ANYWHERE — the client half of the 402.
 *
 * A dozen surfaces fetch the paid skill routes (the composer, the stream hooks, card
 * follow-ups, saved-item relaunch…). When any of them gets the credit 402 back, the honest
 * response is the SAME everywhere: the paywall dialog, with the server's sentence — never
 * an inline error line the user will retry against forever.
 *
 * Rather than threading dialog state through every one of those call sites, the 402 is
 * announced as a window event and ONE listener (CreditWallListener, mounted in the (app)
 * providers) renders the dialog. A fetch site adds a single line:
 *
 *   if (reportCredit402(res.status, err)) ...stop quietly (the wall is up)...
 *
 * Client-safe: no server imports. No-ops outside the browser.
 */

import { isCreditQuotaExceeded, type CreditQuotaExceeded } from "@/lib/billing/quota-error";

export const CREDIT_WALL_EVENT = "maven:credit-wall";

/** Raise the wall with a payload already known to be the credit 402. */
export function raiseCreditWall(quota: CreditQuotaExceeded): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CreditQuotaExceeded>(CREDIT_WALL_EVENT, { detail: quota }));
}

/**
 * The one-liner for fetch sites: raise the wall iff this response is the credit 402.
 * Returns true when it was — the caller should stop its own error theatrics (the wall
 * is the UI now; at most, surface `body.message`, never the slug).
 */
export function reportCredit402(status: number, body: unknown): body is CreditQuotaExceeded {
  if (status !== 402 || !isCreditQuotaExceeded(body)) return false;
  raiseCreditWall(body);
  return true;
}

/**
 * The refusal as a throwable — how a stream hook unwinds without ALSO drawing an error.
 *
 * "Stop its own error theatrics" above was a comment, not a mechanism: every skill hook raised
 * the wall and then threw, so its catch set `error` and the thread drew `SkillRunError` UNDER the
 * modal — with the generic copy, *"The generation or SIM-1 pass dropped out. Tap to retry —
 * nothing was charged."* Both halves are wrong for a 402: nothing dropped out (they were
 * refused), and the retry gets the same 402 forever. Measured on a production build against an
 * anonymous /go visitor tapping Ideas: paywall on top, futile retry underneath.
 *
 * Throw this instead, and skip the error state in the catch (`finally` still resets the stream).
 * Identified by a FLAG, not `instanceof` — the check has to survive module duplication.
 */
export class CreditWallRefusal extends Error {
  readonly creditWall = true;
  constructor(message = "credit wall") {
    super(message);
    this.name = "CreditWallRefusal";
  }
}

/** Was this thrown by a fetch site that already raised the wall? Then the dialog is the UI. */
export function isCreditWallRefusal(err: unknown): boolean {
  return (
    !!err && typeof err === "object" && (err as { creditWall?: unknown }).creditWall === true
  );
}
