/**
 * loop.ts — the agent's change (part 3, §6): a creator's request made on their edit in seconds.
 *
 * One Qwen answer a round, `{say, ops}`. The door (`applyOps`, all or none, then `checkEdit`) and `review` judge it:
 * - an answer that is not that JSON, ops the door refuses, or an error `review` finds that the edit did not have before (X93),
 *   go back word for word as the next round's message, with the edit as it was;
 * - an empty list of ops is an answer that changes nothing (the catalogue asks for it when a request cannot be done);
 * - an accepted answer becomes the edit. When it added or moved something seen, its stills are drawn by the worker and shown to
 *   the model once (X85), which may answer with one repair, judged the same way and not drawn again.
 * At most three rounds in all, and none once the deadline has passed (X89); a call that fails is asked again after a moment.
 * A change is never half made: the answer is the last edit accepted, or the edit as it was, and when nothing was accepted the
 * creator is told why in plain words.
 *
 * The edit and the sentence are judged apart (the last correction, 2026-11-24). The door and the review judge the edit, and
 * nothing about `say` undoes an edit they took or spends a round, with one exception and its bound: an answer whose own say
 * contradicts its ops (`contradicts`) is sent back once in a change, never on the last round, because that is the one say
 * fault that is evidence about the edit. When the rounds are over the say is checked once (`sayFault`): if it cannot be
 * shown, the model is asked once for the sentence alone, told why; if that fails too, or time is short, the code writes it
 * from the two edits (`saidOf`), or, with nothing changed, its own plain line of why. So a change is at most three rounds
 * and one more call.
 *
 * The model reads the catalogue (system) and the context (`contextOf`) with the files on offer (`library`), which are the same
 * files the door lets `asset.add` take, and, when the video was paused on a frame (`at`), that moment (`momentBlock`) above the
 * request. A request with a moment that names no other place is about it, "here" or not (S17): a thing the answer adds on the
 * film's first frame starts on the moment (`offTheStart`, S15), a start set near it is held on it (`codeMoves`, `snapToMoment`),
 * and a zoom of its shot, the answer's only one, starts there (`withMoves`, `zoomHere`); an end near it is held only for a
 * request that points ("here"). An end card too short to read is made readable, moment or not (`readableEnds`). Every call is
 * logged with its rounds, tokens, cost and time, never with the edit's words or its files' addresses.
 */
import { z } from "zod";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { createLogger } from "@/lib/logger";
import type { Analyses } from "../analysis";
import type { Problem } from "../check";
import { captionFrames, layout, placed, runWords } from "../derive";
import { IdSchema, type Asset, type Captions, type Edit } from "../doc";
import { OpsSchema, applyOps, type Applied, type Op } from "../ops";
import { PAUSE_MS, tighten } from "../recipes";
import { review, type Finding } from "../review";
import { stillsOf } from "../worker/stills";
import { ZOOM, aboutCaptions, calloutVoice, captionsFit, captionsHint, captionsWorse, contextOf, effectOf, endsTrim, labelGivesWay, pauseBefore, pieceId, plainHighlight, roomFor, saidOf, sameAs, stressShows, timeCut, unquoted, zoomFor, type GaveWay } from "./context";
import { askQwen, type Ask, type Asked, type Message } from "./model";
import { endsAsked, momentAgain, momentBlock, momentFor, namesAnotherPlace, offTheStart, pointsAt, snapToMoment, startedSay, zoomHere, type Moment } from "./moment";
import { SAYS, closingMessage, refusedMessage, requestMessage, reviewedMessage, sayAgainMessage, stillsMessage, systemPrompt, unreadableMessage, type Drawn } from "./prompt";

const log = createLogger({ module: "edit.agent" });

/**
 * The agent's limits (X89): three rounds; a change stops at 50 s and a first cut at 170 s (the routes' own `maxDuration` is 60
 * and 180). Thinking and the token budget are set from Task 14's measures (X88). Thinking is off: on the same eight requests,
 * three runs each, it took a change from a median of 8.8 s to 25.9 s (with stills 9.3 s to 32.8 s), six runs of twenty-four
 * ran into the 50 s and ended with no answer, and the rest answered as with it off but for two runs. 4,000 tokens are a rail,
 * not a lever (`docs/MODEL-POLICY.md`): the longest answer measured was 181 tokens for a change and 91 for a first cut, and no
 * call was cut short; with thinking on a call wrote up to 2,667, since thinking counts toward the budget.
 */
export const AGENT_LIMITS: { readonly rounds: 3; readonly changeMs: 50_000; readonly firstCutMs: 170_000; readonly maxTokens: number; readonly thinking: boolean; readonly look: boolean } = {
  rounds: 3,
  changeMs: 50_000,
  firstCutMs: 170_000,
  maxTokens: 4000,
  thinking: false,
  /**
   * The model's look at a change that is seen: stills from the worker, then one more answer. Off (X115, Task 14b): of 86 looks
   * over two full runs, 75 answered "no change", 3 sent again what was set, 7 could not be used and 1 took back a zoom nobody
   * had asked for; none made an edit better, and a look cost about 7 of a seen change's 10 s. A change that is seen is judged as
   * an unseen one is: by the door, the review and the measures of what it did (`effectOf`), which the model is still told of,
   * with `undo`, when it cut or brought back words or took a part out. The stills route stays, for the creator's eyes.
   */
  look: false,
};

/** The most stills a change is shown: the worker's own limit. */
const MOST_STILLS = 6;
/** How many frames a part takes to come in (a call-out pops in over 12, a title over 10): it is drawn once it has. */
const SETTLE = 12;
/** How many frames into the first word said the captions are drawn: a word pops in over 8. */
const CAPTION_SETTLE = 8;

/**
 * What a say must not hold (the role's rule, kept here: Task 14): a size in pixels ("90 pixels", "90px", "90 Pixel"), a length
 * in milliseconds ("160 ms"; every time since the final review, not once as a kit word) or a height as the edit counts it
 * ("y=0.21"). The model was told twice and still wrote them, in 6 of 15 answers. One of the say's checks (`sayFault`): it
 * was the answer's schema, and cost a right change its round.
 */
const MEASURES = /\b\d+(?:\.\d+)?\s?(?:px|pixels?|ms|milliseconds?|millisekunden|millisecondi)\b|\by\s?=\s?\d/i;

/**
 * The kit's own words in a say that the creator did not use (Task 14, the say): a preset, a look by its name, an operation, a
 * mark, an item, a shot's id, pixels, milliseconds. A say is about what the creator will see, so the proof counts these and
 * such a say is not shown to the creator (`sayFault`); a word the request itself used is the creator's own ("the pill style"). Each
 * is named once, in this order.
 */
const KIT_TERMS: readonly (readonly [string, RegExp])[] = [
  ["preset", /\bpresets?\b/i],
  ["mono", /\bmono\b/i],
  ["pop", /\bpop\b/i],
  ["pill", /\bpill\b/i],
  // "op", "operation", or an operation by its name ("shot.zoom").
  ["op", /\bops?\b|\boperations?\b|\b[a-z]{3,}\.[a-z]{3,}\b/i],
  ["mark", /\bmarks?\b/i],
  ["item", /\bitems?\b/i],
  ["shot id", /\bs\d+(?:-[a-z]+\d*)*\b/i],
  ["px", /\bpx\b|\bpixels?\b|\d+px\b/i],
  ["ms", /\d\s?ms\b|\bmilliseconds?\b/i],
];
export function kitTerms(say: string, request: string): string[] {
  return KIT_TERMS.filter(([, word]) => word.test(say) && !word.test(request)).map(([name]) => name);
}

