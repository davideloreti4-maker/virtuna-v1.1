import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTIONS, EditSchema, ITEM_PARTS, ItemSchema, MARK_PARTS, MarkSchema, NEUTRAL, NO_LOOK, newEdit, newShot, parseEdit, type Edit } from "../doc";
import { PARTS, PART_IDS } from "../parts";
import { fixture, picture, voice } from "./fixture";

/** The paths of everything the schema refuses in a document; empty when it accepts it. */
const refused = (edit: unknown): string[] => {
  const result = EditSchema.safeParse(edit);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};
/** Loose data, as it comes out of `JSON.parse`: a test may put in it what the types forbid. */
type Loose = ReturnType<typeof JSON.parse>;
/** The fixture with a change, as loose data. */
const change = (mutate: (edit: Loose) => void): unknown => {
  const edit: Edit = fixture();
  mutate(edit);
  return edit;
};

/** Settings each part accepts. */
const props = {
  title: { text: "The hook", font: "inter", look: "bold", y: 0.2, size: 96, color: "#ffffff", accent: null },
  callout: { text: "Now", font: "inter", look: "pop", x: 0.5, y: 0.3, size: 96, color: "#ffffff" },
  progress: { edge: "top", color: "#ffffff" },
  cutaway: { fit: "cover", startMs: 0, volume: 0 },
  sound: { startMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0 },
};

describe("the document", () => {
  it("accepts the fixture and gives it back unchanged", () => {
    expect(parseEdit(fixture())).toEqual(fixture());
  });

  it("refuses a key it does not know, at the top and inside", () => {
    expect(refused({ ...fixture(), extra: 1 })).toEqual([""]);
    expect(refused(change((e) => { e.shots[0].glow = true; }))).toEqual(["shots.0"]);
    expect(refused(change((e) => { e.shots[0].frames = 150; }))).toEqual(["shots.0"]); // a shot's frames are worked out, never stored
    expect(refused(change((e) => { e.captions.fonts = "x"; }))).toEqual(["captions"]);
  });

  it("refuses an id with a space, one over 40 characters, and one every object already has", () => {
    expect(refused(change((e) => { e.shots[0].id = "s 1"; }))).toEqual(["shots.0.id"]);
    expect(refused(change((e) => { e.shots[0].id = "x".repeat(41); }))).toEqual(["shots.0.id"]);
    expect(refused(change((e) => { e.shots[0].id = "0f8fad5b-d9cb-469f-a165-70867728950e"; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].id = "constructor"; }))).toEqual(["shots.0.id"]);
    expect(refused(change((e) => { e.assets[0].id = "__proto__"; }))).toEqual(["assets.0.id"]);
  });

  it("refuses an edit with no shot", () => {
    expect(refused(change((e) => { e.shots = []; }))).toEqual(["shots"]);
  });
});

describe("files", () => {
  it("knows three kinds, each with the facts that kind has", () => {
    expect(refused(change((e) => { e.assets.push(picture, voice); }))).toEqual([]);
    expect(refused(change((e) => { e.assets[0].kind = "hologram"; }))).toEqual(["assets.0.kind"]);
    expect(refused(change((e) => { e.assets.push({ ...picture, ms: 0 }); }))).toEqual(["assets.3"]);
    expect(refused(change((e) => { e.assets.push({ ...voice, w: 0 }); }))).toEqual(["assets.3"]);
  });

  it("refuses a clip or a picture with no size, and a clip or a sound with no length", () => {
    expect(refused(change((e) => { e.assets[0].w = 0; }))).toEqual(["assets.0.w"]);
    expect(refused(change((e) => { e.assets.push({ ...picture, h: 0 }); }))).toEqual(["assets.3.h"]);
    expect(refused(change((e) => { e.assets[0].ms = 0; e.assets[0].words = null; }))).toEqual(["assets.0.ms"]);
    expect(refused(change((e) => { e.assets[2].ms = 0; }))).toEqual(["assets.2.ms"]);
  });

  it("refuses a place in storage that climbs out of its folder, and a kit path that is not plain", () => {
    expect(refused(change((e) => { e.assets[0].at = { bucket: "edit-media", path: "u1/../u2/take.mp4" }; }))).toEqual(["assets.0.at.path"]);
    expect(refused(change((e) => { e.assets[2].at = { kit: "../secrets" }; }))).toEqual(["assets.2.at.kit"]);
    expect(refused(change((e) => { e.assets[2].at = { url: "https://example.com/a.wav" }; }))).toEqual(["assets.2.at"]);
  });

  it("refuses a word that ends before it starts, words out of order, a blank word and a word past the end of its file", () => {
    expect(refused(change((e) => { e.assets[0].words[0] = { text: "Hello", startMs: 900, endMs: 600 }; }))).toEqual(["assets.0.words.0.endMs"]);
    expect(refused(change((e) => { e.assets[0].words[1].startMs = 100; }))).toEqual(["assets.0.words.1.startMs"]);
    expect(refused(change((e) => { e.assets[0].words[0].text = "  "; }))).toEqual(["assets.0.words.0.text"]);
    expect(refused(change((e) => { e.assets[0].words[3].endMs = 12701; }))).toEqual(["assets.0.words.3.endMs"]);
    expect(refused(change((e) => { e.assets[0].words[3].endMs = 12700; }))).toEqual([]);
  });

  it("lets a word be hidden or stressed, each said by its presence", () => {
    expect(refused(change((e) => { Object.assign(e.assets[0].words[0], { hidden: true, stress: true }); }))).toEqual([]);
    expect(refused(change((e) => { e.assets[0].words[0].hidden = false; }))).toEqual(["assets.0.words.0.hidden"]);
    expect(refused(change((e) => { e.assets[0].words[0].stress = false; }))).toEqual(["assets.0.words.0.stress"]);
  });
});

