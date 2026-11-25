/**
 * match.test.ts — the five marks of the style match (Task 13b): the route's field-by-field match grouped into Pace, Captions,
 * Title, Zooms and Look, and the one line a mark opens. The fields are in the shape `matchOf` gives (`src/lib/edit/style/match.ts`).
 */
import { describe, expect, it } from "vitest";
import { lineOf, marksOf, notInKit, type Field } from "../match";

const field = (name: string, target: string, actual: string, verdict: Field["verdict"] = "matched"): Field => ({ field: name, target, actual, verdict });

/** A first cut in a preset: all as asked but the title, moved down a little. */
const PRESET: Field[] = [
  field("pace.pauseMs", "320 ms", "320 ms"),
  field("captions.on", "on", "on"),
  field("captions.look", "pill", "pill"),
  field("captions.font", "inter", "inter"),
  field("captions.size", "68 px", "68 px"),
  field("captions.y", "0.76", "0.76"),
  field("captions.maxWords", "4", "4"),
  field("captions.highlight", "none", "none"),
  field("title", "3.0 s at 0.18", "3.0 s at 0.22"),
  field("title.y", "0.18", "0.22", "near"),
  field("title.frames", "3.0 s", "3.0 s"),
  field("title.look", "label", "label"),
  field("title.size", "110 px", "110 px"),
  field("punchIns", "none", "none"),
  field("look.preset", "natural", "natural"),
];

/** A first cut from words: the captions smaller and lower, and fewer zooms than asked. */
const WORDS: Field[] = [
  field("pace.pauseMs", "150 ms", "150 ms"),
  field("captions.on", "on", "on"),
  field("captions.size", "96 px", "82 px", "near"),
  field("captions.y", "0.72", "0.74", "near"),
  field("title", "2.5 s at 0.2", "2.5 s at 0.2"),
  field("punchIns", "14 a minute at 1.2", "5.54 a minute at 1.2"),
  field("punchIns.perMin", "14 a minute", "5.54 a minute", "not"),
  field("punchIns.zoom", "1.2", "1.2"),
  field("look.preset", "natural", "natural"),
];

const verdicts = (fields: Field[]) => Object.fromEntries(marksOf(fields).map((mark) => [mark.label, mark.verdict]));
const line = (fields: Field[], label: string) => lineOf(marksOf(fields).find((mark) => mark.label === label)!);

describe("marksOf", () => {
  it("gives the five marks in the design's order", () => {
    expect(marksOf(PRESET).map((mark) => mark.label)).toEqual(["Pace", "Captions", "Title", "Zooms", "Look"]);
  });

  it("matches a group when all its fields are, and holds it near when one is only near", () => {
    expect(verdicts(PRESET)).toEqual({ Pace: "matched", Captions: "matched", Title: "near", Zooms: "matched", Look: "matched" });
  });

  it("does not match a group when any of its fields is not, whatever the others are", () => {
    expect(verdicts(WORDS)).toEqual({ Pace: "matched", Captions: "near", Title: "matched", Zooms: "not", Look: "matched" });
    expect(verdicts([field("captions.size", "96 px", "82 px", "near"), field("captions.look", "pill", "pop", "not")])).toEqual({ Captions: "not" });
  });

  it("reads a reference's pace from its quiet share and its cuts", () => {
    const marks = marksOf([field("pace.quiet", "0.12", "0.15", "near"), field("pace.cutsPerMin", "20 a minute", "20 a minute")]);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ label: "Pace", verdict: "near" });
  });

  it("leaves out a group the match says nothing of, and a field of no group", () => {
    expect(marksOf([field("look.preset", "mono", "mono"), field("sound.level", "-14", "-14", "not")]).map((mark) => mark.label)).toEqual(["Look"]);
    expect(marksOf([])).toEqual([]);
  });
});

describe("lineOf", () => {
  it("says a matched group is as asked", () => {
    expect(line(PRESET, "Pace")).toBe("Pace: as asked.");
    expect(line(PRESET, "Captions")).toBe("Captions: as asked.");
  });

  it("says what was asked and what was placed, for a place", () => {
    expect(line(PRESET, "Title")).toBe("Title: asked 0.18 from the top, placed at 0.22.");
  });

  it("tells each field that is not as asked, and none that is", () => {
    expect(line(WORDS, "Captions")).toBe("Captions: asked 96 px, set at 82 px; asked 0.72 from the top, placed at 0.74.");
  });

  it("rounds a rate to one place", () => {
    expect(line(WORDS, "Zooms")).toBe("Zooms: asked 14 a minute, made 5.5.");
  });

  it("names a look in plain words", () => {
    expect(line([field("look.preset", "mono", "natural", "not")], "Look")).toBe("Look: asked for black and white, set to natural.");
  });

  it("says which side has a title, or zooms, when only one does", () => {
    expect(line([field("title", "2.5 s at 0.2", "none", "not")], "Title")).toBe("Title: asked for one, there is none.");
    expect(line([field("title", "none", "2.5 s at 0.2", "not")], "Title")).toBe("Title: asked for none, there is one.");
    expect(line([field("punchIns", "8 a minute at 1.15", "none", "not")], "Zooms")).toBe("Zooms: asked for some, there are none.");
  });

  it("tells a pace in seconds, and a quiet share in percent", () => {
    expect(line([field("pace.pauseMs", "320 ms", "250 ms", "not")], "Pace")).toBe("Pace: asked for pauses of 0.32 s, kept at 0.25 s.");
    expect(line([field("pace.quiet", "0.12", "0.15", "near")], "Pace")).toBe("Pace: asked for 12 % quiet, came to 15 %.");
    expect(line([field("pace.quiet", "0.12", "none", "not")], "Pace")).toBe("Pace: asked for 12 % quiet, came to none.");
  });

  it("never shows a colour's code", () => {
    expect(line([field("captions.highlight", "#ffe14a", "#4ade80", "near")], "Captions")).toBe("Captions: the highlight is another colour.");
    expect(line([field("captions.highlight", "#ffe14a", "none", "not")], "Captions")).toBe("Captions: asked for a highlight colour, there is none.");
    expect(line([field("captions.highlight", "none", "#ffe14a", "not")], "Captions")).toBe("Captions: asked for no highlight colour, there is one.");
  });

  it("says whether a title stays to the end", () => {
    expect(line([field("title.stays", "to the end", "not to the end", "not")], "Title")).toBe("Title: asked to stay to the end, it leaves before.");
    expect(line([field("title.stays", "not to the end", "to the end", "not")], "Title")).toBe("Title: asked to leave before the end, it stays.");
  });

  it("tells a field it does not know as asked and got", () => {
    expect(line([field("captions.shadow", "soft", "hard", "not")], "Captions")).toBe("Captions: asked soft, got hard.");
  });

  it("tells at most two fields, and that there are more", () => {
    const many = [field("captions.size", "96 px", "82 px", "near"), field("captions.y", "0.72", "0.74", "near"), field("captions.maxWords", "3", "4", "near"), field("captions.font", "tiktok", "inter", "not")];
    expect(line(many, "Captions")).toBe("Captions: asked 96 px, set at 82 px; asked 0.72 from the top, placed at 0.74; and 2 more.");
  });
});

describe("notInKit", () => {
  it("lists what the kit cannot draw, or says nothing", () => {
    expect(notInKit(["emoji", "clips cut in"])).toBe("Not in the kit yet: emoji, clips cut in.");
    expect(notInKit([])).toBeNull();
  });
});
