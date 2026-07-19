/**
 * THE GATE + THE TILL — the two lines every paid route adds, and nothing else.
 *
 *   const gate = await creditGate(supabase, user.id, "hooks", log);
 *   if (gate) return gate;                    // ← before any engine spend
 *   ...pipeline runs, blocks persist...
 *   await billUsage({ userId: user.id, action: "hooks", tier: gate?.tier }, log);  // ← on success only
 *
 * One module so the refusal copy, the 402 shape, and the "bill on delivery, best-effort"
 * rules cannot drift apart across a dozen skill routes. The analyze route uses the same
 * body builder — the wall dialog renders ONE payload shape wherever it was hit.
 *
 * SERVER-ONLY (imports the service client). The client-safe halves live in
 * `quota-error.ts` (the 402 type + guard) and `pricing.ts` (the price list).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCreditQuotaVerdict, type QuotaVerdict } from "@/lib/billing/quota";
import { CREDIT_QUOTA_EXCEEDED } from "@/lib/billing/quota-error";
import { recordUsage, type RecordUsageInput } from "@/lib/billing/record-usage";
import { creditCost, TRIAL, UNLIMITED_DAILY_CREDIT_CEILING, type BillableAction } from "@/lib/pricing";
import { createServiceClient } from "@/lib/supabase/service";

/** Minimal logger shape — every route's scoped logger satisfies it. */
interface Log {
  info?: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

/**
 * The refusal copy — four dead-ends, four different honest next steps. Written server-side,
 * where the tier and the window are known; the dialog SHOWS this, it never invents its own.
 */
export function quotaRefusalMessage(verdict: QuotaVerdict): string {
  if (verdict.inTrial) {
    return `Your $1 trial includes ${verdict.limit} credits. Your full plan allowance starts when the trial converts.`;
  }
  if (verdict.reason === "fair_use") {
    return `You've hit today's fair-use ceiling of ${UNLIMITED_DAILY_CREDIT_CEILING} credits. It resets at midnight UTC.`;
  }
  if (verdict.limit === 0) {
    return `Start a plan — the $1 trial includes ${TRIAL.credits} credits.`;
  }
  return `You've used all ${verdict.limit} credits on your plan this month.`;
}

/** The 402 body — the one shape `isCreditQuotaExceeded` recognises client-side. */
export function quotaRefusalBody(verdict: QuotaVerdict, cost: number) {
  return {
    error: CREDIT_QUOTA_EXCEEDED,
    message: quotaRefusalMessage(verdict),
    tier: verdict.tier,
    used: verdict.used,
    limit: verdict.limit,
    inTrial: verdict.inTrial,
    reason: verdict.reason ?? "allowance",
    cost,
  };
}

export interface CreditGateResult {
  /** The 402 to return, or null to proceed. */
  refusal: Response | null;
  /** The verdict either way — `verdict.tier` is what the success path stamps on the bill. */
  verdict: QuotaVerdict;
}

/**
 * The admission check, priced for `action`. Runs BEFORE any engine spend, which is the
 * entire point: a refused request must cost nothing.
 *
 * Inert while BILLING_ENFORCE_QUOTA is off (verdict.enforced=false → refusal null), and
 * fail-open inside the quota module — a flaky meter must never block a paying customer.
 *
 * `costOverride` prices the request when the same route can escalate (explore's live
 * scrape). A route that gates at its CHEAP price and escalates can overdraw by at most one
 * escalation (the next gate sees the overdraft) — the customer-friendly direction.
 */
export async function creditGate(
  supabase: SupabaseClient,
  userId: string,
  action: BillableAction,
  log?: Log,
  costOverride?: number
): Promise<CreditGateResult> {
  const cost = costOverride ?? creditCost(action);
  const verdict = await getCreditQuotaVerdict(supabase, userId, cost);

  if (verdict.enforced && !verdict.allowed) {
    log?.info?.("credit_gate_refused", {
      action,
      cost,
      tier: verdict.tier,
      used: verdict.used,
      limit: verdict.limit,
      inTrial: verdict.inTrial,
      reason: verdict.reason,
    });
    return { refusal: Response.json(quotaRefusalBody(verdict, cost), { status: 402 }), verdict };
  }

  return { refusal: null, verdict };
}

/**
 * Bill a DELIVERED action — call it where the result has been persisted and nothing after
 * can un-deliver it. Best-effort all the way down: it builds its own service client (the
 * ledger takes only service-role writes) and swallows every failure with a loud log —
 * a delivered result outranks our accounting, always.
 */
export async function billUsage(input: RecordUsageInput, log?: Log): Promise<void> {
  try {
    const service = createServiceClient();
    await recordUsage(service, input, log);
  } catch (err) {
    // createServiceClient throws when SUPABASE_SERVICE_ROLE_KEY is absent (local dev
    // without the secret). The action stays free-of-record rather than failing the route.
    log?.warn("usage_bill_skipped", {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