describe("marks and items", () => {
  it("refuses a part the kit does not have, and a part where it cannot sit", () => {
    expect(refused(change((e) => { e.items[0].part = "sparkle"; }))).toEqual(["items.0.part"]);
    expect(refused(change((e) => { e.shots[1].marks[0] = { id: "m1", part: "progress", atMs: 8920, lenMs: 740, props: props.progress }; }))).toEqual(["shots.1.marks.0.part"]);
  });

  it("lets each part sit exactly where the kit says it may, with a file exactly when it plays one", () => {
    expect([...MARK_PARTS].sort()).toEqual(PART_IDS.filter((id) => (PARTS[id].where as readonly string[]).includes("shot")).sort());
    expect([...ITEM_PARTS].sort()).toEqual(PART_IDS.filter((id) => (PARTS[id].where as readonly string[]).includes("film")).sort());
    for (const part of PART_IDS) {
      const plays = PARTS[part].plays !== null;
      const mark = { id: "x", part, atMs: 0, lenMs: 500, props: props[part] };
      const item = { id: "x", part, anchor: "start", at: 0, frames: 30, props: props[part] };
      expect(MarkSchema.safeParse(plays ? { ...mark, asset: "broll" } : mark).success, `${part} on a shot`).toBe((MARK_PARTS as readonly string[]).includes(part));
      expect(ItemSchema.safeParse(plays ? { ...item, asset: "broll" } : item).success, `${part} on the film`).toBe((ITEM_PARTS as readonly string[]).includes(part));
      expect(ItemSchema.safeParse(plays ? item : { ...item, asset: "broll" }).success, `${part} with the wrong file field`).toBe(false);
    }
  });

  it("refuses settings the part's own schema refuses, naming the setting", () => {
    expect(refused(change((e) => { e.shots[1].marks[0].props.size = 20; }))).toEqual(["shots.1.marks.0.props.size"]);
    expect(refused(change((e) => { e.shots[1].marks[0].props.font = "comic"; }))).toEqual(["shots.1.marks.0.props.font"]);
    expect(refused(change((e) => { e.shots[1].marks[0].props.glow = true; }))).toEqual(["shots.1.marks.0.props"]);
  });

  it("refuses a part that plays a file and names none, and a part that plays none and names one", () => {
    expect(refused(change((e) => { e.items.push({ id: "c1", part: "cutaway", anchor: "start", at: 30, frames: 60, props: props.cutaway }); }))).toEqual(["items.1.asset"]);
    expect(refused(change((e) => { e.items[0].asset = "broll"; }))).toEqual(["items.0"]);
  });

  it("refuses a mark shorter than a tenth of a second or longer than three minutes, and an item shorter than three frames", () => {
    expect(refused(change((e) => { e.shots[1].marks[0].lenMs = 99; }))).toEqual(["shots.1.marks.0.lenMs"]);
    expect(refused(change((e) => { e.shots[1].marks[0].lenMs = 180001; }))).toEqual(["shots.1.marks.0.lenMs"]);
    expect(refused(change((e) => { e.items[0].frames = 2; }))).toEqual(["items.0.frames"]);
  });

  it("counts an item from the film's start or back from its end, and from nowhere else", () => {
    expect(refused(change((e) => { Object.assign(e.items[0], { anchor: "end", at: 60 }); }))).toEqual([]);
    expect(refused(change((e) => { e.items[0].anchor = "middle"; }))).toEqual(["items.0.anchor"]);
    expect(refused(change((e) => { delete e.items[0].anchor; }))).toEqual(["items.0.anchor"]);
  });
});

