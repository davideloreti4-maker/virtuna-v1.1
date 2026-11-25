/**
 * ensure-code.ts — an account's referral code, made on first view (plan 2026-11-24-earn, step A; ruling
 * 36). The loop the Settings page ran inline, moved here unchanged so Settings and Earn make codes the same
 * way: read the code; none, insert a new one; try again, at most `CODE_ATTEMPTS` times in all, only when
 * that code was taken (Postgres 23505); any other refusal stops at once. Null when no code could be had.
 *
 * SERVER ONLY. Two clients: `client` is the caller's session client and only reads the caller's own row;
 * the server writes the code with the service client, for `userId`, which every caller takes from the
 * session and never from a request. The service client is made only when a code has to be written; if it
 * cannot be made, no code (null).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

import { generateReferralCode } from "./code-generator";

export const CODE_ATTEMPTS = 5;

export async function ensureReferralCode(
  client: SupabaseClient<Database>,
  userId: string,
  makeAdmin: () => SupabaseClient<Database> = createServiceClient,
): Promise<string | null> {
  const { data: existing } = await client.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (existing) return existing.code;

  let admin: SupabaseClient<Database>;
  try {
    admin = makeAdmin();
  } catch {
    return null;
  }
  for (let i = 0; i < CODE_ATTEMPTS; i++) {
    const code = generateReferralCode();
    const { data, error } = await admin.from("referral_codes").insert({ user_id: userId, code }).select("code").single();
    if (!error && data) return data.code;
    if (error?.code !== "23505") break; // retry only on unique-constraint collision
  }
  return null;
}

/** The link that carries a code: `<app>/?ref=<CODE>`, landing on `/` (the middleware keeps the code). */
export function referralLink(code: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl}/?ref=${code}`;
}
