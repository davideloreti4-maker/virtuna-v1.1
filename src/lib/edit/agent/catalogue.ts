/**
 * catalogue.ts — the operations and the kit's parts written out for the model, with every field's
 * type, range and meaning, in a compact text it reads once per request (the agent's system part).
 *
 * The types and ranges are generated: every operation's zod schema is turned into JSON Schema
 * (`z.toJSONSchema`, zod 4) and the JSON Schema into one line of text. So what the model is told
 * and what the door (`applyOps`) accepts are one list and cannot disagree. Shapes used in several
 * places (a framing, a cut, a mark, a part's settings) are written once, by name, and every place
 * whose JSON Schema is the same as a named shape's says the name instead; one whose fields are all
 * optional versions of a shape's says "some of" it.
 *
 * The meanings are written here by hand, one per operation, shape, part and field, from the
 * schemas' own comments and the kit's code. They are the one thing not generated, so
 * `missingMeanings` lists any the schemas have and this file does not, and a test holds it empty.
 *
 * Pure: the same text every time.
 */
import { z } from "zod";
import { Hex } from "../atoms";
import {
  AdjustSchema, CaptionsSchema, CoverSchema, CutSchema, FrameSchema, FramingSchema, IdSchema, ItemSchema, LOOK_IDS, MarkSchema, MoveSchema,
} from "../doc";
import { OpSchema } from "../ops";
import { PARTS, PART_IDS, type PartId, type PartSpec } from "../parts";
import { PAUSE_MS } from "../recipes";
import { FPS } from "../time";
import { ZONES } from "../zones";
import { AROUND_MS, CUT_NEAR_SAYS, ROOM_PROBE, ZOOM, shareDown, shareUp } from "./context";

type Json = z.core.JSONSchema.BaseSchema;
/** A JSON Schema where one may also be `true` or `false`, which no schema of ours gives. */
type Node = z.core.JSONSchema._JSONSchema;

/** The highest and lowest whole numbers JSON Schema gives `int()` when no other bound is set: no bound at all. */
const NO_BOUND = Number.MAX_SAFE_INTEGER;
/** How a type made of one or more fields of a shape is written. */
const SOME = "some of ";

/* ── the meanings ─────────────────────────────────────────────────────────────────────────────── */

/**
 * What each operation does. Every field of the operation (and of a shot it makes) is named in it
 * in backticks, with what it is; `missingMeanings` holds it so.
 */
const OP_MEANINGS: Record<string, string> = {
  "shot.insert": "a new shot, `shot`, after the shot `after` names, or first when `after` is null. `shot.id` is its own new id; it shows `shot.startMs` up to `shot.endMs` of file `shot.asset`. What it does not say starts plain: `shot.speed` 1, `shot.volume` 1, `shot.framing` the whole picture and still, `shot.out` a plain cut, no look of its own and no marks.",
  "shot.split": "two shots from shot `id`, cut at `atMs` of its file; the second piece is `newId` and keeps the marks from `atMs` on. The film does not change.",
  "shot.trim": "the stretch of its file shot `id` shows: a new `startMs`, a new `endMs`, or both; one not given stays.",
  "shot.remove": "takes shot `id` out, with its marks. An edit keeps at least one shot.",
  "shot.move": "shot `id` goes after the shot `after` names, or first when `after` is null.",
  "shot.set": "shot `id`'s `speed`, `volume`, `framing`, or its cut into the next shot, `out`. A new speed keeps the stretch of file, so the shot fills fewer or more frames.",
  "mark.add": "puts `mark`, a part, on shot `shot`, at a moment of its file the shot shows.",
  "mark.set": "mark `id`'s file (`asset`), moment (`atMs`), length (`lenMs`) or settings (`props`). The settings given are laid over the ones it has, and must be its own part's.",
  "mark.remove": "takes mark `id` out.",
  "item.add": "puts `item`, a part, on the film, starting inside it.",
  "item.set": "item `id`'s file (`asset`), place (`anchor`, `at`), length (`frames`) or settings (`props`). The settings given are laid over the ones it has, and must be its own part's.",
  "item.remove": "takes item `id` out.",
  "word.set": "word `index` of take `asset` (its w<index> in the words): its `text`, whether the captions leave it out (`hidden`), or whether they stress it (`stress`: set heavier, and coloured only in plain captions; in the other looks only the word being said is coloured).",
  "captions.set": "the captions' settings given; the others stay.",
  "asset.add": "puts file `id`, one of the files to add, into the edit. Adding a file already in the edit is refused.",
  "asset.remove": "takes file `id` out of the edit; nothing may still use it.",
  "look.set": "the film's look, or with `shot`, what that shot changes of it: a `preset`, and adjustments (`adjust`) laid over the ones there. A shot's preset may be null, for the film's; a shot's adjustments add to the film's.",
  "look.clear": "back to no look for the film, or with `shot`, back to the film's look for that shot.",
  "cover.set": "`cover`, the picture that stands for the video: a moment of a shot that shows, or null for none.",
};

