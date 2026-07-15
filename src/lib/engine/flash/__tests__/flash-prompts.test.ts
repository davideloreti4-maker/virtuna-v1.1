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
  buildGenericSystemPrompt,
  buildFlashUserContent,
} from "../flash-prompts";
import { NICHE_INSTANTIATION } from "../../wave3/persona-registry";
import type { ContentTypeSlug } from "../../types";

// ─── MODE-01 — the mode seam ────────────────────────────────────────────────────
// Two bugs are pinned here:
//   1. The generic prompt IGNORED audienceRepaint. The Read passes `niche: null`, so it took
//      that path and every audience got the byte-identical General prompt — the "two-audience
//      Read" ran General twice and relabelled one side (live: 10/10 identical verdicts).
//   2. A `mode: 'general'` audience (analyst panel, named person) was framed as a TikTok crowd
//      answering "would you scroll past" — GENERAL_AUDIENCE is mode:'socials', platform:'tiktok'.

describe("buildGenericSystemPrompt — the repaint must reach the model (MODE-01)", () => {
  const REPAINT = { tough_crowd: "The Skeptic — pressure-tests every claim for its weakest link." };

  it("returns the interned STABLE constant with no repaint (the General regression gate)", () => {
    // Identity, not equality: General MUST produce the byte-identical cache prefix it always has.
    expect(buildGenericSystemPrompt()).toBe(STABLE_FLASH_SYSTEM_PROMPT);
    expect(buildGenericSystemPrompt({}, "socials")).toBe(STABLE_FLASH_SYSTEM_PROMPT);
  });

  it("substitutes a stored repaint for the generic archetype definition", () => {
    const prompt = buildGenericSystemPrompt(REPAINT);
    expect(prompt).toContain("The Skeptic — pressure-tests every claim");
    // …and the repainted slot's stock TikTok definition is GONE (it was replaced, not appended).
    expect(prompt).not.toContain("You scroll past in <3 seconds unless the hook lands hard");
    expect(prompt).not.toBe(STABLE_FLASH_SYSTEM_PROMPT);
  });

  it("is deterministic — same audience, same prompt (D-17 cache discipline)", () => {
    expect(buildGenericSystemPrompt(REPAINT)).toBe(buildGenericSystemPrompt(REPAINT));
  });
});

describe("buildGenericSystemPrompt — the general frame is not a feed (MODE-01)", () => {
  const generalPrompt = buildGenericSystemPrompt(undefined, "general");

  it("never mentions TikTok, an FYP, or scrolling a feed", () => {
    expect(generalPrompt).not.toMatch(/TikTok/i);
    expect(generalPrompt).not.toMatch(/FYP/i);
    expect(generalPrompt).not.toMatch(/Scrolls past when/);
  });

  it("frames the reactors as a panel judging on merit", () => {
    expect(generalPrompt).toMatch(/REACTION PANEL/i);
    expect(generalPrompt).toMatch(/LANDS/);
  });

  it("keeps the output contract byte-for-byte (the parser must not care about the frame)", () => {
    // Same 10 slugs, same schema, same strict type rules — only the framing changes.
    expect(generalPrompt).toContain('"personas"');
    expect(generalPrompt).toContain("EXACTLY 10 persona entries");
    expect(generalPrompt).toContain("tough_crowd");
    expect(generalPrompt).toContain("cross_niche_curiosity");
  });

  it("still honours the audience's repaint in the general frame", () => {
    const prompt = buildGenericSystemPrompt(
      { tough_crowd: "The Bar-Raiser — probes for the biggest gap against the level." },
      "general",
    );
    expect(prompt).toContain("The Bar-Raiser");
    expect(prompt).not.toMatch(/TikTok/i);
  });
});

describe("buildFlashUserContent — the general question (MODE-01)", () => {
  it("asks a panel whether it is convinced, never whether it would scroll past", () => {
    const msg = buildFlashUserContent("Replace annual reviews with peer feedback.", "idea", undefined, "general");
    expect(msg).toMatch(/MERITS/);
    expect(msg).not.toMatch(/FYP/i);
    expect(msg).not.toMatch(/creator in your niche/i);
  });

  it("leaves the socials message byte-identical (the regression gate)", () => {
    const withDomain = buildFlashUserContent("hook text", "idea", undefined, "socials");
    const withoutDomain = buildFlashUserContent("hook text", "idea");
    expect(withDomain).toBe(withoutDomain);
  });

  it("never stacks the sell lens onto the general frame (it is a socials lens)", () => {
    const msg = buildFlashUserContent("A pitch.", "idea", "sell", "general");
    expect(msg).not.toMatch(/Buying Lens/);
  });
});

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

// ─── buildFlashUserContent — intent lens (GAP-C2 / §P.10) ────────────────────────
// grow/undefined → byte-identical (regression-critical no-op); sell → appends buying lens.
describe("buildFlashUserContent — intent lens (GAP-C2)", () => {
  it("undefined intent === grow intent (no-op default)", () => {
    expect(buildFlashUserContent("hook copy", "hook")).toBe(
      buildFlashUserContent("hook copy", "hook", "grow"),
    );
  });

  it("grow is byte-identical to the pre-intent message (regression gate)", () => {
    // The pre-intent output had no buying-lens block — assert grow never introduces one.
    const grow = buildFlashUserContent("hook copy", "hook", "grow");
    expect(grow).not.toContain("Buying Lens");
    expect(grow).not.toContain("POTENTIAL BUYER");
  });

  it("sell appends the buying-lens directive", () => {
    const sell = buildFlashUserContent("hook copy", "hook", "sell");
    expect(sell).toContain("Buying Lens");
    expect(sell).toContain("POTENTIAL BUYER");
  });

  it("sell is a strict superset of grow (only adds the directive)", () => {
    const grow = buildFlashUserContent("same text", "idea", "grow");
    const sell = buildFlashUserContent("same text", "idea", "sell");
    expect(sell.length).toBeGreaterThan(grow.length);
    // The content + framing question survive unchanged in the sell variant.
    expect(sell).toContain("same text");
  });

  it("sell keeps the verdict tokens (stop/scroll) — no schema drift", () => {
    const sell = buildFlashUserContent("x", "hook", "sell");
    expect(sell).toContain('"stop"');
    expect(sell).toContain('"scroll"');
  });
});
