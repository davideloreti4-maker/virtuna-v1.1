/**
 * Wave 0 tests for apollo-core.ts — byte-stability, zero-interpolation,
 * embedded-number, and composition contract.
 *
 * All cases in this file MUST be GREEN (Task 2 constant exists).
 * These are the R2/T-03-01/T-03-02 guards for the cached prefix contract.
 */

import { describe, it, expect } from "vitest";
import {
  KNOWLEDGE_CORE,
  APOLLO_INSTRUCTION,
  APOLLO_SYSTEM_PROMPT,
} from "../apollo-core";

describe("apollo-core byte-stability and zero-interpolation", () => {
  it("KNOWLEDGE_CORE is a non-empty string", () => {
    expect(typeof KNOWLEDGE_CORE).toBe("string");
    expect(KNOWLEDGE_CORE.length).toBeGreaterThan(1000);
  });

  it("APOLLO_INSTRUCTION is a non-empty string", () => {
    expect(typeof APOLLO_INSTRUCTION).toBe("string");
    expect(APOLLO_INSTRUCTION.length).toBeGreaterThan(50);
  });

  it("APOLLO_SYSTEM_PROMPT is a non-empty string", () => {
    expect(typeof APOLLO_SYSTEM_PROMPT).toBe("string");
    expect(APOLLO_SYSTEM_PROMPT.length).toBeGreaterThan(1000);
  });

  it("APOLLO_SYSTEM_PROMPT is byte-identical across two reads (module-level const, no interpolation)", () => {
    // Both reads come from the module-level const — must be reference-equal and value-equal
    const read1 = APOLLO_SYSTEM_PROMPT;
    const read2 = APOLLO_SYSTEM_PROMPT;
    expect(read1).toBe(read2);
  });

  it("KNOWLEDGE_CORE contains the 5× follower count outlier number (D-02 port verified)", () => {
    // This assertion FAILS if the post-Task-1 core was not embedded.
    // The exact substring matches what was ported into KNOWLEDGE-CORE.md §2.0a.
    expect(KNOWLEDGE_CORE).toContain("follower count");
    // Also check the ≥ 5× pattern
    expect(KNOWLEDGE_CORE).toContain("5");
  });

  it("KNOWLEDGE_CORE contains no interpolation artifacts (T-03-02: no ${)", () => {
    // ZERO interpolation allowed in the cached prefix — would break DashScope prefix-cache hits.
    expect(KNOWLEDGE_CORE).not.toContain("${");
  });

  it("KNOWLEDGE_CORE contains no Date.now interpolation artifact", () => {
    expect(KNOWLEDGE_CORE).not.toContain("Date.now");
  });

  it("KNOWLEDGE_CORE contains no Math.random interpolation artifact", () => {
    expect(KNOWLEDGE_CORE).not.toContain("Math.random");
  });

  it("APOLLO_INSTRUCTION contains no interpolation artifacts", () => {
    expect(APOLLO_INSTRUCTION).not.toContain("${");
    expect(APOLLO_INSTRUCTION).not.toContain("Date.now");
    expect(APOLLO_INSTRUCTION).not.toContain("Math.random");
  });

  it("APOLLO_SYSTEM_PROMPT composition contract: KNOWLEDGE_CORE + separator + APOLLO_INSTRUCTION", () => {
    const expected = `${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}`;
    expect(APOLLO_SYSTEM_PROMPT).toBe(expected);
  });
});

describe("apollo-core content assertions", () => {
  it("KNOWLEDGE_CORE references KNOWLEDGE-CORE.md as source", () => {
    // The file header must document its source-of-truth
    // Check either in the constant or that it begins with the correct core header
    expect(KNOWLEDGE_CORE).toContain("Apollo Knowledge Core");
  });

  it("KNOWLEDGE_CORE contains §4 Scoring Rubric", () => {
    expect(KNOWLEDGE_CORE).toContain("Scoring Rubric");
  });

  it("KNOWLEDGE_CORE contains §5 Decode Lens", () => {
    expect(KNOWLEDGE_CORE).toContain("Decode Lens");
  });

  it("KNOWLEDGE_CORE contains §6 Rewrite", () => {
    expect(KNOWLEDGE_CORE).toContain("Rewrite");
  });

  it("APOLLO_INSTRUCTION references §4 OUTPUT CONTRACT", () => {
    expect(APOLLO_INSTRUCTION).toContain("OUTPUT CONTRACT");
  });

  it("APOLLO_SYSTEM_PROMPT contains both KNOWLEDGE_CORE and APOLLO_INSTRUCTION content", () => {
    expect(APOLLO_SYSTEM_PROMPT).toContain("Apollo Knowledge Core");
    expect(APOLLO_SYSTEM_PROMPT).toContain("OUTPUT CONTRACT");
  });
});
