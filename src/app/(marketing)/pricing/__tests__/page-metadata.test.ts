import { describe, it, expect } from "vitest";

import { metadata } from "../page";
import { TRIAL } from "@/lib/pricing";

/**
 * The page metadata is part of the offer, not decoration.
 *
 * `pricing-section.test.tsx` next door guards what the PAGE promises, and it is thorough — but
 * it renders the section, so it could never see `page.tsx`'s exported `metadata`. That string
 * promised "a 7-day free Pro trial" while the product sold a $1 trial running 3 days: both of
 * its claims wrong, on the surface with the widest reach, since metadata is what a search
 * result and a shared link show to people who never open the page.
 *
 * So the same rule the section is held to applies here: never advertise terms the checkout will
 * refuse. These assertions are about the CHARGE and belong to the money path.
 */
describe("/pricing metadata", () => {
  it("states the trial's real price and duration", () => {
    const description = metadata.description ?? "";

    expect(description).toContain(TRIAL.price);
    expect(description).toContain(String(TRIAL.days));
  });

  it("never calls the trial free, and never quotes a duration that is not the real one", () => {
    const description = (metadata.description ?? "").toLowerCase();

    // "free trial" was the exact wrong claim: the trial costs a dollar, and the FAQ on the
    // marketing page answers "Is there a free trial?" with "Not a free one — a $1 one."
    expect(description).not.toContain("free trial");

    // Any day-count in the copy must be the real one. This catches the stale "7-day" directly
    // and any successor to it, rather than banning one literal that already shipped.
    const quotedDays = [...description.matchAll(/(\d+)[-\s]day/g)].map((m) => Number(m[1]));
    for (const days of quotedDays) {
      expect(days).toBe(TRIAL.days);
    }
  });

  it("is derived from TRIAL, so changing the terms cannot leave it behind", () => {
    // The regression was a hand-typed string drifting from the constant every other surface
    // reads. If someone re-hardcodes it, TRIAL moves and this fails.
    expect(metadata.description).toBe(
      `Choose the plan that fits your creator journey. Every plan starts at ${TRIAL.price} for ${TRIAL.days} days, then renews at the plan price unless you cancel.`
    );
  });
});
