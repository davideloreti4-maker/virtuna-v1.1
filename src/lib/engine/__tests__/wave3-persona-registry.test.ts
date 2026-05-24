/**
 * Unit tests for Phase 7 persona registry (Plan 07-01 Task 2).
 *
 * Pure-function test surface mirroring `content-type-weights.test.ts`:
 * - Locked-table invariants (ALLOCATION_TABLE sums to 10 per row)
 * - Slot-count and slot-type distribution for each of the 7 content types
 * - Cross-niche adjacency coverage for all 10 primary niche slugs
 * - Determinism (cache-stability substrate per D-17)
 * - Length invariant (Pitfall 2 throw on drift)
 * - 6 FYP archetype membership (PERSONA-02 + D-02)
 *
 * No module mocking needed — registry is a pure data + lookup module.
 */
import { describe, it, expect } from "vitest";
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import {
  ARCHETYPES,
  ALLOCATION_TABLE,
  CROSS_NICHE_ADJACENCY,
  TIME_OF_DAY_TAGS,
  selectPersonaSlots,
} from "../wave3/persona-registry";

describe("ARCHETYPES (Phase 7 D-02 + D-03)", () => {
  it("exports exactly 10 archetypes in the locked order", () => {
    // Order is LOAD-BEARING for top-3 tie-break in Plan 07-02 aggregator.
    expect([...ARCHETYPES]).toEqual([
      "high_engager",
      "saver",
      "lurker",
      "sharer",
      "tough_crowd",
      "purposeful_viewer",
      "niche_deep_buyer",
      "niche_deep_scout",
      "loyalist",
      "cross_niche_curiosity",
    ]);
  });

  it("includes all 6 FYP behavioral archetypes (PERSONA-02 + D-02)", () => {
    const fypArchetypes = [
      "high_engager",
      "saver",
      "lurker",
      "sharer",
      "tough_crowd",
      "purposeful_viewer",
    ] as const;
    for (const a of fypArchetypes) {
      expect(ARCHETYPES).toContain(a);
    }
  });
});

describe("ALLOCATION_TABLE (Phase 7 D-10; Phase 5 CR-04 added comedy)", () => {
  it("every content_type row sums to exactly 10", () => {
    for (const [contentType, row] of Object.entries(ALLOCATION_TABLE)) {
      const sum = row.fyp + row.niche_deep + row.loyalist + row.cross_niche;
      expect(sum, `${contentType} row sum`).toBe(10);
    }
  });

  it("covers exactly the 8 ContentTypeSlug values (Phase 5 CR-04 added comedy as neutral)", () => {
    expect(Object.keys(ALLOCATION_TABLE).sort()).toEqual(
      ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "comedy", "other"].sort(),
    );
  });

  it("vlog allocates 3 loyalist slots (user-adjusted from 3/2/4/1 to 4/2/3/1)", () => {
    expect(ALLOCATION_TABLE.vlog.loyalist).toBe(3);
    expect(ALLOCATION_TABLE.vlog.fyp).toBe(4);
  });

  it("other row is the canonical 6/2/1/1 default", () => {
    expect(ALLOCATION_TABLE.other).toEqual({
      fyp: 6,
      niche_deep: 2,
      loyalist: 1,
      cross_niche: 1,
    });
  });

  it("comedy row mirrors other's 6/2/1/1 neutral baseline (Phase 5 CR-04)", () => {
    expect(ALLOCATION_TABLE.comedy).toEqual(ALLOCATION_TABLE.other);
  });
});

describe("CROSS_NICHE_ADJACENCY (Phase 7 D-03 + PERSONA-05)", () => {
  it("has an entry for every primary niche slug in NICHE_TREE", () => {
    for (const primary of NICHE_TREE) {
      expect(CROSS_NICHE_ADJACENCY[primary.slug], `adjacency for ${primary.slug}`).toBeDefined();
      expect(CROSS_NICHE_ADJACENCY[primary.slug]).toMatch(/.+/);
    }
  });

  it("covers all 10 primary niches", () => {
    expect(NICHE_TREE.length).toBe(10);
    expect(Object.keys(CROSS_NICHE_ADJACENCY).length).toBeGreaterThanOrEqual(10);
  });
});

