/**
 * referral-row.ts — the `referral_clicks` row, written by the server (plan 2026-11-24-earn; rulings 20a
 * and 31). SERVER ONLY. The table is only the count of creators who joined through a link (`earn-read.ts`);
 * no money is decided from it (ruling 29).
 *
 * Why the service client: the code a new account came through belongs to another account. The server
 * looks its owner up and writes the row itself.
 *
 * Two writers: the sign-in callback (`recordSignInReferral`, here) and the checkout, for a buyer it
 * attributes (`recordAttributed`, `referrer-of.ts`). One row per referred account and code: the table's
 * unique key answers a second write with Postgres's 23505, which is quiet.
 *
 * Nothing here throws into a sign-in or a checkout, and nothing waits long: a checkout at most
 * `REFERRAL_ROW_MS` for its one write, a sign-in at most `SIGN_IN_REFERRAL_MS` for its lookup and its
 * write. A failure is logged by its kind only ("error" or "timeout"): never an id, a code or the
 * database's words.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { isReferralCode } from "@/lib/referral/code-generator";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

import { countsAsJoined } from "./earn";
import { LATE, within } from "./time-limit";

/** The longest a checkout waits for the row (one write). */
export const REFERRAL_ROW_MS = 1_000;
/** The longest a sign-in waits for the row (the owner's lookup, then the write). */
export const SIGN_IN_REFERRAL_MS = 2_000;

export interface ReferralRow {
  code: string;
  /** The code's owner, as the server read it. */
  referrerId: string;
  referredId: string;
  clickedAt: string;
}

/** Writes the row. "exists" when this account already has one for this code. Throws on any other refusal. */
export async function writeReferralRow(admin: SupabaseClient<Database>, row: ReferralRow): Promise<"written" | "exists"> {
  const { error } = await admin.from("referral_clicks").insert({
    referral_code: row.code,
    referrer_user_id: row.referrerId,
    referred_user_id: row.referredId,
    clicked_at: row.clickedAt,
  });
  if (!error) return "written";
  if (error.code === "23505") return "exists";
  throw new Error("referral_clicks: insert refused");
}

/**
 * At sign-in (the OAuth callback), for an account that carries a referral cookie: one row for the code's
 * owner and this account. Only for a code of the generator's form, only for an account created within the
 * last 24 hours (ruling 8's rule and constant: an older account signing in again through a link is not a
 * referral, and nothing is looked up for it), never for the owner's own code. Never throws.
 */
export async function recordSignInReferral(
  code: string | undefined,
  user: { id: string; created_at?: string | null },
  makeAdmin: () => SupabaseClient<Database> = createServiceClient,
  ms: number = SIGN_IN_REFERRAL_MS,
): Promise<void> {
  try {
    if (!isReferralCode(code)) return;
    const clickedAt = new Date().toISOString();
    if (!countsAsJoined(user.created_at, clickedAt)) return;
    const done = await within(ms, async () => {
      const admin = makeAdmin();
      const { data, error } = await admin.from("referral_codes").select("user_id").eq("code", code).maybeSingle();
      if (error) throw new Error("referral_codes: lookup refused");
      if (!data || data.user_id === user.id) return;
      await writeReferralRow(admin, { code, referrerId: data.user_id, referredId: user.id, clickedAt });
    });
    if (done === LATE) console.error("[referral] sign-in row not written:", "timeout");
  } catch {
    console.error("[referral] sign-in row not written:", "error");
  }
}
