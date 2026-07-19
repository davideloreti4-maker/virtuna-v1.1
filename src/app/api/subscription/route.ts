/**
 * GET /api/subscription — what plan am I on, and how much of it have I used?
 *
 * One endpoint, because every caller needs both halves together: the settings page shows the
 * plan AND the balance, and the composer's indicator is meaningless without the tier. Splitting
 * it would just mean two round-trips to render one line of text.
 *
 * It used to drop `isTrial` / `trialEndsAt` on the floor even though `useSubscription` reads
 * them — which is why `UpgradePrompt` (gated on `isTrial`) could never render, for anyone. They
 * are returned now.
 *
 * The `usage` block is the honest quota verdict whether or not enforcement is on:
 * `usage.enforced` says whether we would actually BLOCK, while `used` / `limit` are true either
 * way. The UI shows a customer their balance the moment they have a plan; the flag only decides
 * whether hitting the limit stops them.
 */

import { NextResponse } from "next/server";

import { checkCreditQuota } from "@/lib/billing/quota";
import { createClient } from "@/lib/supabase/server";
import type { NumenTier } from "@/lib/whop/config";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `*` rather than a column list, on purpose: `trial_started_at` does not exist until
    // migration 20260713140000 is applied, and naming a missing column makes PostgREST reject
    // the entire SELECT. Same reasoning as lib/billing/quota.ts.
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const row = subscription as Record<string, unknown> | null;

    // `checkReadingQuota`, not `getReadingQuotaVerdict`: the verdict helper re-SELECTs
    // `user_subscriptions` itself, and we are holding that row already. The composer calls this
    // endpoint on every mount, so the duplicate read was on a hot path for nothing.
    const toDate = (v: unknown): Date | null => {
      if (typeof v !== "string") return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const tier: NumenTier = (row?.virtuna_tier as NumenTier) ?? "free";
    // Cost 0: this is a BALANCE readout, not an admission check — "where do they stand",
    // not "can they afford action X". (For Studio this also means `used` reports TODAY's
    // fair-use spend, since unlimited has no monthly window to report.)
    const quota = await checkCreditQuota(
      supabase,
      user.id,
      tier,
      0,
      {
        trialStartedAt: toDate(row?.trial_started_at),
        trialEndsAt: toDate(row?.trial_ends_at),
      },
      new Date(),
      toDate(row?.current_period_end)
    );

    const usage = {
      /** Credits spent in the window that applies. */
      used: quota.used,
      /** null = unlimited (Studio, outside a trial). */
      limit: quota.limit,
      /** What's left. null = unlimited. Never negative — an over-limit balance reads as 0. */
      remaining: quota.limit === null ? null : Math.max(0, quota.limit - quota.used),
      /** Whether that limit is actually enforced right now (BILLING_ENFORCE_QUOTA). */
      enforced: quota.enforced,
      /** Whether the 50-credit $1-trial pool is what's being measured. */
      inTrial: quota.inTrial,
      /** When this allowance resets — the renewal date, or the day the trial converts. */
      renewsAt: quota.renewsAt?.toISOString() ?? null,
      periodStart: quota.periodStart.toISOString(),
    };

    if (!row) {
      return NextResponse.json({
        tier: "free",
        status: "active",
        isTrial: false,
        trialEndsAt: null,
        whopConnected: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        usage,
      });
    }

    return NextResponse.json({
      tier: quota.tier,
      status: (row.status as string | null) ?? "active",
      // The TRUTH is the [trial_started_at, trial_ends_at) window that the quota check reads —
      // not the denormalised `is_trial` flag, which exists for reporting.
      isTrial: quota.inTrial,
      trialEndsAt: (row.trial_ends_at as string | null) ?? null,
      whopConnected: !!row.whop_membership_id,
      cancelAtPeriodEnd: (row.cancel_at_period_end as boolean | null) ?? false,
      currentPeriodEnd: (row.current_period_end as string | null) ?? null,
      usage,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
