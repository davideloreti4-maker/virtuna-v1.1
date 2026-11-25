/**
 * words.ts — a style from the creator's own words (part 3, Task 12; the controller's addendum and fix round 1). Asked for a whole
 * profile, a model invents numbers; so Qwen only chooses (N8): the nearest preset, what the words ask beyond it, whether the words
 * name a person, a channel or a brand as the style, and what they ask for that the kit cannot draw (`WordsAnswerSchema`). Code
 * builds the profile (`changed`: the preset's, each change mapped to the kit's own values in `CHANGE`, checked with
 * `StyleProfileSchema`, its source the words) and writes the creator's sentence from the facts (`sayOf`), so the say never
 * repeats a person's name and never calls a style someone's (X99).
 *
 * An answer outside the shape, or naming an unknown preset, gets one repair quoting the problem; then a plain error. A call that
 * fails throws as it is: the caller owns the retries.
 *
 * Server side: it calls Qwen (`Ask`, P1). Logged with its rounds, tokens and time, never with the creator's words or Qwen's text.
 */
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { Hex } from "../atoms";
import { catalogue } from "../agent/catalogue";
import { readAnswer } from "../agent/loop";
import type { Ask, Message } from "../agent/model";
import { CAPTION_LOOKS, CaptionsSchema, LOOK_IDS } from "../doc";
import { PRESETS, PRESET_IDS, presetOf, type Preset } from "./presets";
import { StyleProfileSchema, type StyleProfile } from "./profile";

const log = createLogger({ module: "edit.style" });

/** One answer and one repair; a short answer, no thinking; each call stopped after 30 s. */
export const WORDS_LIMITS = { rounds: 2, maxTokens: 600, thinking: false, callMs: 30_000 } as const;

/** What each change means in the kit's own values (the addendum). */
export const CHANGE = {
  size: { smaller: 0.8, bigger: 1.3 },
  place: { low: 0.74, middle: 0.5, high: 0.26 },
  zooms: { none: null, few: { perMin: 6, zoom: 1.12 }, many: { perMin: 14, zoom: 1.2 } },
  pace: { calm: 350, normal: 220, fast: 150 },
} as const;

/** The kit's range for a caption's size, as the profile's schema holds it. */
const SIZE = StyleProfileSchema.shape.captions.shape.size;
/** The longest a style's source name is (`StyleProfileSchema`). */
const NAME_CHARS = 80;

/** Only what the words ask for beyond the preset. An unknown field is refused, so a wish the kit has no field for is told, not lost. */
export const ChangeSchema = z.strictObject({
  captions: z.strictObject({
    on: z.boolean(),
    look: z.enum(CAPTION_LOOKS),
    size: z.enum(["smaller", "bigger"]),
    words: z.number().int().min(1).max(CaptionsSchema.shape.maxWords.maxValue ?? 16), // the kit's own pages: up to a whole short sentence (the final fix wave)
    highlight: Hex.nullable(),
    place: z.enum(["low", "middle", "high"]),
  }).partial().optional(),
  title: z.boolean().optional(),
  zooms: z.enum(["none", "few", "many"]).optional(),
  pace: z.enum(["calm", "normal", "fast"]).optional(),
  look: z.enum(LOOK_IDS).optional(),
});
export type Change = z.infer<typeof ChangeSchema>;

/** What the words may ask for that the kit cannot draw (fix round 1). */
export const CANNOT = ["music", "emoji", "stickers", "sound effects", "clips or pictures cut in", "other"] as const;

/**
 * Qwen's answer (fix round 1): the preset, the change (null or none for none), `named` (the words name a person, a channel or a
 * brand as the style) and `cannot` (what they ask for that the kit cannot draw). No free text: code writes the say.
 */
export const WordsAnswerSchema = z.strictObject({
  preset: z.enum(PRESET_IDS),
  change: ChangeSchema.nullable().optional(),
  named: z.boolean(),
  cannot: z.array(z.enum(CANNOT)).max(CANNOT.length).optional(),
});
export type WordsAnswer = z.infer<typeof WordsAnswerSchema>;

/* ── the mapping ───────────────────────────────────────────────────────────────────────────────── */

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The words as a style's name: their spaces made single, cut to 80 characters. */
const nameOf = (words: string): string => words.replace(/\s+/g, " ").trim().slice(0, NAME_CHARS).trimEnd();

/**
 * A preset's profile with the change (the addendum): a size `smaller` or `bigger` ×0.8 or ×1.3, held to the kit's range and made
 * whole; `place` as y 0.74, 0.50 or 0.26; `zooms` none, 6 a minute at 1.12 or 14 at 1.2; `pace` 350, 220 or 150 ms; `title`
 * false as none and true as the profile's own or, where it has none, Bold pop's; the look as asked. Its source is the words.
 * Checked with `StyleProfileSchema`; the profile given is left as it was.
 */
