import { describe, expect, it } from "vitest";
import { ZONES, ZONES_SOURCE } from "../zones";

describe("the apps' overlay zones", () => {
  it("holds TikTok's and Instagram's top bar, right-side buttons and bottom bar, each inside the stage", () => {
    for (const app of ["tiktok", "instagram"] as const) expect(ZONES.filter((zone) => zone.app === app)).toHaveLength(3);
    for (const zone of ZONES) {
      expect(zone.w).toBeGreaterThan(0);
      expect(zone.h).toBeGreaterThan(0);
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + zone.w).toBeLessThanOrEqual(1 + 1e-12);
      expect(zone.y + zone.h).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  /** A zone in stage pixels, to a thousandth. */
  const px = (app: "tiktok" | "instagram", what: string) => {
    const zone = ZONES.find((each) => each.app === app && each.what === what)!;
    return [zone.x * 1080, zone.y * 1920, zone.w * 1080, zone.h * 1920].map((value) => Math.round(value * 1000) / 1000);
  };

  it("takes TikTok's top bar from its template, its icons as measured on its UI template, and the median organic bottom bar", () => {
    expect(px("tiktok", "top bar")).toEqual([0, 0, 1080, 240]);
    expect(px("tiktok", "right-side buttons")).toEqual([916, 576, 142, 1161]); // the avatar's top to the sound disc's bottom; the disc's left to the avatar's right
    expect(px("tiktok", "bottom caption and sound bar")).toEqual([0, 1540, 1080, 380]); // the median of 528, 380, 320
  });

  it("takes Meta's top bar for Instagram, and the medians of its button column and its organic bottom bar", () => {
    expect(px("instagram", "top bar")).toEqual([0, 0, 1080, 268.8]);
    expect(px("instagram", "right-side buttons")).toEqual([950, 1056, 130, 864]); // widths 227, 120, 130; starts 1152, 960
    expect(px("instagram", "bottom caption and audio bar")).toEqual([0, 1500, 1080, 420]); // the median of the organic 420 and 420; Meta's 35 % is an ad's
  });

  it("says when and from where they were measured", () => {
    expect(ZONES_SOURCE.measured).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ZONES_SOURCE.from.length).toBeGreaterThanOrEqual(8);
    for (const address of ZONES_SOURCE.from) expect(address).toMatch(/^https:\/\//);
    expect(ZONES_SOURCE.from.some((address) => address.includes("ads.tiktok.com"))).toBe(true);
    expect(ZONES_SOURCE.from.some((address) => address.includes("facebook.com/business"))).toBe(true);
  });

  it("cannot be changed by whoever reads them", () => {
    expect(Object.isFrozen(ZONES)).toBe(true);
    for (const zone of ZONES) expect(Object.isFrozen(zone)).toBe(true);
  });
});
