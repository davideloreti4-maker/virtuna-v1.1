/**
 * The seal is the milestone's load-bearing mechanic, so it gets the sharpest tests: the $1 buys
 * three specific things, and these assert they are ABSENT from the rendered object rather than
 * merely hidden by a view flag.
 *
 * Each assertion here fails against a no-op seal (`sealTemplate = t => t`) — checked deliberately,
 * because a test that passes whether or not the code works is worse than no test.
 */

import { describe, expect, it } from "vitest";
import {
  CRAFT_SCORE,
  FROZEN_LOSS_DELTA_PCT,
  isSealed,
  REVEALED_INSIGHT,
  SEALED_INSIGHT,
  sealTemplate,
  WALKTHROUGH_IS_PLACEHOLDER,
  WALKTHROUGH_TEMPLATE,
} from "../walkthrough-fixture";
import { FROZEN_LOSS_MOMENT } from "../frozen-analysis";
import { BEATS, beatAt, beatPosition, nextBeat } from "../beats";

describe("the frozen example", () => {
  it("is built by the real adapters, not hand-authored", () => {
    // If the adapters stopped producing a brain read, the walkthrough would silently degrade to
    // the honest "brain unavailable" state and the demo would have nothing to show.
    expect(WALKTHROUGH_TEMPLATE.brain).toBeDefined();
    expect(WALKTHROUGH_TEMPLATE.population).not.toBeNull();
  });

  it("carries the fix and the diagnosis when fully open", () => {
    expect(WALKTHROUGH_TEMPLATE.unlock).toBeDefined();
    expect(WALKTHROUGH_TEMPLATE.brain?.whyThisSecond).toBeDefined();
  });

  it("reveals and withholds two DIFFERENT moments", () => {
    // Revealing one insight only works as a sample if a different one stays locked. If both beats
    // pointed at the same second, the wall would be re-asking for what was just given away.
    expect(REVEALED_INSIGHT.moment).not.toBe(SEALED_INSIGHT.moment);
  });

  it("anchors the wall on the measured steepest drop, not on a chosen second", () => {
    // The frozen curve declines monotonically, so the LOWEST point is trivially the last segment
    // and says nothing. The honest "where they left" is where attention falls fastest — and the
    // wall's moment must be that, straight from the freeze script.
    expect(SEALED_INSIGHT.moment).toBe(FROZEN_LOSS_MOMENT);
    expect(FROZEN_LOSS_DELTA_PCT).toBeGreaterThan(0);
  });

  it("ships REAL data — the placeholder gate is disarmed", () => {
    // Flipped 2026-07-24 in the same commit as the frozen run (analysis vSoTpo5AixUS). If anyone
    // replaces the fixture with hand-authored numbers, this must go back to true and /go will
    // stop mounting the walkthrough in production.
    expect(WALKTHROUGH_IS_PLACEHOLDER).toBe(false);
  });

  it("takes the insight text from the engine's own output", () => {
    // The wall's credibility rests on this being real analysis, not copy. These are the exact
    // phrases the run emitted; if someone rewrites them into marketing prose, this fails.
    expect(REVEALED_INSIGHT.why).toContain("conditional");
    expect(SEALED_INSIGHT.why).toContain("repeats the same point three times");
    expect(SEALED_INSIGHT.fix).toContain("one clean pass");
  });

  it("derives the craft score from the four measured dims", () => {
    // Shown behind the wall, so it must be the video's real craft, never a flattering constant.
    expect(CRAFT_SCORE).toBe(55);
  });
});

describe("sealTemplate — what the dollar actually buys", () => {
  const sealed = sealTemplate(WALKTHROUGH_TEMPLATE, "sealed");

  it("withholds the director's fix", () => {
    expect(sealed.unlock).toBeUndefined();
  });

  it("withholds the diagnosis — the WHY", () => {
    expect(sealed.brain?.whyThisSecond).toBeUndefined();
  });

  it("withholds the audience-specific score", () => {
    expect(sealed.population).toBeNull();
  });

  it("still shows the mechanism: the frames and the measured curve survive", () => {
    // The SHOWN column of the design's table. Withholding these would make the wall read as bait
    // rather than as a teaser — the visitor must be able to SEE that the instrument works.
    expect(sealed.brain?.signals?.length).toBeGreaterThan(0);
    expect(sealed.brain?.clipSeconds).toBe(WALKTHROUGH_TEMPLATE.brain?.clipSeconds);
  });

  it("shows the craft score in the hero instead of an empty figure", () => {
    expect(sealed.verdict.value).toBe(String(CRAFT_SCORE));
    expect(sealed.verdict.label).toBe("craft score");
  });

  it("does not mutate the source template", () => {
    // The open beat re-derives from the same module constant. A mutating seal would make the
    // unlock reveal nothing — the exact failure the honesty floor forbids.
    expect(WALKTHROUGH_TEMPLATE.unlock).toBeDefined();
    expect(WALKTHROUGH_TEMPLATE.population).not.toBeNull();
    expect(WALKTHROUGH_TEMPLATE.brain?.whyThisSecond).toBeDefined();
  });

  it("returns the analysis intact when open", () => {
    const open = sealTemplate(WALKTHROUGH_TEMPLATE, "open");
    expect(open).toBe(WALKTHROUGH_TEMPLATE);
    expect(isSealed(open)).toBe(false);
  });

  it("isSealed agrees with the seal it describes", () => {
    expect(isSealed(sealed)).toBe(true);
  });
});

describe("the guided rail", () => {
  it("walks frames → revealed → wall → open and stops", () => {
    expect(nextBeat("frames")).toBe("revealed");
    expect(nextBeat("revealed")).toBe("wall");
    expect(nextBeat("wall")).toBe("open");
    expect(nextBeat("open")).toBeNull();
  });

  it("lights exactly one affordance per beat, and none past the wall", () => {
    // "Guided rails, not free roam" — more than one CTA on a beat is more than one decision on a
    // screen, which §5 bans outright.
    expect(beatAt("frames").cta).toBeTruthy();
    expect(beatAt("revealed").cta).toBeTruthy();
    // The wall's only action is the tripwire, rendered by LockedPanel — the rail must not offer a
    // way past it, or the walkthrough would hand over the locked beat for free.
    expect(beatAt("wall").cta).toBeNull();
    expect(beatAt("open").cta).toBeNull();
  });

  it("seals every beat before the unlock", () => {
    for (const beat of BEATS) {
      expect(beat.seal).toBe(beat.id === "open" ? "open" : "sealed");
    }
  });

  it("marks the wall as the only beat that asks for money", () => {
    expect(BEATS.filter((b) => b.isWall)).toHaveLength(1);
    expect(beatAt("wall").isWall).toBe(true);
  });

  it("reports position 1-based for the progress rail", () => {
    expect(beatPosition("frames")).toEqual({ step: 1, total: 4 });
    expect(beatPosition("open")).toEqual({ step: 4, total: 4 });
  });

  it("rejects an unknown beat instead of silently returning undefined", () => {
    expect(() => beatAt("nope" as never)).toThrow(/unknown beat/);
    expect(() => nextBeat("nope" as never)).toThrow(/unknown beat/);
  });
});
