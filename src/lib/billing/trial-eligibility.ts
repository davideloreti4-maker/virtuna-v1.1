/**
 * ONE TRIAL PER ACCOUNT — the single predicate, so the button and the charge agree.
 *
 * This rule existed in exactly one place: `/api/whop/checkout` denied the $1 SKU by reading
 * `trial_used_at`. Meanwhile every CTA in the product promised "Start for $1" without reading
 * anything at all. A customer who had already trialled clicked a dollar and was shown
 * ninety-nine. That is not a cosmetic mismatch — it is the shape a chargeback takes, and it is
 * only avoidable if the surface that PROMISES a price and the route that RESOLVES one ask the
 * same question of the same columns.
 *
 * So: one function, two callers (`/api/whop/checkout` to deny the SKU, `/api/subscription` to
 * tell the UI what it may promise). Changing the rule changes both at once.
 *
 * `trial_used_at` is write-once history stamped by the webhook the first time a trial window
 * opens, and never cleared — including on cancellation, which is the point: a customer who
 * trialled, converted and then cancelled lands back on tier `free`, and `free` is exactly the
 * state every "$1" CTA in the product keyed off.
 *
 * `trial_started_at` is checked as a belt on rows predating the `trial_used_at` migration.
 */

/**
 * Has this account already spent its one $1 trial?
 *
 * Takes the raw `user_subscriptions` row (null/undefined for an account that has never had
 * one). Deliberately untyped: both callers `select("*")` because naming a column that predates
 * its migration makes PostgREST reject the entire SELECT.
 */
export function hasUsedTrial(row: Record<string, unknown> | null | undefined): boolean {
  return !!(row?.trial_used_at || row?.trial_started_at);
}
