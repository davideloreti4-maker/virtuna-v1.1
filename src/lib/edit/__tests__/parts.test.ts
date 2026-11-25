import { describe, expect, it } from "vitest";
import { FONTS, PARTS, PART_IDS, partOf } from "../parts";

describe("parts", () => {
  it("lists the five first parts and the three typefaces", () => {
    expect([...PART_IDS].sort()).toEqual(["callout", "cutaway", "progress", "sound", "title"]);
    expect(FONTS).toEqual(["inter", "montserrat", "tiktok"]);
  });

  it("finds a part by name and nothing by a name every object has", () => {
    expect(partOf("title")).toBe(PARTS.title);
    expect(partOf("nope")).toBeUndefined();
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"]) expect(partOf(name)).toBeUndefined();
  });

  it("says where each part may sit", () => {
    expect(PARTS.progress.where).toEqual(["film"]);
    for (const id of ["title", "callout", "cutaway", "sound"] as const) expect([...PARTS[id].where].sort()).toEqual(["film", "shot"]);
  });

  it("says which parts run on over a cut: a sound, a cutaway and a title, not a call-out", () => {
    expect(PART_IDS.filter((id) => PARTS[id].spills).sort()).toEqual(["cutaway", "sound", "title"]);
  });

  it("says what file each part plays, and a part that plays one says where in it to start", () => {
    expect(PARTS.title.plays).toBeNull();
    expect(PARTS.callout.plays).toBeNull();
    expect(PARTS.progress.plays).toBeNull();
    expect(PARTS.cutaway.plays).toEqual(["video", "image"]);
    expect(PARTS.sound.plays).toEqual(["audio"]);
    for (const id of PART_IDS) {
      const spec = partOf(id)!;
      expect(spec.props.safeParse({ startMs: -1 }).error?.issues.some((issue) => issue.path[0] === "startMs") ?? false, id).toBe(spec.plays !== null);
    }
  });

  it("accepts a title's settings and refuses an unknown one, a missing one, blank words and type too small to read", () => {
    const good = { text: "Building it in a shed", font: "inter", look: "bold", y: 0.12, size: 96, color: "#ffffff", accent: "#ff6363" };
    expect(PARTS.title.props.safeParse(good).success).toBe(true);
    expect(PARTS.title.props.safeParse({ ...good, glow: true }).success).toBe(false);
    const { text: _text, ...noText } = good;
    expect(PARTS.title.props.safeParse(noText).success).toBe(false);
    expect(PARTS.title.props.safeParse({ ...good, text: "   " }).success).toBe(false);
    // From 48 px (Task K1): two of five references set their hook smaller than the 84 the kit once held a title to.
    expect(PARTS.title.props.safeParse({ ...good, size: 48 }).success).toBe(true);
    expect(PARTS.title.props.safeParse({ ...good, size: 60 }).success).toBe(true);
    expect(PARTS.title.props.safeParse({ ...good, size: 47 }).success).toBe(false);
    expect(PARTS.title.props.safeParse({ ...good, font: "comic" }).success).toBe(false);
  });

  it("lets a title carry a weight of 400 to 900 in hundreds, or none", () => {
    const good = { text: "Building it in a shed", font: "inter", look: "label", y: 0.12, size: 96, color: "#ffffff", accent: null };
    for (const weight of [400, 500, 600, 700, 800, 900]) expect(PARTS.title.props.safeParse({ ...good, weight }).success, String(weight)).toBe(true);
    for (const weight of [300, 450, 1000, "600"]) {
      const result = PARTS.title.props.safeParse({ ...good, weight });
      expect(result.success, String(weight)).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join(".")), String(weight)).toEqual(["weight"]);
    }
    const parsed = PARTS.title.props.safeParse(good);
    expect(parsed.success && parsed.data).not.toHaveProperty("weight");
  });

  it("holds a call-out to 40 characters, a readable size and a six-digit colour", () => {
    const good = { text: "Virtuna", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 120, color: "#ffffff" };
    expect(PARTS.callout.props.safeParse(good).success).toBe(true);
    expect(PARTS.callout.props.safeParse({ ...good, text: "x".repeat(41) }).success).toBe(false);
    expect(PARTS.callout.props.safeParse({ ...good, size: 30 }).success).toBe(false);
    expect(PARTS.callout.props.safeParse({ ...good, color: "white" }).success).toBe(false);
  });

  it("lets a call-out carry a weight of 400 to 900 in hundreds, or none", () => {
    const good = { text: "Right here", font: "tiktok", look: "label", x: 0.5, y: 0.7, size: 84, color: "#111111" };
    expect(PARTS.callout.props.safeParse({ ...good, weight: 600 }).success).toBe(true);
    for (const weight of [650, 300]) {
      const result = PARTS.callout.props.safeParse({ ...good, weight });
      expect(result.success, String(weight)).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join(".")), String(weight)).toEqual(["weight"]);
    }
    const parsed = PARTS.callout.props.safeParse(good);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty("weight");
  });

  it("accepts a progress bar's, a cutaway's and a sound's settings and refuses ones out of range", () => {
    expect(PARTS.progress.props.safeParse({ edge: "top", color: "#ffffff" }).success).toBe(true);
    expect(PARTS.progress.props.safeParse({ edge: "left", color: "#ffffff" }).success).toBe(false);
    expect(PARTS.cutaway.props.safeParse({ fit: "cover", startMs: 0, volume: 0 }).success).toBe(true);
    expect(PARTS.cutaway.props.safeParse({ fit: "cover", startMs: -1, volume: 0 }).success).toBe(false);
    expect(PARTS.sound.props.safeParse({ startMs: 0, volume: 0.6, fadeInMs: 0, fadeOutMs: 120 }).success).toBe(true);
    expect(PARTS.sound.props.safeParse({ startMs: 0, volume: 3, fadeInMs: 0, fadeOutMs: 120 }).success).toBe(false);
  });
});
