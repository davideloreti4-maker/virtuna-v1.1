/**
 * ambient-v2-sealed.test.ts — the sealed drill's template contract (§0b② THE WALL).
 *
 * "Point sealTemplate at a live run": the walkthrough's `isSealed` asserted that nothing
 * the $1 buys is present on the RENDERED object. The live sealed template must satisfy
 * that same contract — asserted here with BOTH checks (the walkthrough's own `isSealed`
 * and the live surface's `templateIsSealed`) so the two definitions can never drift apart
 * silently.
 */

import { describe, it, expect } from "vitest";
import {
  buildSealedVideoDomainTemplate,
  templateIsSealed,
} from "@/lib/surfaces/ambient-v2-sealed";
import { isSealed } from "@/components/offer/walkthrough/walkthrough-fixture";

describe("buildSealedVideoDomainTemplate", () => {
  it("satisfies the seal contract — nothing the $1 buys is present", () => {
    const template = buildSealedVideoDomainTemplate({ craftScore: 84 });
    expect(templateIsSealed(template)).toBe(true);
    // The walkthrough's own contract, on the live template — the continuity the handoff asked for.
    expect(isSealed(template)).toBe(true);
    expect(template.unlock).toBeUndefined();
    expect(template.brain).toBeUndefined();
    expect(template.population).toBeNull();
  });

  it("the verdict chip carries the CRAFT score — never an audience number", () => {
    const template = buildSealedVideoDomainTemplate({ craftScore: 84.4 });
    expect(template.verdict).toEqual({ value: "84", label: "craft score" });
  });

  it("a missing craft score renders an honest em-dash, never an invented figure", () => {
    const template = buildSealedVideoDomainTemplate({ craftScore: null });
    expect(template.verdict).toEqual({ value: "—", label: "craft score" });
    expect(templateIsSealed(template)).toBe(true);
  });
});
