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
 * FREE routes are listed too, as a decision, not an omission: chat and type-to-room are
 * free ON PURPOSE (the glue of the product), and the test fails if someone starts billing
 * them without moving them to the paid list.
 */

const ROOT = join(__dirname, "../../../app/api/tools");

/** route file → the action it must gate + bill as. */
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
};

/**
 * Free on purpose. Billing appearing here is a product decision that needs a human.
 *
 * `chat/route.ts` USED to be on this list, and that was the wrong shape for it: the conversation is
 * free by decision, but the agent it runs can dispatch PAID skills, and a blanket "no billUsage in
 * this file" assertion is satisfied just as well by the meter being missing as by it being
 * deliberately absent. It has its own test below, which pins both halves separately.
 */
const FREE_ROUTES = ["react/route.ts", "test/card/route.ts"];

describe("every paid tool route gates and bills", () => {
  for (const [file, action] of Object.entries(PAID_ROUTES)) {
    it(`${file} gates before spend and bills "${action}" on delivery`, () => {
      const src = readFileSync(join(ROOT, file), "utf8");

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
