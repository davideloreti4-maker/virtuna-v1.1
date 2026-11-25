/** @vitest-environment happy-dom */
/**
 * posted.test.ts — the geometry of the preview as it will be posted (spec E17; plan 2026-11-25-editor-screens-b, Task 6, ruling
 * S10; the numbers from `.scratch/editor/slice-b/safe-zones.md`): each app's screen on a tall phone, drawn to scale and fitted
 * whole in the browser's area at every size, its parts in the same places relative to each other, nothing of the video or the
 * furniture under a band or cut off, and the creator's controls outside the phone where there is room, over its edges where
 * there is none, never over the furniture; the choice of app kept on the device; the furniture in percent of the video's frame.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FURNITURE, POSTED_KEY, clipOf, keepApp, phoneOf, postedLayout, readApp, type App, type Box, type PostedLayout } from "../posted";

/** A box to the hundredth. */
const near = (box: Box | null, want: Box) => {
  expect(box).not.toBeNull();
  for (const side of ["left", "top", "width", "height"] as const) expect(box![side]).toBeCloseTo(want[side], 2);
};
const EPS = 1e-6;
const right = (box: Box) => box.left + box.width;
const bottom = (box: Box) => box.top + box.height;
const inside = (box: Box, outer: Box) =>
  box.left >= outer.left - EPS && box.top >= outer.top - EPS && right(box) <= right(outer) + EPS && bottom(box) <= bottom(outer) + EPS;
const meet = (a: Box, b: Box) => a.left < right(b) - EPS && b.left < right(a) - EPS && a.top < bottom(b) - EPS && b.top < bottom(a) - EPS;
/** A box as a share of the screen it is on: the same at every size when everything scales with the phone. */
const onScreen = (box: Box, screen: Box): number[] => [(box.left - screen.left) / screen.width, (box.top - screen.top) / screen.height, box.width / screen.width, box.height / screen.height];
/** Each shape of an app's furniture where it is drawn: in percent of the video's whole frame. */
const furniture = (app: "tiktok" | "reels", { video }: PostedLayout): Box[] =>
  FURNITURE[app].map(({ box: [left, top, width, height] }) => ({ left: video.left + (left / 100) * video.width, top: video.top + (top / 100) * video.height, width: (width / 100) * video.width, height: (height / 100) * video.height }));

const APPS: App[] = ["tiktok", "reels", "off"];
/** A tall phone, a phone browser with its toolbars, a small phone, a short tall one, a desk. */
const AREAS = [{ w: 393, h: 852 }, { w: 375, h: 600 }, { w: 360, h: 640 }, { w: 393, h: 660 }, { w: 1280, h: 800 }];

describe("each app's screen on the tall phone, in its points", () => {
  it("is TikTok's: the whole video at the screen's width under the app's top strip, its bottom bar under the video", () => {
    const phone = phoneOf("tiktok");
    near(phone.screen, { left: 0, top: 0, width: 393, height: 852 });
    near(phone.video, { left: 0, top: 50, width: 393, height: 698.67 });
    near(phone.clip, phone.video);
    near(phone.band, { left: 0, top: 749, width: 393, height: 103 });
  });

  it("is Reels': the video zoomed to cover the screen down to the bar, its sides cut", () => {
    const phone = phoneOf("reels");
    near(phone.clip, { left: 0, top: 0, width: 393, height: 770 });
    near(phone.video, { left: -20.06, top: 0, width: 433.13, height: 770 });
    near(phone.band, { left: 0, top: 770, width: 393, height: 82 });
  });

  it("is the video alone with Off", () => {
    const phone = phoneOf("off");
    near(phone.screen, { left: 0, top: 0, width: 393, height: 698.67 });
    near(phone.video, phone.screen);
    expect(phone.band).toBeNull();
  });
});

