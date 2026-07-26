#!/usr/bin/env node
/**
 * Provision the whole Whop catalogue from pricing.ts.
 *
 * Creates, for each tier: one product, one full-price plan, and one $1/3-day trial plan.
 * Then creates the webhook and captures its signing secret (returned ONLY on creation —
 * a later read will not give it back, so this script is the one chance to capture it).
 *
 * The owner still has to sign up and finish Whop's payout/KYC onboarding by hand; that is
 * a merchant agreement plus banking and tax identity, and it is theirs to accept. Everything
 * after that is here.
 *
 * Usage:
 *   WHOP_API_KEY=...  [WHOP_COMPANY_ID=biz_...]  node provision-whop.mjs [--apply]
 *
 * Runs as a DRY RUN by default and prints exactly what it would create. Pass --apply to
 * actually create. Writes the resulting env vars to whop-env.json.
 *
 * Re-running with --apply creates DUPLICATES — Whop has no upsert here. If a run half
 * fails, read whop-env.json and the console output, then delete the strays in the dashboard
 * before retrying, or pass the ids you already have via env to skip those steps.
 */

import { writeFileSync } from "fs";

const BASE = "https://api.whop.com/api/v1";
const KEY = process.env.WHOP_API_KEY;
const APPLY = process.argv.includes("--apply");

if (!KEY) {
  console.error("WHOP_API_KEY is required");
  process.exit(1);
}

/**
 * Mirrors src/lib/pricing.ts. `id` is the persisted tier id (`starter` is sold as
 * "Creator" — never print the id to a customer).
 *
 * The trial is NOT a separate Whop primitive: it is the same monthly plan carrying an
 * initial_price of $1 plus a 3-day trial_period_days. Whop charges an initial fee up front
 * and only delays the SUBSCRIPTION, which is precisely "$1 today, full price on day 4".
 */
const TIERS = [
  { id: "starter", name: "Creator", price: 49, blurb: "500 credits/month — about 50 full Readings." },
  { id: "pro", name: "Pro", price: 99, blurb: "1,500 credits/month, 1,000-viewer population depth, priority support." },
  { id: "studio", name: "Studio", price: 499, blurb: "Unlimited credits (fair use), 5 seats, API access, dedicated support." },
];

const TRIAL = { price: 1, days: 3 };
const MONTHLY_DAYS = 30;
const APP_URL = process.env.APP_URL ?? "https://numenmachines.com";
const WEBHOOK_URL = `${APP_URL}/api/webhooks/whop`;

// The three the handler acts on. invoice.past_due is included as a second past-due signal.
const WEBHOOK_EVENTS = [
  "membership.activated",
  "membership.deactivated",
  "payment.failed",
  "invoice.past_due",
];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** The company every product hangs off. Discover it, or take it from the env. */
async function resolveCompanyId() {
  if (process.env.WHOP_COMPANY_ID) return process.env.WHOP_COMPANY_ID;
  // `/api/v1/companies` needs the `company:basic:read` scope, which a default key does NOT
  // carry. The older `/api/v2/company` returns the same id for the key's own company with
  // no extra scope, so try it first and avoid sending the owner back to the dashboard.
  for (const url of [
    "https://api.whop.com/api/v2/company",
    "https://api.whop.com/api/v5/company",
    `${BASE}/companies`,
  ]) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
      if (!res.ok) continue;
      const r = await res.json();
      const id = r?.id ?? r?.company?.id ?? r?.data?.[0]?.id;
      if (typeof id === "string" && id.startsWith("biz_")) return id;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    "Could not discover the company id. Pass WHOP_COMPANY_ID=biz_… — it is the biz_… in your Whop dashboard URL."
  );
}

const out = { products: {}, plans: {}, trialPlans: {}, webhook: null };

console.log(`\n${APPLY ? "\x1b[41m\x1b[97m APPLY \x1b[0m — creating real objects" : "\x1b[46m\x1b[30m DRY RUN \x1b[0m — nothing will be created (pass --apply to commit)"}\n`);

const companyId = APPLY || process.env.WHOP_COMPANY_ID ? await resolveCompanyId() : "biz_<discovered at apply>";
console.log(`company: ${companyId}\n`);

