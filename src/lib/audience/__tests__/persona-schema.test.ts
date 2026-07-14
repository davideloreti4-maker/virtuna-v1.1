/**
 * persona-schema.test.ts — the write boundary rejects an archetype the engine cannot bind.
 *
 * `archetype` is the engine's binding key (see build-reaction-panel + archetype-binding.test.ts).
 * Every write path used to validate `z.array(z.unknown())`, so `CalibratedPersona.archetype` was
 * typed `Archetype` while the boundary accepted any string — the type was a claim nothing enforced.
 *
 * The shapes here are the shapes the REAL callers send (the #281 lesson: a unit test written
 * against a convenient shape passed while the caller's actual shape stayed broken). In particular,
 * persona-edit-form.tsx PATCHes the FULL personas array — it edits one index and re-sends the
 * siblings — so one bad sibling must fail the whole payload.
 */

import { describe, it, expect } from "vitest";
import {
  CalibratedPersonaSchema,
  CalibratedPersonasSchema,
} from "@/lib/audience/persona-schema";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";

const valid = {
  archetype: "saver",
  repaint: "Bookmarks routines to try later",
  temperature: "warm",
  disposition: "collector",
  share: 0.15,
};

describe("CalibratedPersonaSchema", () => {
  it("accepts all 10 engine archetypes", () => {
    for (const archetype of ARCHETYPES) {
      expect(CalibratedPersonaSchema.safeParse({ ...valid, archetype }).success).toBe(true);
    }
  });

  it("rejects the two slugs that were actually in prod ('fitness', 'learner')", () => {
    for (const archetype of ["fitness", "learner"]) {
      const result = CalibratedPersonaSchema.safeParse({ ...valid, archetype });
      expect(result.success).toBe(false);
    }
  });

  it("accepts the optional presentation-only label", () => {
    expect(
      CalibratedPersonaSchema.safeParse({ ...valid, label: "The Bookmarker" }).success,
    ).toBe(true);
  });

  it("still rejects the other engine invariants (share out of range)", () => {
    expect(CalibratedPersonaSchema.safeParse({ ...valid, share: 1.5 }).success).toBe(false);
  });
});

describe("CalibratedPersonasSchema — the array shape the routes actually receive", () => {
  it("THE CALLER'S SHAPE: one bad sibling fails the whole PATCH payload", () => {
    // persona-edit-form.tsx maps over audience.personas and re-sends ALL of them, so a row that
    // still holds a bad slug carries it along on every edit. That payload must not be accepted.
    const asEditFormSends = [
      valid,
      { ...valid, archetype: "fitness", repaint: "Hardcore gym regular", share: 0.25 },
      { ...valid, archetype: "loyalist", share: 0.15 },
    ];

    const result = CalibratedPersonasSchema.safeParse(asEditFormSends);
    expect(result.success).toBe(false);
  });

  it("accepts a fully valid array", () => {
    const good = [valid, { ...valid, archetype: "loyalist" }, { ...valid, archetype: "lurker" }];
    expect(CalibratedPersonasSchema.safeParse(good).success).toBe(true);
  });

  it("keeps the storage-DoS cap at 50 elements (WR-02)", () => {
    const tooMany = Array.from({ length: 51 }, () => valid);
    expect(CalibratedPersonasSchema.safeParse(tooMany).success).toBe(false);
  });
});