describe("the phone fitted in the browser's area (S10)", () => {
  it.each(AREAS.flatMap((area) => APPS.map((app) => [app, area] as const)))("%s in %o: whole, centred, every part in its place, nothing under a band or cut off", (app, area) => {
    const layout = postedLayout(app, area);
    const phone = phoneOf(app);
    const { screen, video, clip, band } = layout;
    // Contain: inside the area, touching it on one axis, centred on both, drawn at one scale.
    expect(inside(screen, { left: 0, top: 0, width: area.w, height: area.h })).toBe(true);
    expect(Math.min(area.w - screen.width, area.h - screen.height)).toBeCloseTo(0, 6);
    expect(screen.left).toBeCloseTo(area.w - right(screen), 6);
    expect(screen.top).toBeCloseTo(area.h - bottom(screen), 6);
    expect(layout.pt).toBeCloseTo(Math.min(area.w / phone.screen.width, area.h / phone.screen.height), 9);
    // Every part where the tall phone has it, as a share of the screen.
    for (const part of ["video", "clip", "band"] as const) {
      const at = layout[part];
      const was = phone[part];
      if (was === null || at === null) expect(at).toBe(was);
      else onScreen(at, screen).forEach((share, index) => expect(share).toBeCloseTo(onScreen(was, phone.screen)[index]!, 9));
    }
    // What is seen of the video is on the phone and above its bar; the bar is on the phone.
    expect(inside(clip, screen)).toBe(true);
    expect(inside(clip, video)).toBe(true);
    if (band) {
      expect(inside(band, screen)).toBe(true);
      expect(bottom(clip)).toBeLessThanOrEqual(band.top + EPS);
    }
    // The furniture is seen whole, above the bar, and the creator's controls are over none of it.
    const drawn = app === "off" ? [] : furniture(app, layout);
    for (const shape of drawn) {
      expect(inside(shape, clip)).toBe(true);
      if (band) expect(bottom(shape)).toBeLessThanOrEqual(band.top + EPS);
    }
    const { top: row, bottom: bar } = layout.controls;
    for (const control of [row, bar]) {
      expect(inside(control, { left: 0, top: 0, width: area.w, height: area.h })).toBe(true);
      expect(drawn.filter((shape) => meet(shape, control))).toEqual([]);
    }
    expect(bottom(row)).toBeLessThanOrEqual(bar.top);
  });

  it("fills a tall phone with TikTok's or Reels' screen at one point a pixel", () => {
    for (const app of ["tiktok", "reels"] as const) {
      const layout = postedLayout(app, { w: 393, h: 852 });
      expect(layout.pt).toBe(1);
      near(layout.screen, { left: 0, top: 0, width: 393, height: 852 });
    }
    near(postedLayout("tiktok", { w: 393, h: 852 }).video, { left: 0, top: 50, width: 393, height: 698.67 });
  });

  it("draws the whole phone smaller in a phone browser with its toolbars: the video above the bar, not under it", () => {
    const layout = postedLayout("tiktok", { w: 375, h: 600 });
    const pt = 600 / 852;
    expect(layout.pt).toBeCloseTo(pt, 9);
    near(layout.screen, { left: (375 - 393 * pt) / 2, top: 0, width: 393 * pt, height: 600 });
    near(layout.video, { left: (375 - 393 * pt) / 2, top: 50 * pt, width: 393 * pt, height: 698.67 * pt });
    near(layout.band, { left: (375 - 393 * pt) / 2, top: 749 * pt, width: 393 * pt, height: 103 * pt });
  });

  it("frames the phone in a desk's window, as tall as the window", () => {
    const layout = postedLayout("tiktok", { w: 1280, h: 800 });
    expect(layout.pt).toBeCloseTo(800 / 852, 9);
    near(layout.screen, { left: (1280 - (393 * 800) / 852) / 2, top: 0, width: (393 * 800) / 852, height: 800 });
  });

  it("puts the creator's controls outside the phone where there is room, over its edges where there is none", () => {
    // Off on a tall phone: the video leaves 76.67 above and below it.
    const off = postedLayout("off", { w: 393, h: 852 });
    near(off.video, { left: 0, top: 76.67, width: 393, height: 698.67 });
    expect(bottom(off.controls.top)).toBeLessThanOrEqual(off.screen.top);
    expect(off.controls.bottom.top).toBeGreaterThanOrEqual(bottom(off.screen));
    // TikTok on the same phone fills it: the row over its top strip, the scrubber over its bar, 16 in from the sides.
    const tiktok = postedLayout("tiktok", { w: 393, h: 852 });
    expect(inside(tiktok.controls.top, { ...tiktok.screen, height: tiktok.video.top })).toBe(true);
    expect(inside(tiktok.controls.bottom, tiktok.band!)).toBe(true);
    near(tiktok.controls.bottom, { left: 16, top: 852 - 44, width: 393 - 32, height: 44 });
    // The row is wide enough for its three controls, centred on the phone, also when the phone is drawn narrower.
    const small = postedLayout("tiktok", { w: 375, h: 600 });
    expect(small.controls.top.width).toBe(300);
    expect(small.controls.top.left + 150).toBeCloseTo(small.screen.left + small.screen.width / 2, 9);
  });

  it("cuts the video to what is seen: Reels' two sides, at scale; nothing of TikTok's or Off's", () => {
    expect(clipOf(postedLayout("reels", { w: 393, h: 852 }))).toBe("inset(0px 20.06px 0px 20.06px)");
    expect(clipOf(postedLayout("reels", { w: 375, h: 600 }))).toBe(`inset(0px ${Math.round(((433.125 - 393) / 2) * (600 / 852) * 100) / 100}px 0px ${Math.round(((433.125 - 393) / 2) * (600 / 852) * 100) / 100}px)`);
    expect(clipOf(phoneOf("reels"))).toBe("inset(0px 20.06px 0px 20.06px)");
    expect(clipOf(postedLayout("tiktok", { w: 393, h: 852 }))).toBe("inset(0px 0px 0px 0px)");
    expect(clipOf(postedLayout("off", { w: 375, h: 600 }))).toBe("inset(0px 0px 0px 0px)");
  });
});

