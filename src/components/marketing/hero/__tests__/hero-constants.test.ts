/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";

import { HERO_SCORE } from "../hero-constants";
import { BAND_THRESHOLDS } from "@/components/board/verdict/verdict-constants";

/**
 * Phase 2 Wave-0 Nyquist scaffold — HERO-03 score-honesty.
 *
 * RED-by-design: `../hero-constants` does not exist yet (built in 02-03).
 *
 * The canned resolved score MUST be >= the product's STRONG band threshold so
 * that rendering it in coral as a "will pop" outcome is TRUTHFUL, not a
 * fabricated-green (UI-SPEC §Color "Score-honesty constraint"). The threshold
 * is imported from the product's single source of truth, not a literal 70, so
 * if the product re-bands its honesty palette this gate moves with it.
 */
describe("hero-constants — HERO-03 score honesty", () => {
  it("HERO_SCORE is at least the STRONG band threshold (coral is honest only >= 70)", () => {
    expect(HERO_SCORE).toBeGreaterThanOrEqual(BAND_THRESHOLDS.STRONG);
  });

  it("HERO_SCORE is a valid 0–100 virality score", () => {
    expect(HERO_SCORE).toBeLessThanOrEqual(100);
  });
});
