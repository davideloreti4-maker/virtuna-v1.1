import { describe, it, expect } from "vitest";
import {
  NICHE_TREE,
  getNicheBranches,
  getPrimaryLabel,
  getSubLabel,
  type NicheTree,
  type PersonaMix,
} from "@/lib/niches/taxonomy";

describe("NICHE_TREE shape", () => {
  it("exposes exactly 10 primary niches", () => {
    expect(NICHE_TREE).toHaveLength(10);
  });

  it("anchors on the 5 Phase 1 corpus niches", () => {
    const slugs = NICHE_TREE.map((p) => p.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(["beauty", "fitness", "education", "comedy", "lifestyle"])
    );
  });

  it("includes 5 extension niches for creator coverage breadth", () => {
    const slugs = NICHE_TREE.map((p) => p.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "food-cooking",
        "tech-gadgets",
        "gaming",
        "fashion-style",
        "music-performance",
      ])
    );
  });

  it("each primary has 8-12 sub-niches", () => {
    for (const primary of NICHE_TREE) {
      expect(primary.subs.length).toBeGreaterThanOrEqual(8);
      expect(primary.subs.length).toBeLessThanOrEqual(12);
    }
  });

  it("all slugs are lowercase and hyphen-separated (no spaces, no underscores, no uppercase)", () => {
    for (const primary of NICHE_TREE) {
      expect(primary.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const sub of primary.subs) {
        expect(sub.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });
});

describe("getNicheBranches", () => {
  it("returns sub-niches for a known primary slug", () => {
    const subs = getNicheBranches("fitness");
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0]).toEqual({ slug: expect.any(String), label: expect.any(String) });
  });

  it("returns an empty array for an unknown primary slug", () => {
    expect(getNicheBranches("nonexistent-slug")).toEqual([]);
  });
});

describe("getPrimaryLabel", () => {
  it("returns the human-readable label for a known primary slug", () => {
    expect(getPrimaryLabel("fitness")).toBe("Fitness");
    expect(getPrimaryLabel("food-cooking")).toBe("Food & Cooking");
  });

  it("returns null for an unknown primary slug", () => {
    expect(getPrimaryLabel("nope")).toBeNull();
  });
});

describe("getSubLabel", () => {
  it("returns the sub-niche label for a known (primary, sub) pair", () => {
    expect(getSubLabel("fitness", "yoga")).toBe("Yoga");
  });

  it("returns null for an unknown sub slug under a known primary", () => {
    expect(getSubLabel("fitness", "nope")).toBeNull();
  });

  it("returns null for an unknown primary even if sub slug is valid elsewhere", () => {
    expect(getSubLabel("nope", "yoga")).toBeNull();
  });
});

describe("Phase 4 — personas + benchmark_filters per primary niche", () => {
  it("every primary has a non-empty personas array", () => {
    for (const primary of NICHE_TREE) {
      expect(primary.personas).toBeDefined();
      expect(Array.isArray(primary.personas)).toBe(true);
      expect(primary.personas.length).toBeGreaterThan(0);
    }
  });

  it("personas weight sums to exactly 10 per primary (D-13: 10-persona allocation)", () => {
    for (const primary of NICHE_TREE) {
      const sum = primary.personas.reduce((acc: number, p: PersonaMix) => acc + p.weight, 0);
      expect(sum).toBe(10);
    }
  });

  it("every primary has a non-empty benchmark_filters.tag_filters array (≥3 entries)", () => {
    for (const primary of NICHE_TREE) {
      expect(primary.benchmark_filters).toBeDefined();
      expect(Array.isArray(primary.benchmark_filters.tag_filters)).toBe(true);
      expect(primary.benchmark_filters.tag_filters.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every primary has a positive integer min_corpus_size (≥ 10)", () => {
    for (const primary of NICHE_TREE) {
      expect(primary.benchmark_filters.min_corpus_size).toBeGreaterThanOrEqual(10);
      expect(Number.isInteger(primary.benchmark_filters.min_corpus_size)).toBe(true);
    }
  });

  it("persona archetypes use documented vocabulary (fyp-/niche-/loyalist-/cross-niche-)", () => {
    const validPrefixes = /^(fyp-|niche-|loyalist-|cross-niche-)/;
    for (const primary of NICHE_TREE) {
      for (const p of primary.personas) {
        expect(p.archetype).toMatch(validPrefixes);
      }
    }
  });

  it("tag_filters contain only lowercase alphanumeric tokens (no # prefix, no spaces)", () => {
    for (const primary of NICHE_TREE) {
      for (const tag of primary.benchmark_filters.tag_filters) {
        expect(tag).toMatch(/^[a-z0-9]+$/);
      }
    }
  });
});

// Type-only assertion — fails to type-check if NicheTree changes shape incompatibly.
const _typeCheck: NicheTree = NICHE_TREE;
void _typeCheck;