/** What each look preset does, on the film or on a shot. */
const LOOK_MEANINGS: Record<(typeof LOOK_IDS)[number], string> = {
  natural: "as filmed",
  vivid: "more contrast and colour",
  warm: "warmer and a little softer in the highlights",
  cool: "cooler and a little less colour",
  mono: "black and white, a little more contrast",
  soft: "lighter shadows, softer highlights, less contrast and colour",
};

interface Named {
  /** How the catalogue names it. */
  name: string;
  schema: z.ZodType;
  /** What it is; null for a part's settings, which its part's own line says. */
  says: string | null;
  /** What each field means. A field of a few choices names every one (`missingMeanings`). */
  fields: Record<string, string>;
}

const FONT = "the typeface: inter, montserrat or tiktok (TikTok Sans)";

/** The shapes written once and named where they are used, in the order the catalogue lists them. */
const SHAPES: readonly Named[] = [
  {
    name: "Frame", schema: FrameSchema, says: "how a picture is cropped on the stage",
    fields: {
      zoom: "how many times it is enlarged; 1 fills the stage, and then x and y do nothing",
      x: "which part shows across once it is enlarged: -1 its left edge, 0 its middle, 1 its right edge",
      y: "which part shows down: -1 its top, 0 its middle, 1 its bottom",
    },
  },
  {
    name: "Move", schema: MoveSchema, says: "a move of the framing, at an even pace over the shot",
    fields: {
      to: "where the framing ends",
      ease: "how it eases there: linear, in (starts slow), out (ends slow) or in-out (both)",
      part: 'the stretch of the move the shot shows, from its first moment to its last, as two numbers: "part":[0,1] is all of it; before 0 and after 1 the framing holds',
    },
  },
  {
    name: "Framing", schema: FramingSchema, says: "a shot's framing; a punch-in is a zoom on a shot of its own",
    fields: { from: "where it is, or where its move starts", move: "the move, or null for none" },
  },
  {
    name: "Cut", schema: CutSchema, says: "how a shot hands over to the next. The last shot hands over to nothing",
    fields: {
      kind: "cut is plain; the others overlap the two shots by frames: fade cross-fades, push pushes this shot out from a side, wipe wipes over it from a side, punch is a hard cut with a quick push in, iris and clock are an iris and a clock wipe",
      frames: "how many frames the two shots share",
      from: "the side the next shot comes in from: left, right, top or bottom",
    },
  },
  {
    name: "Adjust", schema: AdjustSchema, says: "adjustments on top of a look's preset, each from -1 to 1; 0 changes nothing",
    fields: {
      exposure: "brighter or darker",
      warmth: "warmer (orange) or cooler (blue)",
      tint: "toward magenta or toward green",
      shadows: "lighter or darker shadows",
      highlights: "brighter or softer highlights",
      contrast: "more or less contrast",
      saturation: "more or less colour; -1 is black and white",
      vibrance: "more or less colour where there is least",
    },
  },
  {
    name: "Captions", schema: CaptionsSchema, says: "the captions, one setting for the whole film: what is said, a page at a time",
    fields: {
      on: "whether they show",
      look: "pill: white words on a dark rounded box, the word being said in the highlight colour; pop: white words with a dark outline, the word being said in the highlight colour and popping; highlight: the word being said on a box of the highlight colour; plain: white words with a dark outline, only stressed words coloured. In pill, pop and highlight only the word being said is coloured: a stressed word is set heavier, and coloured only while it is said",
      font: FONT,
      size: "the type size in pixels on the 1080-wide stage; set smaller when the widest word does not fit",
      y: "the caption line's centre, as a share of the stage's height (0 top, 1 bottom)",
      width: "their widest, as a share of the stage's width",
      maxWords: "the most words on one page, up to a whole short sentence in two or three rows",
      highlight: "the colour of the word being said, and in plain of the stressed words; null for white",
      weight: "letters' weight; left out 800; a stressed word one step heavier, up to 900, except in plain with one and highlight null; plain with one sits closer, thinner-edged",
    },
  },
  { name: "Cover", schema: CoverSchema, says: "a moment of a shot", fields: { shot: "the shot", atMs: "the moment, in milliseconds of the shot's file" } },
  {
    name: "Mark", schema: MarkSchema, says: "a part on a shot, at a moment of the shot's file; it follows what is said through every trim, split and move",
    fields: {
      id: "its own id, new in the edit",
      atMs: "the moment of its shot's file it starts at",
      lenMs: "how long it shows, in milliseconds of film, whatever the shot's speed",
      part: "which part: title, callout, cutaway or sound",
      asset: "the file it plays, one of the edit's",
      props: "its part's settings, all of them",
    },
  },
  {
    name: "Item", schema: ItemSchema, says: "a part on the film as a whole",
    fields: {
      id: "its own id, new in the edit",
      anchor: "start: at counts frames from the film's first frame; end: at is how many frames before the film's end it starts, so an end card stays at the end",
      at: "its first frame, counted as anchor says",
      frames: "how many frames it shows; null lasts to the film's end, or to the end of the file it plays",
      part: "which part: title, callout, progress, cutaway or sound",
      asset: "the file it plays, one of the edit's",
      props: "its part's settings, all of them",
    },
  },
];

