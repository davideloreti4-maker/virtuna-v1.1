import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BEHAVIORAL_CORE,
  BEHAVIORAL_ETHICS_BLOCK,
  BEHAVIORAL_SYSTEM_PROMPT_FLASH,
  BEHAVIORAL_SYSTEM_PROMPT_MAX,
  FORENSIC_FLASH_DIRECTIVE,
  FORENSIC_MAX_DIRECTIVE,
} from "../behavioral-core";

describe("behavioral-core — tier-gated byte-stable behavioral prompts", () => {
  it("exports both tier prompts, non-empty and substantial", () => {
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH.length).toBeGreaterThan(1000);
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX.length).toBeGreaterThan(1000);
  });

  it("both prompts share the byte-identical CORE + ethics prefix (cache-stable common prefix)", () => {
    const sharedPrefix = `${BEHAVIORAL_CORE}\n\n---\n\n${BEHAVIORAL_ETHICS_BLOCK}\n\n`;
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH.startsWith(sharedPrefix)).toBe(true);
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX.startsWith(sharedPrefix)).toBe(true);
  });

  it("both prompts carry the D-04 never-coach / weaponization refusal line", () => {
    const refusal = /never hand the user a step-by-step to manipulate, coerce, stalk, or dox/i;
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH).toMatch(refusal);
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX).toMatch(refusal);
  });

  it("both prompts carry the directional / limited-evidence honesty caveat", () => {
    const caveat = /DIRECTIONAL, drawn from limited evidence/i;
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH).toMatch(caveat);
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX).toMatch(caveat);
  });

  it("FLASH (text tier) forbids micro-expression / deception-timestamp reads", () => {
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH).toContain(FORENSIC_FLASH_DIRECTIVE);
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH).toMatch(
      /do NOT claim micro-expression \/ deception-timestamp reads/i,
    );
    // text tier must NOT carry the video-tier deception-band directive
    expect(BEHAVIORAL_SYSTEM_PROMPT_FLASH).not.toContain(FORENSIC_MAX_DIRECTIVE);
  });

  it("MAX (video tier) permits a deception-likelihood band WORD, never a number", () => {
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX).toContain(FORENSIC_MAX_DIRECTIVE);
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX).toMatch(
      /deception likelihood as a band WORD \(Low \/ Medium \/ High, never a number\)/i,
    );
    expect(BEHAVIORAL_SYSTEM_PROMPT_MAX).not.toContain(FORENSIC_FLASH_DIRECTIVE);
  });

  it("BEHAVIORAL_CORE embeds the harvested corpus brain (cognition layer markers present)", () => {
    expect(BEHAVIORAL_CORE).toContain("Numen Behavioral Reasoning Core");
    expect(BEHAVIORAL_CORE).toContain("The Six-Axis Influence Map");
    expect(BEHAVIORAL_CORE).toContain("Felt-Seen Is the Apex");
  });

  it("is byte-stable: source contains no per-request interpolation (Date.now/Math.random/new Date)", () => {
    const src = readFileSync(
      join(__dirname, "..", "behavioral-core.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/Date\.now\(/);
    expect(src).not.toMatch(/Math\.random\(/);
    expect(src).not.toMatch(/new Date\(/);
  });
});
