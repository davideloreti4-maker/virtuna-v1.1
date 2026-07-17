/**
 * archetype-names.test.ts — the 10 personas' user-facing names.
 *
 * Two things worth guarding: that every archetype HAS a name (a new one must not silently regress
 * to shouting its slug), and that these names stay OUT of the model (F7 — the workspace promises
 * users exactly this).
 */

import { describe, it, expect } from "vitest";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import {
  ARCHETYPE_DISPLAY_NAME,
  archetypeDisplayName,
} from "@/lib/audience/archetype-names";

describe("archetypeDisplayName", () => {
  it("names ALL 10 archetypes — no raw slug reaches a user", () => {
    for (const a of ARCHETYPES) {
      const name = ARCHETYPE_DISPLAY_NAME[a];
      expect(name, `${a} has no display name`).toBeTruthy();
      // The bug this module exists to kill: engine vocabulary shouted at the user.
      expect(name, `${a} still reads as a slug`).not.toMatch(/_/);
    }
    // NOTE: `tough_crowd` → "Tough Crowd" is deliberately UNCHANGED. A name is bad when it is
    // MACHINE vocabulary, not when it happens to match the title-cased slug — "Tough Crowd" is
    // already how a person would say it. Asserting "every name must differ from its slug" would
    // force a worse name purely to satisfy a test, which is the test wagging the product.
  });

  /** The exact string that shipped on the card and prompted this change. */
  it("turns the worst offender into English", () => {
    expect(archetypeDisplayName("cross_niche_curiosity")).toBe("Passers-by");
    expect(archetypeDisplayName("niche_deep_buyer")).toBe("Deep Fans");
    expect(archetypeDisplayName("lurker")).toBe("Quiet Watchers");
  });

  /**
   * #282 found a prod persona with 45% of its share on a slug outside the vocabulary. Those rows
   * still render in the workspace — a DISPLAY helper is the wrong place to throw over bad data
   * that someone needs to see in order to fix it.
   */
  it("title-cases an unknown slug rather than throwing (the #282 rows still exist)", () => {
    expect(archetypeDisplayName("vibe_tribe")).toBe("Vibe Tribe");
  });
});