/** Each part: what it is, and what its settings mean. */
const PART_MEANINGS: Record<PartId, { says: string; fields: Record<string, string> }> = {
  title: {
    says: "the hook: a line or two over the picture, at most three lines",
    fields: {
      text: "its words; words in *asterisks* take the accent colour",
      font: FONT,
      look: "bold: letters with a thin outline and a shadow; label: on a box, dark under light letters, light under dark ones, its accent kept readable on either (coloured letters, or a marker behind the word); outline: with a thick outline",
      y: "its centre, as a share of the stage's height",
      size: "the type size in pixels; set smaller when it does not fit three lines",
      color: "its letters' colour",
      accent: "the colour of words in *asterisks*; null for none",
      weight: "letters' weight; left out 700 for a label, else 800",
    },
  },
  callout: {
    says: "one or two words that land on a moment of the picture, on one line",
    fields: {
      text: "its words",
      font: FONT,
      look: "pop: outlined letters that pop in; label: on a box, dark under light letters, light under dark ones",
      x: "its centre, as a share of the stage's width",
      y: "its centre, as a share of the stage's height",
      size: "the type size in pixels; set smaller when it is wider than the stage",
      color: "its letters' colour",
      weight: "letters' weight; left out 800",
    },
  },
  progress: {
    says: "a thin bar across the stage that fills as the film plays",
    fields: { edge: "the stage's edge it sits on: top or bottom", color: "its colour" },
  },
  cutaway: {
    says: "a clip or a picture in place of the speaker's picture, full frame (contain leaves black around it), while the voice goes on",
    fields: { fit: "cover fills the stage and crops; contain shows all of it", startMs: "where in its own file it starts playing; 0 for a picture", volume: "its own sound's level; 1 is as recorded" },
  },
  sound: {
    says: "a sound: an effect on a moment, or a voice over the film",
    fields: { startMs: "where in its own file it starts playing", volume: "its level; 1 is as recorded", fadeInMs: "how long it fades in", fadeOutMs: "how long it fades out" },
  },
};

const PART_SHAPES: readonly Named[] = PART_IDS.map((part) => ({ name: `${part}.props`, schema: PARTS[part].props, says: null, fields: PART_MEANINGS[part].fields }));

/** Shapes whose JSON Schema is plain enough to stand for by a word: an id, a colour. */
const ATOMS: readonly { name: string; schema: z.ZodType; says: string }[] = [
  { name: "id", schema: IdSchema, says: "1 to 40 of A-Z, a-z, 0-9, _ and -" },
  // A white example (the native default, 2026-11-24): with the house's captions, which have no colour, the model gave call-outs
  // and accents the example's coral as if it were the film's own.
  { name: "#rrggbb", schema: Hex, says: 'a colour, like "#ffffff"' },
];

/* ── the rules ────────────────────────────────────────────────────────────────────────────────── */

