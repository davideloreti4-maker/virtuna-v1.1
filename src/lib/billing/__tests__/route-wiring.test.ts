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

/** Free on purpose. Billing appearing here is a product decision that needs a human. */
const FREE_ROUTES = ["chat/route.ts", "react/route.ts", "test/card/route.ts"];

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