describe("the app chosen, kept on the device (6)", () => {
  afterEach(() => {
    window.localStorage.removeItem(POSTED_KEY);
    vi.restoreAllMocks();
  });

  it("is TikTok when nothing is kept, the one kept, and TikTok for anything else", () => {
    expect(readApp()).toBe("tiktok");
    keepApp("reels");
    expect(window.localStorage.getItem(POSTED_KEY)).toBe("reels");
    expect(readApp()).toBe("reels");
    keepApp("off");
    expect(readApp()).toBe("off");
    window.localStorage.setItem(POSTED_KEY, "junk");
    expect(readApp()).toBe("tiktok");
  });

  it("is TikTok when the storage cannot be read, and a choice that cannot be kept is let go", () => {
    keepApp("reels");
    const read = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const kept = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(readApp()).toBe("tiktok");
    expect(read).toHaveBeenCalledWith(POSTED_KEY);
    expect(() => keepApp("off")).not.toThrow();
    expect(kept).toHaveBeenCalledWith(POSTED_KEY, "off");
  });
});

describe("the furniture (7)", () => {
  const all = [...FURNITURE.tiktok, ...FURNITURE.reels];

  it("lies inside the video's frame, and on Reels inside what is not cut off", () => {
    for (const { box } of all) {
      const [left, top, width, height] = box;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100);
      expect(top + height).toBeLessThanOrEqual(100);
    }
    for (const { box } of FURNITURE.reels) {
      expect(box[0]).toBeGreaterThanOrEqual(4.6);
      expect(box[0] + box[2]).toBeLessThanOrEqual(95.4);
    }
  });

  it("names no app: the apps' names are only on the switch", () => {
    for (const { text } of all) expect(text ?? "").not.toMatch(/TikTok|Instagram|Reels/i);
  });

  it("leaves one place a post's caption for the edit's title: two lines on TikTok, one on Reels", () => {
    expect(FURNITURE.tiktok.filter((shape) => shape.kind === "text" && shape.text === undefined)).toHaveLength(1);
    expect(FURNITURE.reels.filter((shape) => shape.kind === "text" && shape.text === undefined)).toHaveLength(1);
  });
});