export function changed(profile: StyleProfile, change: Change, words: string): StyleProfile {
  const style = structuredClone(profile);
  const { captions } = change;
  if (captions) {
    if (captions.on !== undefined) style.captions.on = captions.on;
    if (captions.look) style.captions.look = captions.look;
    if (captions.size) style.captions.size = clamp(Math.round(style.captions.size * CHANGE.size[captions.size]), SIZE.minValue ?? 0, SIZE.maxValue ?? Infinity);
    if (captions.words) style.captions.maxWords = captions.words;
    if (captions.highlight !== undefined) style.captions.highlight = captions.highlight?.toLowerCase() ?? null;
    if (captions.place) style.captions.y = CHANGE.place[captions.place];
  }
  // The parse below gives fresh objects: nothing of CHANGE or Bold pop is shared with the style.
  if (change.title === false) style.title = null;
  if (change.title === true) style.title ??= presetOf("bold-pop")!.profile.title;
  if (change.zooms) style.punchIns = CHANGE.zooms[change.zooms];
  if (change.pace) style.pace = { ...style.pace, pauseMs: CHANGE.pace[change.pace] };
  if (change.look) style.look = { preset: change.look };
  style.source = { kind: "words", name: nameOf(words) };
  return StyleProfileSchema.parse(style);
}

/* ── what the creator reads ───────────────────────────────────────────────────────────────────── */

const NUMBERS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"] as const;
const CAPTION_ADJECTIVE: Record<(typeof CAPTION_LOOKS)[number], string> = { pill: "boxed", pop: "bold pop", highlight: "highlighted", plain: "plain" };
const PLACE_WORDS = { low: "low on the screen", middle: "in the middle", high: "high on the screen" } as const;
const ZOOM_WORDS = { none: "no zooms", few: "a few zooms", many: "many zooms" } as const;
const PACE_WORDS = { calm: "a calm pace", normal: "a steady pace", fast: "a fast pace" } as const;
const LOOK_WORDS: Record<(typeof LOOK_IDS)[number], string> = {
  natural: "natural colour", vivid: "vivid colour", warm: "a warm look", cool: "a cool look", mono: "a black and white look", soft: "a soft look",
};

/** A colour's name, plain: by its hue, or white, grey or black when it has little. */
export function colourName(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const spread = max - min;
  if (spread < 0.12) return max > 0.85 ? "white" : max < 0.2 ? "black" : "grey";
  const sixths = max === r ? (g - b) / spread : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4;
  const hue = (sixths * 60 + 360) % 360;
  return hue < 15 ? "red" : hue < 40 ? "orange" : hue < 70 ? "yellow" : hue < 165 ? "green" : hue < 255 ? "blue" : hue < 290 ? "purple" : hue < 340 ? "pink" : "red";
}

/** "a", "a and b", "a, b and c". */
const listed = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** What the style changed of the preset, each in a few plain words: only what differs from the preset, in the change's terms. */
function changesSaid(preset: StyleProfile, style: StyleProfile, change: Change): string[] {
  const said: string[] = [];
  const [was, now] = [preset.captions, style.captions];
  if (was.on && !now.on) said.push("no captions");
  else if (now.on) {
    const size = now.size === was.size ? null : now.size > was.size ? "bigger" : "smaller";
    const look = now.look === was.look ? null : CAPTION_ADJECTIVE[now.look];
    const place = now.y === was.y || !change.captions?.place ? null : PLACE_WORDS[change.captions.place];
    if (size || look || place) said.push([size, look, "captions", place].filter(Boolean).join(" "));
    if (now.maxWords !== was.maxWords) said.push(`${NUMBERS[now.maxWords - 1]} ${now.maxWords === 1 ? "word" : "words"} at a time`);
    if (now.highlight !== was.highlight) said.push(now.highlight === null ? "no colour on the words" : `${colourName(now.highlight)} on the words that light up`);
  }
  if (preset.title === null && style.title !== null) said.push("a title over the opening");
  if (preset.title !== null && style.title === null) said.push("no title");
  if (change.zooms && JSON.stringify(style.punchIns) !== JSON.stringify(preset.punchIns)) said.push(ZOOM_WORDS[change.zooms]);
  if (change.pace && style.pace.pauseMs !== preset.pace.pauseMs) said.push(PACE_WORDS[change.pace]);
  if (style.look.preset !== preset.look.preset) said.push(LOOK_WORDS[style.look.preset]);
  return said;
}

