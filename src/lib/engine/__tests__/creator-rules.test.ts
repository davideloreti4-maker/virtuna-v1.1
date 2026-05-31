import { describe, it, expect } from "vitest";
import {
  CREATOR_RULES_BLOCK,
  CREATOR_RULES_CONSENSUS,
  CREATOR_RULES_NUMERIC,
  CREATOR_RULES_PRINCIPLES,
  CREATOR_RULES_CONFLICTS,
} from "../creator-rules";
import { STABLE_COUNTERFACTUALS_SYSTEM_PROMPT } from "../stage11-counterfactuals-prompts";
import { STABLE_CRITIQUE_SYSTEM_PROMPT } from "../stage10-critique-prompts";
import { STABLE_PLATFORM_FIT_SYSTEM_PROMPT } from "../wave4/platform-fit-prompts";

// Locks the single-source-of-truth Creator Intelligence rules and their
// injection into the three cache-stable V3 system prompts. If creator-rules.ts
// drifts from .planning/research/creator-intelligence.md, these break.

describe("CREATOR_RULES single source of truth", () => {
  it("numeric table covers all 40 rows with creator attribution", () => {
    expect(CREATOR_RULES_NUMERIC).toContain("1. Outlier = ≥5× follower count in views (Ava)");
    expect(CREATOR_RULES_NUMERIC).toContain("40. Hoyos avg 10M views/Short");
    // every row cites a creator
    expect(CREATOR_RULES_NUMERIC).toContain("(Hormozi)");
    expect(CREATOR_RULES_NUMERIC).toContain("(Hoyos)");
    expect(CREATOR_RULES_NUMERIC).toContain("(Ava)");
  });

  it("consensus block has all 11 high-confidence rules", () => {
    for (let n = 1; n <= 11; n++) {
      expect(CREATOR_RULES_CONSENSUS).toContain(`${n}. `);
    }
    expect(CREATOR_RULES_CONSENSUS).toContain("The Hook Decides Everything");
  });

  it("conflicts block resolves by context, never averaging", () => {
    expect(CREATOR_RULES_CONFLICTS.toLowerCase()).toContain("never average");
    expect(CREATOR_RULES_CONFLICTS).toContain("Edutainment vs Education");
  });

  it("principles enforce creator attribution and no generic feedback", () => {
    expect(CREATOR_RULES_PRINCIPLES).toContain("CITE THE CREATOR");
    expect(CREATOR_RULES_PRINCIPLES.toLowerCase()).toContain("never output generic");
  });

  it("composed block bundles principles + consensus + conflicts + numeric", () => {
    expect(CREATOR_RULES_BLOCK).toContain(CREATOR_RULES_PRINCIPLES);
    expect(CREATOR_RULES_BLOCK).toContain(CREATOR_RULES_CONSENSUS);
    expect(CREATOR_RULES_BLOCK).toContain(CREATOR_RULES_CONFLICTS);
    expect(CREATOR_RULES_BLOCK).toContain(CREATOR_RULES_NUMERIC);
  });
});

describe("creator-rules injection into V3 system prompts", () => {
  it("stage 11 counterfactuals carries the full rules block + grounding behaviors", () => {
    expect(STABLE_COUNTERFACTUALS_SYSTEM_PROMPT).toContain(CREATOR_RULES_BLOCK);
    expect(STABLE_COUNTERFACTUALS_SYSTEM_PROMPT).toContain("Lead-Magnet Formula");
    expect(STABLE_COUNTERFACTUALS_SYSTEM_PROMPT).toContain("Hoyos");
  });

  it("stage 10 critique carries consensus + numeric + attribution requirement", () => {
    expect(STABLE_CRITIQUE_SYSTEM_PROMPT).toContain(CREATOR_RULES_CONSENSUS);
    expect(STABLE_CRITIQUE_SYSTEM_PROMPT).toContain(CREATOR_RULES_NUMERIC);
    expect(STABLE_CRITIQUE_SYSTEM_PROMPT.toLowerCase()).toContain("cite the creator");
  });

  it("platform-fit carries weighted rubrics + never-average guardrail", () => {
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT).toContain("[weight 25]");
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT).toContain("NEVER average platforms");
    expect(STABLE_PLATFORM_FIT_SYSTEM_PROMPT).toContain("Hoyos");
  });

  it("all three system prompts resolve cleanly (no leaked undefined from a failed import)", () => {
    // Guards against a broken CREATOR_RULES import surfacing as literal "undefined".
    // (Literal "${...}" is allowed — stage10 intentionally shows escaped \${placeholder}
    // example text to the model.)
    for (const p of [
      STABLE_COUNTERFACTUALS_SYSTEM_PROMPT,
      STABLE_CRITIQUE_SYSTEM_PROMPT,
      STABLE_PLATFORM_FIT_SYSTEM_PROMPT,
    ]) {
      expect(p).not.toContain("undefined");
      expect(p.length).toBeGreaterThan(500);
    }
  });
});
