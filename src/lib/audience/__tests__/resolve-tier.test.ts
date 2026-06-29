/**
 * Phase 3 Plan 02 — resolveTier truth-table gate (D-06 / TRUST-01).
 *
 * Productionizes the spike's test-local tier predicate (signature-determinism.test.ts:
 * 105-126) into a real `src/` resolver + locks the never-Validated-for-general RULE.
 *
 * The tier keys off `DomainPack.calibration` (the trust-tier basis), NEVER
 * `Audience.calibration` (scrape provenance) — a pack carrying a non-empty calibration
 * baseline is the Validated anchor; a no-calibration SIM (e.g. General) resolves
 * Directional BY RULE. No General pack object exists in P3 (D-02), so non-socials
 * resolves Directional directly.
 *
 * Test runner (CRITICAL repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/resolve-tier.test.ts
 * NEVER `npm test` / `npx vitest` — they emit fake PASS(0)/FAIL(0).
 */

import { describe, it, expect } from "vitest";
import { resolveTier, tierFromCalibration } from "../resolve-tier";

describe("tierFromCalibration (pack-calibration predicate)", () => {
  it("a non-empty calibration baseline resolves Validated", () => {
    expect(tierFromCalibration({ baselineRef: "src/lib/engine/calibration-baseline.json" })).toBe(
      "Validated"
    );
  });

  it("no / empty calibration baseline resolves Directional by rule — never Validated", () => {
    expect(tierFromCalibration(undefined)).toBe("Directional");
    expect(tierFromCalibration({})).toBe("Directional");
    expect(tierFromCalibration({ baselineRef: "" })).toBe("Directional");
    expect(tierFromCalibration(undefined)).not.toBe("Validated");
  });
});

describe("resolveTier (audience mode → tier)", () => {
  it("a socials audience resolves Validated (reads SOCIALS_PACK.calibration)", () => {
    expect(resolveTier({ mode: "socials" })).toBe("Validated");
  });

  it("a general audience resolves Directional by rule — never Validated", () => {
    expect(resolveTier({ mode: "general" })).toBe("Directional");
    expect(resolveTier({ mode: "general" })).not.toBe("Validated");
  });
});
