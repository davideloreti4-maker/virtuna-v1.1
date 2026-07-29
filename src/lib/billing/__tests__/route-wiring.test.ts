import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CREDIT_COSTS } from "@/lib/pricing";

/**
 * THE WIRING GUARD — every paid route must gate BEFORE spend and bill ON delivery.
 *
 * This is a source-scan, and says so: it proves the calls are PRESENT in each route file,
 * not that they behave (behaviour is covered by credit-gate.test.ts + the route suites).
 * Its job is the regression nobody writes a test for: a refactor that quietly drops the
 * `creditGate` line from one of eleven routes, which the route's own green suite would
 * never notice — enforcement is off in tests, so nothing fails when billing vanishes.
 *
 * FREE routes are listed too, as a decision, not an omission: chat is free ON PURPOSE (the
 * glue of the product), and the test fails if someone starts billing it without moving it to
 * the paid list.
 *
 * ⚠️ `react/route.ts` was on that free list until 2026-07-28. It is a real Flash panel run,
 * and the `＋ Test something of your own` door promotes it to a primary action, so the owner
 * priced it at 1 credit under its own `react` key. Moving it here is the guard's whole point
 * working in the other direction: the list is where a pricing decision is written down.
 */

const ROOT = join(__dirname, "../../../app/api/tools");
const API_ROOT = join(__dirname, "../../../app/api");

/** route file (relative to `api/tools`) → the action it must gate + bill as. */
const PAID_ROUTES: Record<string, keyof typeof CREDIT_COSTS> = {
  "hooks/route.ts": "hooks",
  "ideas/route.ts": "ideas",
  "ideas/develop/route.ts": "develop",
  "script/route.ts": "script",
  "read/route.ts": "read",
  "refine/route.ts": "refine",
  "predict/route.ts": "predict",
  "simulate/route.ts": "simulate",
  "profile/route.ts": "profile",
  "explore/route.ts": "explore",
  "remix/run/route.ts": "remix",
  "react/route.ts": "react",
};

/**
 * Free on purpose. Billing appearing here is a product decision that needs a human.
 *
 * The list emptied out from BOTH ends on 2026-07-28, which is the guard working as intended —
 * it is where a pricing decision gets written down:
 *   - `react/route.ts` moved UP to the paid list (a real Flash panel run, priced at 1 credit).
 *   - `chat/route.ts` moved OUT to its own test below. A blanket "no billUsage in this file"
 *     assertion was the wrong shape for it: the conversation is free by decision, but the agent
 *     it runs dispatches PAID skills, and the assertion is satisfied just as well by the meter
 *     being MISSING as by it being deliberately absent. Both halves are pinned separately now.
 */
const FREE_ROUTES = ["test/card/route.ts"];

/**
 * ⚠️ PAID ROUTES THAT DO NOT LIVE UNDER `api/tools` — and the reason this map had to exist.
 *
 * `ROOT` above is `api/tools`, so for as long as that was the only path scanned, this guard could
 * not see a paid route anywhere else in `api/` no matter how expensive it was. `/api/account-read`
 * sat outside it running TWO Apify scrapes per call, ungated and unbilled, with `account` not even
 * a key in CREDIT_COSTS — flagged across six sessions and invisible to the one test whose whole
 * job is catching exactly that. The guard was not failing; it was looking in one directory.
 *
 * Add a paid route here the moment it lives outside `api/tools`. A guard that covers one folder
 * reads like a guard that covers the API.
 *
 * NOT covered by this file, and deliberately: `analyze/route.ts` gates and bills `score`/`remix`
 * through the LOWER-LEVEL pair (`getCreditQuotaVerdict` + `recordUsage`) rather than
 * `creditGate` + `billUsage`, so these string assertions do not fit its shape. It is genuinely
 * metered — verified at `analyze/route.ts:420` (gate) and `:908`/`:1174` (bill) — just not by
 * this mechanism. Asserting the wrong pair here would produce a red test for correct code.
 */
const PAID_ROUTES_OUTSIDE_TOOLS: Record<string, keyof typeof CREDIT_COSTS> = {
  "account-read/route.ts": "account",
};

/** Every paid route, wherever it lives: [absolute path, action, display name]. */
const ALL_PAID_ROUTES: Array<[string, keyof typeof CREDIT_COSTS, string]> = [
  ...Object.entries(PAID_ROUTES).map(
    ([file, action]) => [join(ROOT, file), action, `tools/${file}`] as [string, keyof typeof CREDIT_COSTS, string],
  ),
  ...Object.entries(PAID_ROUTES_OUTSIDE_TOOLS).map(
    ([file, action]) => [join(API_ROOT, file), action, file] as [string, keyof typeof CREDIT_COSTS, string],
  ),
];

