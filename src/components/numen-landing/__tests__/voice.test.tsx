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
 *
 * Phase-3 EXTEND: the ban scan now also covers reading-gallery, social-proof,
 * proof-strip, and cta-section (none may contain a banned token). honesty-comparison
 * is EXCLUDED from the ban scan and instead gets a POSITIVE assertion — it is the
 * one sanctioned home of the rival strings (viral score / accuracy / guaranteed,
 * D-05). RED until Plans 02/03/05 ship all five components.
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

  // Phase-3 EXTEND — the four NEW copy-bearing components must be VOICE-clean.
  // honesty-comparison is DELIBERATELY excluded here (it is the one sanctioned home
  // of the rival strings, D-05) and gets a positive assertion in the next test.
  it("bans every forbidden token in reading-gallery + social-proof + proof-strip + cta-section", async () => {
    const { ReadingGallery } = await import("@/components/numen-landing/reading-gallery");
    const { SocialProof } = await import("@/components/numen-landing/social-proof");
    const { ProofStrip } = await import("@/components/numen-landing/proof-strip");
    const { CtaSection } = await import("@/components/numen-landing/cta-section");

    const gallery = render(<ReadingGallery />).container.textContent ?? "";
    const social = render(<SocialProof count={3} />).container.textContent ?? "";
    const strip = render(<ProofStrip count={3} />).container.textContent ?? "";
    const cta = render(<CtaSection />).container.textContent ?? "";
    const text = `${gallery}\n${social}\n${strip}\n${cta}`;

    for (const re of banned) {
      expect(text).not.toMatch(re);
    }
  });

  // D-05 — the sanctioned rival strings live ONLY in honesty-comparison. Positive
  // assertion (NOT a ban scan): prove they are present-and-scoped here, so the ban
  // scan above stays meaningful even though the comparison section needs them.
  it("scopes the sanctioned rival strings to honesty-comparison (positive assertion, D-05)", async () => {
    const { HonestyComparison } = await import(
      "@/components/numen-landing/honesty-comparison"
    );
    const text = render(<HonestyComparison />).container.textContent ?? "";
    expect(text).toMatch(/viral score|virality score/i);
    expect(text).toMatch(/accuracy|guaranteed/i);
  });
});
