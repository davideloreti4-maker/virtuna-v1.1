/**
 * Phase 01 Plan 03 — resolvePack dispatcher gate (PACK-01).
 *
 * The dispatcher is the thin "core dispatch surface" — it holds ZERO scoring
 * logic. It resolves a domain key to a pack; scoring is reached only via the
 * returned `pack.scoring.run`. P1 always resolves to "socials".
 */
import { describe, it, expect } from "vitest";
import { resolvePack, SOCIALS_PACK } from "../packs";

describe("resolvePack — core dispatch surface (PACK-01)", () => {
  it('resolvePack("socials") returns SOCIALS_PACK (reference identity)', () => {
    expect(resolvePack("socials")).toBe(SOCIALS_PACK);
  });

  it("throws on an unknown pack id (guards future packs)", () => {
    // Cast: the typed signature only admits "socials"; this exercises the
    // runtime guard for an out-of-contract id.
    expect(() => (resolvePack as (m: string) => unknown)("unknown")).toThrow();
  });

  it("reaches scoring only via the returned pack (not the dispatcher)", () => {
    // The dispatcher exposes scoring transitively through pack.scoring.run —
    // it never re-exports the scorer directly.
    expect(typeof resolvePack("socials").scoring.run).toBe("function");
  });
});
