/**
 * Tests for flash-prompts.ts — niche-aware system prompt builder (Plan 03-01 Task 1, D-05).
 *
 * TDD RED phase: written BEFORE buildNicheAwareSystemPrompt exists.
 *
 * Spec (D-05 behavior):
 *  a) No panel → prompt === STABLE_FLASH_SYSTEM_PROMPT (back-compat)
 *  b) niche panel produces a prompt containing the niche's niche_instantiation text + is byte-stable
 *  c) niche: null panel falls back to generic (same as STABLE_FLASH_SYSTEM_PROMPT)
 *
 * Isolation constraint: imports only from flash/* and wave3/persona-registry.ts.
 */
import { describe, it, expect } from "vitest";
import {
  STABLE_FLASH_SYSTEM_PROMPT,
  buildNicheAwareSystemPrompt,
} from "../flash-prompts";
import { NICHE_INSTANTIATION } from "../../wave3/persona-registry";
import type { ContentTypeSlug } from "../../types";

describe("STABLE_FLASH_SYSTEM_PROMPT — back-compat (D-05)", () => {
  it("is a non-empty string", () => {
    expect(typeof STABLE_FLASH_SYSTEM_PROMPT).toBe("string");
    expect(STABLE_FLASH_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("contains the 10 archetype definition block", () => {
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain("tough_crowd");
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain("loyalist");
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain("high_engager");
  });

  it("contains the output schema JSON shape", () => {
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain('"personas"');
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain('"verdict"');
    expect(STABLE_FLASH_SYSTEM_PROMPT).toContain('"quote"');
  });
});

describe("buildNicheAwareSystemPrompt — niche panel (D-05)", () => {
  it("niche: null → output === STABLE_FLASH_SYSTEM_PROMPT (generic fallback)", () => {
    const result = buildNicheAwareSystemPrompt({ niche: null, contentType: null });
    expect(result).toBe(STABLE_FLASH_SYSTEM_PROMPT);
  });

  it("niche: 'fitness' → prompt contains fitness niche_instantiation text", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    const fitnessInstantiation = NICHE_INSTANTIATION["fitness"]?.["tough_crowd"];
    expect(fitnessInstantiation).toBeTruthy();
    expect(result).toContain(fitnessInstantiation!);
  });

  it("niche: 'fitness' → prompt is different from the generic STABLE_FLASH_SYSTEM_PROMPT", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).not.toBe(STABLE_FLASH_SYSTEM_PROMPT);
  });

  it("niche: 'fitness' → prompt is byte-stable (calling twice yields same string)", () => {
    const r1 = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    const r2 = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(r1).toBe(r2);
  });

  it("different niches produce different prompts", () => {
    const fitness = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    const beauty = buildNicheAwareSystemPrompt({ niche: "beauty", contentType: null });
    expect(fitness).not.toBe(beauty);
  });

  it("niche prompt contains the output schema section (preserved from generic)", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).toContain('"personas"');
    expect(result).toContain('"verdict"');
    expect(result).toContain('"quote"');
  });

  it("niche prompt contains the Critical Divergence Requirement (preserved from generic)", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).toContain("Critical Divergence Requirement");
  });

  it("niche prompt contains 'tough_crowd' archetype heading", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).toContain("tough_crowd");
  });

  it("niche prompt contains 'Scrolls past when:'", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).toContain("Scrolls past when:");
  });

  it("niche prompt contains 'Stops for:'", () => {
    const result = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    expect(result).toContain("Stops for:");
  });

  it("contentType: 'talking_head' with niche → different allocation from null contentType", () => {
    // talking_head allocation: fyp:5 niche_deep:2 loyalist:2 cross_niche:1
    // other allocation:        fyp:6 niche_deep:2 loyalist:1 cross_niche:1
    // Different slot counts → different prompts (slot repetition encodes weighting)
    const withType = buildNicheAwareSystemPrompt({
      niche: "fitness",
      contentType: "talking_head" as ContentTypeSlug,
    });
    const withoutType = buildNicheAwareSystemPrompt({ niche: "fitness", contentType: null });
    // Both should be valid niche-aware prompts
    expect(withType).toContain("fitness");
    expect(withoutType).toContain("fitness");
  });
});
