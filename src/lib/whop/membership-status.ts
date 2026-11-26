/**
 * Which Whop membership statuses mean the plan has ended. Pure, no env and no fetch, so client code (the
 * plan card) and server code (delete, the live read) share one list.
 *
 * Only these count as ended. Every other status, one Whop adds later included (`unresolved`, `drafted`,
 * …), counts as billing again: an unknown status must never let a delete through.
 */
const ENDED_STATUSES: readonly string[] = ["canceled", "cancelled", "expired", "completed"];

export function isEndedStatus(status: string): boolean {
  return ENDED_STATUSES.includes(status);
}
