import { describe, it, expect } from "vitest";
import {
  NICHE_TREE,
  getNicheBranches,
  getPrimaryLabel,
  getSubLabel,
  type NicheTree,
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

// Type-only assertion — fails to type-check if NicheTree changes shape incompatibly.
const _typeCheck: NicheTree = NICHE_TREE;
void _typeCheck;
