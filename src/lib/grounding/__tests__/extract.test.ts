import { describe, it, expect } from "vitest";
import { mapExtractionResponse, isUsableTeardown, type ExtractionInput } from "../extract";
import { classifyFacet, slugifyFacet } from "../types";

const input = (over: Partial<ExtractionInput> = {}): ExtractionInput => ({
  caption: "cottage cheese eggs",
  hashtags: ["highprotein"],
  opening: "Stop buying protein bars.",
  views: 1_000_000,
  multiplier: 12.3,
  baselineLabel: "vs niche",
  ...over,
});

describe("classifyFacet (soft vocab)", () => {
  it("normalizes a known label to its seed slug and flags it known", () => {
    expect(classifyFacet("hook_archetype", "Secret Reveal / Breakdown")).toEqual({
      slug: "secret-reveal-breakdown",
      known: true,
    });
  });
  it("keeps an unknown value (growable) but flags known:false", () => {
    const r = classifyFacet("format", "Duet Stitch Reply");
    expect(r.slug).toBe("duet-stitch-reply");
    expect(r.known).toBe(false);
  });
  it("returns null slug for empty/blank", () => {
    expect(classifyFacet("format", "  ")).toEqual({ slug: null, known: false });
    expect(classifyFacet("format", null)).toEqual({ slug: null, known: false });
  });
  it("slugifies & → and, strips punctuation, collapses hyphens", () => {
    expect(slugifyFacet("A vs. B  Comparison!!")).toBe("a-vs-b-comparison");
    expect(slugifyFacet("Q&A")).toBe("qanda");
  });
});

describe("mapExtractionResponse", () => {
  const parsed = {
    teardowns: [
      {
        hookArchetype: "Contrarian",
        format: "Problem Solution",
        visualHook: "Crash Zoom",
        editingStyle: null,
        signatureSeries: null,
        spokenHook: "Stop buying protein bars.",
        hookTemplate: "Stop buying [product category].",
        idea: {
          seed: "cheap protein",
          angle: "grocery-store protein beats supplements",
          belief: "you need powders",
          reality: "whole foods win",
          evidence: "macros per dollar",
        },
        template: {
          name: "Myth-bust + swap",
          slots: [{ key: "myth", label: "The myth", example: "protein bars" }],
          skeleton: ["call out the myth", "reveal the swap", "show the payoff"],
          guidance: "lead with the myth in 3 words",
        },
        whyItWorks: "pattern-interrupt on a common purchase",
      },
    ],
  };

  it("aligns 1:1 with inputs and normalizes facets to slugs", () => {
    const out = mapExtractionResponse(parsed, [input()]);
    expect(out).toHaveLength(1);
    expect(out[0]!.hookArchetype).toBe("contrarian");
    expect(out[0]!.hookTemplate).toBe("Stop buying [product category].");
    expect(out[0]!.format).toBe("problem-solution");
    expect(out[0]!.visualHook).toBe("crash-zoom");
    expect(out[0]!.editingStyle).toBeNull();
    expect(out[0]!.idea?.angle).toBe("grocery-store protein beats supplements");
    expect(out[0]!.template?.skeleton).toHaveLength(3);
  });

  it("derives hookSource from opening presence (honest, not model-trusted)", () => {
    const withT = mapExtractionResponse(parsed, [input({ opening: "hi" })]);
    const noT = mapExtractionResponse(parsed, [input({ opening: null })]);
    expect(withT[0]!.hookSource).toBe("native_transcript");
    expect(noT[0]!.hookSource).toBe("caption_fallback");
  });

  it("pads missing items to a null-filled Teardown (never fabricates)", () => {
    const out = mapExtractionResponse({ teardowns: [] }, [input(), input()]);
    expect(out).toHaveLength(2);
    expect(out[0]!.spokenHook).toBeNull();
    expect(out[0]!.idea).toBeNull();
    expect(out[0]!.template).toBeNull();
    // hookSource is still set honestly even on an empty teardown
    expect(out[0]!.hookSource).toBe("native_transcript");
    expect(isUsableTeardown(out[0]!)).toBe(false);
  });

  it("drops a garbage idea/template but keeps a usable hook", () => {
    const out = mapExtractionResponse(
      { teardowns: [{ spokenHook: "real hook", idea: "not an object", template: 42 }] },
      [input()],
    );
    expect(out[0]!.idea).toBeNull();
    expect(out[0]!.template).toBeNull();
    expect(out[0]!.spokenHook).toBe("real hook");
    expect(isUsableTeardown(out[0]!)).toBe(true);
  });

  it("tolerates a totally malformed response", () => {
    expect(mapExtractionResponse(null, [input()])).toHaveLength(1);
    expect(mapExtractionResponse({ nope: 1 }, [input()])[0]!.spokenHook).toBeNull();
  });
});