/**
 * A say as an answer is read: whatever was sent, as text. Nothing about the sentence makes an answer unreadable (a say that
 * is missing, blank, endless or in the kit's numbers is `sayFault`'s to tell, once the edit is settled).
 */
const SaySchema = z.string().catch("");

/** The say-only call's answer: the sentence; ops, which it is asked to leave empty, are not looked at and need not be there. */
const ClosingSchema: z.ZodType<{ say: string }> = z.object({ say: SaySchema });

/** The model's answer: one sentence for the creator, and the operations, as sent; the door reads them. */
export const AnswerSchema: z.ZodType<{ say: string; ops: unknown[] }> = z.object({
  say: SaySchema,
  ops: z.array(z.unknown()).max(200),
});

/**
 * True when a say tells the creator that something was changed (Task 14b, ruling 1): "I've added…", "Moved…", "…is now…",
 * "…has been removed", "…are moved higher", "It's … now." Not "I couldn't move…", "I have made no changes", "I kept them where
 * they are". The loop knows whether anything changed; when nothing did, a say that claims a change is not the creator's to
 * read (`sayFault`). On the second take the closing say claimed a change that was not made, 4 of 4 ("the whole video is now
 * 1.25 times faster"). English only, and a say is English or it is not taken (X120).
 */
const DID = "added|adjusted|applied|changed|cut|increased|lowered|made|moved|placed|put|raised|reduced|removed|replaced|set|shortened|slowed|sped|stressed|switched|tightened|trimmed|turned|updated|zoomed";
const CLAIMS: readonly RegExp[] = [
  new RegExp(`\\b(?:I|we)(?:'ve|’ve| have)?\\s+(?:also\\s+|just\\s+|now\\s+)?(?:${DID})\\b(?!\\s+(?:no|nothing|none)\\b)`, "i"),
  new RegExp(`^(?:${DID})\\b(?!\\s+(?:no|nothing|none)\\b)`, "i"),
  new RegExp(`\\b(?:has|have)\\s+been\\s+(?:${DID})\\b`, "i"),
  new RegExp(`(?<!\\b(?:nothing|none|no\\s+\\w+)\\s)\\b(?:is|are)\\s+(?:now\\s+)?(?:${DID})\\b`, "i"),
  /\b(?:is|are|it's|it’s|they're|they’re)\s+now\b|\bnow\s+(?:says|reads|shows|has|have|in|on|off)\b|\bnow[.!]?$/i,
];
export const claimsChange = (say: string): boolean => CLAIMS.some((claim) => claim.test(say.trim()));
/**
 * True when a say is not in English (X120, the final review): in this part the say is English whatever the request's
 * language, because the checks on it (`claimsChange`, `contradicts`, the kit's words) and the code's own parts of it are
 * English; a German or Italian sentence passed them unread or got English joined on. Told, outside what the say quotes, by
 * the words German and Italian sentences are made with and English ones are not, and by any letter English does not write:
 * more of those than of English's own small words. (A one-word say in another language with neither is not told.)
 */
const FOREIGN = /\b(?:der|das|und|ist|sind|nicht|ich|habe|wurde|wurden|wird|jetzt|eine|einen|einem|auf|zum|zur|kann|kein|keine|dein|deine|untertitel|mehr|oben|unten|il|gli|che|sono|ho|hai|nel|nella|della|delle|dei|ora|adesso|tuo|tua|tuoi|sottotitoli)\b|(?![\p{ASCII}])\p{L}/giu;
const ENGLISH = /\b(?:the|is|are|and|your|you|of|to|it|now|not|cannot|there|with|that|this|has|have|will|would|but|they|them|can|could|from|for)\b/gi;
export function notEnglish(say: string): boolean {
  const plain = unquoted(say);
  return (plain.match(FOREIGN)?.length ?? 0) > (plain.match(ENGLISH)?.length ?? 0);
}
/** Said back to a say that is not in English. */
const NOT_ENGLISH = "your say is not in English: in this part say is English whatever language the request is in. Say the same in English";

/** Said back to a say that claims a change where none was made. */
const NOTHING_CHANGED = "your say tells the creator of a change, and nothing was changed: the edit is as it was. Say what could not be done and what would work instead, and claim nothing";
/** Said back to a say that names the kit's own words. */
const kitRefusal = (terms: readonly string[]): string =>
  `your say names ${terms.map((term) => `"${term}"`).join(", ")}: the editing kit's own words, which the creator did not use. Say it in the creator's own kind of words, about what they will see ("${SAYS[0]}")`;

export interface AgentInput {
  /** The creator's edit, already parsed (the route parses it first: `contextOf` refuses an edit that is not valid). */
  edit: Edit;
  /** What the worker measured of the edit's takes, by asset id. */
  analyses: Analyses;
  /** The creator's request, in their own words. */
  request: string;
  /** The files on offer besides the edit's own (the kit's, the creator's other takes): the context's and the door's. */
  library: readonly Asset[];
  /** The signed-in creator, whose takes the stills are drawn from (X63). */
  user: string;
  /** When the change must stop, as `now()` counts (`Date.now()` unless told). */
  deadlineMs: number;
  /** False: no stills at all. */
  stills?: boolean;
  /** The film frame of `edit` the video was paused on; left out when the request has none. */
  at?: number;
}

/**
 * What became of a round's answer: `changed`, accepted and applied; `no change`, accepted with no ops; `refused` by the door;
 * `review`, the edit it made has an error it did not have before; `unreadable`, not the JSON asked; `no answer`, the call
 * failed; `chosen`, a first cut's choices, read (`first-cut.ts`); `undone`, the change before it taken back, after the model
 * was told what it did (Task 14); `said`, the sentence of the one call that asks for it alone, taken (when it is not, that
 * round is `refused` with the say's fault).
 */
export type Outcome = "changed" | "no change" | "refused" | "review" | "unreadable" | "no answer" | "chosen" | "undone" | "said";

export interface Round {
  n: number;
  /** The ops the answer sent, as sent; none when it could not be read. */
  ops: unknown[];
  /** The door's problems; null when it let the ops through, or was not asked. */
  refused: Problem[] | null;
  /** What `review` found in the edit the ops made; none when the door refused them or was not asked. */
  findings: Finding[];
  /** The frames drawn after this round and shown to the model. */
  stills: number[];
  /** The whole round: the answer, the door, the review and its stills. */
  ms: number;
  tokens: { input: number; output: number };
  outcome: Outcome;
  /** The model's call alone. */
  askMs: number;
  /** The stills' call alone; 0 when none was made. */
  stillsMs: number;
  /** Why the answer was not taken, when it could not be read or the call failed; else null. */
  error: string | null;
  /** Why the stills could not be drawn; null when they were, or none were asked. */
  stillsError: string | null;
}

export interface AgentResult {
  /**
   * The creator's sentence (`sayBy` tells whose): the model's, when it can be shown (`sayFault`), with the code's own part
   * of a change joined to it; else the code's, of what changed (`saidOf`) or, with nothing changed, of why (`couldNot`). The
   * rounds keep the door's problems and the review's findings as they were.
   */
  say: string;
  /** The ops of every accepted round, in order. */
  ops: Op[];
  /** The last edit accepted, or the edit as it was. */
  edit: Edit;
  /** What `review` finds in that edit. */
  findings: Finding[];
  rounds: Round[];
  ms: number;
  /** In cents (`calculateCost`), each call priced on its own. */
  cost: number;
  tokens: { input: number; output: number };
  /** True when a round changed the edit. */
  changed: boolean;
  /** Whose sentence `say` is: the model's as its answer had it, the model's when asked again for the sentence alone, or the code's. */
  sayBy: SayBy;
}
export type SayBy = "model" | "model, asked again" | "code";