/** The moves the code makes for the model (`withMoves`, loop.ts): written by hand, as the loop reads them. */
const MOVES = [
  `pauses.tighten {ms int [${PAUSE_MS.min},${PAUSE_MS.max}]} — a move the code makes for you: every pause the cuts keep longer than \`ms\` is cut down to it, each cut placed in its measured pause. It stands for the trims; send it in ops like any other.`,
  `shot.zoom {id id, zoom [${ZOOM.least},${ZOOM.most}], slow? bool, word? int} — a move the code makes for you: shot \`id\` framed tighter, up to \`zoom\`, with the face held where it is and every text still clear of it; \`slow\` true makes it a slow zoom over the shot, else it is a punch-in; with \`word\`, the index of a word of the shot's take, it starts at the pause before that word (the code splits the shot there), else with the shot. It stands for the shot.set; it is refused, with the reason, where the shot has no room.`,
  `time.cut {fromMs ms, toMs ms} — a move the code makes for you: the film's own time from \`fromMs\` up to \`toMs\` is taken out (0 is the film's start; a \`toMs\` past its end is its end), each end landed on the nearest clean cut within ${CUT_NEAR_SAYS}, so that no word is clipped. It stands for the trims, the splits and the shots taken out; the code adds how much went to your say. It is refused, with where the nearest clean cuts are and the words they follow, when an end has none in reach.`,
  "ends.trim {start? bool, end? bool} — a move the code makes for you: what the film shows before its first word (`start`), after its last (`end`), or both, is cut off, by the rule the pauses are cut by, so a breath stays next to the word. It stands for the trims; it is refused where the film already starts or ends on its words.",
];

/** How every range in the catalogue and the context is written, said once. */
const RANGES = "Ranges: [a,b] has both ends in; [a,b) leaves b out; (a,b] leaves a out; ∞ is no end. array(A, B) is a JSON array of an A and a B; marks=[…] and the like are lists, not ranges.";

const RULES = [
  'Answer only {"say": string, "ops": Op[]}: say is one short sentence to the creator, in English, about what they will see, in their own kind of words, with no pixels, no y, no ids and none of the names this catalogue uses; ops are applied in order, all or none, and an empty list changes nothing.',
  "Shots are cut by file time: a shot's startMs and endMs, and every atMs (shot.split, a mark, the cover), are milliseconds of the shot's own file, never of the film; a part's props.startMs is of the part's own file (where the sound or clip starts playing). Cut in a pause, at its cut@, where one is near.",
  "Word indexes are per take: word.set names the take in asset and the word by its index in that take.",
  'Anything these operations and parts cannot do: a visual effect the looks, cuts and framings do not give (a blur, a glitch, a shake, an overlay graphic with the picture still showing under it), a sticker, an arrow, a sound, a clip or a picture not among the files on offer, music, changing the person or the place they are in (their body, face, age, voice or clothes, or the room: no framing, look or cut changes these). Say so in say and send "ops": [].',
  'No music: there is none to add; asked for music, say so in say and send "ops": [].',
  `Frames are ${FPS} a second: the film, an item's at and frames, a cut's frames and film=…f in the context count them.`,
  "Captions and parts stay clear of the mouth, the eyes and the apps' buttons and bars (below), and a title or a call-out clear of the captions and of every other title or call-out on screen with it; the review checks every frame.",
];

/** The apps' zones from `zones.ts`, each rounded outward, as the review judges by them. */
function zonesLine(): string {
  const APP = { tiktok: "TikTok", instagram: "Instagram" } as const;
  const zones = ZONES.map((zone) => `${APP[zone.app]} ${zone.what} x=[${shareDown(zone.x)},${shareUp(zone.x + zone.w)}] y=[${shareDown(zone.y)},${shareUp(zone.y + zone.h)}]`);
  return `- The apps' buttons and bars, as shares of the stage (x 0 left to 1 right, y 0 top to 1 bottom): ${zones.join("; ")}.`;
}