describe("every paid tool route gates and bills", () => {
  for (const [path, action, file] of ALL_PAID_ROUTES) {
    it(`${file} gates before spend and bills "${action}" on delivery`, () => {
      const src = readFileSync(path, "utf8");

      // The USER, never `user.id`: `is_anonymous` decides which allowance applies, and while it
      // was an optional 6th argument eleven of these twelve routes never passed it — so an
      // anonymous /go visitor read as a customer and ran every skill free and unmetered.
      expect(src, `${file} must call creditGate with the user object`).toContain(
        `creditGate(supabase, user, "${action}")`
      );
      expect(src, `${file} must not pass a bare user id — anonymity would be lost`).not.toContain(
        "creditGate(supabase, user.id"
      );
      expect(src, `${file} must bill on the success path`).toContain("billUsage(");
      // The bill names its action (explore bills a ternary — scrape vs cached).
      if (action === "explore") {
        expect(src).toContain(`liveScrape ? "explore_scrape" : "explore"`);
      } else {
        expect(src).toContain(`action: "${action}"`);
      }
      // Ordering: the gate must appear before the stream/pipeline body of the file.
      expect(src.indexOf("creditGate("), `${file}: gate must run before billing`).toBeLessThan(
        src.indexOf("billUsage(")
      );
    });
  }

  for (const file of FREE_ROUTES) {
    it(`${file} stays free — no gate, no bill (a decision, not an omission)`, () => {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src).not.toContain("creditGate(");
      expect(src).not.toContain("billUsage(");
    });
  }

  it("the free chat route does not hand an ANONYMOUS visitor the paid skills", () => {
    // Chat is free by decision, but the agent loop can DISPATCH paid skills (ideas/hooks/script)
    // in-process — the pipelines behind three gated routes. For an anonymous /go visitor that is the
    // trial wall's back door: the demo entitles one Test, so the route must bind the free-only
    // registry. (For a real CUSTOMER those runs are now gated + billed too — the test below.)
    const src = readFileSync(join(ROOT, "chat/route.ts"), "utf8");
    expect(src).toContain("FREE_SKILL_TOOLS");
    expect(src).toContain("isSealedVisitor(user)");
  });

  it("chat/route.ts is free to TALK to, but charges for the skills its agent dispatches", () => {
    // The two halves of this route pull in opposite directions and both matter:
    //
    //   the TURN is free      — chat is the glue of the product; admission-pricing a sentence would
    //                           make the thread hostile, so there is no gate on the conversation.
    //   the SKILLS are not    — ideas/hooks/script hit the same paid engine as their own routes. For
    //                           months they ran here with no gate and no ledger row, so the identical
    //                           pack cost 1 credit from the skill pill and 0 from chat. That made
    //                           deleting the pill a pricing change, not a UI change.
    //
    // A single "no billUsage in this file" assertion cannot tell those apart — it passes loudest
    // exactly when the meter is missing. So pin each half to what it must actually contain.
    const src = readFileSync(join(ROOT, "chat/route.ts"), "utf8");

    // No admission price on the conversation itself — a gate on a LITERAL action would be one.
    expect(src, "the chat turn itself must stay free").not.toMatch(/creditGate\(supabase, user, "/);

    // …but a dispatched skill goes through the same gate + till as its own dedicated route, priced
    // by the action the skill declares, so the two doors into the engine cannot drift apart.
    expect(src, "dispatched skills must be gated").toContain("creditGate(supabase, user, action)");
    expect(src, "dispatched skills must be billed").toContain("billUsage(");
    expect(src, "the loop must be handed the till").toContain("billing: skillBilling(");
  });

  it("the react route walls the anonymous visitor BEFORE it gates them", () => {
    // Enforcement is opt-in for customers (`BILLING_ENFORCE_QUOTA`, off in production) but NOT
    // for an anonymous session: `enforced = isAnonymous || isQuotaEnforced()`. `react` is not
    // the DEMO_ACTION, so a /go visitor reaching this gate is refused `trial_required` — a live
    // 402 on a route that shipped its gate on the promise that nobody would see one yet.
    //
    // The only reason they cannot reach it is ORDER: THE WALL 403s every anonymous session
    // first. That ordering is load-bearing, and nothing else in the file says so.
    const src = readFileSync(join(ROOT, "react/route.ts"), "utf8");
    const wall = src.indexOf("isSealedVisitor(user)");
    const gate = src.indexOf("creditGate(");
    expect(wall, "react/route.ts must wall the anonymous visitor").toBeGreaterThan(-1);
    expect(gate, "react/route.ts must gate").toBeGreaterThan(-1);
    expect(wall, "THE WALL must run before the credit gate").toBeLessThan(gate);
  });

  it("the analyze route (score + remix decode) gates at the Reading price", () => {
    const src = readFileSync(
      join(__dirname, "../../../app/api/analyze/route.ts"),
      "utf8"
    );
    expect(src).toContain('getCreditQuotaVerdict(supabase, user, "score", CREDITS_PER_READING');
    expect(src).toContain("recordUsage(");
  });

  it("the analyze route hands the meter the USER, so the /go visitor cannot read as a customer", () => {
    // The funnel's free run happens here. An anonymous visitor is tier `free` (allowance 0),
    // so a gate that only sees `user.id` refuses the demo the day BILLING_ENFORCE_QUOTA flips
    // on — on the one page built to convert them, with a 402 nobody would be watching for.
    // Passing the user makes `is_anonymous` impossible to drop without a type error.
    const src = readFileSync(
      join(__dirname, "../../../app/api/analyze/route.ts"),
      "utf8"
    );
    expect(src).not.toContain("getCreditQuotaVerdict(supabase, user.id");
  });
});
