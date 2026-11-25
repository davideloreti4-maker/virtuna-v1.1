/**
 * Niches as Discover names them: the stored value read as a key
 * (the two comedy values are one), its label, and the filter's options. Pure.
 */
import { describe, expect, it } from "vitest";

import { NICHE_KEY_PATTERN, NICHE_LABELS, nicheKeyOf, nicheLabel, nicheOptions } from "../niches";

describe("nicheKeyOf", () => {
  it("trims and lowercases", () => {
    expect(nicheKeyOf("  Food ")).toBe("food");
    expect(nicheKeyOf("HEALTH-FITNESS")).toBe("health-fitness");
  });

  it("comedy and comedy-entertainment are comedy", () => {
    expect(nicheKeyOf("comedy")).toBe("comedy");
    expect(nicheKeyOf("comedy-entertainment")).toBe("comedy");
    expect(nicheKeyOf(" Comedy-Entertainment ")).toBe("comedy");
  });

  it("empty is null", () => {
    expect(nicheKeyOf("")).toBeNull();
    expect(nicheKeyOf("   ")).toBeNull();
    expect(nicheKeyOf(null)).toBeNull();
    expect(nicheKeyOf(undefined)).toBeNull();
  });
});

describe("nicheLabel", () => {
  it.each([
    ["content-creation", "Content creation"],
    ["comedy", "Comedy"],
    ["self-improvement", "Self-improvement"],
    ["business", "Business"],
    ["tech", "Tech"],
    ["lifestyle", "Lifestyle"],
    ["health-fitness", "Fitness"],
    ["beauty-fashion", "Beauty"],
    ["education-science", "Education"],
    ["relationships-family", "Family"],
    ["food", "Food"],
    ["art-design", "Art and design"],
    ["travel", "Travel"],
    ["career", "Career"],
    ["sports", "Sports"],
    ["finance", "Finance"],
    ["other", "Other"],
  ])("%s is %j", (key, label) => {
    expect(nicheLabel(key)).toBe(label);
  });

  it("a key the map does not hold: hyphens as spaces, a capital first letter", () => {
    expect(nicheLabel("home-decor")).toBe("Home decor");
    expect(nicheLabel("gaming")).toBe("Gaming");
    expect(nicheLabel("diy-home-repair")).toBe("Diy home repair");
  });

  it("does not answer for the object's own names", () => {
    expect(nicheLabel("constructor")).toBe("Constructor");
    expect(nicheLabel("__proto__")).toBe("__proto__");
  });
});

describe("NICHE_KEY_PATTERN: the niche keys the address holds", () => {
  it("every key of the label map, and comedy-entertainment, pass it", () => {
    const keys = [...Object.keys(NICHE_LABELS), "comedy-entertainment"];
    expect(keys.length).toBe(18);
    for (const key of keys) expect(key).toMatch(NICHE_KEY_PATTERN);
  });

  it("is a-z, 0-9 and hyphens, 1 to 40 of them", () => {
    expect("a".repeat(40)).toMatch(NICHE_KEY_PATTERN);
    for (const bad of ["", "a".repeat(41), "Food", "food & drink", "art design", "../x"]) expect(bad).not.toMatch(NICHE_KEY_PATTERN);
  });
});

describe("nicheOptions", () => {
  const v = (niche: string | null) => ({ niche });

  it("the keys that have videos, most videos first, ties by label", () => {
    const videos = [v("food"), v("travel"), v("food"), v("tech"), v("art-design"), v("tech"), v("food")];
    expect(nicheOptions(videos)).toEqual([
      { key: "food", label: "Food", count: 3 },
      { key: "tech", label: "Tech", count: 2 },
      { key: "art-design", label: "Art and design", count: 1 },
      { key: "travel", label: "Travel", count: 1 },
    ]);
  });

  it("comedy and comedy-entertainment are counted as one option", () => {
    const videos = [v("comedy"), v("comedy-entertainment"), v("Comedy-Entertainment"), v("food"), v("food")];
    expect(nicheOptions(videos)).toEqual([
      { key: "comedy", label: "Comedy", count: 3 },
      { key: "food", label: "Food", count: 2 },
    ]);
  });

  it("a key the address cannot hold is not offered (it could not be kept in the address)", () => {
    const videos = [v("food & drink"), v("food & drink"), v("a".repeat(41)), v("Self Improvement"), v("food")];
    expect(nicheOptions(videos)).toEqual([{ key: "food", label: "Food", count: 1 }]);
  });

  it("a video with no niche is in no option", () => {
    expect(nicheOptions([v(null), v(""), v("  ")])).toEqual([]);
    expect(nicheOptions([])).toEqual([]);
  });
});
