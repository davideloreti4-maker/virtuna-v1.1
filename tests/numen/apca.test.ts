/**
 * tests/numen/apca.test.ts — WR-05 APCA gate runs inside `pnpm test`.
 *
 * Previously `scripts/check-apca.ts` only ran when someone remembered to invoke
 * it manually, and its palette was hand-duplicated from globals.css with a code
 * comment as the only "sync" enforcement. The gate now PARSES the hexes out of
 * `.numen-surface` (single source of truth) and this test runs it in CI, so a
 * drift in globals.css that breaks a contrast floor fails the suite.
 */
import { describe, it, expect } from "vitest";

import { runApcaGate } from "../../scripts/check-apca";

describe("APCA contrast gate (DS-02 / DS-03 / D-12 / WR-05)", () => {
  const report = runApcaGate();

  it("parses the warm base from .numen-surface", () => {
    expect(report.base).toBe("#1a1714");
  });

  it("measures every Q4 pairing (body / muted / accent / three verdicts)", () => {
    expect(report.results.map((r) => r.label)).toEqual([
      "body",
      "muted",
      "accent",
      "verdict-good",
      "verdict-mixed",
      "verdict-bad",
    ]);
  });

  it("every pairing meets its APCA Lc target on the live globals.css palette", () => {
    const failing = report.results.filter((r) => !r.pass);
    expect(
      failing.map((r) => `${r.label} ${r.hex} Lc ${r.lc.toFixed(1)} < ${r.target}`),
    ).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