for (const tier of TIERS) {
  console.log(`\x1b[1m${tier.name}\x1b[0m (tier id: ${tier.id})`);

  // ---- product -----------------------------------------------------------
  const productBody = {
    company_id: companyId,
    title: `Maven ${tier.name}`,
    description: tier.blurb,
    visibility: "visible",
  };
  console.log(`  product   → "${productBody.title}"`);

  let productId = `prod_<${tier.id}>`;
  if (APPLY) {
    const p = await api("POST", "/products", productBody);
    productId = p.id;
    console.log(`              created ${productId}`);
  }
  out.products[tier.id] = productId;

  // ---- full-price plan ---------------------------------------------------
  const fullBody = {
    product_id: productId,
    plan_type: "renewal",
    currency: "usd",
    visibility: "visible",
    renewal_price: tier.price,
    billing_period: MONTHLY_DAYS,
    title: tier.name,
    description: `${tier.name} — $${tier.price}/month.`,
  };
  console.log(`  plan      → $${tier.price}/mo, no trial, no initial fee`);

  let fullId = `plan_<${tier.id}_full>`;
  if (APPLY) {
    const p = await api("POST", "/plans", fullBody);
    fullId = p.id;
    console.log(`              created ${fullId}`);
  }
  out.plans[tier.id] = fullId;

  // ---- $1 / 3-day trial plan --------------------------------------------
  const trialTitle = `${tier.name} — $${TRIAL.price} for ${TRIAL.days} days`; // <=30 chars
  const trialBody = {
    product_id: productId,
    plan_type: "renewal",
    currency: "usd",
    visibility: "visible",
    initial_price: TRIAL.price, // charged immediately
    renewal_price: tier.price, // starts after trial_period_days
    billing_period: MONTHLY_DAYS,
    trial_period_days: TRIAL.days,
    title: trialTitle.length > 30 ? `${tier.name} $1 trial` : trialTitle,
    description: `$${TRIAL.price} for ${TRIAL.days} days, then $${tier.price}/month. Cancel anytime.`,
  };
  console.log(
    `  trial SKU → $${TRIAL.price} now + ${TRIAL.days}-day trial, then $${tier.price}/mo`
  );

  let trialId = `plan_<${tier.id}_trial>`;
  if (APPLY) {
    const p = await api("POST", "/plans", trialBody);
    trialId = p.id;
    console.log(`              created ${trialId}`);
  }
  out.trialPlans[tier.id] = trialId;
  console.log();
}

// ---- webhook -------------------------------------------------------------
console.log(`\x1b[1mWebhook\x1b[0m`);
console.log(`  url    → ${WEBHOOK_URL}`);
console.log(`  events → ${WEBHOOK_EVENTS.join(", ")}`);

if (APPLY) {
  const w = await api("POST", "/webhooks", {
    url: WEBHOOK_URL,
    events: WEBHOOK_EVENTS,
    enabled: true,
  });
  // Returned ONLY on creation. If this is ever lost, the webhook must be rotated.
  const secret = w.webhook_secret ?? w.secret;
  out.webhook = { id: w.id, secret: secret ?? null };
  console.log(`           created ${w.id}`);
  if (!secret) {
    console.log(
      "  \x1b[31m✗ no signing secret in the response — read it from the dashboard and set WHOP_WEBHOOK_SECRET by hand\x1b[0m"
    );
  } else {
    console.log(`           signing secret captured (${secret.slice(0, 8)}…)`);
  }
}
console.log();

// ---- the env vars --------------------------------------------------------
const env = {
  WHOP_PRODUCT_ID_STARTER: out.plans.starter,
  WHOP_PRODUCT_ID_PRO: out.plans.pro,
  WHOP_PRODUCT_ID_STUDIO: out.plans.studio,
  WHOP_TRIAL_PLAN_ID_STARTER: out.trialPlans.starter,
  WHOP_TRIAL_PLAN_ID_PRO: out.trialPlans.pro,
  WHOP_TRIAL_PLAN_ID_STUDIO: out.trialPlans.studio,
  WHOP_WEBHOOK_SECRET: out.webhook?.secret ?? "<from webhook creation>",
  WHOP_API_KEY: "<the key you generated>",
};

console.log("\x1b[1mEnv vars\x1b[0m");
for (const [k, v] of Object.entries(env)) {
  const shown = k === "WHOP_WEBHOOK_SECRET" && APPLY && out.webhook?.secret ? "<captured — in whop-env.json>" : v;
  console.log(`  ${k}=${shown}`);
}

// NOTE: WHOP_PRODUCT_ID_* hold PLAN ids, not product ids. The name is legacy; checkout
// sends `plan_id`, so plan ids are what every lookup matches against. Writing product ids
// here would break tier mapping on every webhook.
writeFileSync(
  new URL("./whop-env.json", import.meta.url),
  JSON.stringify({ companyId, products: out.products, env }, null, 2)
);
console.log(`\nwrote whop-env.json${APPLY ? "" : " (dry-run placeholders)"}\n`);
