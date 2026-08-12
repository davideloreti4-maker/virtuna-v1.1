/**
 * Create (or repair) a STAFF test account on the shared Supabase project, on the Studio tier.
 *
 * ⚠️ THERE IS ONE SUPABASE PROJECT. Dev and production share it, so this account is a REAL
 * production account and every run it makes spends real engine money (DashScope, and Apify on
 * the scrape-priced actions). "Unlimited" is what it sounds like commercially, not technically:
 *
 *   tier `studio` → `creditsPerMonth: null` → no MONTHLY wall (lib/pricing.ts)
 *   …but `UNLIMITED_DAILY_CREDIT_CEILING` still applies: 300 credits per UTC day, resetting at
 *   midnight UTC, and the verdict comes back `reason: "fair_use"` rather than "upgrade".
 *
 * 300/day is 30 full Readings, 150 scripts, or 300 hooks packs a day — far past what a test
 * walk needs, but it is a ceiling and this script does not remove it. Raising it would mean
 * editing that constant, i.e. changing the product's fair-use policy for every Studio customer.
 *
 * WHY NOT JUST UPGRADE THE E2E ACCOUNT: `e2e-test@virtuna.local` staying on tier `free` is what
 * makes the credit walls testable — the 402 → trial-wall dialog was verified on production
 * through exactly that account on 2026-08-05. Two accounts, two jobs. Do not merge them.
 *
 * The trial fields are explicitly NULLed: `creditAllowanceFor` lets the TRIAL cap win even on
 * Studio (deliberately, so `null` can never leak into a trial), so an account carrying a live
 * trial window would be capped at `TRIAL.credits` no matter what its tier said.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────────────────
 *   STAFF_TEST_PASSWORD='…' npx tsx scripts/create-unlimited-test-user.ts
 *   STAFF_TEST_EMAIL='someone@example.com' STAFF_TEST_PASSWORD='…' npx tsx scripts/…
 *
 * Omit STAFF_TEST_PASSWORD and a strong one is generated and printed ONCE. Credentials are
 * never written to a file by this script — put them in a password manager, not in the repo.
 * Idempotent: safe to re-run to repair the tier or reset the password.
 */
import { config } from "dotenv";
import { randomBytes } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const EMAIL = process.env.STAFF_TEST_EMAIL ?? "staff-unlimited@virtuna.local";
const GENERATED = !process.env.STAFF_TEST_PASSWORD;
const PASSWORD = process.env.STAFF_TEST_PASSWORD ?? randomBytes(18).toString("base64url");
const DISPLAY_NAME = "Staff Test (unlimited)";

/** Far enough out that `current_period_end` never reads as a lapsed period during testing. */
const PERIOD_END = new Date(Date.UTC(new Date().getUTCFullYear() + 5, 0, 1)).toISOString();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await ensureUser(supabase);
  await ensureProfile(supabase, userId);
  await ensureStudioSubscription(supabase, userId);
  await report(supabase, userId);
}

/** Create the auth user, or reset its password so the printed credentials are always true. */
async function ensureUser(supabase: SupabaseClient): Promise<string> {
  // listUsers is paginated (50/page by default) and this project has more users than that.
  let existing: { id: string } | undefined;
  for (let page = 1; page <= 20 && !existing; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error("listUsers failed:", error.message); process.exit(1); }
    if (!data.users.length) break;
    existing = data.users.find((u) => u.email === EMAIL);
  }

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) { console.error("password reset failed:", error.message); process.exit(1); }
    console.log(`✓ user exists — password reset  ${EMAIL}  (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("createUser failed:", error?.message);
    process.exit(1);
  }
  console.log(`✓ created user  ${EMAIL}  (${data.user.id})`);
  return data.user.id;
}

/** Onboarding pre-completed, so the account lands straight on /home instead of the funnel. */
async function ensureProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("creator_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (data) { console.log("✓ creator profile already present"); return; }

  const { error } = await supabase.from("creator_profiles").insert({
    user_id: userId,
    display_name: DISPLAY_NAME,
    onboarding_completed_at: new Date().toISOString(),
  });
  if (error) console.error("⚠️ profile insert failed (non-fatal):", error.message);
  else console.log("✓ creator profile created, onboarding marked complete");
}

/**
 * The row `getCreditQuotaVerdict` reads. Only `virtuna_tier` and the trial window decide the
 * allowance — but `status` carries a CHECK constraint and other surfaces read it, so it is set
 * honestly rather than left to drift.
 */
async function ensureStudioSubscription(supabase: SupabaseClient, userId: string) {
  const row = {
    user_id: userId,
    virtuna_tier: "studio",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: PERIOD_END,
    // NULL on purpose — the trial cap beats "unlimited" (see the header note).
    is_trial: false,
    trial_started_at: null,
    trial_ends_at: null,
    trial_used_at: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("user_subscriptions").select("id").eq("user_id", userId).maybeSingle();

  const { error } = existing
    ? await supabase.from("user_subscriptions").update(row).eq("user_id", userId)
    : await supabase.from("user_subscriptions").insert(row);

  if (error) { console.error("subscription write failed:", error.message); process.exit(1); }
  console.log(`✓ subscription ${existing ? "updated" : "created"} — tier studio, active, no trial window`);
}

/** Read the row back. A write that was not read back is not a verified write. */
async function report(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("virtuna_tier,status,is_trial,trial_ends_at,current_period_end")
    .eq("user_id", userId).maybeSingle();

  console.log("\n── persisted row ─────────────────────────────");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n── credentials ───────────────────────────────");
  console.log(`  email    ${EMAIL}`);
  console.log(`  password ${PASSWORD}${GENERATED ? "   ← generated, shown ONCE" : ""}`);
  console.log(`  user id  ${userId}`);

  console.log("\n⚠️  A REAL PRODUCTION ACCOUNT on the shared Supabase project. Its runs spend real");
  console.log("    engine money. Store these in a password manager — do not commit them.");
  console.log("⚠️  \"Unlimited\" = no monthly wall, but 300 credits/UTC day (fair use, resets midnight");
  console.log("    UTC). Hitting it returns reason \"fair_use\", not \"upgrade\".");
}

main().catch((e) => { console.error(e); process.exit(1); });