const CONTEXT = [
  "- film <frames>f: the film's length.",
  "- asset <id> video <ms>ms <w>x<h> sound|silent <origin>, asset <id> image <w>x<h> <origin>, asset <id> audio <ms>ms <origin>: each file in the edit, its length and size; origin is filmed, uploaded, generated or kit.",
  "- shot <id> take=<file> [<startMs>,<endMs>)ms speed=<speed> vol=<volume> film=[<first>,<end>)f look=<preset> marks=[<id>:<part>@<atMs>+<lenMs>,…]: each shot in order: the stretch of its file it shows, its film frames, its own look's preset (- for the film's) and its marks. After them, framing=, out= and adjust= (its look's adjustments, added to the film's) when they are not plain.",
  "- mark <id> film=[<first>,<end>)f asset=<file> props=<settings>: each mark's film frames (film=- when it does not show), the file it plays, if any, and its settings. item <id> <part> anchor=<anchor> at=<at> frames=<frames> film=[<first>,<end>)f asset=<file> props=<settings>: the same for each item.",
  "- captions <setting>=<value> …: the captions. look preset=<preset> adjust=<the adjustments that are not 0, or ->: the film's look. cover shot=<id> atMs=<ms> frame=<n> (frame=- when it does not show), or cover -.",
  "- files: <id> <kind> … <origin> in edit|to add: every file on offer, written as the asset lines: in the edit already, or to add. A shot or a part can use one to add only once asset.add has put it into the edit, which may be in the same answer. A last line … (more files) means more are on offer than are listed; a line no sound on offer, that no sound effect and no music can be added.",
  `- words: per take, under a line take <id>, w<index> <text> [<startMs>,<endMs>), only from ${AROUND_MS / 1000} s before to ${AROUND_MS / 1000} s after what its shots show; (hidden) is left out of the captions, (stressed) is stressed; a last line first w<i> starts <ms>; last w<j> ends <ms> says where the speech listed begins and ends. A take with no words near what is shown has no take line; none (the whole section): no take has.`,
  `- pauses: per take, under a line take <id>, [<startMs>,<endMs>) cut@<cutMs>: a measured silence and its quietest moment, where a cut goes, only from ${AROUND_MS / 1000} s before to ${AROUND_MS / 1000} s after what its shots show. take <id> none: measured, and none found there; take <id> not measured: the take has no analysis; no take shown (the whole section): the shots show only pictures.`,
  "- faces: shot <id>,<id>,… take=<file> face y=[<top>,<bottom>] x=[<left>,<right>] mouth y=[<top>,<bottom>] x=[<left>,<right>]: for the shots of one take framed alike, the boxes that hold the face and the mouth over all of them, in shares of the stage, rounded outward (face - or mouth - where none was found; none where neither was; not measured where the take has no analysis). When the face moves, lines [<fromMs>,<toMs>) face … mouth … under it say the same for each stretch of a second or more; a stretch's times are of the file, and another group's shots, or none, may show part of them. A last line … (faces trimmed) means lines past it were cut to keep the faces short; no take shown (the whole section): the shots show only pictures. The eyes are in the face's upper half.",
  `- room: where things have room, as the review judges it. y is a text's centre, and a range holds every height clear of the eyes, the mouth, the apps' zones and the other texts on all the frames named; none is no height. captions now size <size>, <n> words a page, y=<y>; as they are they have room at y=[<from>,<to>]. Bigger, the largest with a place first: {"size":<size>,"maxWords":<n>,"y":<y>}; …: where the captions, one setting for the whole film, may sit as they are; and each larger size with a place, as the settings captions.set takes, all three together; a sentence Without the title they would also have room at … names heights only a title or a call-out is in the way of. pauses: the cuts keep about <n> ms of pause each: what pauses.tighten cuts down. zoom: shot.zoom may take <id> to <zoom>; <id> (now <zoom>) to <zoom>; <id> no further: how tight each shot may go with every text still clear of the face. film=[<first>,<end>)f shot <id>..<id> w<i>-w<j>: one line y=[<from>,<to>] or [<from>,<to>]; two lines …: for that stretch of the film, the shot it shows (or its first and last) and the words that start in it, where one line (a call-out) and two lines (a title) of size ${ROOM_PROBE.size}, centred, sit clear of the whole face; smaller text has room there too. A text over several stretches needs a y in each one's range. A last line … (room trimmed) means lines past it were cut.`,
  "- findings: <severity> <code> frame=<n> <says>: the errors the review finds in the edit as it is, each with the way to fix it; and, after a change of yours, each warn that change brought (but for a text that only touches an app's bar), a note written without a fix. Clear a warn of yours when a small step does; never by changing what the request did not ask for.",
  "- The stage is 1080 by 1920 pixels; x and y are shares of it.",
];