describe("TIME_OF_DAY_TAGS (Phase 7 D-04 + Pitfall 8)", () => {
  it("has exactly 4 entries to bound cache combinatorics", () => {
    expect(TIME_OF_DAY_TAGS.length).toBe(4);
  });

  it("each tag has id + label + description", () => {
    for (const tag of TIME_OF_DAY_TAGS) {
      expect(tag.id).toMatch(/.+/);
      expect(tag.label).toMatch(/.+/);
      expect(tag.description).toMatch(/.+/);
    }
  });
});

describe("selectPersonaSlots (Phase 7 D-10 + D-11)", () => {
  const allContentTypes = [
    "talking_head",
    "b_roll",
    "slideshow",
    "action",
    "tutorial",
    "vlog",
    "other",
  ] as const;

  it("returns exactly 10 slots for every content type (PERSONA-07 length invariant)", () => {
    for (const ct of allContentTypes) {
      const slots = selectPersonaSlots(ct, "beauty");
      expect(slots.length, `slots for ${ct}`).toBe(10);
    }
  });

  it("null content_type falls back to other row (6/2/1/1 per D-11)", () => {
    const slots = selectPersonaSlots(null, "beauty");
    expect(slots.length).toBe(10);
    expect(slots.filter((s) => s.slot_type === "fyp").length).toBe(6);
    expect(slots.filter((s) => s.slot_type === "niche_deep").length).toBe(2);
    expect(slots.filter((s) => s.slot_type === "loyalist").length).toBe(1);
    expect(slots.filter((s) => s.slot_type === "cross_niche").length).toBe(1);
  });

  it("null nicheSlug falls back to 'general TikTok' label (Pitfall 6)", () => {
    const slots = selectPersonaSlots("tutorial", null);
    expect(slots.length).toBe(10);
    // Verify at least one FYP slot has the generic fallback niche label.
    const fypSlot = slots.find((s) => s.slot_type === "fyp");
    expect(fypSlot?.niche_label).toBe("general TikTok");
    expect(fypSlot?.niche_instantiation).toMatch(/.+/); // generic fallback string
  });

  it("returns deeply-equal arrays for identical inputs (D-17 cache substrate)", () => {
    const a = selectPersonaSlots("slideshow", "beauty");
    const b = selectPersonaSlots("slideshow", "beauty");
    expect(a).toEqual(b);
  });

  it("PERSONA-03: tutorial content type yields exactly 3 niche_deep slots", () => {
    const slots = selectPersonaSlots("tutorial", "fitness");
    expect(slots.filter((s) => s.slot_type === "niche_deep").length).toBe(3);
  });

  it("PERSONA-04: talking_head content type yields exactly 2 loyalist slots", () => {
    const slots = selectPersonaSlots("talking_head", "beauty");
    expect(slots.filter((s) => s.slot_type === "loyalist").length).toBe(2);
  });

  it("each slot carries non-empty archetype definition, scroll_past_triggers, stop_triggers, motivator, niche_instantiation", () => {
    const slots = selectPersonaSlots("slideshow", "beauty");
    for (const slot of slots) {
      expect(slot.archetype_definition.length).toBeGreaterThan(20);
      expect(slot.scroll_past_triggers.length).toBeGreaterThan(0);
      expect(slot.stop_triggers.length).toBeGreaterThan(0);
      expect(slot.motivator).toMatch(/.+/);
      expect(slot.niche_instantiation.length).toBeGreaterThan(10);
      expect(slot.time_of_day_label).toMatch(/.+/);
    }
  });

  it("cross_niche slots use the adjacent niche from CROSS_NICHE_ADJACENCY", () => {
    const slots = selectPersonaSlots("slideshow", "beauty");
    const crossSlot = slots.find((s) => s.slot_type === "cross_niche");
    expect(crossSlot).toBeDefined();
    // beauty's adjacency is lifestyle per D-03
    expect(crossSlot?.niche).toBe(CROSS_NICHE_ADJACENCY.beauty);
  });
});
