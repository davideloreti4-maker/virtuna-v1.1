/** @vitest-environment happy-dom */
/**
 * social-proof.test.tsx — Wave-0 Nyquist scaffold for PROOF-01 / D-09.
 *
 * RED until Plan 03-05 ships `@/components/numen-landing/social-proof`.
 * Encodes the UI-SPEC §3 D-09 threshold guard: the proof block NEVER reads as a
 * weak "0 creators" claim. Below a THRESHOLD count it shows a qualitative anchor
 * ("be one of the first…"); at/above it shows the real formatted number.
 *
 *   THRESHOLD = 50  // implementer must match this cutover in social-proof.tsx
 *
 * Component imported dynamically so the file is RED on the missing module now.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("SocialProof — PROOF-01 / D-09 threshold guard (RED until Plan 03-05)", () => {
  it("below threshold (count=3): never says '0 creators', shows qualitative 'first' anchor", async () => {
    const { SocialProof } = await import("@/components/numen-landing/social-proof");
    const text = render(<SocialProof count={3} />).container.textContent ?? "";
    expect(text).not.toContain("0 creators");
    expect(text.toLowerCase()).toContain("first");
  });

  it("above threshold (count=5000): shows the real formatted number via toLocaleString", async () => {
    const { SocialProof } = await import("@/components/numen-landing/social-proof");
    const text = render(<SocialProof count={5000} />).container.textContent ?? "";
    expect(text).toContain("5,000");
  });
});