/* ── the text ─────────────────────────────────────────────────────────────────────────────────── */

/** The catalogue the agent reads: the rules, the operations, the shapes, the parts and how to read the context. */
export function catalogue(): string {
  return catalogueOf(OpSchema.options);
}

/** The catalogue of these operations: each a strict object whose `op` is its name. */
export function catalogueOf(ops: readonly z.ZodType[]): string {
  const writer = new Writer();
  const out: string[] = [RANGES, "", "RULES", ...RULES.map((rule) => `- ${rule}`), zonesLine(), ""];

  out.push(
    "OPERATIONS: each op is a JSON object with \"op\" set to its name and the fields after it, like {\"op\":\"shot.trim\",\"id\":\"s1\",\"endMs\":4200}.",
    `"name? type" may be left out; a|b is either; "int" is a whole number; text≤80 is words up to 80 characters, not blank; ${ATOMS.map((atom) => `${atom.name} is ${atom.says}`).join("; ")}; "some of X" is one or more of X's fields.`,
  );
  for (const op of ops) {
    const { name, rest } = opParts(writer.json(op));
    const [type, meaning] = [writer.type(rest), OP_MEANINGS[name]];
    out.push(`${name} ${type.startsWith("{") ? type : `{${type}}`}${meaning ? ` — ${meaning}` : ""}`);
    if (name === "look.set") out.push(...LOOK_IDS.map((look) => `  ${look}: ${LOOK_MEANINGS[look]}`));
  }
  out.push(...MOVES);

  out.push("", "SHAPES");
  for (const shape of SHAPES) {
    const json = writer.json(shape.schema);
    out.push(`${shape.name} ${writer.type(json, shape.name)}${shape.says ? ` — ${shape.says}` : ""}`, ...fieldLines(json, shape.fields));
  }

  out.push("", "PARTS: a mark is a part on a shot (mark.add), an item a part on the film (item.add).");
  for (const part of PART_IDS) {
    const spec: PartSpec = PARTS[part];
    const [json, name] = [writer.json(spec.props), `${part}.props`];
    const kinds = spec.where.map((where) => (where === "shot" ? "a mark" : "an item")).sort();
    const spills = spec.where.includes("shot") ? `; as a mark it ${spec.spills ? "runs on over the cuts that follow" : "ends when its shot's footage does"}` : "";
    const where = `${capital(kinds.length > 1 ? kinds.join(" or ") : `${kinds[0] ?? "nothing"} only`)}${spills}.`;
    const plays = spec.plays ? ` It plays one of the edit's files (${spec.plays.join(" or ")}), named in asset, from its startMs.` : "";
    out.push(`${part} — ${PART_MEANINGS[part].says}. ${where}${plays}`, `  ${name} ${writer.type(json, name)}`);
    out.push(...fieldLines(json, PART_MEANINGS[part].fields).map((line) => `  ${line}`));
  }

  out.push("", "CONTEXT: each request comes with the edit as it is, in these lines:", ...CONTEXT);
  return out.join("\n");
}

/**
 * The meanings this file lacks for these operations and the shapes, parts and settings it writes,
 * each named: an operation ("shot.spin"), a field of an operation its meaning does not name in
 * backticks ("shot.split.newId", and "shot.insert.shot.id" for a shot it makes), a field of a shape
 * or a part's settings ("Captions.size"), or a choice of a field its meaning does not name
 * ("Cut.kind clock"). An operation whose fields are some of a shape's ("some of Captions") has
 * them checked as that shape's. Empty when every one has a meaning.
 */
export function missingMeanings(ops: readonly z.ZodType[]): string[] {
  const writer = new Writer();
  const missing: string[] = [];
  for (const op of ops) {
    const { name, rest } = opParts(writer.json(op));
    const meaning = OP_MEANINGS[name];
    if (!meaning) {
      missing.push(name);
      continue;
    }
    if (writer.type(rest).startsWith(SOME)) continue;
    for (const [key, field] of Object.entries(rest.properties ?? {})) {
      const inner = schemaOf(field);
      const nested = inner.type === "object" && writer.type(inner).startsWith("{") ? Object.keys(inner.properties ?? {}).map((sub) => `${key}.${sub}`) : [];
      for (const path of [key, ...nested]) if (!meaning.includes(`\`${path}\``)) missing.push(`${name}.${path}`);
    }
  }
  for (const look of LOOK_IDS) if (!LOOK_MEANINGS[look]) missing.push(`look ${look}`);
  for (const shape of [...SHAPES, ...PART_SHAPES]) {
    const json = writer.json(shape.schema);
    for (const key of fieldsOf(json)) {
      const meaning = shape.fields[key];
      if (!meaning) missing.push(`${shape.name}.${key}`);
      else for (const choice of choicesOf(json, key)) if (!names(meaning, choice)) missing.push(`${shape.name}.${key} ${choice}`);
    }
  }
  return missing;
}

