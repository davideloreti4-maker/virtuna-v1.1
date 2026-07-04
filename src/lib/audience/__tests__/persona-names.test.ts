/**
 * persona-names — the named-people source of truth (The Room, Phase 1 Task A).
 *
 * Locks: (1) every engine archetype has a stable default name; (2) a creator label always wins;
 * (3) unknown archetypes resolve null (caller falls back); (4) personaNameMap only carries
 * creator-labelled entries. Determinism (same input → same name) is covered by the map being a
 * static const.
 *
 * Test runner (CRITICAL repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/persona-names.test.ts
 * NEVER `npm test` / `npx vitest` — they emit fake PASS(0)/FAIL(0).
 */

import { describe, it, expect } from "vitest";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import {
  ARCHETYPE_PERSONA_NAME,
  resolvePersonaName,
  personaNameMap,
} from "../persona-names";

describe("ARCHETYPE_PERSONA_NAME", () => {
  it("names every engine archetype exactly once with a non-empty, unique name", () => {
    for (const a of ARCHETYPES) {
      expect(ARCHETYPE_PERSONA_NAME[a]?.trim().length ?? 0).toBeGreaterThan(0);
    }
    const names = ARCHETYPES.map((a) => ARCHETYPE_PERSONA_NAME[a]);
    expect(new Set(names).size).toBe(ARCHETYPES.length); // no two archetypes share a name
  });
});

describe("resolvePersonaName", () => {
  it("returns the stable default name for a known archetype", () => {
    expect(resolvePersonaName("tough_crowd")).toBe(ARCHETYPE_PERSONA_NAME.tough_crowd);
  });

  it("prefers a non-empty creator label over the default", () => {
    expect(resolvePersonaName("tough_crowd", "Casey")).toBe("Casey");
    expect(resolvePersonaName("tough_crowd", "  Casey  ")).toBe("Casey");
  });

  it("ignores an empty/whitespace label and falls back to the default", () => {
    expect(resolvePersonaName("tough_crowd", "   ")).toBe(ARCHETYPE_PERSONA_NAME.tough_crowd);
    expect(resolvePersonaName("tough_crowd", "")).toBe(ARCHETYPE_PERSONA_NAME.tough_crowd);
  });

  it("returns null for an unknown / absent archetype and no label (caller falls back)", () => {
    expect(resolvePersonaName("mystery_slug")).toBeNull();
    expect(resolvePersonaName(null)).toBeNull();
    expect(resolvePersonaName(undefined)).toBeNull();
  });

  it("still honours a label for an unknown archetype", () => {
    expect(resolvePersonaName("mystery_slug", "Casey")).toBe("Casey");
  });
});

describe("personaNameMap", () => {
  it("carries only creator-labelled personas (trimmed), skipping unlabelled ones", () => {
    const map = personaNameMap([
      { archetype: "tough_crowd", label: "  Casey " },
      { archetype: "saver", label: null },
      { archetype: "lurker" },
    ]);
    expect(map).toEqual({ tough_crowd: "Casey" });
  });

  it("returns an empty object for null/empty personas (General/legacy)", () => {
    expect(personaNameMap(null)).toEqual({});
    expect(personaNameMap([])).toEqual({});
    expect(personaNameMap(undefined)).toEqual({});
  });
});
