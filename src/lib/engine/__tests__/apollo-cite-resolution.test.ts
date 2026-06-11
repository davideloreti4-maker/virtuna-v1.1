/**
 * §-cite resolution guard tests — ENG-02 / plan 01-01.
 *
 * The faithful runtime harness (scripts/apollo-cite-harness.ts) proved two things on
 * the real Apollo path: (a) emitted cites resolved to the lean core (no dangler on the
 * test video), but the lean prefix is the ONLY thing keeping it so; (b) 7 §-cites LEAKED
 * into user-facing prose (ceiling_capper/confidence_scope/suggestions). guardApolloCites
 * is the V5 backstop: strip danglers from auditable metadata, strip ALL cites from prose.
 *
 * These exercise the guard directly (pure function, no LLM/network mock).
 */
import { describe, it, expect } from "vitest";
import { guardApolloCites } from "../deepseek";
import { PRESENT_SECTIONS } from "../apollo-core";
import type { DeepSeekReasoning } from "../types";

// Minimal valid-shaped Apollo response; tests mutate the cite-bearing fields.
function makeReasoning(overrides?: Partial<DeepSeekReasoning>): DeepSeekReasoning {
  const dim = (name: string) => ({
    name: name as never,
    band: "mid" as const,
    score: 50,
    lever: "Contrast / curiosity gap (§2.1)",
    evidence: "Hook states the topic but opens no gap (§2.1)",
  });
  return {
    behavioral_predictions: undefined,
    component_scores: {
      hook_effectiveness: 5, retention_strength: 5, shareability: 5,
      comment_provocation: 5, save_worthiness: 5, trend_alignment: 5, originality: 5,
    },
    suggestions: [{ text: "Open a curiosity gap (§2.1) in the first line.", priority: "high", category: "hook" }],
    warnings: [],
    confidence: "medium",
    dimensions: ["hook", "retention", "clarity", "share_pull", "substance", "credibility"].map(dim),
    composite_score: 50,
    ceiling_capper: "The hook is a topic label, not a curiosity gap (§2.1), and the take is recycled (§2.5).",
    confidence_scope: "Sensor did not provide mute-readability or 3-hook alignment (§2.1 multimodal).",
    rewrites: [
      { original: "verbatim hook", variant: "Girls know their birthday (§2.1). Guys don't.", lever_fixed: "Contrast / curiosity gap (§2.1)" },
      { original: "verbatim hook", variant: "I can name 3 things in 5 seconds.", lever_fixed: "Specificity (§2.1)" },
    ],
    ...overrides,
  } as DeepSeekReasoning;
}

describe("guardApolloCites — metadata danglers", () => {
  it("strips a fabricated §9 dangler from a dimension lever, keeps the valid §2.2", () => {
    const data = makeReasoning();
    data.dimensions[1]!.lever = "Dopamine ladder (§2.2) + behavioral layer (§9)";
    const { drift } = guardApolloCites(data);
    expect(data.dimensions[1]!.lever).toContain("§2.2");   // valid — preserved
    expect(data.dimensions[1]!.lever).not.toContain("§9"); // dangler — stripped
    expect(drift).toContain("§9");
  });

  it("strips dropped-section danglers (§2.6/§7/§8) from evidence", () => {
    const data = makeReasoning();
    data.dimensions[0]!.evidence = "Audience fit per §7 and behavioral §2.6 with provenance §8";
    guardApolloCites(data);
    for (const t of ["§7", "§2.6", "§8"]) expect(data.dimensions[0]!.evidence).not.toContain(t);
  });

  it("preserves a valid lever cite untouched when nothing dangles", () => {
    const data = makeReasoning();
    data.dimensions[0]!.lever = "Contrast / curiosity gap (§2.1)";
    data.dimensions[0]!.evidence = "Resolves cleanly to the lean core (§4.1)";
    guardApolloCites(data);
    // Valid metadata cites survive byte-for-byte (only danglers are stripped from lever/evidence).
    expect(data.dimensions[0]!.lever).toBe("Contrast / curiosity gap (§2.1)");
    expect(data.dimensions[0]!.evidence).toBe("Resolves cleanly to the lean core (§4.1)");
  });

  it("strips a dangler from rewrite lever_fixed", () => {
    const data = makeReasoning();
    data.rewrites[0]!.lever_fixed = "Made-up lever (§8)";
    guardApolloCites(data);
    expect(data.rewrites[0]!.lever_fixed).not.toContain("§8");
  });
});

describe("guardApolloCites — prose discipline (strip ALL cites)", () => {
  it("strips every §-cite from ceiling_capper, leaving readable prose", () => {
    const data = makeReasoning();
    const { drift } = guardApolloCites(data);
    expect(data.ceiling_capper).not.toMatch(/§/);
    expect(data.ceiling_capper).toContain("not a curiosity gap"); // surrounding prose intact
    expect(data.ceiling_capper).not.toMatch(/\(\s*\)/);           // no orphaned empty parens
    expect(drift.filter((c) => c === "§2.1").length).toBeGreaterThan(0);
  });

  it("strips cites from confidence_scope, suggestions, and rewrite variant", () => {
    const data = makeReasoning();
    guardApolloCites(data);
    expect(data.confidence_scope).not.toMatch(/§/);
    expect(data.suggestions[0]!.text).not.toMatch(/§/);
    expect(data.rewrites[0]!.variant).not.toMatch(/§/);
    // valid cite in the same rewrite's lever_fixed (metadata) is still kept
    expect(data.rewrites[0]!.lever_fixed).toContain("§2.1");
  });

  it("never empties a required string field when it was only a cite", () => {
    const data = makeReasoning();
    data.confidence_scope = "§2.1"; // pathological: prose that is nothing but a cite
    guardApolloCites(data);
    expect(data.confidence_scope.length).toBeGreaterThan(0); // falls back to original, not ""
  });
});

describe("PRESENT_SECTIONS whitelist matches the lean core", () => {
  it("includes the craft sections and excludes the dropped ones", () => {
    for (const t of ["§1", "§2.1", "§2.5", "§3", "§4.1", "§5", "§6"]) expect(PRESENT_SECTIONS.has(t)).toBe(true);
    for (const t of ["§2.6", "§7", "§8", "§9"]) expect(PRESENT_SECTIONS.has(t)).toBe(false);
  });
});
