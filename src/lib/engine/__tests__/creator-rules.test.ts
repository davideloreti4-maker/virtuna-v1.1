import { describe, it, expect } from "vitest";
// creator-rules.ts is DORMANT (Plan 03-02, D-01): moved to _dormant/engine/.
// KNOWLEDGE-CORE.md (apollo-core.ts) is now the single SSOT prompt brain.
// This test is kept to document the dormanted constants; its import follows the file.
import {
  CREATOR_RULES_BLOCK,
  CREATOR_RULES_CONSENSUS,
  CREATOR_RULES_NUMERIC,
  CREATOR_RULES_PRINCIPLES,
  CREATOR_RULES_CONFLICTS,
} from "../_dormant/engine/creator-rules";
// NOTE: stage 10 critique is now deterministic TS (no LLM prompt) — its creator-rule
// injection moved into per-check flag templates in stage10-critique.ts. No prompt to assert.
//
// REMOVED (2026-06-04, Plan 01-01): cross-imports of the stage-11 counterfactuals prompt
// and the wave4 platform-fit prompt constants, plus the describe block asserting
// CREATOR_RULES_BLOCK injection into those prompts. Both prompt files move to _dormant/
// in Plan 05 — importing them here would break compile at that step. The kept test below
// verifies creator-rules.ts own exports independently of any cut modules.

// Locks the single-source-of-truth Creator Intelligence rules. If creator-rules.ts
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

// NOTE: "creator-rules injection into V3 system prompts" describe block removed.
// The cut-module cross-import assertions were removed because the prompt files
// move to _dormant/ in Plan 05. Cross-module injection is verified at that plan.
