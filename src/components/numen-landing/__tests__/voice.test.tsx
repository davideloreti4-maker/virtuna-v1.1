/** @vitest-environment happy-dom */
/**
 * voice.test.tsx — Wave-0 Nyquist scaffold for VOICE.md Hard Rules 1-2.
 *
 * RED until Wave 1/2/3 ships the three copy-bearing components. Renders the hero,
 * verdict-throne, and how-it-works together and scans the combined rendered text
 * against the VOICE.md ban list:
 *  - Rule 1 (ZERO engine jargon): Apollo / fold / Omni / model / pipeline.
 *  - Rule 2 (ZERO hype / fake precision): % / viral / virality / guaranteed /
 *    accuracy / predict.
 *
 * Stays RED on missing modules; goes GREEN only if EVERY shipped copy string passes
 * VOICE. This is the automated voice gate for the page's positioning moat.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

// VOICE.md Hard Rules 1-2 forbidden-copy patterns.
const banned: RegExp[] = [
  /%/,
  /\bviral\b/i,
  /virality/i,
  /guaranteed/i,
  /\bApollo\b/,
  /\bfold\b/,
  /\bOmni\b/i,
  /\bpipeline\b/,
  /\bmodel\b/i,
  /accuracy/i,
  /predict/i,
];

describe("VOICE — Rules 1-2 forbidden-copy scan on rendered copy (RED until Wave 1/2/3)", () => {
  it("renders no banned engine-jargon or hype/fake-precision token across hero + verdict + explainer", async () => {
    const { Hero } = await import("@/components/numen-landing/hero");
    const { VerdictThrone } = await import("@/components/numen-landing/verdict-throne");
    const { HowItWorks } = await import("@/components/numen-landing/how-it-works");

    const hero = render(<Hero />).container.textContent ?? "";
    const throne = render(<VerdictThrone />).container.textContent ?? "";
    const how = render(<HowItWorks />).container.textContent ?? "";
    const text = `${hero}\n${throne}\n${how}`;

    for (const re of banned) {
      expect(text).not.toMatch(re);
    }
  });
});
