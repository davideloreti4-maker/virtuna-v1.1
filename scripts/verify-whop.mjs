#!/usr/bin/env node
/**
 * Live Whop verification. Run the moment the owner hands over credentials.
 *
 * Proves, against the REAL API (not a mock):
 *   1. the API key authenticates
 *   2. every configured plan id exists, and its price/interval matches pricing.ts
 *   3. each trial SKU really is $1-initial + 3-day-trial + the plan's renewal price
 *   4. a checkout session can actually be created and returns the ch_… id the embed needs
 *
 * Usage:
 *   WHOP_API_KEY=... \
 *   WHOP_PRODUCT_ID_STARTER=... WHOP_PRODUCT_ID_PRO=... WHOP_PRODUCT_ID_STUDIO=... \
 *   WHOP_TRIAL_PLAN_ID_STARTER=... WHOP_TRIAL_PLAN_ID_PRO=... WHOP_TRIAL_PLAN_ID_STUDIO=... \
 *   node verify-whop.mjs
 *
 * Read-only except step 4, which creates a checkout SESSION. A session is not a charge —
 * nobody is billed — but it is a write, so it is clearly labelled and runs last.
 */

const BASE = "https://api.whop.com/api/v1";
const KEY = process.env.WHOP_API_KEY;

// The prices pricing.ts sells. A mismatch here means the dashboard and the app disagree
// about what a customer pays — the single most expensive kind of drift.
const EXPECTED = {
  starter: { name: "Creator", price: 49 },
  pro: { name: "Pro", price: 99 },
  studio: { name: "Studio", price: 499 },
};
const TRIAL = { initial: 1, days: 3 };

const PLANS = {
  starter: process.env.WHOP_PRODUCT_ID_STARTER,
  pro: process.env.WHOP_PRODUCT_ID_PRO,
  studio: process.env.WHOP_PRODUCT_ID_STUDIO,
};
const TRIALS = {
  starter: process.env.WHOP_TRIAL_PLAN_ID_STARTER,
  pro: process.env.WHOP_TRIAL_PLAN_ID_PRO,
  studio: process.env.WHOP_TRIAL_PLAN_ID_STUDIO,
};

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
};

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

if (!KEY) {
  console.error("WHOP_API_KEY is required");
  process.exit(1);
}

console.log("\n\x1b[1m1. API key\x1b[0m");
const me = await api("/me");
if (me.status === 200) ok(`authenticates (${BASE})`);
else if (me.status === 401) bad("401 — key is invalid or revoked");
else console.log(`  ? /me returned ${me.status} — trying plans anyway`);

console.log("\n\x1b[1m2. Full-price plans\x1b[0m");
for (const [tier, id] of Object.entries(PLANS)) {
  const want = EXPECTED[tier];
  if (!id) {
    bad(`${tier}: env var unset`);
    continue;
  }
  const { status, body } = await api(`/plans/${id}`);
  if (status !== 200) {
    bad(`${tier} (${id}): HTTP ${status} — plan does not exist`);
    continue;
  }
  const price = Number(body.renewal_price ?? body.base_price ?? body.price);
  const initial = Number(body.initial_price ?? 0);
  const trialDays = Number(body.trial_period_days ?? 0);

  if (price === want.price) ok(`${tier} → ${want.name}: $${price}/mo`);
  else bad(`${tier}: Whop says $${price}, pricing.ts says $${want.price}`);

  if (initial) bad(`${tier}: full-price plan has an initial fee of $${initial} — should be 0`);
  if (trialDays) bad(`${tier}: full-price plan has a ${trialDays}-day trial — should be 0`);
}

console.log("\n\x1b[1m3. $1 / 3-day trial SKUs\x1b[0m");
for (const [tier, id] of Object.entries(TRIALS)) {
  const want = EXPECTED[tier];
  if (!id) {
    bad(`${tier}: trial env var unset (checkout would silently sell FULL price)`);
    continue;
  }
  if (id === PLANS[tier]) {
    bad(`${tier}: trial id is the SAME as the full-price id — the $1 door does not exist`);
    continue;
  }
  const { status, body } = await api(`/plans/${id}`);
  if (status !== 200) {
    bad(`${tier} trial (${id}): HTTP ${status} — plan does not exist`);
    continue;
  }
  const initial = Number(body.initial_price ?? 0);
  const days = Number(body.trial_period_days ?? 0);
  const renewal = Number(body.renewal_price ?? body.base_price ?? body.price);

  initial === TRIAL.initial
    ? ok(`${tier} trial: $${initial} initial fee`)
    : bad(`${tier} trial: initial fee is $${initial}, expected $${TRIAL.initial}`);

  days === TRIAL.days
    ? ok(`${tier} trial: ${days}-day free trial`)
    : bad(`${tier} trial: free trial is ${days} days, expected ${TRIAL.days}`);

  renewal === want.price
    ? ok(`${tier} trial: renews at $${renewal}/mo`)
    : bad(`${tier} trial: renews at $${renewal}, expected $${want.price} — a trial that renews at the WRONG price is a refund queue`);
}

console.log("\n\x1b[1m4. Checkout session creation (write — creates a session, charges nobody)\x1b[0m");
const probeId = PLANS.starter ?? Object.values(PLANS).find(Boolean);
if (!probeId) {
  bad("no plan id available to probe");
} else {
  const res = await fetch(`${BASE}/checkout_configurations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: probeId,
      metadata: { supabase_user_id: "verify-probe", supabase_email: "probe@local" },
      redirect_url: "https://numenmachines.com/settings?tab=billing&checkout=success",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status >= 200 && res.status < 300 && body.id) {
    ok(`created session ${body.id}`);
    String(body.id).startsWith("ch_")
      ? ok("id is a ch_… checkout session — matches what <WhopCheckoutEmbed sessionId> expects")
      : bad(`id "${body.id}" is not a ch_… id — the embed may reject it`);
    // The whole point of a session over a bare planId: metadata must survive to the webhook,
    // because that is how we map a purchase back to a Supabase user.
    body.metadata?.supabase_user_id === "verify-probe"
      ? ok("metadata round-trips (this is what the webhook reads to find the user)")
      : bad(`metadata did NOT round-trip: ${JSON.stringify(body.metadata ?? null)} — the webhook could not identify the buyer`);
  } else {
    bad(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
}

console.log(
  failures === 0
    ? "\n\x1b[32m\x1b[1mAll checks passed.\x1b[0m\n"
    : `\n\x1b[31m\x1b[1m${failures} check(s) failed — do NOT flip enforcement.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