/** The choices a field of an object, or of every object of a union, may take: an enum's values, or each one's own constant. */
function choicesOf(json: Json, key: string): string[] {
  const members = json.oneOf ?? json.anyOf ?? [json];
  const fields = members.flatMap((member) => {
    const field = fieldOf(member, key);
    return field ? (field.anyOf ?? [field]) : [];
  });
  const values = fields.flatMap((field) => [...(field.enum ?? []), ...(field.const === undefined ? [] : [field.const])]);
  return [...new Set(values.filter((value): value is string => typeof value === "string"))];
}

/** True when a meaning names a choice as a word of its own. */
const names = (meaning: string, choice: string): boolean => new RegExp(`(^|[^A-Za-z-])${choice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z-]|$)`).test(meaning);

/** An operation's name, and its schema without its `op`. */
function opParts(json: Json): { name: string; rest: Json } {
  const { op: _op, ...fields } = json.properties ?? {};
  return { name: opName(json), rest: { ...json, properties: fields, required: (json.required ?? []).filter((key) => key !== "op") } };
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** A field's meaning on a line of its own, for every field that has one. */
function fieldLines(json: Json, meanings: Record<string, string>): string[] {
  return fieldsOf(json).flatMap((key) => (meanings[key] ? [`  ${key}: ${meanings[key]}`] : []));
}

/** The fields of an object, or of every object of a union, each once, in the order they first come. */
function fieldsOf(json: Json): string[] {
  const members = json.oneOf ?? json.anyOf ?? [json];
  return [...new Set(members.flatMap((member) => Object.keys(member.properties ?? {})))];
}

function opName(json: Json): string {
  const name = fieldOf(json, "op")?.const;
  if (typeof name !== "string") throw new Error(`an operation's schema has no "op" name: ${JSON.stringify(json).slice(0, 200)}`);
  return name;
}

/* ── JSON Schema to one line ──────────────────────────────────────────────────────────────────── */

/** Writes JSON Schema as compact types, naming the shapes and atoms it knows. */
class Writer {
  private readonly named: { name: string; key: string; partial: string | null }[];

  constructor() {
    this.named = [...SHAPES, ...PART_SHAPES, ...ATOMS].map(({ name, schema }) => {
      const json = this.json(schema);
      return { name, key: keyOf(json), partial: json.type === "object" ? keyOf(withoutRequired(json)) : null };
    });
  }

  /** A schema's JSON Schema, as the model writes it in (zod's "input"), without the `$schema` line. */
  json(schema: z.ZodType): Json {
    const { $schema: _schema, ...json } = z.toJSONSchema(schema, { io: "input" });
    return json;
  }

  /** A JSON Schema as a type. `self` is the shape being written, which is not named by itself. */
  type(node: Node, self: string | null = null): string {
    const json = schemaOf(node);
    const named = this.nameOf(json, self);
    if (named) return named;
    const members = json.oneOf ?? json.anyOf;
    if (members) return this.union(members);
    if (json.const !== undefined) return JSON.stringify(json.const);
    if (json.enum) return json.enum.map((value) => (typeof value === "string" ? value : JSON.stringify(value))).join("|");
    switch (json.type) {
      case "null":
        return "null";
      case "boolean":
        return "bool";
      case "integer":
        return `int ${rangeOf(json)}`.trimEnd();
      case "number":
        return rangeOf(json) || "number";
      case "string":
        return textOf(json);
      case "array":
        if (json.prefixItems) return `array(${json.prefixItems.map((item) => this.type(item)).join(", ")})`;
        if (json.items && !Array.isArray(json.items) && typeof json.items === "object") return `[${this.type(json.items)}]`;
        break;
      case "object":
        return this.object(json);
    }
    throw new Error(`the catalogue cannot write this schema: ${JSON.stringify(json).slice(0, 200)}`);
  }

  private nameOf(json: Json, self: string | null): string | null {
    const [key, partial] = [keyOf(json), json.type === "object" && (json.required ?? []).length === 0 ? keyOf(withoutRequired(json)) : null];
    for (const shape of this.named) {
      if (shape.name === self) continue;
      if (shape.key === key) return shape.name;
      if (partial !== null && shape.partial === partial) return `${SOME}${shape.name}`;
    }
    return null;
  }

  private object(json: Json): string {
    const required = new Set(json.required ?? []);
    const fields = Object.entries(json.properties ?? {}).map(([key, value]) => `${key}${required.has(key) ? "" : "?"} ${this.type(value)}`);
    return `{${fields.join(", ")}}`;
  }

  /**
   * A union. Objects that share fields (the same name, type and need) are written as those fields
   * and one of the rest: {id id, atMs …} & ({part "title", …} | …). "some of" several shapes is
   * written as some of them all.
   */
  private union(members: readonly Json[]): string {
    const [first, ...others] = members;
    const objects = first !== undefined && others.length > 0 && members.every((member) => member.type === "object");
    const shared = objects ? Object.keys(first.properties ?? {}).filter((key) => others.every((other) => sameField(first, other, key))) : [];
    if (first && shared.length > 0) {
      const rest = members.map((member) => this.object(only(member, (key) => !shared.includes(key))));
      return `${this.object(only(first, (key) => shared.includes(key)))} & (${rest.join(" | ")})`;
    }
    const types = members.map((member) => this.type(member));
    if (types.length > 1 && types.every((type) => type.startsWith(SOME))) return SOME + types.map((type) => type.slice(SOME.length)).join("|");
    return types.join(objects ? " | " : "|");
  }
}

/** A JSON Schema that is an object, as every one of ours is. */
function schemaOf(node: Node): Json {
  if (typeof node === "boolean") throw new Error(`the catalogue cannot write the schema ${node}: every field has a type`);
  return node;
}

/** The schema of an object's field; undefined when it has none of that name. */
function fieldOf(json: Json, key: string): Json | undefined {
  const field = json.properties?.[key];
  return field === undefined ? undefined : schemaOf(field);
}

/** A JSON Schema's identity: its keys sorted, at every depth. */
function keyOf(json: unknown): string {
  return JSON.stringify(json, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : value,
  );
}

function withoutRequired(json: Json): Json {
  const { required: _required, ...rest } = json;
  return rest;
}

const needs = (json: Json, key: string): boolean => (json.required ?? []).includes(key);
/** True when two objects have a field of that name, of one type, that both need or neither does. */
const sameField = (a: Json, b: Json, key: string): boolean => {
  const [x, y] = [fieldOf(a, key), fieldOf(b, key)];
  return x !== undefined && y !== undefined && keyOf(x) === keyOf(y) && needs(a, key) === needs(b, key);
};

/** An object schema with only the fields `keep` keeps. */
function only(json: Json, keep: (key: string) => boolean): Json {
  return {
    ...json,
    properties: Object.fromEntries(Object.entries(json.properties ?? {}).filter(([key]) => keep(key))),
    required: (json.required ?? []).filter(keep),
  };
}

/** A number's range, as RANGES says: [44,200], (0,1], [0,∞). Empty when it has none. */
function rangeOf(json: Json): string {
  const bound = (value: number | undefined) => (value === undefined || Math.abs(value) >= NO_BOUND ? undefined : value);
  const [min, max] = [bound(json.minimum), bound(json.maximum)];
  const [above, below] = [json.exclusiveMinimum, json.exclusiveMaximum].map((value) => (typeof value === "number" ? value : undefined));
  if ([min, max, above, below].every((value) => value === undefined)) return "";
  const low = above !== undefined ? `(${above}` : min !== undefined ? `[${min}` : "(-∞";
  const high = below !== undefined ? `${below})` : max !== undefined ? `${max}]` : "∞)";
  return `${low},${high}`;
}

/** A string: words up to a length, or a string of a pattern no atom names. */
function textOf(json: Json): string {
  if (json.pattern === "\\S" && json.maxLength !== undefined) return `text≤${json.maxLength}`;
  const length = json.maxLength !== undefined ? `≤${json.maxLength}` : "";
  return json.pattern ? `string${length} /${json.pattern}/` : `string${length}`;
}
