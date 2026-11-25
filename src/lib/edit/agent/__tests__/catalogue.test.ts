import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CAPTION_LOOKS, CUT_KINDS, CaptionsSchema, IdSchema, LOOK_IDS } from "../../doc";
import { OP_NAMES, OpSchema } from "../../ops";
import { FONTS, PARTS, PART_IDS } from "../../parts";
import { ZONES } from "../../zones";
import { catalogue, catalogueOf, missingMeanings } from "../catalogue";
import { NO_SOUND, ROOM_PROBE, ZOOM } from "../context";
import { EndsSchema, TightenSchema, TimeCutSchema, ZoomSchema } from "../loop";
import { PAUSE_MS } from "../../recipes";

const text = catalogue();
const text80 = () => z.string().max(80);
const lines = text.split("\n");

/** The one line that starts with `start`. */
function lineOf(start: string): string {
  const found = lines.filter((line) => line.startsWith(start));
  expect(found, `one line starting with ${JSON.stringify(start)}`).toHaveLength(1);
  return found[0] ?? "";
}

/**
 * How a setting is written, read from the zod schema itself (not from its JSON Schema): its name,
 * then its range or its choices, as the catalogue writes them.
 */
function written(key: string, schema: z.ZodType): string {
  let inner: z.ZodType = schema;
  let [nullable, optional] = [false, false];
  for (;;) {
    if (inner instanceof z.ZodNullable) nullable = true;
    else if (inner instanceof z.ZodOptional) optional = true;
    else break;
    inner = (inner as z.ZodNullable<z.ZodType> | z.ZodOptional<z.ZodType>).unwrap() as z.ZodType;
  }
  let type: string;
  if (inner instanceof z.ZodNumber) type = `${inner.isInt ? "int " : ""}[${inner.minValue},${inner.maxValue}]`;
  else if (inner instanceof z.ZodEnum) type = inner.options.join("|");
  else if (inner instanceof z.ZodLiteral) type = [...inner.values].join("|");
  else if (inner instanceof z.ZodString) type = inner.maxLength === null ? "#rrggbb" : `text≤${inner.maxLength}`;
  else if (inner instanceof z.ZodBoolean) type = "bool";
  else throw new Error(`the test does not know how ${key} is written`);
  return `${key}${optional ? "?" : ""} ${type}${nullable ? "|null" : ""}`;
}