describe("shots", () => {
  it("is a stretch of its file that ends after it starts, within an hour", () => {
    expect(refused(change((e) => { e.shots[0].endMs = 0; }))).toEqual(["shots.0.endMs"]);
    expect(refused(change((e) => { Object.assign(e.shots[0], { startMs: 3000, endMs: 2999 }); }))).toEqual(["shots.0.endMs"]);
    expect(refused(change((e) => { e.shots[0].endMs = 4999.5; }))).toEqual(["shots.0.endMs"]);
    expect(refused(change((e) => { e.shots[0].endMs = 3_600_001; }))).toEqual(["shots.0.endMs"]);
  });

  it("refuses a cut that is not one of the seven", () => {
    expect(refused(change((e) => { e.shots[0].out = { kind: "zoom-blur", frames: 10 }; }))).toEqual(["shots.0.out.kind"]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "fade", frames: 1 }; }))).toEqual(["shots.0.out.frames"]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "push", frames: 10 }; }))).toEqual(["shots.0.out.from"]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "push", frames: 10, from: "top" }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "wipe", frames: 10, from: "north" }; }))).toEqual(["shots.0.out.from"]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "punch", frames: 6 }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].out = { kind: "slide", frames: 10, from: "left" }; }))).toEqual(["shots.0.out.kind"]);
  });

  it("accepts a framing that moves, and a part of the move that reaches before its start or past its end, but not one that ends before it starts", () => {
    const move = { to: { zoom: 1.2, x: 0, y: 0 }, ease: "in-out", part: [0, 1] };
    expect(refused(change((e) => { e.shots[0].framing.move = move; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].framing.move = { ...move, part: [0.25, 0.5] }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].framing.move = { ...move, part: [-0.5, 1.5] }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].framing.move = { ...move, part: [0.5, 0.25] }; }))).toEqual(["shots.0.framing.move.part"]);
    expect(refused(change((e) => { e.shots[0].framing.move = { ...move, part: [0, 1001] }; }))).toEqual(["shots.0.framing.move.part.1"]);
    expect(refused(change((e) => { e.shots[0].framing.from.zoom = 0.5; }))).toEqual(["shots.0.framing.from.zoom"]);
  });

  it("gives the film a look always, and a shot a preset of its own or the film's, with adjustments on top", () => {
    expect(refused(change((e) => { e.look = { preset: "warm", adjust: { ...NEUTRAL, exposure: 0.2 } }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].look = { preset: "mono", adjust: NEUTRAL }; }))).toEqual([]);
    expect(refused(change((e) => { e.shots[0].look = { preset: null, adjust: { ...NEUTRAL, exposure: 0.2 } }; }))).toEqual([]);
    expect(refused(change((e) => { e.look = null; }))).toEqual(["look"]);
    expect(refused(change((e) => { e.look = { preset: null, adjust: NEUTRAL }; }))).toEqual(["look.preset"]);
    expect(refused(change((e) => { e.look = { preset: "neon", adjust: NEUTRAL }; }))).toEqual(["look.preset"]);
    expect(refused(change((e) => { e.look = { preset: "warm", adjust: null }; }))).toEqual(["look.adjust"]);
    expect(refused(change((e) => { e.shots[0].look = { preset: "warm", adjust: { ...NEUTRAL, exposure: 3 } }; }))).toEqual(["shots.0.look.adjust.exposure"]);
    expect(NO_LOOK).toEqual({ preset: "natural", adjust: { exposure: 0, warmth: 0, tint: 0, shadows: 0, highlights: 0, contrast: 0, saturation: 0, vibrance: 0 } });
  });

  it("accepts a cover that names a shot and a moment of its file", () => {
    expect(refused(change((e) => { e.cover = { shot: "s2", atMs: 9000 }; }))).toEqual([]);
    expect(refused(change((e) => { e.cover = { shot: "s2", atMs: -1 }; }))).toEqual(["cover.atMs"]);
  });

  it("gives the captions one of the kit's typefaces", () => {
    expect(refused(change((e) => { e.captions.font = "montserrat"; }))).toEqual([]);
    expect(refused(change((e) => { e.captions.font = "comic"; }))).toEqual(["captions.font"]);
  });

  it("lets a caption page hold a whole short sentence, up to 16 words, and no fewer than one (Task K1)", () => {
    for (const maxWords of [1, 6, 12, 16]) expect(refused(change((e) => { e.captions.maxWords = maxWords; })), String(maxWords)).toEqual([]);
    for (const maxWords of [0, 17, 2.5]) expect(refused(change((e) => { e.captions.maxWords = maxWords; })), String(maxWords)).toEqual(["captions.maxWords"]);
  });

  it("lets the captions carry a weight of 400 to 900 in hundreds, or none", () => {
    for (const weight of [400, 500, 600, 700, 800, 900]) expect(refused(change((e) => { e.captions.weight = weight; })), String(weight)).toEqual([]);
    for (const weight of [300, 450, 1000, "600"]) expect(refused(change((e) => { e.captions.weight = weight; })), String(weight)).toEqual(["captions.weight"]);
    expect(parseEdit(fixture()).captions).not.toHaveProperty("weight");
  });
});