export interface AgentDeps {
  ask?: Ask;
  stills?: typeof stillsOf;
  now?: () => number;
  /** Waits this long before asking again after a call that failed (`setTimeout` unless told). */
  wait?: (ms: number) => Promise<void>;
}

/** The least time left for the one call that asks for the sentence alone to be worth making. */
const CLOSING_MS = 2000;
/** Said with a repair when the answer to it is the last. */
const LAST = 'This is your last answer: when you are not sure it passes, send "ops": [] and say what could not be done and what would work.';
/** Said when an answer framed a shot by hand and a text then lay on the face. */
const BY_HAND = "Frame a shot with shot.zoom, never by hand: it holds the face where it is and keeps every text clear of it, or says why it cannot.";
/** A message's text, its pictures left out. */
const textOf = (message: Message | undefined): string => (!message ? "" : typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n"));
/** True when an answer's ops name a file to add or to play: a refusal of them says that no file can be made up. */
const namesFile = (ops: readonly unknown[]): boolean => ops.some((op) => {
  const sent = typeof op === "object" && op !== null ? (op as { op?: unknown; mark?: { part?: unknown }; item?: { part?: unknown } }) : null;
  const part = sent?.mark?.part ?? sent?.item?.part;
  return sent?.op === "asset.add" || part === "sound" || part === "cutaway";
});

/** How long to wait before asking again after a failed call: 1 s, then 2 s; never past the deadline. */
const RETRY_MS = 1000;

/**
 * Why nothing changed, in words the creator reads: the role's rule for `say` (no ids, no files, no milliseconds or frames).
 * The door's problems and the review's findings name all of those; the rounds keep them as they are.
 */
const PLAIN = {
  time: "I ran out of time",
  "no answer": "the editing service did not answer",
  unreadable: "something went wrong on my side",
  refused: "what I tried is not possible on this video",
  undone: "what I tried was not what you asked for",
} as const;
/** The review's errors, as the reason a change was not made. */
const PLAIN_FINDING: Partial<Record<Finding["code"], string>> = {
  "on-face": "it would cover your face",
  "under-buttons": "it would sit under the app's buttons or bars",
  "on-text": "it would cover other words on screen",
  "text-fits": "the text would not fit on the screen",
  "two-titles": "two titles would show at once",
  "cut-outside-pause": "a cut would land in the middle of your words",
  "empty-start": "the video would start on an empty frame",
};
const couldNot = (why: string | null): string => (why === null ? "I couldn't make that change." : `I couldn't make that change: ${why}.`);

/**
 * A move the code makes for the model (N8: the craft is in code; Task 14): `{"op":"pauses.tighten","ms":n}` stands for the
 * operations `tighten` gives at that pause, each cut placed in its measured pause. Asked to cut the pauses shorter, the model
 * trimmed by hand: 2 runs of 3 changed nothing, and the third made the film longer.
 */
export const TightenSchema: z.ZodType<{ op: "pauses.tighten"; ms: number }> = z.strictObject({
  op: z.literal("pauses.tighten"),
  ms: z.number().int().min(PAUSE_MS.min).max(PAUSE_MS.max),
});

/**
 * The other move (fix round 2): `{"op":"shot.zoom","id":…,"zoom":n,"slow":bool}` stands for the `shot.set` that frames the shot
 * tighter with the face held where it is and every text still clear of it (`zoomFor`): still, a punch-in; `slow`, a move over
 * the shot. Asked to punch in or to zoom slowly, the model wrote framings by hand: the first cut's title covered the eyes, or
 * it gave one shot another's framing; 0 of 9 as asked.
 */
export const ZoomSchema: z.ZodType<{ op: "shot.zoom"; id: string; zoom: number; slow?: boolean | undefined; word?: number | undefined }> = z.strictObject({
  op: z.literal("shot.zoom"),
  id: IdSchema,
  zoom: z.number().min(ZOOM.least).max(ZOOM.most),
  slow: z.boolean().optional(),
  /** The word of the shot's take the zoom is to start at: the code splits the shot in the pause before it (fix round 3). */
  word: z.number().int().min(0).optional(),
});

/**
 * The third move (Task 14b): `{"op":"time.cut","fromMs":a,"toMs":b}` takes the film's time from a to b out, each end landed on
 * the nearest clean cut within a second (`timeCut`), and the say is given how much went.
 */
export const TimeCutSchema: z.ZodType<{ op: "time.cut"; fromMs: number; toMs: number }> = z.strictObject({
  op: z.literal("time.cut"),
  fromMs: z.number().min(0),
  toMs: z.number().min(0),
});

/**
 * The fourth move (Task 14b, the controller's ruling): `{"op":"ends.trim","start":bool,"end":bool}` cuts off what the film
 * shows before its first word, after its last, or both (`endsTrim`): the model says only which end.
 */
export const EndsSchema: z.ZodType<{ op: "ends.trim"; start?: boolean | undefined; end?: boolean | undefined }> = z
  .strictObject({ op: z.literal("ends.trim"), start: z.boolean().optional(), end: z.boolean().optional() })
  .refine((ends) => ends.start === true || ends.end === true, "names no end");

const MOVES = ["pauses.tighten", "shot.zoom", "time.cut", "ends.trim"];

/**
 * A `word.set` that gives a word a new text keeps the punctuation the old one closed with (Task 14b, ruling 3): asked to write
 * one word for another that closed a sentence, the model sent the bare word, 3 of 3, and the captions ran two sentences together. Only when the
 * new text closes with none of its own.
 */
export function withPunctuation(edit: Edit, ops: readonly unknown[]): unknown[] {
  return ops.map((op) => {
    const sent = typeof op === "object" && op !== null ? (op as { op?: unknown; asset?: unknown; index?: unknown; text?: unknown }) : null;
    if (sent?.op !== "word.set" || typeof sent.text !== "string" || typeof sent.index !== "number") return op;
    const clip = edit.assets.find((asset) => asset.id === sent.asset);
    const old = clip?.kind === "video" ? clip.words?.[sent.index]?.text : undefined;
    const closing = old === undefined ? null : /[.,!?:;]+$/.exec(old.trim())?.[0];
    const text = sent.text.trimEnd();
    return closing && text !== "" && !/[.,!?:;…]$/.test(text) ? { ...sent, text: `${text}${closing}` } : op;
  });
}

/** An item counted from the end that runs to the end and starts this few frames before it is too short to read: 0.8 s. */
const READ_LEAST = 24;
/** Where such an item is put instead: two seconds before the end. */
const READ_AT = 60;

/**
 * An end card that cannot be read is not made (S17 (5)): an item counted back from the film's end whose `at` (how many frames
 * before the end it starts) is under its own `frames` starts that long before the end instead, and so runs to the end; one with
 * no `frames` (to the end) and `at` under `READ_LEAST` starts `READ_AT` before it. Asked for an end card, the model sent `at` 0
 * (refused by the door) and then 3 with `frames` 90, in 2 runs of 3: a card on screen for 3 frames. Read against the item as the
 * ops before it leave it, the edit's own or one this answer added. With or without a moment; every other op as sent.
 */
export function readableEnds(edit: Edit, ops: readonly unknown[]): unknown[] {
  type Place = { anchor: unknown; at: unknown; frames: unknown };
  const items = new Map<string, Place>(edit.items.map((item) => [item.id, { anchor: item.anchor, at: item.at, frames: item.frames }]));
  /** The `at` that reads, for an item placed so. */
  const readable = ({ anchor, at, frames }: Place): unknown =>
    anchor !== "end" || typeof at !== "number" ? at : frames === null ? (at < READ_LEAST ? READ_AT : at) : typeof frames === "number" && at < frames ? frames : at;
  return ops.map((op) => {
    const sent = typeof op === "object" && op !== null ? (op as { op?: unknown; id?: unknown; item?: unknown }) : null;
    if (sent?.op === "item.add" && typeof sent.item === "object" && sent.item !== null) {
      const item = sent.item as Place & { id?: unknown };
      const at = readable(item);
      if (typeof item.id === "string") items.set(item.id, { ...item, at });
      return at === item.at ? op : { ...sent, item: { ...item, at } };
    }
    if (sent?.op === "item.set" && typeof sent.id === "string") {
      const was = items.get(sent.id);
      if (!was) return op;
      const set = sent as Partial<Place>;
      const now: Place = { anchor: set.anchor ?? was.anchor, at: set.at ?? was.at, frames: set.frames !== undefined ? set.frames : was.frames };
      const at = readable(now);
      items.set(sent.id, { ...now, at });
      return at === now.at ? op : { ...sent, at };
    }
    if (sent?.op === "item.remove" && typeof sent.id === "string") items.delete(sent.id);
    return op;
  });
}

/**
 * An answer's ops with each move made: in order, on the edit the ops before it give. Any other op is passed on as it is, for
 * the door. A move that cannot be read, or that has nothing to do, is refused as the door refuses, with what to send instead.
 * With `here`, the moment a request points at (slice B, Task 3): a zoom of the shot that moment is on, in the edit the ops
 * before it give (the moment is the take's, found again there: S11), is the zoom here (`zoomHere`), from the moment and not
 * from the shot's cut; the word it names, if any, is not looked at.
 */
export function withMoves(edit: Edit, analyses: Analyses, ops: readonly unknown[], library: readonly Asset[], here: Moment | null = null): { ok: true; ops: unknown[]; says: string[] } | Extract<Applied, { ok: false }> {
  const made: unknown[] = [];
  /** What the code has to tell of a move it made, for the end of the say's sentence. */
  const says: string[] = [];
  for (const [i, op] of ops.entries()) {
    const name = typeof op === "object" && op !== null ? (op as { op?: unknown }).op : undefined;
    if (typeof name !== "string" || !MOVES.includes(name)) {
      made.push(op);
      continue;
    }
    const refuse = (message: string): Extract<Applied, { ok: false }> => ({ ok: false, problems: [{ path: `ops.${i}`, id: null, message }] });
    // On the edit as the ops before it leave it: when those do not pass the door, the door says why.
    const before = made.length > 0 ? applyOps(edit, made, library) : { ok: true as const, edit };
    if (!before.ok) return before;
    if (name === "ends.trim") {
      const read = EndsSchema.safeParse(op);
      if (!read.success) return refuse('ends.trim takes "start": true, "end": true, or both, and nothing else');
      const trimmed = endsTrim(before.edit, analyses, { start: read.data.start === true, end: read.data.end === true });
      if ("none" in trimmed) return refuse(trimmed.none);
      made.push(...trimmed.ops);
    } else if (name === "time.cut") {
      const read = TimeCutSchema.safeParse(op);
      if (!read.success) return refuse('time.cut takes only "fromMs" and "toMs", in the film\'s own time, 0 at its start');
      const cut = timeCut(before.edit, analyses, read.data.fromMs, read.data.toMs);
      if ("none" in cut) return refuse(cut.none);
      made.push(...cut.ops);
      if (cut.says) says.push(cut.says);
    } else if (name === "pauses.tighten") {
      // A length a little outside what the move takes is brought to its nearest end: "two thirds of what the cuts keep" may fall under it.
      const ms = (op as { ms?: unknown }).ms;
      const read = TightenSchema.safeParse(typeof ms === "number" && Number.isFinite(ms) ? { ...(op as object), ms: Math.min(PAUSE_MS.max, Math.max(PAUSE_MS.min, Math.round(ms))) } : op);
      if (!read.success) return refuse(`pauses.tighten takes only "ms", a whole number from ${PAUSE_MS.min} to ${PAUSE_MS.max}`);
      const trims = tighten(before.edit, analyses, { pauseMs: read.data.ms });
      if (trims.length === 0) return refuse(`the cuts keep no pause longer than ${read.data.ms} ms: there is nothing to cut at that. A lower ms cuts more, down to ${PAUSE_MS.min}; at ${PAUSE_MS.min} already, the pauses are as short as they go`);
      made.push(...trims);
    } else {
      const read = ZoomSchema.safeParse(op);
      if (!read.success) return refuse(`shot.zoom takes "id", a shot's; "zoom", from ${ZOOM.least} to ${ZOOM.most}; "slow", true for a slow zoom; and "word", the index of the word to start at`);
      // Here: split on the moment, and the piece from there pushed in.
      const moment = here ? momentAgain(before.edit, analyses, here) : null;
      if (moment && moment.shot === read.data.id) {
        const zoomed = zoomHere(before.edit, analyses, moment, read.data.zoom, read.data.slow === true, library);
        if ("none" in zoomed) return refuse(`${zoomed.none}. Zoom another part and say which part stays as it is; or send "ops": [] and say what is in the way`);
        made.push(...zoomed.ops);
        says.push(zoomed.says);
        continue;
      }
      // From a word: the shot is split in the pause before it, and the piece from there is the one zoomed.
      const cut = read.data.word === undefined ? null : pauseBefore(before.edit, analyses, read.data.id, read.data.word);
      let [on, id] = [before.edit, read.data.id];
      if (cut !== null) {
        const piece = pieceId(on, id, "z");
        const split = { op: "shot.split", id, atMs: cut, newId: piece };
        const parted = applyOps(on, [split], library);
        if (!parted.ok) return parted;
        made.push(split);
        [on, id] = [parted.edit, piece];
      }
      const zoomed = zoomFor(on, analyses, id, read.data.zoom, read.data.slow === true);
      if ("none" in zoomed) return refuse(`${zoomed.none}. Zoom the shots that have room and say which part stays as it is; or send "ops": [] and say what is in the way`);
      made.push({ op: "shot.set", id, framing: zoomed.framing });
    }
  }
  return { ok: true, ops: made, says };
}

/**
 * The code's own moves on an answer's edit that passed the door (Task 9b), each on the edit the one before left: with `here`,
 * a start or an end set near the moment the request points at is put on it (`snapToMoment`, slice B), first, since the title
 * that gives way does so six frames before a new text's first frame, which must be final by then; an unasked white highlight
 * on plain white captions is undone (`plainHighlight`, the fix wave), an asked stress shows (`stressShows`), a new call-out
 * speaks in the film's voice (`calloutVoice`, Task 3b), then a title that stays to the end gives way to a new text as it is
 * finally drawn (`labelGivesWay`). `was` is the edit before the answer, `sent` the answer's ops as they went through the door,
 * `request` the creator's own words (what they named stays as sent; none names nothing), `here` the moment the request is about,
 * else null: a moment of the take, found again in `was` and in the answer's edit (S11); `ends`, true when an end set near it is
 * held too, which is only for a request that points (S17 (2)). With nothing to do, or should the door refuse what they make,
 * the edit as it is and no ops.
 */
export function codeMoves(was: Edit, edit: Edit, sent: readonly unknown[], analyses: Analyses, library: readonly Asset[], request = "", here: Moment | null = null, ends = here !== null): { edit: Edit; ops: Op[]; says: string[]; gave: GaveWay[] } {
  const made = { edit, ops: [] as Op[], says: [] as string[], gave: [] as GaveWay[] };
  const moves = [
    (on: Edit) => ({ ...(here ? snapToMoment(was, on, here, analyses, ends) : { ops: [], says: [] }), gave: [] }),
    (on: Edit) => ({ ...plainHighlight(was, on, request), gave: [] }),
    (on: Edit) => ({ ...stressShows(was, on, sent), gave: [] }),
    (on: Edit) => ({ ...calloutVoice(was, on, request), gave: [] }),
    (on: Edit) => labelGivesWay(on, analyses, library, was),
  ];
  for (const move of moves) {
    const { ops, says, gave } = move(made.edit);
    const next = ops.length > 0 ? applyOps(made.edit, ops, library) : null;
    if (!next?.ok) continue;
    [made.edit, made.ops, made.says, made.gave] = [next.edit, [...made.ops, ...ops], [...made.says, ...says], [...made.gave, ...gave]];
  }
  return made;
}

/**
 * What the code says of captions it placed itself, as the end of the model's own sentence (`withPlaced`): they had no room as
 * the answer set them, so they were set at the largest size that has one (`captionsFit`).
 */
export function placedSay(was: Captions, asked: Captions, placed: Captions): string {
  const fewer = placed.maxWords < asked.maxWords;
  if (placed.size < asked.size) {
    if (placed.size > was.size) return `as large as fits clear of your face and the apps' buttons${fewer ? ", with fewer words at a time" : ""}`;
    return `a little smaller${fewer ? ", with fewer words at a time," : ""} so they stay clear of your face and the apps' buttons`;
  }
  return `${fewer ? "with fewer words at a time, " : ""}where they stay clear of your face and the apps' buttons`;
}

/**
 * A say with the code's part joined to it: one sentence still (a say is one short sentence, the craft's rule). A part the say
 * holds already, in any case, is not said again: told the zoom here goes "from here to the end", the model wrote that itself,
 * and the creator read it twice (the second proof, 2 runs).
 */
export function withPlaced(say: string, placed: string): string {
  const plain = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();
  if (plain(say).includes(plain(placed))) return say;
  return `${say.trim().replace(/[.!?]+$/, "")}, ${placed}.`;
}

/** The counts of words a page a say may name in words. */
const COUNTS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
/**
 * Where a say and its ops disagree and code can tell: an answer that changed only the captions and says "higher" while its
 * ops set them lower, or the other way round; a move ("higher", "lower", "moved") with the height as it was, whatever else the
 * say tells; "bigger" over a smaller size, or the other way round; a count of words a page they do not have. Asked for
 * captions higher with no room higher, the model sent the larger setting 0.02 lower and said it had moved them up, 5 runs of
 * 9. A word of where something is ("above the bar", "the bottom bar") is no move. Strict and simple on purpose (the last
 * correction): a say it calls untrue costs one round at most (the answer is sent back once) and the model's wording, never
 * the change, so no word excuses another. Null when they agree, and for a change of anything else, where the words may be
 * about that.
 */
export function contradicts(say: string, ops: readonly unknown[], was: Captions, is: Captions): string | null {
  if (ops.length === 0 || !ops.every((op) => typeof op === "object" && op !== null && (op as { op?: unknown }).op === "captions.set")) return null;
  const says = (words: RegExp) => words.test(say);
  const [up, down] = [says(/\b(?:higher|up(?!\s+to\b)|upwards?|raised?)\b/i), says(/\b(?:lower|lowered|down|downwards?)\b/i)];
  const [bigger, smaller] = [says(/\b(bigger|larger|increased?)\b/i), says(/\b(smaller|reduced?|decreased?)\b/i)];
  if (up && !down && is.y > was.y) return "your say has the captions go higher, and your ops set them lower";
  if (down && !up && is.y < was.y) return "your say has the captions go lower, and your ops set them higher";
  if (is.y === was.y && (up || down || says(/\b(?:moved?|moves|moving|shifted)\b/i))) {
    if (up && !down) return "your say has the captions go higher, and your ops leave them at the height they had";
    if (down && !up) return "your say has the captions go lower, and your ops leave them at the height they had";
    return "your say has the captions moved, and your ops leave them at the height they had";
  }
  if (bigger && !smaller && is.size < was.size) return "your say has the captions bigger, and your ops set them smaller";
  if (smaller && !bigger && is.size > was.size) return "your say has the captions smaller, and your ops set them bigger";
  const counts = [...say.matchAll(/\b(one|two|three|four|five|six|seven|eight|\d+)\s+words?\b/gi)].map((match) => COUNTS[(match[1] ?? "").toLowerCase()] ?? Number(match[1]));
  const [named] = counts;
  if (named !== undefined && !counts.includes(is.maxWords)) return `your say has the captions at ${named} words a page, and your ops leave them at ${is.maxWords}`;
  return null;
}

/** How many sentences a say runs to, outside what it quotes. */
export const sentencesOf = (say: string): number => unquoted(say).trim().split(/(?<=[.!?])["”’']?\s+/).filter(Boolean).length;

/** The longest a say may be. */
const SAY_MOST = 600;

/**
 * Why a say cannot be shown to the creator, in words the model can act on; null when it can. Asked once the edit is settled
 * (the last correction: the edit and the sentence are judged apart), of the say an answer came with and of the one the model
 * is asked for again: blank or endless; not in English (X120); more than one sentence; a size, a length or a height as the
 * kit counts them (`MEASURES`); the kit's own words the request did not use (`kitTerms`); with nothing changed, a claim of a
 * change (`claimsChange`); with the captions alone changed, what `contradicts` tells. `ops` are those applied in all, `was`
 * and `is` the captions before the request and after it.
 */
export function sayFault(say: string, about: { request: string; ops: readonly unknown[]; was: Captions; is: Captions }): string | null {
  if (!/\S/.test(say)) return "your say is blank";
  if (say.length > SAY_MOST) return `your say is longer than ${SAY_MOST} characters: one short sentence`;
  if (notEnglish(say)) return NOT_ENGLISH;
  if (sentencesOf(say) > 1) return "your say runs to more than one sentence: say it in one short sentence";
  if (MEASURES.test(unquoted(say))) return 'your say names a size in pixels, a length in milliseconds or a "y": say it in plain words ("larger", "above your head", "shorter pauses")';
  const kit = kitTerms(unquoted(say), about.request);
  if (kit.length > 0) return kitRefusal(kit);
  if (about.ops.length === 0) return claimsChange(say) ? NOTHING_CHANGED : null;
  return contradicts(say, about.ops, about.was, about.is);
}

/** The one op that takes back the change before it, after the model was told what that change did. */
const isUndo = (ops: readonly unknown[]): boolean => ops.length === 1 && typeof ops[0] === "object" && ops[0] !== null && (ops[0] as { op?: unknown }).op === "undo";

const isError = (finding: Finding): boolean => finding.severity === "error";

/** An answer read as `schema` says, or what is wrong with it, in a line: not JSON, or each zod issue as `path: message`. */
export function readAnswer<T>(text: string, schema: z.ZodType<T>): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripModelOutput(text));
  } catch (error) {
    return { ok: false, error: `it is not JSON (${error instanceof Error ? error.message : String(error)})` };
  }
  const answer = schema.safeParse(json);
  if (!answer.success) return { ok: false, error: answer.error.issues.map((issue) => `${issue.path.join(".") || "the answer"}: ${issue.message}`).join("; ") };
  return { ok: true, value: answer.data };
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A round's record before its call is made. */
export const newRound = (n: number): Round => ({
  n, ops: [], refused: null, findings: [], stills: [], ms: 0, tokens: { input: 0, output: 0 }, outcome: "no answer", askMs: 0, stillsMs: 0, error: null, stillsError: null,
});

/** How an agent asks the model: the call, the clock, the wait before asking again, and when it must stop, as `now()` counts. */
export interface Asking {
  ask: Ask;
  now: () => number;
  wait: (ms: number) => Promise<void>;
  deadlineMs: number;
}

/**
 * One call to the model for a round, as every agent round makes it: stopped by the deadline, with the agent's token budget and
 * thinking (`AGENT_LIMITS`); the round gets the call's tokens and time, and the answer comes back with its cost. A call stopped
 * by the deadline is "deadline". A call that fails otherwise is "failed", logged, and, unless it was the `last` round, the model
 * is given a moment before it is asked again: 1 s, then 2 s, … never past the deadline (`failures` counts the calls that failed).
 */
export async function askRound(
  asking: Asking, round: Round, messages: Message[], last: boolean, failures: { count: number },
): Promise<{ answer: Asked; cost: number } | "deadline" | "failed"> {
  const { ask, now, wait, deadlineMs } = asking;
  const signal = AbortSignal.timeout(Math.max(0, deadlineMs - now()));
  try {
    const answer = await ask(messages, { maxTokens: AGENT_LIMITS.maxTokens, thinking: AGENT_LIMITS.thinking, signal });
    round.tokens = answer.usage;
    round.askMs = answer.ms;
    return { answer, cost: calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: answer.usage.input, completion_tokens: answer.usage.output }) };
  } catch (error) {
    // Stopped by the deadline: told as the deadline, and not asked again.
    if (signal.aborted || now() >= deadlineMs) {
      round.error = "the deadline passed before the model answered";
      return "deadline";
    }
    round.error = `the model did not answer: ${message(error)}`;
    log.warn("the model did not answer", { round: round.n, error: message(error) });
    // A busy model (429, 503) is given a moment before it is asked again, never past the deadline.
    failures.count += 1;
    if (!last) await wait(Math.max(0, Math.min(RETRY_MS * 2 ** (failures.count - 1), deadlineMs - now())));
    return "failed";
  }
}

