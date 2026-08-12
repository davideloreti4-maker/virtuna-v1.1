import { describe, expect, it } from "vitest";
import {
  computeAuthorBaseline,
  multiplierFor,
  formatMultiplier,
} from "@/lib/discover/author-baseline";

describe("computeAuthorBaseline", () => {
  it("prefers the creator's own median VIEWS when their posts are available", () => {
    const b = computeAuthorBaseline({ heart: 55700, videoCount: 405 }, [100, 200, 900]);
    expect(b).toEqual({ basis: "own-median-views", value: 200, label: "vs their usual views" });
  });

  it("falls back to lifetime average LIKES when no own posts are available", () => {
    const b = computeAuthorBaseline({ heart: 55700, videoCount: 405 });
    expect(b?.basis).toBe("lifetime-avg-likes");
    expect(b?.label).toBe("vs their lifetime average");
    expect(b?.value).toBeCloseTo(55700 / 405, 5);
  });

  it("returns null when neither basis is computable (no posts, no video count)", () => {
    expect(computeAuthorBaseline({ heart: 0, videoCount: 0 })).toBeNull();
  });

  it("ignores an empty own-posts array rather than dividing by zero", () => {
    const b = computeAuthorBaseline({ heart: 400, videoCount: 4 }, []);
    expect(b?.basis).toBe("lifetime-avg-likes");
  });
});

describe("multiplierFor", () => {
  it("divides VIEWS by the baseline on the views basis", () => {
    const b = { basis: "own-median-views" as const, value: 200, label: "vs their usual views" };
    expect(multiplierFor({ views: 1000, likes: 7 }, b)).toBe(5);
  });

  it("divides LIKES by the baseline on the likes basis", () => {
    const b = { basis: "lifetime-avg-likes" as const, value: 100, label: "vs their lifetime average" };
    expect(multiplierFor({ views: 999999, likes: 570 }, b)).toBe(5.7);
  });

  it("is INDEPENDENT of any result set — the same inputs always give the same number", () => {
    // Spec §2.7: the old result-set median gave 1.4x / 7.3x / 11.9x / 28.4x for one video.
    const b = { basis: "lifetime-avg-likes" as const, value: 17969, label: "vs their lifetime average" };
    const v = { views: 1_400_000, likes: 103_300 };
    expect(multiplierFor(v, b)).toBeCloseTo(5.7, 1);
    expect(multiplierFor(v, b)).toBeCloseTo(5.7, 1);
  });
});

describe("formatMultiplier", () => {
  it("clamps above the printable band (D4)", () => {
    expect(formatMultiplier(490.2)).toBe("50×+");
    expect(formatMultiplier(20154.7)).toBe("50×+");
  });

  it("prints one decimal inside the band", () => {
    expect(formatMultiplier(5.7)).toBe("5.7×");
    expect(formatMultiplier(50)).toBe("50.0×");
  });
});
