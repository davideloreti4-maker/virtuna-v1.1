/** @vitest-environment happy-dom */
/**
 * proof-placement.test.tsx — Wave-0 Nyquist scaffold for PROOF-02 / D-10.
 *
 * RED until Plans 03-03/03-05 ship `@/components/numen-landing/proof-strip` and
 * `@/components/numen-landing/social-proof`. Encodes the "one source, two surfaces"
 * contract: the early thin `ProofStrip` and the full `SocialProof` block must read
 * from a SINGLE count value, never two independent queries.
 *
 * This scaffold guards that at the component level by rendering BOTH with the same
 * explicit `count` prop and asserting both surface that same number. The page
 * (Plan 03-05 Task 3) threads ONE `getWaitlistCount()` read into both — this is the
 * component-level half of that guard.
 *
 * Components imported dynamically so the file is RED on the missing modules now.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("Proof placement — PROOF-02 / D-10 one source, two surfaces (RED until Plans 03-03/05)", () => {
  it("ProofStrip and SocialProof both surface the SAME count (1,234)", async () => {
    const { ProofStrip } = await import("@/components/numen-landing/proof-strip");
    const { SocialProof } = await import("@/components/numen-landing/social-proof");

    const count = 1234;
    const strip = render(<ProofStrip count={count} />).container.textContent ?? "";
    const social = render(<SocialProof count={count} />).container.textContent ?? "";

    // Both read from ONE source → both render the same formatted number.
    expect(strip).toContain("1,234");
    expect(social).toContain("1,234");
  });
});
