import { NextResponse } from "next/server";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchWhopMembership, type LiveMembership } from "@/lib/whop/membership";

/** Two times the same instant? (Postgres writes "+00:00" where Whop's read writes "Z".) */
function sameTime(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  return Date.parse(a) === Date.parse(b);
}

/**
 * GET /api/settings/plan-state — the live Whop state of the caller's membership (spec
 * docs/superpowers/specs/2026-11-26-settings-design.md, 3.1). Answers `{ membership: null }`,
 * `{ membership }` or, when Whop cannot be asked, `{ unknown: true }`. Catches the caller's stored row up
 * when Whop's cancel flag or period end differ (the webhook never sends the flag).
 */
export async function GET() {
  if (!NEW_LOOK_ENABLED) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("user_subscriptions")
    .select("whop_membership_id, cancel_at_period_end, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row?.whop_membership_id) return NextResponse.json({ membership: null });

  let membership: LiveMembership | null;
  try {
    membership = await fetchWhopMembership(row.whop_membership_id);
  } catch {
    return NextResponse.json({ unknown: true });
  }
  if (!membership) return NextResponse.json({ membership: null });

  // Catch the stored row up (the webhook never sends this flag), the caller's row only.
  const flagDiffers = membership.cancelAtPeriodEnd !== Boolean(row.cancel_at_period_end);
  const endDiffers = membership.renewsAt !== null && !sameTime(membership.renewsAt, row.current_period_end);
  if (flagDiffers || endDiffers) {
    await service
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: membership.cancelAtPeriodEnd,
        ...(membership.renewsAt ? { current_period_end: membership.renewsAt } : {}),
      })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ membership });
}
