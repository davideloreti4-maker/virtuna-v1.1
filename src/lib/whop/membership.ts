/**
 * The one request for a Whop membership: `GET /api/v1/memberships/{id}`. The daily sync
 * (`/api/cron/sync-whop`) and the live plan state (`/api/settings/plan-state`) both ask through here.
 * Spec: docs/superpowers/specs/2026-11-26-settings-design.md, 3.1.
 */

/**
 * Whop's v1 membership resource.
 *
 * ⚠️ This shape CHANGED and the old one no longer exists. The previous version of the sync
 * cron read `valid: boolean`, `expires_at: number` and a flat `product_id` from
 * `/api/v5/memberships/…` — an endpoint Whop has removed (it answers 404). v1 returns a
 * `status` enum, a `renewal_period_end`, and nests the ids under `plan`/`product`.
 * Reading the old fields off the new payload would yield `valid === undefined` and mark
 * every paying customer `cancelled`, so callers must be explicit about the enum.
 */
export interface WhopMembership {
  id: string;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "expired"
    | "completed"
    | (string & {});
  renewal_period_end: number | string | null;
  cancel_at_period_end?: boolean;
  plan?: { id?: string };
  product?: { id?: string };
  /** Legacy flat spellings, still tolerated if an older API version is in play. */
  plan_id?: string;
  product_id?: string;
}

export interface LiveMembership {
  /** Whop's status as sent: "active" | "trialing" | "past_due" | "canceled" | "expired" | "completed" | other. */
  status: string;
  cancelAtPeriodEnd: boolean;
  /** ISO time of the period's end, or null. Whop sends seconds or an ISO string (`renewal_period_end`). */
  renewsAt: string | null;
}

/** Statuses Whop bills again (unless the membership cancels at the period's end). */
const RENEWING_STATUSES = ["active", "trialing", "past_due"];

/**
 * Whop's membership as sent. null: Whop has no such membership (404). Throws on any other failure
 * (network, any other non-OK answer, a missing key).
 */
export async function fetchWhopMembershipRecord(
  membershipId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WhopMembership | null> {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("WHOP_API_KEY is not set");
  const response = await fetchImpl(`https://api.whop.com/api/v1/memberships/${encodeURIComponent(membershipId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Whop API returned ${response.status}`);
  return (await response.json()) as WhopMembership;
}

/** Whop sends the period end as a Unix timestamp (seconds) or an ISO string; either becomes an ISO time. */
export function periodEndOf(raw: WhopMembership["renewal_period_end"] | undefined): string | null {
  if (typeof raw === "number") return new Date(raw * 1000).toISOString();
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

/** null: Whop has no such membership (404). Throws on any other failure (network, 5xx, missing key). */
export async function fetchWhopMembership(
  membershipId: string,
  fetchImpl?: typeof fetch,
): Promise<LiveMembership | null> {
  const record = await fetchWhopMembershipRecord(membershipId, fetchImpl);
  if (!record) return null;
  return {
    status: String(record.status),
    cancelAtPeriodEnd: record.cancel_at_period_end === true,
    renewsAt: periodEndOf(record.renewal_period_end),
  };
}

/** active, trialing or past_due, and not cancel_at_period_end: Whop will bill again. */
export function membershipRenews(m: LiveMembership): boolean {
  return RENEWING_STATUSES.includes(m.status) && !m.cancelAtPeriodEnd;
}