/** The first sentence of a preset's line, its first letter made small: what it looks like. */
const looksOf = (preset: Preset): string => {
  const first = preset.description.split(/(?<=[.!?])\s+/)[0] ?? preset.description;
  return first.charAt(0).toLowerCase() + first.slice(1);
};

/**
 * The creator's sentences, written by code from the answer and the style it made (fix round 1, Task 12b), in English, at most two:
 * - with no change, the preset by its name and what it looks like (the first sentence of its line); with any change, the name and
 *   the changes in plain words, never the line, which a change may make untrue;
 * - when the words name a person, a channel or a brand: that this is the nearest look we have, not their own style (never their
 *   name); and what the kit cannot draw yet. These two share a sentence when both are said.
 */
export function sayOf(preset: Preset, style: StyleProfile, answer: Pick<WordsAnswer, "named" | "cannot" | "change">): string {
  const changes = changesSaid(preset.profile, style, answer.change ?? {});
  const made = changes.length === 0 ? `I used ${preset.name}: ${looksOf(preset)}` : `I used ${preset.name}, with ${listed(changes)}.`;
  const cannot = [...new Set(answer.cannot ?? [])].map((what) => (what === "other" ? "some of what you asked for" : what));
  const closing = [
    answer.named ? "It is the nearest look we have, not that person's own style" : null,
    cannot.length > 0 ? `not in the kit yet: ${cannot.join(", ")}` : null,
  ].filter((part) => part !== null).join("; ");
  const last = closing ? `${closing.charAt(0).toUpperCase()}${closing.slice(1)}.` : null;
  return last === null ? made : `${made} ${last}`;
}

/* ── the prompt ────────────────────────────────────────────────────────────────────────────────── */

const ANSWER =
  `{"preset": string, "change"?: {"captions"?: {"on"?: boolean, "look"?: string, "size"?: "smaller"|"bigger", "words"?: int, "highlight"?: "#rrggbb"|null, "place"?: "low"|"middle"|"high"}, "title"?: boolean, "zooms"?: "none"|"few"|"many", "pace"?: "calm"|"normal"|"fast", "look"?: string}, "named": boolean, "cannot"?: [${CANNOT.map((what) => `"${what}"`).join("|")}]}`;

/** The captions' looks, in plain words. */
const CAPTION_WORDS: Record<(typeof CAPTION_LOOKS)[number], string> = {
  pill: "white words on a dark box",
  pop: "bold white edged words, the one being said in colour",
  highlight: "the word being said on a block of colour",
  plain: "plain white words, the stressed ones in colour",
};

const seconds = (frames: number): string => `${Math.round((frames / 30) * 10) / 10} s`;

/** A preset's line and its facts, as the prompt lists it. */
function presetLines({ id, name, description, profile }: Preset): string[] {
  const { captions, title, punchIns, pace, look } = profile;
  const colour = captions.highlight === null ? "no colour" : `colour ${captions.highlight}`;
  const facts = [
    `${captions.look} captions in ${captions.font}, ${captions.size} px, at ${captions.y} of the height, ${captions.maxWords} ${captions.maxWords === 1 ? "word" : "words"} at a time, ${colour}`,
    title === null ? "no title" : title.stays ? `a ${title.look} title that stays to the end${title.ink ? `, in ${colourName(title.ink)} letters` : ""}` : `a ${title.look} title over the opening for ${seconds(title.frames)}`,
    punchIns ? `${punchIns.perMin} punch-ins a minute at ${punchIns.zoom}x` : "no punch-ins",
    `pauses of ${pace.pauseMs} ms`,
    `look ${look.preset}`,
  ];
  return [`- ${id} — "${name}": ${description}`, `  ${facts.join("; ")}`];
}

/** The catalogue's six looks, each "  <id>: <what it does>". */
function lookLines(): string[] {
  const lines = catalogue().split("\n");
  const at = lines.findIndex((line) => line.startsWith("look.set "));
  const looks = LOOK_IDS.map((id) => lines.slice(at + 1).find((line) => line.startsWith(`  ${id}: `)));
  if (at < 0 || looks.some((line) => line === undefined)) throw new Error("the catalogue does not describe the six looks");
  return looks.map((line) => `  ${line!.trim()}`);
}

