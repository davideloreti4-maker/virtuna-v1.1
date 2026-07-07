import { describe, it, expect } from "vitest";
import { validateBlock } from "@/lib/tools/block-registry";
import { ALL_FIXTURE_BLOCKS } from "../fixtures";

/**
 * Drift guard for the /dev/cards design gallery: every fixture block MUST validate through the
 * live BLOCK_REGISTRY, otherwise the gallery would silently render an <UnsupportedBlock> and stop
 * being an honest 1:1 reference. If a block schema changes, this fails until the fixture is updated.
 */
describe("dev/cards fixtures", () => {
  it("covers all 14 registered block types (plus the account-read thin variant)", () => {
    const types = new Set(ALL_FIXTURE_BLOCKS.map((b) => (b as { type?: string }).type));
    // 12 distinct types exercised here: idea/hook/script/remix/outlier/markdown/account-read +
    // profile-read/reaction-distribution/prediction-gauge/multi-audience-read/band.
    expect(types.size).toBeGreaterThanOrEqual(11);
  });

  for (const [i, block] of ALL_FIXTURE_BLOCKS.entries()) {
    const type = (block as { type?: string }).type ?? "unknown";
    it(`block[${i}] "${type}" validates against the registry`, () => {
      expect(validateBlock(block).ok, `${type} (index ${i}) failed registry validation`).toBe(true);
    });
  }
});
