/**
 * spec.test.ts — what is and is not an EditSpec.
 *
 * Unknown keys are an error everywhere. A typo in a stored document or in an operation's payload
 * has to be refused, not dropped: a dropped key is a change that silently did not happen.
 */
import { describe, expect, it } from "vitest";
import { EditSpecSchema, IdSchema, parseEditSpec, type Word } from "../spec";
import { fixture } from "./fixture";

describe("parseEditSpec", () => {
  it("reads the fixture back unchanged", () => {
    expect(parseEditSpec(JSON.parse(JSON.stringify(fixture())))).toEqual(fixture());
  });

  it("refuses an unknown key anywhere", () => {
    const top = { ...fixture(), extra: 1 };
    expect(EditSpecSchema.safeParse(top).success).toBe(false);
    const deep = fixture();
    (deep.main[0] as unknown as Record<string, unknown>).colour = "red";
    expect(EditSpecSchema.safeParse(deep).success).toBe(false);
  });

  it("refuses a segment shorter than three frames, a speed out of range and a colour that is not hex", () => {
    const short = fixture();
    short.main[0]!.len = 2;
    expect(EditSpecSchema.safeParse(short).success).toBe(false);
    const fast = fixture();
    fast.main[0]!.speed = 5;
    expect(EditSpecSchema.safeParse(fast).success).toBe(false);
    const colour = fixture();
    colour.captions.style.color = "white";
    expect(EditSpecSchema.safeParse(colour).success).toBe(false);
  });

  it("names the kit it was made with, and refuses none or a kit it does not know", () => {
    expect(EditSpecSchema.safeParse({ ...fixture(), kit: "v1" }).success).toBe(true);
    const none: Record<string, unknown> = { ...fixture() };
    delete none.kit;
    expect(EditSpecSchema.safeParse(none).success).toBe(false);
    expect(EditSpecSchema.safeParse({ ...fixture(), kit: "v2" }).success).toBe(false);
  });

  it("refuses an edit with no segment, and a version it does not know", () => {
    expect(EditSpecSchema.safeParse({ ...fixture(), main: [] }).success).toBe(false);
    expect(() => parseEditSpec({ ...fixture(), v: 2 })).toThrow(/version 2/);
  });

  it("refuses an id every object already has, as an id and as a record key, and reads ordinary ids", () => {
    const reserved = Object.getOwnPropertyNames(Object.prototype); // __proto__, constructor, toString, ...
    expect(reserved).toEqual(expect.arrayContaining(["__proto__", "constructor", "toString", "hasOwnProperty"]));
    expect(reserved.filter((id) => IdSchema.safeParse(id).success)).toEqual([]);
    /* as a key: JSON.parse makes "__proto__" an own key, as a stored document or a request body would */
    for (const id of ["__proto__", "constructor", "toString"]) {
      const asset = JSON.stringify({ ...fixture().assets.photo, id });
      const assets = JSON.parse(JSON.stringify(fixture()).replace('"assets":{', `"assets":{"${id}":${asset},`));
      expect(EditSpecSchema.safeParse(assets).success, `assets.${id}`).toBe(false);
      const fixes = JSON.parse(JSON.stringify(fixture()).replace('"fixes":{', `"fixes":{"${id}":{"0":"x"},`));
      expect(EditSpecSchema.safeParse(fixes).success, `captions.fixes.${id}`).toBe(false);
    }
    const word = JSON.parse(JSON.stringify(fixture()).replace('"fixes":{"take":{', '"fixes":{"take":{"__proto__":"x",'));
    expect(EditSpecSchema.safeParse(word).success, "captions.fixes.take.__proto__").toBe(false);
    expect(["s1", "take", "a-b_9", "proto", "__proto", "Constructor", "toString2"].filter((id) => !IdSchema.safeParse(id).success)).toEqual([]);
  });

  it("refuses a kit path that leaves the kit folder, and reads the kit's own paths", () => {
    const reads = (kit: string): boolean => {
      const spec = fixture();
      spec.assets.kick!.at = { kit };
      return EditSpecSchema.safeParse(spec).success;
    };
    const outside = ["sfx/../x", "sfx/../../../../etc/passwd", "a/..//..", "sfx//kick.m4a", "sfx/", "./sfx/kick.m4a", "/sfx/kick.m4a"];
    expect(outside.filter(reads)).toEqual([]);
    const inside = ["sfx/kick.m4a", "wipes/swipe-blur.html", "fonts/inter-latin-wght.woff2", "text.html"];
    expect(inside.filter((kit) => !reads(kit))).toEqual([]);
  });

  it("refuses a storage path that is not plain segments, and reads ordinary paths", () => {
    const stored = (path: string): boolean => {
      const spec = fixture();
      spec.assets.take!.at = { bucket: "takes", path };
      return EditSpecSchema.safeParse(spec).success;
    };
    const bad = ["../x", "u1/../x", "u1/..", "..", ".", "./x", "u1/./x", "/u1/take.mov", "u1//take.mov", "u1/", "u1\\take.mov", "..\\x"];
    expect(bad.filter(stored)).toEqual([]);
    const good = ["u1/take.mov", "take.mov", "a/b/c.d", "u1/..take.mov", "u1/.x", "u1/take name (1).mov"];
    expect(good.filter((path) => !stored(path))).toEqual([]);
  });

  it("refuses a correction keyed by a word number not written plainly: the compiler would never apply it", () => {
    const keyed = (key: string): boolean => {
      const spec = fixture();
      spec.captions.fixes.take = { [key]: "x" };
      return EditSpecSchema.safeParse(spec).success;
    };
    expect(["016", "00", "-1", "1.0", "1e3", " 1", "1000000"].filter(keyed)).toEqual([]);
    expect(["0", "16", "19", "999999"].filter((key) => !keyed(key))).toEqual([]);
  });

  it("refuses words that end before they start, or start before the word before them", () => {
    const transcript = (words: Word[]): boolean => {
      const spec = fixture();
      spec.assets.take!.words = words;
      return EditSpecSchema.safeParse(spec).success;
    };
    expect(transcript([{ t0: 500, t1: 400, text: "back" }])).toBe(false);
    expect(transcript([{ t0: 0, t1: 400, text: "a" }, { t0: 300, t1: 600, text: "b" }, { t0: 200, t1: 700, text: "c" }])).toBe(false);
    /* a word may start where the one before it starts, overlap it, or last no time */
    expect(transcript([{ t0: 0, t1: 400, text: "a" }, { t0: 0, t1: 300, text: "b" }, { t0: 200, t1: 200, text: "c" }])).toBe(true);
    expect(transcript(fixture().assets.take!.words!)).toBe(true);
  });
});