let system: string | null = null;
/** The system prompt: the role, the answer, the presets, the change's fields and the rules. The same every time. */
export function wordsPrompt(): string {
  if (system !== null) return system;
  return (system = [
    `You choose the style of a creator's short vertical video from their own words about it. The editor has ${PRESETS.length} presets: choose the one nearest to the words, and change only what the words ask for beyond it. The code builds the style from your answer and tells the creator what it made.`,
    `Answer with one JSON object only: ${ANSWER}.`,
    "",
    "The presets (preset: one of these ids):",
    ...PRESETS.flatMap(presetLines),
    "",
    "change: only what the words ask for beyond the preset. Leave out every field the preset already has as asked, and leave change out when the preset is enough. Never take away or change a thing the words do not ask about: a title, zooms or captions the words do not mention stay as the preset has them. Words may ask for several changes at once: give each of them (\"small captions at the top\" is captions size smaller and place high).",
    "- captions.on: false for no captions at all.",
    `- captions.look: ${CAPTION_LOOKS.map((look) => `${look} (${CAPTION_WORDS[look]})`).join(", ")}.`,
    '- captions.size: "smaller" or "bigger" than the preset\'s.',
    `- captions.words: how many words show at a time, 1 to ${CaptionsSchema.shape.maxWords.maxValue}.`,
    '- captions.highlight: the colour of the word being said (with plain captions, of the stressed words), as "#rrggbb", or null for none.',
    '- captions.place: "low", "middle" or "high" on the screen.',
    "- title: true for a hook title over the opening, false for none.",
    '- zooms: punch-ins at the cuts, the speaker framed tighter: "none", "few" or "many".',
    '- pace: the pauses kept between phrases: "calm" (long), "normal" or "fast" (short, punchy).',
    "- look: the film's colour look, one of:",
    ...lookLines(),
    "",
    "named: always give it, true or false. true only when the words give a proper name (a person, a channel or a brand) as the style; then choose the preset nearest to how that style is known to look, with the changes that bring it nearer. false otherwise, and never for a kind of video, a format or a mood (a vlog, a tutorial, an interview, cinematic).",
    `cannot: what the words ask for that the editor cannot draw, each one of ${CANNOT.map((what) => `"${what}"`).join(", ")} ("other" for anything else it cannot draw: B-roll, transitions, animated graphics…). Leave it out when there is nothing. Still choose the nearest preset and the changes the editor can make.`,
    "",
    "Read the mood of the words as well as the things they name: a calm, polished or serious mood leans to the quiet presets (Sentences, Clean, Black and white, Key words), a loud or energetic one to the bold ones (Bold pop, One word, Highlighter).",
  ].join("\n"));
}

const repairMessage = (error: string, truncated: boolean): string =>
  `${truncated ? "Your answer stopped at the token limit before it ended, so it could not be read" : "Your answer could not be read"}: ${error}. Answer again with one JSON object only: ${ANSWER}.`;

/** What was wrong with an answer, without its text: not JSON (whose error quotes the answer), or the shape's problems. */
const problemOf = (error: string): { kind: "not JSON" | "outside the shape"; told: string } =>
  error.startsWith("it is not JSON") ? { kind: "not JSON", told: "it is not JSON" } : { kind: "outside the shape", told: error };

/* ── a style from words ────────────────────────────────────────────────────────────────────────── */

/**
 * The style the creator's words ask for, and the sentences they read: see the file's header. Throws when no words are given, when
 * neither the answer nor its repair can be read (a plain error, without the answer's text), or when a call fails.
 */
export async function styleOfWords(words: string, ask: Ask): Promise<{ style: StyleProfile; say: string }> {
  if (!/\S/.test(words)) throw new Error("no words were given");
  const started = performance.now();
  const messages: Message[] = [{ role: "system", content: wordsPrompt() }, { role: "user", content: `The creator's words: ${JSON.stringify(words)}` }];
  const tokens = { input: 0, output: 0 };
  const kinds: string[] = [];
  let told = "";
  for (let round = 1; round <= WORDS_LIMITS.rounds; round++) {
    const asked = await ask(messages, { maxTokens: WORDS_LIMITS.maxTokens, thinking: WORDS_LIMITS.thinking, signal: AbortSignal.timeout(WORDS_LIMITS.callMs) });
    tokens.input += asked.usage.input;
    tokens.output += asked.usage.output;
    const read = readAnswer(asked.text, WordsAnswerSchema);
    if (read.ok) {
      const preset = presetOf(read.value.preset)!;
      const style = changed(preset.profile, read.value.change ?? {}, words);
      log.info("a style from words", { preset: preset.id, changed: Object.keys(read.value.change ?? {}), named: read.value.named, cannot: read.value.cannot?.length ?? 0, rounds: round, tokens, ms: Math.round(performance.now() - started) });
      return { style, say: sayOf(preset, style, read.value) };
    }
    const problem = problemOf(read.error);
    kinds.push(problem.kind);
    told = problem.told;
    messages.push({ role: "assistant", content: asked.text }, { role: "user", content: repairMessage(read.error, asked.truncated === true) });
  }
  log.warn("no style could be read from the words", { rounds: WORDS_LIMITS.rounds, tokens, problems: kinds });
  throw new Error(`I couldn't read a style from those words: ${told}`);
}