/**
 * The frames to draw after accepted ops (exported for the smoke run, which draws a change the loop did not): each thing seen that they added or moved, once it shows as it will, and the middle of
 * the film; at most `MOST_STILLS`, in order. Seen: `mark.add`, `mark.set` with `atMs` or `props`, `item.add`, `item.set` (not a
 * sound, which is heard); `captions.set` with `y`, `look`, `size` or `font`, or turning them on; `shot.set` with `framing`;
 * `look.set` (a shot's, or the film's, which the middle shows). Empty when none is.
 */
export function framesToDraw(edit: Edit, ops: readonly Op[]): { frame: number; says: string }[] {
  const lay = layout(edit);
  const things = placed(edit);
  const last = Math.max(0, lay.frames - 1);
  const drawn = new Map<number, string[]>();
  let any = false;
  const draw = (frame: number, says: string) => {
    any = true;
    const at = Math.min(last, Math.max(0, frame));
    const all = drawn.get(at) ?? [];
    if (!all.includes(says)) drawn.set(at, [...all, says]);
  };
  const thing = (id: string) => {
    const place = things.find((candidate) => candidate.thing.id === id);
    if (!place || place.thing.part === "sound") return;
    draw(place.at + Math.min(SETTLE, Math.floor(place.frames / 2)), `${place.thing.part} ${id}`);
  };
  const shot = (id: string) => {
    const place = lay.shots[edit.shots.findIndex((candidate) => candidate.id === id)];
    if (place) draw(place.at + Math.floor(place.frames / 2), `shot ${id}`);
  };
  const captions = () => {
    if (!edit.captions.on) return;
    for (const [r, run] of lay.runs.entries()) {
      const [first] = runWords(edit, run);
      if (!first) continue;
      const span = captionFrames(edit, lay, r);
      return draw(run.at + Math.min(first.from + CAPTION_SETTLE, span.frames - 1), "the captions");
    }
  };
  for (const op of ops) {
    switch (op.op) {
      case "mark.add":
        thing(op.mark.id);
        break;
      case "mark.set":
        if (op.atMs !== undefined || op.props !== undefined) thing(op.id);
        break;
      case "item.add":
        thing(op.item.id);
        break;
      case "item.set":
        thing(op.id);
        break;
      case "captions.set":
        if (op.y !== undefined || op.look !== undefined || op.size !== undefined || op.font !== undefined || op.on === true) captions();
        break;
      case "shot.set":
        if (op.framing !== undefined) shot(op.id);
        break;
      case "look.set":
        if (op.shot === undefined) any = true;
        else shot(op.shot);
        break;
    }
  }
  if (!any) return [];
  const changed = [...drawn.entries()].slice(0, MOST_STILLS - 1);
  const middle = Math.floor(lay.frames / 2);
  const film = ops.some((op) => op.op === "look.set" && op.shot === undefined) ? "the middle of the film, and the film's look" : "the middle of the film";
  const frames = new Map(changed);
  frames.set(middle, [...(frames.get(middle) ?? []), film]);
  return [...frames.entries()].sort(([a], [b]) => a - b).map(([frame, says]) => ({ frame, says: says.join("; ") }));
}

