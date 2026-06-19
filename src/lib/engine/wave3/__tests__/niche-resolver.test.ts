/**
 * niche-resolver.test.ts — Phase 14 (14-01 Task 1).
 *
 * Unit coverage for resolveNicheKey: the runner-layer fix that maps free-text /
 * sub-slug `niche_primary` to a top-level NICHE_INSTANTIATION key (or null).
 *
 * The acceptance pairs (from 14-01-PLAN.md):
 *   - "personal-finance" → "education"   (sub-slug → parent)
 *   - "fitness"          → "fitness"     (direct top-level hit)
 *   - "my weird prose niche" → null      (prose miss → honest generic fallback)
 *   - null               → null          (no niche)
 */

import { describe, it, expect } from "vitest";
import { resolveNicheKey } from "../niche-resolver";
import { NICHE_INSTANTIATION_KEYS, isNicheInstantiationKey } from "../persona-registry";

describe("resolveNicheKey", () => {
  describe("acceptance pairs (plan-locked)", () => {
    it("sub-slug 'personal-finance' resolves to parent 'education'", () => {
      expect(resolveNicheKey("personal-finance")).toBe("education");
    });

    it("direct top-level 'fitness' resolves to 'fitness'", () => {
      expect(resolveNicheKey("fitness")).toBe("fitness");
    });

    it("prose 'my weird prose niche' resolves to null (honest generic fallback)", () => {
      expect(resolveNicheKey("my weird prose niche")).toBeNull();
    });

    it("null resolves to null", () => {
      expect(resolveNicheKey(null)).toBeNull();
    });
  });

  describe("(1) null / empty", () => {
    it("empty string → null", () => {
      expect(resolveNicheKey("")).toBeNull();
    });

    it("whitespace-only → null", () => {
      expect(resolveNicheKey("   ")).toBeNull();
    });
  });

  describe("(2) direct top-level hit (normalized)", () => {
    it("every NICHE_INSTANTIATION key resolves to itself", () => {
      for (const key of NICHE_INSTANTIATION_KEYS) {
        expect(resolveNicheKey(key)).toBe(key);
      }
    });

    it("case-insensitive + trimmed: '  Beauty  ' → 'beauty'", () => {
      expect(resolveNicheKey("  Beauty  ")).toBe("beauty");
    });

    it("hyphenated top-level slug 'food-cooking' → 'food-cooking'", () => {
      expect(resolveNicheKey("food-cooking")).toBe("food-cooking");
    });
  });

  describe("(3) sub-slug → parent", () => {
    it("'skincare' → 'beauty'", () => {
      expect(resolveNicheKey("skincare")).toBe("beauty");
    });

    it("'strength-training' → 'fitness'", () => {
      expect(resolveNicheKey("strength-training")).toBe("fitness");
    });

    it("'meal-prep' → 'food-cooking'", () => {
      expect(resolveNicheKey("meal-prep")).toBe("food-cooking");
    });

    it("'esports' → 'gaming'", () => {
      expect(resolveNicheKey("esports")).toBe("gaming");
    });

    it("resolved parent is always a valid instantiation key", () => {
      const resolved = resolveNicheKey("coding-programming");
      expect(resolved).toBe("education");
      expect(isNicheInstantiationKey(resolved!)).toBe(true);
    });
  });

  describe("(4) keyword / contains fallback", () => {
    it("'fitness coaching' → 'fitness' (top-level slug contained)", () => {
      expect(resolveNicheKey("fitness coaching")).toBe("fitness");
    });

    it("'skincare routine' → 'beauty' (sub label/slug contained)", () => {
      expect(resolveNicheKey("skincare routine")).toBe("beauty");
    });

    it("'food cooking' (hyphenless) → 'food-cooking'", () => {
      expect(resolveNicheKey("food cooking")).toBe("food-cooking");
    });
  });

  describe("(5) honest null on miss — never fabricate", () => {
    it("totally unrelated prose → null", () => {
      expect(resolveNicheKey("underwater basket weaving")).toBeNull();
    });

    it("ambiguous single word with no taxonomy overlap → null", () => {
      expect(resolveNicheKey("xyzzy")).toBeNull();
    });
  });

  describe("purity / determinism", () => {
    it("same input → same output across repeated calls", () => {
      const a = resolveNicheKey("personal-finance");
      const b = resolveNicheKey("personal-finance");
      expect(a).toBe(b);
      expect(a).toBe("education");
    });
  });
});
