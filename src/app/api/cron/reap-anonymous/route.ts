import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/reap-anonymous" });

/**
 * GET /api/cron/reap-anonymous — the anonymous-user reaper.
 *
 * The /go funnel mints a real `auth.users` row per visitor who submits (§0b① — that is
 * the point: no parallel demo path), so abandoned anonymous sessions accumulate forever
 * unless something sweeps them. This is that something.
 *
 * WHO IS REAPED — every condition must hold:
 *   1. `is_anonymous === true`. A missing claim reads as REAL (same polarity as
 *      verdict-seal.ts and DEMO_CREDITS): the failure that matters is deleting a real
 *      customer, and the cost of sparing a stray anon row is a row.
 *   2. Last activity (`last_sign_in_at`, else `created_at`) is older than
 *      `REAP_AFTER_DAYS`. A returning visitor's anon session refreshes; reaping on
 *      created_at alone would delete someone who was here yesterday.
 *   3. NO `user_subscriptions` row. A paid-but-never-linked visitor's claim path
 *      (SealedWallCta → "finish unlocking") hangs off this user id — reaping them
 *      deletes what they paid for. Any subscription row spares, whatever its status.
 *
 * Deletion cascades through the user's rows (threads, analyses, creator_profiles…).
 * `wallet_transactions` is ON DELETE RESTRICT by design (immutable money ledger) — an
 * anonymous user can't earn one, but if one ever exists the delete FAILS for that user
 * and the sweep reports it instead of aborting.
 */

/** Supabase's own guidance for anonymous-user cleanup is "older than 30 days". */
const REAP_AFTER_DAYS = 30;

/** Bound one run's work — the sweep is periodic; a backlog drains across runs. */
const MAX_DELETIONS_PER_RUN = 500;

const ADMIN_PAGE_SIZE = 1000;

function lastActivityOf(user: { created_at: string; last_sign_in_at?: string | null }): number {
  const created = new Date(user.created_at).getTime();
  const signedIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : NaN;
  const latest = Math.max(
    Number.isFinite(created) ? created : 0,
    Number.isFinite(signedIn) ? signedIn : 0,
  );
  // An unparsable pair yields 0 — treated as NOT expired (spare on bad data, never reap on it).
  return latest;
}

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const cutoff = Date.now() - REAP_AFTER_DAYS * 24 * 60 * 60 * 1000;

  let scanned = 0;
  let reaped = 0;
  let sparedPaid = 0;
  const failures: string[] = [];

  try {
    // Page through the whole user list; anonymous rows can't be filtered server-side.
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: ADMIN_PAGE_SIZE,
      });
      if (error) {
        log.error("listUsers failed — aborting sweep", { page, error: error.message });
        return NextResponse.json(
          { error: "listUsers failed", scanned, reaped, sparedPaid, failures },
          { status: 500 },
        );
      }

      const users = data?.users ?? [];
      scanned += users.length;

      for (const user of users) {
        if (reaped >= MAX_DELETIONS_PER_RUN) break;
        // Strict true — a missing claim is a REAL user (the polarity every other
        // anonymous-keyed guard in this codebase uses; never loosen it).
        if (user.is_anonymous !== true) continue;
        if (lastActivityOf(user) === 0 || lastActivityOf(user) >= cutoff) continue;

        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (sub) {
          sparedPaid++;
          continue;
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          failures.push(user.id);
          log.error("delete failed — skipping user", {
            userId: user.id,
            error: deleteError.message,
          });
        } else {
          reaped++;
        }
      }

      if (users.length < ADMIN_PAGE_SIZE || reaped >= MAX_DELETIONS_PER_RUN) break;
    }

    log.info("sweep complete", { scanned, reaped, sparedPaid, failed: failures.length });
    return NextResponse.json({ scanned, reaped, sparedPaid, failures });
  } catch (err) {
    log.error("sweep crashed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "sweep crashed", scanned, reaped, sparedPaid, failures },
      { status: 500 },
    );
  }
}