/** The creator's request, made on their edit: see the file's header. */
export async function change(input: AgentInput, deps: AgentDeps = {}): Promise<AgentResult> {
  const ask = deps.ask ?? askQwen;
  const draw = deps.stills ?? stillsOf;
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  const { analyses, library, request } = input;

  const before = review(input.edit, analyses);
  const old = new Set(before.filter(isError).map(sameAs));
  // The warnings the edit came with are the creator's to live with (a first cut's own: its title touching a bar, its captions
  // on the chin). Shown them, the model "fixed" them in answers that asked for nothing of the kind, and the review then refused
  // the whole answer (Task 14: a call-out 0 of 3). So it is shown every error, and only the warnings a change of its own brings.
  const lived = new Set(before.filter((finding) => !isError(finding)).map(sameAs));
  // Nor a text touching an app's zone, which the review grades as still read (the first cut's own title touches one): shown
  // it on its closing line, the model moved the line down onto the eyes, 3 of 3.
  const shownTo = (found: readonly Finding[]): Finding[] => found.filter((finding) => isError(finding) || (!lived.has(sameAs(finding)) && finding.code !== "under-buttons"));
  let context = contextOf(input.edit, analyses, shownTo(before), library);
  // The frame the video was paused on, resolved in code and written above the request (E15); none off the film. The system
  // prompt stays as it is, so a request with no moment is asked exactly as before.
  const here = input.at === undefined ? null : momentFor(input.edit, analyses, input.at);
  const messages: Message[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: requestMessage(context, request, here ? momentBlock(here, input.edit, analyses, endsAsked(request)) : undefined) },
  ];
  // The request points at the moment ("here", "now", "this"): an end near it is held on it too, and any zoom of its shot starts
  // there. One about the whole video stays whole.
  const pointed = here !== null && pointsAt(request) ? here : null;
  // The tag is the pointer for code too (S17): a request with a moment that names no other place (the start, the end, the whole
  // film, a time) is about the moment, "here" or not. A start set near it is held on it, and a zoom of its shot, the answer's
  // only one, starts there. Asked "Zoom in" with a moment, the model sent the very ops of "Zoom in here", 3 runs of 3.
  const tagged = here !== null && (pointed !== null || !namesAnotherPlace(request)) ? here : null;

  let edit = input.edit;
  let findings = before;
  const rounds: Round[] = [];
  const applied: Op[] = [];
  let cost = 0;
  /** The model's sentence for the edit as the rounds leave it: the last accepted answer's; null when none was taken. */
  let candidate: string | null = null;
  /** What the code did itself in that answer (captions it placed, a cut it landed): joined to the model's sentence. */
  let parts: string[] = [];
  /** The answer the rounds ended on, when it is not among `messages` yet: it comes before a request for the sentence alone. */
  let tail: Message[] = [];
  /** Why the last judged round did not change the edit, in the creator's words (`PLAIN`); null after an accepted change. */
  let failed: string | null = null;
  /** The calls that failed so far: each waits twice as long before the next. */
  const failures = { count: 0 };
  /** The last round there may be: three, or the one after the stills, which are shown once. */
  let lastRound: number = AGENT_LIMITS.rounds;
  /** True once an accepted change was shown to the model: its stills, and what it did. */
  let shown = false;
  /** The edit before that change, to take it back to. */
  let undoTo: { edit: Edit; findings: Finding[]; applied: number; gave: number } | null = null;
  /** What the code's move did to a title that stays, in the changes taken (`labelGivesWay`): the facts tell it, and only it. */
  const gave: GaveWay[] = [];
  /** True once an answer was sent back because its own say contradicts its ops: once a change, no more. */
  let contradicted = false;
  /** True when `candidate` is the code's own sentence (S15, S16: a thing it put on the moment, off the film's start), said as it is. */
  let coded = false;

  for (let n = 1; n <= lastRound; n++) {
    if (input.deadlineMs - now() <= 0) {
      failed ??= PLAIN.time;
      break;
    }
    const begun = now();
    const round = newRound(n);
    rounds.push(round);
    const done = () => {
      round.ms = now() - begun;
    };

    const called = await askRound({ ask, now, wait, deadlineMs: input.deadlineMs }, round, messages, n >= lastRound, failures);
    if (called === "deadline") {
      failed = PLAIN.time;
      done();
      break;
    }
    if (called === "failed") {
      failed = PLAIN["no answer"];
      done();
      continue;
    }
    const { answer } = called;
    cost += called.cost;

    const read = readAnswer(answer.text, AnswerSchema);
    // The model is told when its next answer is its last, so that it can say what would work rather than try once more.
    const repair = (content: string) => messages.push({ role: "assistant", content: answer.text }, { role: "user", content: n + 1 >= lastRound ? `${content} ${LAST}` : content });
    if (!read.ok) {
      round.outcome = "unreadable";
      round.error = read.error;
      failed = PLAIN.unreadable;
      repair(unreadableMessage(read.error, answer.truncated === true));
      done();
      continue;
    }
    const said = read.value;
    round.ops = said.ops;
    if (said.ops.length === 0) {
      round.outcome = "no change";
      // After the model was told what its change did, no ops means the change stands as it was made: its own say stands too. The
      // second one is written looking at the changed edit and reads like a second step ("the captions are already bigger").
      if (!shown) [candidate, parts, coded] = [said.say, [], false];
      tail = [{ role: "assistant", content: answer.text }];
      done();
      break;
    }

    // Told what its change did, the model takes it back: the edit as it was before that change, and what it now says.
    if (shown && undoTo && isUndo(said.ops)) {
      round.outcome = "undone";
      [edit, findings] = [undoTo.edit, undoTo.findings];
      applied.length = undoTo.applied;
      gave.length = undoTo.gave;
      // With the change taken back nothing may be changed: its sentence is held to that as every say is (`sayFault`).
      [candidate, parts, coded] = [said.say, [], false];
      tail = [{ role: "assistant", content: answer.text }];
      failed = applied.length === 0 ? PLAIN.undone : null;
      done();
      break;
    }

    const answered = readableEnds(edit, withPunctuation(edit, said.ops));
    // The zoom here: of a zoom of the moment's shot when the request points; else when the moment is the tag's and the answer
    // zooms that one shot only (one that zooms several is left as the model wrote it).
    const zoomed = new Set(answered.flatMap((op) => (typeof op === "object" && op !== null && (op as { op?: unknown }).op === "shot.zoom" ? [(op as { id?: unknown }).id] : [])));
    const made = withMoves(edit, analyses, answered, library, pointed ?? (zoomed.size === 1 ? tagged : null));
    // A thing the answer adds with a moment, its start left on the film's first frame, starts on the moment, before the door
    // (S15, S16): the tag is the pointer, "here" or not. Paused at 0:05, "Add a title: New drop" came back on the first frames
    // twice. The answer's sentence is then the code's: the model's may say "at the start".
    const lifted = made.ok && here !== null ? offTheStart(edit, made.ops, here, analyses, request, library) : null;
    const moved = made.ok && lifted ? { ...made, ops: lifted.ops } : made;
    let door: Applied = moved.ok ? applyOps(edit, moved.ops, library) : moved;
    if (!door.ok) {
      round.outcome = "refused";
      round.refused = door.problems;
      failed = PLAIN.refused;
      repair(refusedMessage(door.problems, namesFile(said.ops)));
      done();
      continue;
    }
    let sent: unknown[] = moved.ok ? moved.ops : said.ops;
    // The code's own moves on what passed the door, before the review judges it (Task 9b, Task 3b, the fix wave, slice B): a
    // start or an end near the moment pointed at is put on it, an unasked white highlight is undone, an asked stress shows, a
    // new call-out takes the film's voice, and a title that stays to the end gives way to a new text. What they did joins the
    // say, as the other moves' does. The moment is the take's (S11): each round's answer is held against it as the edit that
    // answer is applied to, and the one it makes, show it, so a round after a change and an answer that also cuts are held
    // right, and a moment cut out holds nothing.
    const byCode = codeMoves(edit, door.edit, sent, analyses, library, request, tagged, pointed !== null);
    if (byCode.ops.length > 0) [door, sent] = [{ ok: true, edit: byCode.edit }, [...sent, ...byCode.ops]];
    let found = review(door.edit, analyses);
    let fresh = found.filter((finding) => isError(finding) && !old.has(sameAs(finding)));
    // The captions' own errors are held to the one rule the room offers by (`captionsRule`): an error they already carried
    // reads the same before and after, and may still be worse (more frames covered).
    const ownErrors = (all: readonly Finding[]) => all.filter((finding) => isError(finding) && aboutCaptions(finding));
    if (ownErrors(found).length > 0 && ownErrors(fresh).length === 0 && captionsWorse(edit, door.edit, analyses)) fresh = [...fresh, ...ownErrors(found)];
    let placed: string | null = null;
    // Captions with no room anywhere as the answer set them (a look on a box, a size too large) are placed by code, at the
    // largest size that has room (N8): asked for the pill look, the model set it at the size bare words fitted at and gave up,
    // 3 of 3; told where it fitted, it took that in 2 runs of 6. The answer's say gets a sentence of what the code did.
    // (A title or a call-out the new captions would cover is told of that text, `on-text`: the captions' doing all the same.)
    const setCaptions = said.ops.some((op) => typeof op === "object" && op !== null && (op as { op?: unknown }).op === "captions.set");
    if (fresh.length > 0 && setCaptions && fresh.every((finding) => aboutCaptions(finding) || finding.code === "on-text")) {
      const fit = captionsFit(door.edit, analyses, edit);
      const refit: Applied | null = fit ? applyOps(door.edit, [{ op: "captions.set", ...fit }], library) : null;
      const refound = refit?.ok ? review(refit.edit, analyses) : null;
      // Not against a place that was asked for: a height moved the other way than the answer moved it is no placing of it.
      const asked = Math.sign(door.edit.captions.y - edit.captions.y);
      const kept = fit !== null && (asked === 0 || Math.sign(fit.y - edit.captions.y) === asked);
      if (fit && kept && refit?.ok && refound && !refound.some((finding) => isError(finding) && !old.has(sameAs(finding))) && !captionsWorse(edit, refit.edit, analyses) && JSON.stringify(refit.edit.captions) !== JSON.stringify(edit.captions)) {
        placed = placedSay(edit.captions, door.edit.captions, refit.edit.captions);
        [door, found, fresh, sent] = [refit, refound, [], [...sent, { op: "captions.set", ...fit }]];
      }
    }
    round.findings = found;
    if (fresh.length > 0) {
      round.outcome = "review";
      failed = (fresh[0] && PLAIN_FINDING[fresh[0].code]) ?? "it would leave a problem in the video";
      // With each error, where its text has room: the model does not find a place from the face's box alone (Task 14).
      // And when the answer framed a shot by hand and a text now lies on the face: the move that frames it.
      const framed = fresh.some((finding) => finding.code === "on-face") && said.ops.some((op) => typeof op === "object" && op !== null && (op as { op?: unknown }).op === "shot.set" && (op as { framing?: unknown }).framing !== undefined);
      // A text the answer's new captions would cover is the captions' to clear, not the text's: told where they have room.
      const hints = fresh.map((finding) => (setCaptions && finding.code === "on-text" ? captionsHint(door.edit, analyses, edit) : roomFor(door.edit, analyses, finding, edit)));
      repair(reviewedMessage(fresh, hints, framed ? [BY_HAND] : []));
      done();
      continue;
    }

    // The one say fault that is evidence about the edit (the controller's ruling on r02: asked for captions higher with no
    // room higher, the model sent larger captions at the same height and said "higher", and with the sentence judged apart
    // that swap was taken, 3 runs of 3). An answer whose own say contradicts its ops is sent back once in a change, never on
    // the last round and never twice, with both sides named. After that the edit stands whatever the sentence says. So a
    // true say called a contradiction costs one round and never the change. Not of captions the code placed: where they
    // ended is the code's doing.
    const untrue = contradicted || placed || n >= lastRound ? null : contradicts(said.say, said.ops, edit.captions, door.edit.captions);
    if (untrue) {
      contradicted = true;
      round.outcome = "refused";
      // The words after the two sides are the ones measured on "captions higher" with no room higher: told this, the model
      // answered with no ops and the true reason, 15 runs of 15; told "send ops that do what your say tells, or none", it sent
      // the swap again, 3 of 3; told to "do only the part that can be done", 2 of 6.
      round.refused = [{ path: "say", id: null, message: `${untrue}: say and ops must agree. Where there is no room for what was asked, send "ops": [] and say what is in the way and what would work` }];
      failed = PLAIN.refused;
      repair(refusedMessage(round.refused));
      done();
      continue;
    }

    round.outcome = "changed";
    const ops = OpsSchema.parse(sent);
    const [was, wasFound, wasApplied, wasGave] = [edit, findings, applied.length, gave.length];
    applied.push(...ops);
    gave.push(...byCode.gave);
    edit = door.edit;
    findings = found;
    // What the code did itself (captions it placed, a cut it landed) joins the say's own sentence, when that is shown. When it
    // put an added thing on the moment (S15, S16), the code says the answer: where that thing starts, then the rest in its words.
    [candidate, parts, coded] = lifted && lifted.moved.length > 0
      ? [startedSay(was, edit, lifted.moved, byCode.gave), [], true]
      : [said.say, [...(placed ? [placed] : []), ...(moved.ok ? moved.says : []), ...byCode.says], false];
    tail = [{ role: "assistant", content: answer.text }];
    failed = null;

    // A look, once, with a round left for it and time: the stills of what is seen, and what the change did as code measures
    // it. Stills only when something seen was added or moved (X85); the measures alone when the change cut or brought back
    // words, changed the film's length or took a part out.
    const effect = effectOf(was, edit, byCode.gave);
    const frames = input.stills === false || !AGENT_LIMITS.look ? [] : framesToDraw(edit, ops);
    const time = input.deadlineMs - now();
    if (n >= lastRound || time <= 0 || (frames.length === 0 && !effect.risky)) {
      done();
      break;
    }
    let drawn: Drawn[] = [];
    if (frames.length > 0) {
      const asked = now();
      try {
        const stills = await draw(input.user, edit, frames.map((frame) => frame.frame), { signal: AbortSignal.timeout(time) });
        round.stills = stills.map((still) => still.frame);
        drawn = stills.map((still, i) => ({ ...still, says: frames[i]?.says ?? "" }));
      } catch (error) {
        round.stillsError = message(error);
        log.warn("the stills could not be drawn; the change stands without them", { round: n, error: message(error) });
      }
      round.stillsMs = now() - asked;
      if (round.stillsError !== null) {
        done();
        break;
      }
    }
    const changedContext = contextOf(edit, analyses, shownTo(found), library);
    const told = placed ? [...effect.lines, "the captions' size, words a page and height were set by the code, where they have room: leave them as they are"] : effect.lines;
    messages.push({ role: "assistant", content: answer.text }, { role: "user", content: stillsMessage(drawn, changedContext, context, request, told) });
    tail = [];
    context = changedContext;
    lastRound = n + 1;
    shown = true;
    undoTo = { edit: was, findings: wasFound, applied: wasApplied, gave: wasGave };
    done();
  }

  // The sentence, judged apart from the edit (the last correction). The edit stands as the rounds left it. The model's say
  // for it is checked once; one that cannot be shown, or none at all after answers the door or the review judged, is asked
  // for once, alone (its ops, if it sends any, are not looked at); and if that cannot be shown either, or time is short, the
  // code writes the sentence. Not after answers that could only not be read: a model that sends no JSON has nothing to add.
  const changed = applied.length > 0;
  const about = { request, ops: applied, was: input.edit.captions, is: edit.captions };
  const judged = rounds.some((round) => round.outcome === "refused" || round.outcome === "review");
  // The code's own line is true by making: it is not judged as the model's is.
  const fault = candidate === null || coded ? null : sayFault(candidate, about);
  let sentence: string | null = fault === null ? candidate : null;
  let sayBy: SayBy = coded ? "code" : "model";
  if (sentence === null && (candidate !== null || judged) && input.deadlineMs - now() > CLOSING_MS) {
    const begun = now();
    const round = newRound(rounds.length + 1);
    rounds.push(round);
    const asked = fault === null ? closingMessage() : sayAgainMessage(fault, changed, effectOf(input.edit, edit, gave).lines);
    const asking: Message[] = tail.length > 0 ? [...messages, ...tail, { role: "user", content: asked }] : [...messages.slice(0, -1), { role: "user", content: `${textOf(messages.at(-1))}\n\n${asked}` }];
    const called = await askRound({ ask, now, wait, deadlineMs: input.deadlineMs }, round, asking, true, failures);
    round.ms = now() - begun;
    if (called !== "deadline" && called !== "failed") {
      cost += called.cost;
      const again = readAnswer(called.answer.text, ClosingSchema);
      const why = again.ok ? sayFault(again.value.say, about) : null;
      if (!again.ok) {
        round.outcome = "unreadable";
        round.error = again.error;
      } else if (why === null) {
        round.outcome = "said";
        [sentence, sayBy] = [again.value.say, "model, asked again"];
      } else {
        round.outcome = "refused";
        round.refused = [{ path: "say", id: null, message: why }];
      }
    }
  }
  // The code's own sentence: of what changed, from the two edits; with nothing changed, of why.
  const say = sentence !== null ? parts.reduce(withPlaced, sentence) : changed ? saidOf(input.edit, edit, gave) : couldNot(candidate === null ? (failed ?? PLAIN.time) : failed);
  if (sentence === null) sayBy = "code";
  const tokens = rounds.reduce((sum, round) => ({ input: sum.input + round.tokens.input, output: sum.output + round.tokens.output }), { input: 0, output: 0 });
  const ms = now() - started;
  log.info("a change", {
    changed, rounds: rounds.length, outcomes: rounds.map((round) => round.outcome), roundMs: rounds.map((round) => round.ms),
    stills: rounds.flatMap((round) => round.stills).length, tokens, cost, ms, sayBy,
  });
  return { say, ops: applied, edit, findings, rounds, ms, cost, tokens, changed, sayBy };
}
