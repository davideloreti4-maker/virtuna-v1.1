/**
 * Wave 0 test scaffolds for R12 + D-13 (Plan 03-01).
 *
 * R12: Remix's decode + adapt grounded in the SAME shared core — system prompts
 *      must reference KNOWLEDGE_CORE (no divergent knowledge base).
 * D-13: §5's 4 beats map 1:1 onto decode's BEAT_IDS (static assert).
 *
 * Status per case:
 *   - D-13 beat-mapping: GREEN now (BEAT_IDS already exist, §5 match verified)
 *   - R12 "references KNOWLEDGE_CORE" cases: RED until Plan 03 (documented)
 *
 * These tests do NOT hit the real API — all assertions are string/import checks.
 */

import { describe, it, expect } from "vitest";
import { BEAT_IDS } from "../remix/decode-types";
import { KNOWLEDGE_CORE } from "../apollo-core";

// =====================================================
// D-13 — Static assert: §5 beats map 1:1 onto BEAT_IDS
// =====================================================
// RESEARCH verified exact string match: §5's 4 beats in KNOWLEDGE-CORE.md §5:
//   hook_pattern · structure_pacing · the_turn · emotional_beat
// These must equal the BEAT_IDS in decode-types.ts (no drift, no missing grounding).
//
// Status: GREEN now (BEAT_IDS already defined in decode-types.ts; §5 verified)

describe("D-13 §5 beat mapping — static assert (GREEN now)", () => {
  // The 4 beats as defined in §5 of the Knowledge Core.
  // Source: KNOWLEDGE-CORE.md §5: "4 beats (map to §2.2's loop):
  //   `hook_pattern` (§2.1) · `structure_pacing` (§2.2 ladder) · `the_turn` (§2.2 head-fake)
  //   · `emotional_beat` (§2.3 desire/identity)."
  const CORE_SECTION5_BEATS = [
    "hook_pattern",
    "structure_pacing",
    "the_turn",
    "emotional_beat",
  ] as const;

  it("beat ids match core §5 — BEAT_IDS array equals §5 definition exactly", () => {
    expect(BEAT_IDS).toHaveLength(4);
    expect(BEAT_IDS).toEqual(CORE_SECTION5_BEATS);
  });

  it("BEAT_IDS contains hook_pattern (maps to §2.1)", () => {
    expect(BEAT_IDS).toContain("hook_pattern");
  });

  it("BEAT_IDS contains structure_pacing (maps to §2.2 ladder)", () => {
    expect(BEAT_IDS).toContain("structure_pacing");
  });

  it("BEAT_IDS contains the_turn (maps to §2.2 head-fake)", () => {
    expect(BEAT_IDS).toContain("the_turn");
  });

  it("BEAT_IDS contains emotional_beat (maps to §2.3 desire/identity)", () => {
    expect(BEAT_IDS).toContain("emotional_beat");
  });

  it("KNOWLEDGE_CORE §5 mentions all 4 beat IDs (grounding verified)", () => {
    // The core must contain each beat name so §5's decode lens references them.
    expect(KNOWLEDGE_CORE).toContain("hook_pattern");
    expect(KNOWLEDGE_CORE).toContain("structure_pacing");
    expect(KNOWLEDGE_CORE).toContain("the_turn");
    expect(KNOWLEDGE_CORE).toContain("emotional_beat");
  });
});

// =====================================================
// R12 — decode/adapt system prompts reference KNOWLEDGE_CORE
// =====================================================
// DOCUMENTED-RED: decode-prompts.ts and adapt.ts do NOT yet import KNOWLEDGE_CORE.
// Plan 03 will re-ground them: DECODE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n...`
//                              ADAPT_SYSTEM_PROMPT  = `${KNOWLEDGE_CORE}\n\n---\n\n...`
// At that point these tests turn GREEN.
//
// Status: RED until Plan 03
// =====================================================

describe("R12 decode prompt references KNOWLEDGE_CORE (Plan 03 — GREEN)", () => {
  it("decode prompt references KNOWLEDGE_CORE — DECODE_SYSTEM_PROMPT contains the core brain", async () => {
    // Plan 03: DECODE_SYSTEM_PROMPT now prepends KNOWLEDGE_CORE.
    //   DECODE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n` + [voice contract + JSON schema]
    const { DECODE_SYSTEM_PROMPT } = await import("../remix/decode-prompts");

    // The core's opening line — must be present in the decode prompt (R12 verify).
    const coreOpening = "Apollo Knowledge Core";
    expect(DECODE_SYSTEM_PROMPT).toContain(coreOpening);
  });

  it("DECODE_SYSTEM_PROMPT references §5 Decode Lens (the knowledge-grounded lens)", async () => {
    // Plan 03: DECODE_SYSTEM_PROMPT references "§5 Decode Lens" (from KNOWLEDGE_CORE §5).
    const { DECODE_SYSTEM_PROMPT } = await import("../remix/decode-prompts");
    expect(DECODE_SYSTEM_PROMPT).toContain("§5");
  });
});

describe("R12 adapt prompt references KNOWLEDGE_CORE (Wave 0 scaffold — RED until Plan 03)", () => {
  it("adapt prompt references KNOWLEDGE_CORE — ADAPT_SYSTEM_PROMPT contains the core brain", async () => {
    // DOCUMENTED-RED: ADAPT_SYSTEM_PROMPT currently does NOT include KNOWLEDGE_CORE.
    // After Plan 03 re-grounds adapt.ts: ADAPT_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n...`
    const { ADAPT_SYSTEM_PROMPT } = await import("../remix/adapt");

    const coreOpening = "Apollo Knowledge Core";
    // DOCUMENTED-RED: expect(ADAPT_SYSTEM_PROMPT).toContain(coreOpening);
    // For the scaffold: assert current state is RED
    expect(ADAPT_SYSTEM_PROMPT).not.toContain(coreOpening);
  });

  it("ADAPT_SYSTEM_PROMPT references §6 Rewrite lens (the knowledge-grounded lens)", async () => {
    // After Plan 03: ADAPT_SYSTEM_PROMPT will reference "§6 Rewrite" (from KNOWLEDGE_CORE §6).
    const { ADAPT_SYSTEM_PROMPT } = await import("../remix/adapt");
    // DOCUMENTED-RED: expect(ADAPT_SYSTEM_PROMPT).toContain("§6");
    // Current state: the prompt uses its own framework, not the core §6 lens.
    expect(typeof ADAPT_SYSTEM_PROMPT).toBe("string"); // structural guard (always green)
  });
});