describe("new things", () => {
  it("starts a new shot at normal speed and volume, uncropped, still, with a plain cut, no look of its own and no marks", () => {
    expect(newShot({ id: "a", asset: "take", endMs: 3000 })).toEqual({
      id: "a", asset: "take", startMs: 0, endMs: 3000, speed: 1, volume: 1,
      framing: { from: { zoom: 1, x: 0, y: 0 }, move: null },
      look: null, out: { kind: "cut" }, marks: [],
    });
    expect(newShot({ id: "a", asset: "take", startMs: 500, endMs: 3000 }).startMs).toBe(500);
  });

  it("starts a new edit as one shot over the whole take, captions on, no look", () => {
    const take = fixture().assets[0]!;
    const edit = newEdit(take);
    expect(parseEdit(edit)).toEqual(edit);
    expect(edit.shots.map((shot) => [shot.id, shot.asset, shot.startMs, shot.endMs])).toEqual([["s1", "take", 0, 12700]]);
    expect(edit.assets).toEqual([take]);
    expect(edit.items).toEqual([]);
    expect(edit.captions.on).toBe(true);
    expect(edit.look).toEqual(NO_LOOK);
  });

  it("gives a new edit a look and captions of its own, and keeps what new things start from unchangeable", () => {
    const edit = newEdit(picture);
    expect(edit.look).toEqual(NO_LOOK);
    expect(edit.look).not.toBe(NO_LOOK);
    expect(edit.look.adjust).not.toBe(NEUTRAL);
    expect(edit.captions).not.toBe(DEFAULT_CAPTIONS);
    expect(() => { NEUTRAL.exposure = 1; }).toThrow(TypeError);
    expect(() => { NO_LOOK.preset = "warm"; }).toThrow(TypeError);
    expect(() => { DEFAULT_CAPTIONS.on = false; }).toThrow(TypeError);
  });

  it("starts a new edit of a picture as three seconds of it, and of a long clip as its first three minutes", () => {
    expect(newEdit(picture).shots[0]!.endMs).toBe(3000);
    expect(newEdit({ ...fixture().assets[1]!, ms: 600_000 } as never).shots[0]!.endMs).toBe(180_000);
  });

  it("gives the first shot another id when the file has taken s1", () => {
    expect(newEdit({ ...picture, id: "s1" }).shots[0]!.id).toBe("s2");
  });

  it("refuses to start an edit from a sound, or from a clip too short for a shot", () => {
    expect(() => newEdit(voice)).toThrow('"voice" is a sound');
    expect(() => newEdit({ ...fixture().assets[1]!, ms: 80 } as never)).toThrow("shortest shot");
    expect(newEdit({ ...fixture().assets[1]!, ms: 100 } as never).shots[0]!.endMs).toBe(100);
  });
});
