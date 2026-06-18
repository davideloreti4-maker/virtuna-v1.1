/**
 * refine.test.ts — TDD RED tests for refine.ts (Plan 05-05, Task 1).
 *
 * Behavior contract:
 *  1. detectRefineIntent("make hook 1 punchier") → isRefine true, skill "hooks", cardRef 1, instruction preserved.
 *  2. detectRefineIntent("tighten idea 2") → isRefine true, skill "idea", cardRef 2.
 *  3. detectRefineIntent("what should I post this week?") → isRefine false (plain chat question — no skill fire).
 *  4. buildRefineAnchor(originalCardProps, instruction) → fenced anchor embedding original card content + user instruction.
 */

import { describe, it, expect } from "vitest";
import { detectRefineIntent, buildRefineAnchor } from "../refine";
import type { HookCardBlock, IdeaCardBlock } from "../blocks";

describe("detectRefineIntent", () => {
  it("Test 1: detects hook refine intent with ordinal reference", () => {
    const result = detectRefineIntent("make hook 1 punchier");
    expect(result.isRefine).toBe(true);
    expect(result.skill).toBe("hooks");
    expect(result.cardRef).toBe(1);
    expect(result.instruction).toContain("punchier");
  });

  it("Test 2: detects idea refine intent with ordinal reference", () => {
    const result = detectRefineIntent("tighten idea 2");
    expect(result.isRefine).toBe(true);
    expect(result.skill).toBe("idea");
    expect(result.cardRef).toBe(2);
  });

  it("Test 3: plain chat question is NOT a refine (no false positive — D-05)", () => {
    const result = detectRefineIntent("what should I post this week?");
    expect(result.isRefine).toBe(false);
    expect(result.skill).toBeUndefined();
    expect(result.cardRef).toBeUndefined();
  });

  it("additional: 'rewrite the first hook' → isRefine true", () => {
    const result = detectRefineIntent("rewrite the first hook");
    expect(result.isRefine).toBe(true);
    expect(result.skill).toBe("hooks");
  });

  it("additional: 'sharpen idea 3' → isRefine true, cardRef 3", () => {
    const result = detectRefineIntent("sharpen idea 3");
    expect(result.isRefine).toBe(true);
    expect(result.skill).toBe("idea");
    expect(result.cardRef).toBe(3);
  });

  it("additional: generic question without card reference → isRefine false", () => {
    const result = detectRefineIntent("give me more ideas about gym content");
    expect(result.isRefine).toBe(false);
  });

  // WR-01: free-floating digit must NOT become cardRef when not adjacent to card noun
  it("WR-01: 'tighten the top 3 hooks' → isRefine false (digit not tied to card noun)", () => {
    const result = detectRefineIntent("tighten the top 3 hooks");
    // '3' is a count modifier, not 'hook 3' — should not extract cardRef=3
    expect(result.isRefine).toBe(false);
  });

  it("WR-01: 'make hook 2 punchier' → cardRef=2 (digit is tied to noun)", () => {
    const result = detectRefineIntent("make hook 2 punchier");
    expect(result.isRefine).toBe(true);
    expect(result.cardRef).toBe(2);
  });
});

describe("buildRefineAnchor", () => {
  it("Test 4a: builds anchor from HookCardBlock props + instruction", () => {
    const hookProps: HookCardBlock["props"] = {
      hookLine: "Stop scrolling — here is the truth about protein shakes",
      audienceArchetype: "Skeptic",
      mechanism: "pattern interrupt + credibility anchor",
      seedHook: "Stop scrolling — here is the truth about protein shakes",
      rank: 1,
      band: "Strong",
      fraction: "7/10 stop",
      scrollQuote: "Wait, is that actually true?",
      model: "sim1-flash",
      channel: "spoken",
    };
    const anchor = buildRefineAnchor(hookProps, "make it punchier");
    expect(typeof anchor).toBe("string");
    expect(anchor.length).toBeGreaterThan(0);
    // Must embed the original hook line
    expect(anchor).toContain("Stop scrolling — here is the truth about protein shakes");
    // Must embed the instruction
    expect(anchor).toContain("make it punchier");
  });

  it("Test 4b: builds anchor from IdeaCardBlock props + instruction", () => {
    const ideaProps: IdeaCardBlock["props"] = {
      title: "3 things gym beginners always get wrong",
      angle: "myth-busting from a coach perspective",
      whyItFits: "because your audience is 18-25 gym beginners",
      mechanism: "authority + gap in knowledge",
      seedHook: "The #1 mistake gym beginners make",
      needsTake: false,
      topic: "gym mistakes",
      take: "first-hand coaching experience",
      format: "list",
      band: "Mixed",
      fraction: "5/10 stop",
      scrollQuote: "Oh no, am I doing that?",
      model: "sim1-flash",
    };
    const anchor = buildRefineAnchor(ideaProps, "tighten the angle");
    expect(typeof anchor).toBe("string");
    // Must embed either title or seedHook
    expect(anchor).toContain("3 things gym beginners always get wrong");
    // Must embed instruction
    expect(anchor).toContain("tighten the angle");
  });
});