describe("catalogue", () => {
  it("names every operation, each on a line of its own with what it does", () => {
    for (const name of OP_NAMES) expect(lineOf(`${name} {`)).toMatch(/\} — \S/);
    // And the four moves the code makes for the model (Task 14, 14b), written as the loop reads them.
    expect(lines.filter((line) => /^[a-z]+\.[a-z]+ \{/.test(line))).toHaveLength(OP_NAMES.length + 4);
    expect(lineOf("ends.trim {")).toMatch(/^ends\.trim \{start\? bool, end\? bool\} — a move the code makes for you: what the film shows before its first word \(`start`\), after its last \(`end`\), or both, is cut off/);
    expect(EndsSchema.safeParse({ op: "ends.trim", end: true }).success && EndsSchema.safeParse({ op: "ends.trim", start: true, end: true }).success).toBe(true);
    expect(EndsSchema.safeParse({ op: "ends.trim" }).success || EndsSchema.safeParse({ op: "ends.trim", start: false }).success || EndsSchema.safeParse({ op: "ends.trim", end: true, ms: 100 }).success).toBe(false);
    expect(lineOf("time.cut {")).toMatch(/^time\.cut \{fromMs ms, toMs ms\} — a move the code makes for you: the film's own time from `fromMs` up to `toMs` is taken out .* each end landed on the nearest clean cut within one second, so that no word is clipped\./);
    expect(TimeCutSchema.safeParse({ op: "time.cut", fromMs: 0, toMs: 1000 }).success).toBe(true);
    expect(TimeCutSchema.safeParse({ op: "time.cut", fromMs: -1, toMs: 1000 }).success || TimeCutSchema.safeParse({ op: "time.cut", fromMs: 0 }).success).toBe(false);
    expect(lineOf("shot.zoom {")).toBe(`shot.zoom {id id, zoom [${ZOOM.least},${ZOOM.most}], slow? bool, word? int} — a move the code makes for you: shot \`id\` framed tighter, up to \`zoom\`, with the face held where it is and every text still clear of it; \`slow\` true makes it a slow zoom over the shot, else it is a punch-in; with \`word\`, the index of a word of the shot's take, it starts at the pause before that word (the code splits the shot there), else with the shot. It stands for the shot.set; it is refused, with the reason, where the shot has no room.`);
    expect(ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: 1.2, word: 0 }).success).toBe(true);
    expect(ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: 1.2, word: 1.5 }).success).toBe(false);
    // One least for the zoom, in the schema, on this line and in the search (`ZOOM.least`): the review of Task 14 found 1.05 here and 1.08 there.
    expect(ZOOM.least).toBe(1.08);
    expect(ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: ZOOM.least }).success && ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: ZOOM.most, slow: true }).success).toBe(true);
    expect(ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: 1.07 }).success || ZoomSchema.safeParse({ op: "shot.zoom", id: "s1", zoom: ZOOM.most + 0.01 }).success || ZoomSchema.safeParse({ op: "shot.zoom", zoom: 1.2 }).success).toBe(false);
    expect(lineOf("pauses.tighten {")).toBe(`pauses.tighten {ms int [${PAUSE_MS.min},${PAUSE_MS.max}]} — a move the code makes for you: every pause the cuts keep longer than \`ms\` is cut down to it, each cut placed in its measured pause. It stands for the trims; send it in ops like any other.`);
    expect(TightenSchema.safeParse({ op: "pauses.tighten", ms: PAUSE_MS.min }).success && TightenSchema.safeParse({ op: "pauses.tighten", ms: PAUSE_MS.max }).success).toBe(true);
    expect(TightenSchema.safeParse({ op: "pauses.tighten", ms: PAUSE_MS.min - 1 }).success || TightenSchema.safeParse({ op: "pauses.tighten", ms: PAUSE_MS.max + 1 }).success).toBe(false);
  });

  it("names every part and each of its settings, with the ranges and choices of its schema", () => {
    for (const part of PART_IDS) {
      const kinds = PARTS[part].where.length > 1 ? "A mark or an item" : PARTS[part].where[0] === "film" ? "An item only" : "A mark only";
      expect(lineOf(`${part} — `)).toContain(`. ${kinds}`);
      const props = lineOf(`  ${part}.props {`);
      const shape = (PARTS[part].props as z.ZodObject).shape as Record<string, z.ZodType>;
      for (const [key, schema] of Object.entries(shape)) expect(props).toContain(written(key, schema));
    }
    // The examples a reader checks by eye.
    expect(lineOf("  title.props {")).toContain("size [48,220]");
    expect(lineOf("  callout.props {")).toContain("size [44,200]");
    expect(lineOf("  sound.props {")).toContain("fadeInMs int [0,5000]");
    expect(lineOf("  title.props {")).toContain("weight? 400|500|600|700|800|900");
    expect(lineOf("  callout.props {")).toContain("weight? 400|500|600|700|800|900");
    // A part's weight line: the title's, then the call-out's.
    expect(lines.filter((line) => line.startsWith("    weight: "))).toEqual(["    weight: letters' weight; left out 700 for a label, else 800", "    weight: letters' weight; left out 800"]);
  });

  it("writes the captions' settings with their ranges, and captions.set as some of them", () => {
    const captions = lineOf("Captions {");
    expect(captions).toContain("size [44,200]");
    expect(captions).toContain("maxWords int [1,16]");
    expect(captions).toContain("width (0,1]");
    for (const [key, schema] of Object.entries(CaptionsSchema.shape)) {
      if (key !== "width") expect(captions).toContain(written(key, schema));
    }
    expect(lineOf("captions.set {")).toMatch(/^captions\.set \{some of Captions\} — /);
    expect(captions).toContain("weight? 400|500|600|700|800|900");
    expect(lineOf("  weight: ")).toBe("  weight: letters' weight; left out 800; a stressed word one step heavier, up to 900, except in plain with one and highlight null; plain with one sits closer, thinner-edged");
  });

  it("says a page may hold a whole short sentence in two or three rows, and a label's box follows its letters (Task K1)", () => {
    expect(lineOf("  maxWords: ")).toBe("  maxWords: the most words on one page, up to a whole short sentence in two or three rows");
    // The title's label and the call-out's: the box is dark under light letters and light under dark ones; color decides.
    const labels = lines.filter((line) => line.startsWith("    look: ") && line.includes("label: "));
    expect(labels).toHaveLength(2);
    for (const line of labels) expect(line).toContain("label: on a box, dark under light letters, light under dark ones");
    // Fix rounds 1 and 2: an accent that would not read on its box is drawn as a marker behind the word; the title's label says so.
    expect(lineOf("    look: bold: ")).toContain("label: on a box, dark under light letters, light under dark ones, its accent kept readable on either (coloured letters, or a marker behind the word)");
  });

  it("names every look, every cut kind, every caption look and every font", () => {
    const presets = LOOK_IDS.join("|");
    expect(lineOf("look.set {")).toContain(`preset? ${presets}|null`);
    for (const look of LOOK_IDS) expect(text).toMatch(new RegExp(`^  ${look}: \\S`, "m"));
    const cut = lineOf("Cut ");
    for (const kind of CUT_KINDS) expect(cut).toContain(`kind "${kind}"`);
    expect(lineOf("Captions {")).toContain(`look ${CAPTION_LOOKS.join("|")}`);
    for (const look of CAPTION_LOOKS) expect(text).toContain(`${look}: `);
    expect(lineOf("Captions {")).toContain(`font ${FONTS.join("|")}`);
  });

  it("writes the shared shapes once and names them where they are used", () => {
    expect(lineOf("shot.set {")).toContain("framing? Framing, out? Cut");
    expect(lineOf("mark.add {")).toContain("mark Mark");
    expect(lineOf("item.add {")).toContain("item Item");
    expect(lineOf("look.set {")).toContain("adjust? some of Adjust");
    expect(lineOf("cover.set {")).toContain("cover Cover|null");
    expect(lineOf("mark.set {")).toContain("props? some of title.props|callout.props|progress.props|cutaway.props|sound.props");
    expect(lineOf("Mark {")).toContain('{id id, atMs int [0,3600000], lenMs int [100,180000]} & ({part "title", props title.props} | ');
    expect(lineOf("word.set {")).toContain("index int [0,∞)");
    expect(lineOf("Framing {")).toContain("{from Frame, move Move|null}");
    expect(lineOf("Move {")).toContain("part array([-1000,1000], [-1000,1000])");
  });

  it("carries the rules the model must keep, each on one line", () => {
    const rules = [
      'Answer only {"say": string, "ops": Op[]}',
      "Shots are cut by file time",
      "Word indexes are per take",
      'Anything these operations and parts cannot do: a visual effect the looks, cuts and framings do not give (a blur, a glitch, a shake, an overlay graphic with the picture still showing under it), a sticker, an arrow, a sound, a clip or a picture not among the files on offer, music, changing the person or the place they are in (their body, face, age, voice or clothes, or the room: no framing, look or cut changes these). Say so in say and send "ops": []',

      'No music: there is none to add; asked for music, say so in say and send "ops": []',
      "Frames are 30 a second",
      "Captions and parts stay clear of the mouth, the eyes and the apps' buttons",
    ];
    for (const rule of rules) expect(lines.filter((line) => line.includes(rule)), rule).toHaveLength(1);
    const cut = lineOf("- Shots are cut by file time");
    expect(cut).toContain("a shot's startMs and endMs, and every atMs (shot.split, a mark, the cover), are milliseconds of the shot's own file, never of the film");
    expect(cut).toContain("a part's props.startMs is of the part's own file (where the sound or clip starts playing)");
    expect(cut).toContain("in a pause, at its cut@, where one is near");
  });

  it("refuses nothing the parts, cuts, looks and framings do: the refusal never names a sound effect, a fade or a zoom", () => {
    const refusal = lineOf("- Anything these operations and parts cannot do");
    // The sound part's own words: "an effect on a moment".
    expect(lineOf("sound — ")).toContain("an effect on a moment");
    for (const word of ["an effect", "sound effect", "whoosh", "fade", "zoom", "transition", "colour", "caption", "title"]) expect(refusal, word).not.toContain(word);
    expect(refusal).toContain("a visual effect the looks, cuts and framings do not give (a blur, a glitch, a shake, an overlay graphic with the picture still showing under it)");
    expect(refusal).toContain("a sound, a clip or a picture not among the files on offer");
    // A logo over the video is a cutaway: it takes the speaker's place, full frame.
    expect(lineOf("cutaway — ")).toContain("a clip or a picture in place of the speaker's picture, full frame (contain leaves black around it), while the voice goes on");
    expect(lineOf("asset.add {")).toContain("puts file `id`, one of the files to add, into the edit. Adding a file already in the edit is refused.");
  });

  it("says where every one of the apps' buttons and bars is, from the zones review judges by", () => {
    const zones = lineOf("- The apps' buttons and bars");
    for (const zone of ZONES) expect(zones).toContain(zone.what);
    // TikTok's right-side buttons, rounded outward: x 916 to 1058 px of 1080, y 576 to 1737 of 1920.
    expect(zones).toContain("TikTok right-side buttons x=[0.84,0.98] y=[0.30,0.91]");
  });

  it("says how to read every line of the context, in the one range notation", () => {
    expect(lineOf("Ranges: ")).toBe("Ranges: [a,b] has both ends in; [a,b) leaves b out; (a,b] leaves a out; ∞ is no end. array(A, B) is a JSON array of an A and a B; marks=[…] and the like are lists, not ranges.");
    expect(text).not.toMatch(/\d–-?\d/);
    const faces = lineOf("- faces: ");
    expect(faces).toContain("shot <id>,<id>,… take=<file> face y=[<top>,<bottom>] x=[<left>,<right>] mouth y=[<top>,<bottom>] x=[<left>,<right>]: for the shots of one take framed alike");
    expect(faces).toContain("rounded outward (face - or mouth - where none was found; none where neither was; not measured where the take has no analysis)");
    expect(faces).toContain("a stretch's times are of the file, and another group's shots, or none, may show part of them");
    expect(faces).toContain("A last line … (faces trimmed) means lines past it were cut to keep the faces short; no take shown (the whole section): the shots show only pictures");
    expect(lineOf("- files: ")).toContain("<id> <kind> … <origin> in edit|to add: every file on offer, written as the asset lines");
    expect(lineOf("- files: ")).toContain("only once asset.add has put it into the edit");
    expect(lineOf("- files: ")).toContain("A last line … (more files) means more are on offer than are listed; a line no sound on offer, that no sound effect and no music can be added.");
    expect(lineOf("- files: ")).toContain(NO_SOUND);
    expect(lineOf("- words: ")).toContain("a last line first w<i> starts <ms>; last w<j> ends <ms> says where the speech listed begins and ends");
    expect(lineOf("- room: ")).toContain("pauses: the cuts keep about <n> ms of pause each: what pauses.tighten cuts down.");
    expect(lineOf("- room: ")).toContain("zoom: shot.zoom may take <id> to <zoom>; <id> (now <zoom>) to <zoom>; <id> no further: how tight each shot may go with every text still clear of the face.");
    expect(lineOf("- words: ")).toContain("per take, under a line take <id>, w<index> <text> [<startMs>,<endMs>)");
    expect(lineOf("- pauses: ")).toContain("per take, under a line take <id>, [<startMs>,<endMs>) cut@<cutMs>");
    expect(lineOf("- words: ")).toContain("A take with no words near what is shown has no take line; none (the whole section): no take has.");
    expect(lineOf("- pauses: ")).toContain("take <id> none: measured, and none found there; take <id> not measured: the take has no analysis; no take shown (the whole section): the shots show only pictures");
    // The guide's lines come in the context's own order.
    const order = ["- film ", "- asset ", "- shot ", "- mark ", "- captions ", "- files: ", "- words: ", "- pauses: ", "- faces: ", "- room: ", "- findings: "].map((start) => lines.findIndex((line) => line.startsWith(start)));
    expect(order.every((at) => at >= 0)).toBe(true);
    // Task 14: where a text has room, and the two kinds of finding.
    const room = lineOf("- room: ");
    expect(room).toContain('captions now size <size>, <n> words a page, y=<y>; as they are they have room at y=[<from>,<to>]. Bigger, the largest with a place first: {"size":<size>,"maxWords":<n>,"y":<y>}; …');
    expect(room).toContain("as the settings captions.set takes, all three together");
    expect(room).toContain("film=[<first>,<end>)f shot <id>..<id> w<i>-w<j>: one line y=[<from>,<to>] or [<from>,<to>]; two lines …");
    expect(room).toContain(`of size ${ROOM_PROBE.size}, centred, sit clear of the whole face`);
    expect(room).toContain("none is no height");
    expect(room).toContain("A last line … (room trimmed) means lines past it were cut.");
    expect(lineOf("- findings: ")).toContain("the errors the review finds in the edit as it is, each with the way to fix it; and, after a change of yours, each warn that change brought (but for a text that only touches an app's bar), a note written without a fix.");
    expect(lineOf("- findings: ")).toContain("never by changing what the request did not ask for");
    expect(text).toContain("say is one short sentence to the creator, in English, about what they will see, in their own kind of words, with no pixels, no y, no ids and none of the names this catalogue uses");
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(lineOf("- asset ")).toContain("asset <id> video <ms>ms <w>x<h> sound|silent <origin>, asset <id> image <w>x<h> <origin>, asset <id> audio <ms>ms <origin>");
    expect(lineOf("- mark ")).toContain("film=- when it does not show");
    expect(lineOf("- shot ")).toContain("adjust= (its look's adjustments, added to the film's)");
    expect(lineOf("- pauses: ")).toContain("only from 2 s before to 2 s after what its shots show.");
    expect(lineOf("- words: ")).toContain("only from 2 s before to 2 s after what its shots show");
    expect(lineOf("look.set {")).toContain("a shot's adjustments add to the film's");
  });

  it("gives a colour's form by a white example, so no colour of its own is offered as a default (the native default)", () => {
    expect(catalogue()).toContain('a colour, like "#ffffff"');
    expect(catalogue()).not.toContain("#ff6363");
  });

  it("is generated: another operation in the list changes the text", () => {
    expect(catalogueOf(OpSchema.options)).toBe(text);
    const spin = z.strictObject({ op: z.literal("shot.spin"), id: IdSchema, turns: z.number().int().min(1).max(9) });
    const more = catalogueOf([...OpSchema.options, spin]);
    expect(more).not.toBe(text);
    expect(more).toMatch(/^shot\.spin \{id id, turns int \[1,9\]\}$/m);
    expect(missingMeanings([...OpSchema.options, spin])).toEqual(["shot.spin"]);
    // A field its operation's meaning does not name.
    const why = z.strictObject({ op: z.literal("shot.remove"), id: IdSchema, why: text80() });
    expect(missingMeanings([why])).toEqual(["shot.remove.why"]);
  });

  it("has a meaning for every operation, shape, part and setting", () => {
    expect(missingMeanings(OpSchema.options)).toEqual([]);
  });

  it("is the same every time, and compact", () => {
    expect(catalogue()).toBe(text);
    // 18,000 since Task K1 (it was 17,000): pages of a whole sentence and the label's light box are said in it, and it stood at
    // 16,950 after them. 19,500 since Task 14: how to read the room (the captions, the pauses, the framings, the stretches), a
    // warning as a note, the moves pauses.tighten and shot.zoom, and what changing the speaker means (about 2,700 more).
    // 21,000 since Task 14b: the moves time.cut and ends.trim (about 900 more). 21,100 since the call-out's weight
    // (2026-11-24): it stood at 20,958, and at 21,033 with the weight in callout.props and its line.
    expect(text.length).toBeLessThan(21_100);
  });
});
