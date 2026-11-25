/**
 * first-cut.ts — the first cut (part 3, §5 and §12.4, and Task 10b): a creator's raw take comes back cut in its pauses,
 * captioned, titled, punched in and levelled, in a style or in the house style. The style sets the craft; Qwen chooses only
 * what reading the take can tell (the hook's words and the words to stress, and with no style the pace; the house's look is
 * natural, set by code, X129); the recipes do the rest (N8), and the creator's message is written from what the cut holds.
 *
 * The steps:
 * 1. the take's first edit (`firstEdit`);
 * 2. Qwen asked once for `ChoicesSchema`, given the take's words and pauses, the catalogue's title, call-out and look lines,
 *    how to choose stresses and, with a style, the style; an answer that is not that gets up to two repairs, quoting the zod
 *    issues (`askRound`, `readAnswer`: as every agent round asks); a hook that repeats the opening, or that takes more than two
 *    lines as the title will be set (`hookLines`, Task 7), is sent back once, and what comes next is kept;
 * 3. on the edit, each step on the edit the one before made: `tighten` at the style's pause (with a reference's quiet share,
 *    the cap `pauseFor` gives for this take, X104) or Qwen's; the captions set to the
 *    style's or the house's; the stresses, fillers dropped by code (`unfilled`, Task 12b), then `thinned` (no two neighbours, at
 *    most one in any three words); `placeCaptions`;
 *    `punchIns` at the style's or the house's rate, which read the stresses; `levelVoice`; the title (the style's or the
 *    house's place, length, look and size, its *asterisked* words in the captions' highlight colour, or `MARKED` where they
 *    have none and the style is a preset's or words') and `placeTitle`, which
 *    moves it, and last makes it smaller, so no error is left on it; with no place at any size, the short hook the same way
 *    (fix round 2); the look (the style's, or the house's natural); where the captions draw every word alike (`evenLine`:
 *    the house's), the stresses are then left out of the edit, having placed the punch-ins (Task 9b, ruling 2a);
 * 4. all of it through the door at once from the first edit, then `review`;
 * 5. a last resort, when errors are left: one `change` with `FIX_REQUEST`; then a part (title, call-out) that still carries an
 *    error is left out. Captions are never left out: when no place and no size clears them, the cut keeps the error and says
 *    so. So a first cut ends with no error it could remove (X93, as ruled in Task 10's fix round 1);
 * 6. with a style, `matchOf` on the cut;
 * 7. `say`, written by code from the finished edit (`sayOf`), in at most two short sentences (Task 14b): the cut's length, what
 *    it carries and what its captions look like; then, only when there is something to know, captions that could not be kept
 *    clear, what is not as the style (and why, where code moved it), what the kit cannot draw, and what was left out and why.
 * When no answer of Qwen's can be read, the recipes cut alone: no title, no stresses, the style's look or natural, the style's
 * pause or 250 ms.
 *
 * Every call is logged with its rounds, tokens, cost and time, never with the take's words.
 */
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import type { Analyses, TakeAnalysis } from "../analysis";
import { titleBox, type TitleProps } from "../../../edit/film/layout";
import { layout } from "../derive";
import { LOOK_IDS, type Asset, type Captions, type Edit, type Item, type Mark } from "../doc";
import { measureWide } from "../measure";
import { applyOps, type Op } from "../ops";
import { PAUSE_MS, levelVoice, placeCaptions, placeTitle, punchIns, tighten } from "../recipes";
import { review, type Finding, type FindingCode } from "../review";
import { HOUSE_STYLE } from "../style/house";
import { matchOf, type Match } from "../style/match";
import { pauseFor } from "../style/measures";
import { StyleProfileSchema, type StyleProfile } from "../style/profile";
import { FPS } from "../time";
import { firstEdit } from "../worker/takes";
import { catalogue } from "./catalogue";
import { LOOK_WORDS, MARKED, contextOf, evenLine } from "./context";
import { AGENT_LIMITS, askRound, change, newRound, readAnswer, type AgentDeps, type AgentResult, type Round } from "./loop";
import { askQwen, type Message } from "./model";

const log = createLogger({ module: "edit.agent" });

const IN_RANGE = `must be a whole number from ${PAUSE_MS.min} to ${PAUSE_MS.max}`;

/**
 * How long a hook may be, as it is seen (its asterisks left out): the title, on at most `lines` as its title is set (Task 7,
 * R2: measured by code, `hookLines`), and the short one for little room (fix round 2).
 */
export const HOOK = { title: { words: 8, chars: 44, lines: 2 }, short: { words: 3, chars: 18 } } as const;
/** A hook's words as they are seen: its asterisks left out. */
const seen = (text: string): string => text.replaceAll("*", "").trim();
/** A question mark at a hook's end, as it is seen: the ASCII one, the full-width one and the Arabic one. */
const ASKS = /[?？؟]$/;
/** A hook within its words and characters, and not ending in a question mark (X128: the one sign of a question code can read). */
const hookOf = ({ words, chars }: { words: number; chars: number }) =>
  z.string().regex(/\S/, "is blank")
    .refine((text) => seen(text).length <= chars, `is over ${chars} characters`)
    .refine((text) => seen(text).split(/\s+/).filter(Boolean).length <= words, `is over ${words} words`)
    .refine((text) => !ASKS.test(seen(text)), "ends in a question mark: give a claim, or a direct statement of what the video gives");

/** Made up, a claim within HOOK and two lines at the largest candidate label (84 px, 600); its short form within HOOK.short. */
export const HOOK_EXAMPLE = { title: "One *change* makes your bread rise", short: "Bread that *rises*" } as const;
const SHORT = hookOf(HOOK.short);

/**
 * What Qwen chooses for a first cut (spec §5; Task 10b, C: no `say`, which code writes; one in an answer is left aside; Task 7:
 * a hook of at most 8 words and 44 characters and no question, and a short one of at most 3 and 18, needed with a title). A
 * short form over its limit is left out (null) rather than asked for again (Task 12b: it was the one rule a styled cut's first
 * answer broke). Its lines are measured later, by `choose`, at the title's own size.
 * With a style, `look` and `pauseMs` are the style's and Qwen's are not used.
 */
export const ChoicesSchema: z.ZodType<{ title: string | null; short: string | null; stress: number[]; look: (typeof LOOK_IDS)[number]; pauseMs: number }> = z
  .object({
    title: hookOf(HOOK.title).nullable(),
    short: z.string().nullable(),
    stress: z.array(z.number().int().min(0)).max(5, "holds more than five words"),
    look: z.enum(LOOK_IDS),
    pauseMs: z.number().int(IN_RANGE).min(PAUSE_MS.min, IN_RANGE).max(PAUSE_MS.max, IN_RANGE),
  })
  .superRefine((choices, ctx) => {
    if (choices.title !== null && choices.short === null) ctx.addIssue({ code: "custom", path: ["short"], message: "is needed with a title" });
  })
  .transform((choices) => ({ ...choices, short: choices.short !== null && SHORT.safeParse(choices.short).success ? choices.short : null }));
export type Choices = z.infer<typeof ChoicesSchema>;

export interface FirstCutInput {
  /** The take, as the worker measured it (`assetOf`). */
  asset: Asset;
  analysis: TakeAnalysis;
  /** The signed-in creator, whose take the last resort's stills are drawn from (X63). */
  user: string;
  /** When the first cut must stop, as `now()` counts (`AGENT_LIMITS.firstCutMs` from the start, at the route). */
  deadlineMs: number;
  /** None: the house style (`HOUSE_STYLE`), and Qwen chooses the pace; the look is the house's natural (X129). */
  style?: StyleProfile;
}

export type FirstCutResult = AgentResult & {
  /** How far the cut is from the style; null with none. */
  match: ReturnType<typeof matchOf> | null;
  /** Qwen's choices as read (with a style, its look and pause are not the ones used), or the recipes' own when none could be read. */
  choices: Choices;
};

/** The last resort's request (Task 10b, B). */
export const FIX_REQUEST = "Fix only these errors, and change nothing else: not the cut, not the captions' look, not the style.";

/** The title a first cut adds: its id, and what neither the style nor the house sets (as Task 9's films were made). */
const TITLE = { id: "hook", font: "tiktok", color: "#ffffff" } as const;
/** `MARKED` lives with the loop's moves (`context.ts`), which colour an asked stress with it too (Task 9b). */
export { MARKED };
/** How near the take's end a tail pause ends, as `measures.ts` reads the spoken span. */
const TAIL_SLACK_MS = 100;
/** Stressed words at least this many apart: never two neighbours, at most one in any three words in a row. */
const STRESS_APART = 3;

/**
 * Words that never carry the point (Task 12b): articles, pronouns, auxiliaries and common prepositions and conjunctions, one closed
 * list for each language the tool hears, by the take's ISO 639-1 language. Qwen still stresses some ("be", "are"), so code drops
 * them. By language, not one list for all: German "die" and "war" are fillers, English "die" and "war" are not. Negations ("not",
 * "never", "nicht", "non") are not fillers.
 */
export const FILLERS: Readonly<Record<"en" | "de" | "it", ReadonlySet<string>>> = {
  en: new Set([
    "a", "an", "the",
    "i", "me", "my", "you", "your", "he", "him", "his", "she", "her", "it", "its", "we", "us", "our", "they", "them", "their", "this", "that", "these", "those",
    "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "have", "has", "had", "will", "would", "can", "could", "should", "may", "might", "must",
    "to", "of", "in", "on", "at", "by", "for", "with", "from", "as", "about",
    "and", "or", "but", "so", "if", "then", "than", "because",
    "it's", "i'm", "we're", "you're", "they're", "that's",
  ]),
  de: new Set([
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
    "ich", "du", "er", "sie", "es", "wir", "ihr", "mich", "dich", "sich", "mir", "dir", "ihm", "ihn", "uns", "euch", "mein", "meine", "dein", "sein", "seine", "unser",
    "ist", "sind", "bin", "bist", "war", "waren", "hat", "habe", "hast", "haben", "wird", "werden", "wurde", "kann", "können", "muss", "soll", "will",
    "in", "im", "an", "am", "auf", "aus", "bei", "mit", "nach", "von", "vom", "zu", "zum", "zur", "für", "über",
    "und", "oder", "aber", "denn", "dass", "wenn", "als", "wie",
  ]),
  it: new Set([
    "il", "lo", "la", "i", "gli", "le", "un", "uno", "una",
    "io", "tu", "lui", "lei", "noi", "voi", "loro", "mi", "ti", "si", "ci", "vi", "ne", "me", "te", "mio", "tuo", "suo",
    "è", "e", "sono", "sei", "siamo", "siete", "era", "ho", "hai", "ha", "abbiamo", "hanno", "essere", "avere",
    "di", "a", "da", "in", "con", "su", "per", "tra", "del", "della", "dei", "al", "alla", "nel", "nella",
    "che", "ma", "o", "se", "come", "perché",
  ]),
};

/** A word as the list holds it: lower case, its curly apostrophes made straight, every other mark taken off. */
const bare = (word: string): string => word.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^\p{L}\p{N}']/gu, "").replace(/^'+|'+$/g, "");

/** The stresses whose words are not fillers in the take's language; all of them in a language with no list. */
export function unfilled(stress: readonly number[], words: readonly { text: string }[], language: string | null): number[] {
  const code = language?.slice(0, 2).toLowerCase() ?? "";
  if (!Object.hasOwn(FILLERS, code)) return [...stress];
  const fillers = FILLERS[code as keyof typeof FILLERS];
  return stress.filter((index) => !fillers.has(bare(words[index]?.text ?? "")));
}

/* ── the prompt ─────────────────────────────────────────────────────────────────────────────────── */

const ANSWER = '{"title": string|null, "short": string|null, "stress": [int], "look": string, "pauseMs": int}';

const ROLE = [
  "You make the first cut of a creator's short vertical video from their raw take. The code cuts the take's pauses down, sets and places the captions and the title, punches in at cuts and levels the voice, and tells the creator what it did. You choose only what reading the take can tell.",
  `Answer with one JSON object only: ${ANSWER}.`,
  `- title: the hook shown over the opening, at most ${HOOK.title.words} words and ${HOOK.title.chars} characters, on at most two lines, in the take's own language: a claim of what the viewer gets from the video (its news, its result or its promise), from the most concrete thing the take says, wherever it says it; never the greeting, where the speaker is, that they have returned or what they are doing; nothing the take does not say; never a question. In words its first sentence does not use (the captions show it then). Put *asterisks* around the one or two words that carry it. null for none.`,
  `- short: the same hook cut down to at most ${HOOK.short.words} words and ${HOOK.short.chars} characters, for when there is little room, its key word in *asterisks* too; null when title is null. Count its words. A short form of four words or more is left out. For example, title "${HOOK_EXAMPLE.title}" (six words) and short "${HOOK_EXAMPLE.short}" (three words).`,
  "- stress: at most five words the cut leans on (the punch-ins land on them; captions that show a stress set them heavier), each by its index in the take (its w<index> in the words). Fewer is better, and none is fine. Each a word that carries the point: a name, a number, the thing promised; never a filler (is, are, be, will, the, and, so…); never two neighbours, and at most one in any three words in a row.",
  `- look: the film's look, one of ${LOOK_IDS.join(", ")} (below).`,
  `- pauseMs: the pause kept between phrases, a whole number from ${PAUSE_MS.min} to ${PAUSE_MS.max}: lower for a fast, punchy delivery, higher for a calm one.`,
].join("\n");

/** A line of the catalogue, by how it starts, and the lines indented under it. */
function block(lines: readonly string[], head: string): string[] {
  const at = lines.findIndex((line) => line.startsWith(head));
  if (at < 0) throw new Error(`the catalogue has no line "${head}"`);
  const under = lines.slice(at + 1).findIndex((line) => !line.startsWith("  "));
  return lines.slice(at, under < 0 ? undefined : at + 1 + under);
}

let system: string | null = null;
/** The role, then the catalogue's look lines, the title and call-out parts, and how to read the words and the pauses. The same every time. */
function firstCutPrompt(): string {
  if (system !== null) return system;
  const lines = catalogue().split("\n");
  const parts = [...block(lines, "title — "), ...block(lines, "callout — ")];
  return (system = [ROLE, "", "From the edit's catalogue:", ...block(lines, "look.set "), ...parts, "", "How the take is given:", ...block(lines, "- words: "), ...block(lines, "- pauses: ")].join("\n"));
}

/** The take's words and pauses as the context writes them, and with a style, the style and what it leaves to Qwen. */
function takeMessage(edit: Edit, analyses: Analyses, style: StyleProfile | undefined): string {
  const context = contextOf(edit, analyses, []);
  const sections = [`words:\n${context.words}`, `pauses:\n${context.pauses}`];
  if (style) {
    const title = style.title?.on ? "The style opens with a title: write its words in the style's manner." : "The style has no title: answer title null.";
    sections.push(`style:\n${JSON.stringify(style)}\nThe style sets the pace, the captions, the title's place and length, the punch-ins and the look: answer look "${style.look.preset}" and pauseMs ${style.pace.pauseMs}, as they are. ${title} Choose the words to stress in the style's manner.`);
  } else {
    // The house's look is set by code (X129): the model is told the truth, and its answer keeps its `look` field.
    sections.push(`look:\nThe film's look is ${HOUSE_STYLE.look.preset}: answer look "${HOUSE_STYLE.look.preset}".`);
  }
  return sections.join("\n\n");
}

const repairMessage = (error: string, truncated: boolean): string =>
  `${truncated ? "Your answer stopped at the token limit before it ended, so it could not be read" : "Your answer could not be read"}: ${error}. Answer again with one JSON object only: ${ANSWER}.`;

/* ── the choices ─────────────────────────────────────────────────────────────────────────────────── */

/** How many of the take's first words a hook is held against. */
const OPENING_WORDS = 6;
const plainWord = (word: string): string => (word.toLowerCase().split(/['’]/)[0] ?? "").replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * True when a hook repeats the take's opening (Task 14b, ruling 6): more than half of its words are among the take's first six
 * ("We're" counts as "we"). The owner's first cut carried his own opening words as its title, so that for two seconds the
 * same words stood on screen twice, title above and captions below.
 */
export function repeatsOpening(title: string, words: readonly { text: string }[]): boolean {
  const opening = new Set(words.slice(0, OPENING_WORDS).map((word) => plainWord(word.text)).filter((word) => word !== ""));
  const hook = title.split(/\s+/).map(plainWord).filter((word) => word !== "");
  return hook.length > 0 && hook.filter((word) => opening.has(word)).length > hook.length / 2;
}

/** Said, once, to a hook that repeats the opening. */
const repeatsMessage = (opening: string): string =>
  `The title repeats the take's opening words ("${opening}"), which the captions show at the same moment. Give a title that says what the video is about or what it promises, in words that sentence does not use. Answer again with one JSON object only: ${ANSWER}.`;

/** The lines a hook is set on as `title` sets it (its look, size and weight; TikTok Sans), by the server's tables. */
export function hookLines(text: string, title: NonNullable<StyleProfile["title"]>): number {
  const props: TitleProps = { text, font: TITLE.font, look: title.look, y: title.y, size: title.size, color: TITLE.color, accent: null, ...(title.weight !== undefined && { weight: title.weight }) };
  return titleBox(props, (line, weight, size, tracking) => measureWide(line, TITLE.font, weight, size, tracking).width).lines.length;
}

/** How many of a hook's characters two lines hold as `title` sets it: the longest start of it, in whole words, set on two. */
function heldOnTwo(text: string, title: NonNullable<StyleProfile["title"]>): number {
  const words = seen(text).split(/\s+/).filter(Boolean);
  const starts = words.map((_, i) => words.slice(0, i + 1).join(" "));
  return starts.filter((start) => hookLines(start, title) <= HOOK.title.lines).at(-1)?.length ?? 0;
}

/** Said, once, to a hook over two lines (Task 7, R2): how many lines it takes and how much of it two lines hold. */
const linesMessage = (hook: string, lines: number, held: number): string =>
  `The title "${seen(hook)}" takes ${lines} lines at its size; at most two: two lines hold about ${held} characters of it. Answer again with one JSON object only: ${ANSWER}.`;

/**
 * Why a readable answer's hook is sent back, and what it is told; null when it is kept. One that repeats the opening (Task 14b),
 * else one over two lines at the title's own look, size and weight (Task 7, X128); never with no title to set it in.
 */
function sentBack(hook: string | null, words: readonly { text: string }[], title: NonNullable<StyleProfile["title"]> | null): { error: string; message: string } | null {
  if (hook === null) return null;
  if (repeatsOpening(hook.replaceAll("*", ""), words)) {
    return { error: "the title repeats the take's opening words", message: repeatsMessage(words.slice(0, OPENING_WORDS).map((word) => word.text).join(" ")) };
  }
  if (title === null) return null;
  const lines = hookLines(seen(hook), title); // the string `heldOnTwo` measures: the words as drawn, no asterisks
  if (lines <= HOOK.title.lines) return null;
  return { error: "the title takes more than two lines", message: linesMessage(hook, lines, heldOnTwo(hook, title)) };
}

/** `ChoicesSchema`, with each stressed word one the take has. */
function choicesFor(words: number): z.ZodType<Choices> {
  return ChoicesSchema.superRefine((choices, ctx) => {
    choices.stress.forEach((index, i) => {
      if (index < words) return;
      ctx.addIssue({ code: "custom", path: ["stress", i], message: words > 0 ? `is w${index}; the take's words are w0 to w${words - 1}` : "the take has no words to stress" });
    });
  });
}

/** The stresses kept: in the take's order, each at least `STRESS_APART` words after the one kept before it; a later one is dropped. */
export function thinned(stress: readonly number[]): number[] {
  const kept: number[] = [];
  for (const index of [...new Set(stress)].sort((a, b) => a - b)) {
    const last = kept.at(-1);
    if (last === undefined || index - last >= STRESS_APART) kept.push(index);
  }
  return kept;
}

/**
 * Qwen's choices: one answer, and up to two repairs (`AGENT_LIMITS.rounds` in all), none once the deadline has passed. A call
 * that fails is a round, asked again after a moment. Null when no answer could be read. A hook is sent back once (`sentBack`),
 * held against the take's `words` and set as `title` sets it (null: the cut has no title).
 */
async function choose(
  messages: Message[], schema: z.ZodType<Choices>, deadlineMs: number, deps: Required<Pick<AgentDeps, "ask" | "now" | "wait">>,
  words: readonly { text: string }[], title: NonNullable<StyleProfile["title"]> | null,
): Promise<{ choices: Choices | null; rounds: Round[]; cost: number }> {
  const { now } = deps;
  const rounds: Round[] = [];
  const failures = { count: 0 };
  let cost = 0;
  /** True once a hook was sent back (it repeated the opening, or took more than two lines): once, then whatever comes is kept. */
  let asked = false;
  /** The answer that was sent back for its hook: kept when nothing readable comes after it (the final review: it was lost). */
  let first: Choices | null = null;
  for (let n = 1; n <= AGENT_LIMITS.rounds && deadlineMs - now() > 0; n++) {
    const begun = now();
    const round = newRound(n);
    rounds.push(round);
    const called = await askRound({ ...deps, deadlineMs }, round, messages, n === AGENT_LIMITS.rounds, failures);
    round.ms = now() - begun;
    if (called === "deadline") break;
    if (called === "failed") continue;
    cost += called.cost;
    const read = readAnswer(called.answer.text, schema);
    if (read.ok) {
      // A hook that repeats the opening words or takes more than two lines is asked for again, once, while a round is left;
      // then whatever comes is kept.
      const back = !asked && n < AGENT_LIMITS.rounds ? sentBack(read.value.title, words, title) : null;
      if (back) {
        asked = true;
        first = read.value;
        round.outcome = "refused";
        round.error = back.error;
        messages.push({ role: "assistant", content: called.answer.text }, { role: "user", content: back.message });
        continue;
      }
      round.outcome = "chosen";
      return { choices: read.value, rounds, cost };
    }
    round.outcome = "unreadable";
    round.error = read.error;
    messages.push({ role: "assistant", content: called.answer.text }, { role: "user", content: repairMessage(read.error, called.answer.truncated === true) });
  }
  return { choices: first, rounds, cost };
}

/* ── the cut ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The title as the profile places it; null when there is to be none. One that stays is held to the film's end (`frames: null`),
 * so `placeTitle` judges it over the whole film; its letters are the profile's ink, or white (Task 9c), at the profile's weight
 * when it has one (Task 8; else the look's own). Its marked words take the
 * captions' highlight colour or, where the captions have none and the style is a preset's or words', `MARKED`, so the key word
 * shows (Task 12b, option A; X127); the house and a style read from a reference get no colour their captions do not have.
 */
function titleOp(edit: Edit, text: string | null, profile: StyleProfile): Extract<Op, { op: "item.add" }> | null {
  if (text === null || !profile.title?.on) return null;
  const { y, frames, look, size, stays, ink, weight } = profile.title;
  const accent = profile.captions.highlight ?? (profile.source.kind === "preset" || profile.source.kind === "words" ? MARKED : null);
  const props = { text, font: TITLE.font, look, y, size, color: ink ?? TITLE.color, accent, ...(weight !== undefined && { weight }) };
  return { op: "item.add", item: { id: freshId(edit, TITLE.id), part: "title", anchor: "start", at: 0, frames: stays ? null : frames, props } };
}

/** `base`, or `base-2`, `base-3`… when the edit already has an id of that name. */
function freshId(edit: Edit, base: string): string {
  const used = new Set([...edit.assets.map((asset) => asset.id), ...edit.shots.flatMap((shot) => [shot.id, ...shot.marks.map((mark) => mark.id)]), ...edit.items.map((item) => item.id)]);
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}

const isError = (finding: Finding): boolean => finding.severity === "error";
/** A captions finding: one that names no mark and no item, of `on-face` or `under-buttons`. */
const isCaptions = (finding: Finding): boolean => finding.where.mark === undefined && finding.where.item === undefined && (finding.code === "on-face" || finding.code === "under-buttons");
const codesOf = (findings: readonly Finding[], of: (finding: Finding) => boolean): Set<FindingCode> => new Set(findings.filter((finding) => isError(finding) && of(finding)).map((finding) => finding.code));

/** The parts (marks and items) review finds an error on, each once, with its first such error. */
function partsWithErrors(edit: Edit, findings: readonly Finding[]): { thing: Mark | Item; where: "mark" | "item"; finding: Finding }[] {
  const out = new Map<string, { thing: Mark | Item; where: "mark" | "item"; finding: Finding }>();
  for (const finding of findings.filter(isError)) {
    const item = finding.where.item ? edit.items.find((each) => each.id === finding.where.item) : undefined;
    const mark = finding.where.mark ? edit.shots.flatMap((shot) => shot.marks).find((each) => each.id === finding.where.mark) : undefined;
    const thing = item ?? mark;
    if (thing && !out.has(thing.id)) out.set(thing.id, { thing, where: item ? "item" : "mark", finding });
  }
  return [...out.values()];
}

/* ── what the creator reads ─────────────────────────────────────────────────────────────────────── */

/** A part's error, as the reason it was left out. */
const PLAIN: Partial<Record<FindingCode, string>> = {
  "on-face": "it would cover your face",
  "under-buttons": "it would sit under the app's buttons or bars",
  "on-text": "it would cover other words on screen",
  "text-fits": "it would not fit on the screen",
  "two-titles": "two titles would show at once",
};
const PART_NAMES: Record<string, string> = { title: "the title", callout: "a call-out", progress: "the progress bar", cutaway: "a cutaway", sound: "a sound" };


/**
 * The captions as the creator reads them (Task 12b): what the look draws, then what takes the colour, only where something does:
 * the word being said where the look colours it (`pill`, `pop`, `highlight`), the stressed words with `plain`; nothing more with
 * no highlight colour, or `plain` with no stress.
 */
function captionsSaid(captions: Captions, stressed: number): string {
  const look = LOOK_WORDS[captions.look];
  if (captions.highlight === null) return look;
  if (captions.look !== "plain") return `${look}, the word being said in colour`;
  return stressed > 0 ? `${look}, the words that matter in colour` : look;
}

/** What a thing was moved or made smaller for, in the creator's words; null when it had no error to be moved for. */
function why(codes: ReadonlySet<FindingCode>): string | null {
  const reasons = [
    codes.has("on-face") ? "off your face" : null,
    codes.has("under-buttons") ? "clear of the app's buttons" : null,
    codes.has("on-text") ? "clear of the captions" : null,
  ].filter((reason) => reason !== null);
  if (reasons.length > 0) return `to stay ${reasons.join(" and ")}`;
  return codes.has("text-fits") ? "to fit" : null;
}

const areaOf = (field: string): string => field.split(".")[0] ?? field;

/** "a", "a and b", "a, b and c". */
function listed(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** A field not as the style, as a clause of "It follows the style, except that …": which way it differs, in plain words. */
function clauseOf(field: Match): string {
  const [want, got] = [Number.parseFloat(field.target), Number.parseFloat(field.actual)];
  const more = got > want;
  switch (field.field) {
    case "pace.pauseMs": return more ? "the pauses are longer" : "the pauses are shorter";
    case "pace.quiet": return field.actual === "none" ? "it does not pause" : more ? "it pauses more" : "it pauses less";
    case "pace.cutsPerMin": return more ? "it cuts more often" : "it cuts less often";
    case "captions.on": return field.actual === "off" ? "it has no captions" : "it has captions";
    case "captions.look": return "the captions look different";
    case "captions.font": return "the captions use another typeface";
    case "captions.size": return more ? "the captions are larger" : "the captions are smaller";
    case "captions.y": return more ? "the captions sit lower" : "the captions sit higher";
    case "captions.maxWords": return more ? "more words show at once" : "fewer words show at once";
    case "captions.highlight": return "the captions' colour is different";
    case "title": return field.actual === "none" ? "it has no title" : "it has a title";
    case "title.y": return more ? "the title sits lower" : "the title sits higher";
    case "title.frames": return more ? "the title shows for longer" : "the title shows for less time";
    case "title.look": return "the title looks different";
    case "title.size": return more ? "the title is larger" : "the title is smaller";
    case "punchIns": return field.actual === "none" ? "it does not punch in" : "it punches in";
    case "punchIns.perMin": return more ? "it punches in more often" : "it punches in less often";
    case "punchIns.zoom": return more ? "it punches in closer" : "it punches in less close";
    case "look.preset": return `the look is ${field.actual}`;
    default: return `${field.field} is different`;
  }
}

/**
 * The match, as clauses of the say's second sentence (Task 14b; it was two sentences of its own): what is not as the style,
 * each in plain words with what it was moved for where code moved it (`reasons`, by field), or that it follows the style;
 * then what the kit cannot draw. A field only near the style is not named, nor an area in `left` (said already, as left out).
 */
function matchSay(match: ReturnType<typeof matchOf>, reasons: Record<string, string | null>, left: ReadonlySet<string>): string[] {
  const off = match.fields.filter((field) => field.verdict === "not" && !left.has(areaOf(field.field)));
  const clauses = off.map((field) => [clauseOf(field), reasons[field.field]].filter((part) => part).join(" "));
  return [
    clauses.length > 0 ? `it follows the style, except that ${listed(clauses)}` : "it follows the style",
    ...(match.notMatched.length > 0 ? [`not in the kit yet: ${match.notMatched.join(", ")}`] : []),
  ];
}

/** What the creator reads beside the edit itself: the match's clauses, and the other clauses of the second sentence. */
interface Said {
  match: string[] | null;
  /** What was left out and why, an error left that the captions' clause does not tell, the recipes cutting alone. */
  clauses: string[];
}

/** A look's preset as a creator would call it: the kit's own name only where it is a plain word. */
const LOOK_SAID: Partial<Record<Edit["look"]["preset"], string>> = { mono: "black-and-white" };

/**
 * The creator's message, from the finished edit only: at most two short sentences (Task 14b: a first cut's say follows the
 * rule a change's does, about what the creator will see; it was up to five, with the title's words and each step). The
 * first: the cut's length, which is the point of a first cut, what it carries (a title, punch-ins, a look other than natural),
 * and what its captions look like. The second only when there is something the creator has to know: captions that could not
 * be kept clear, how it differs from a style (or that it follows it), what was left out and why, the recipes cutting alone.
 * Never a thing the edit does not hold.
 */
function sayOf(first: Edit, edit: Edit, findings: readonly Finding[], styled: boolean, said: Said): string {
  const seconds = (each: Edit) => (layout(each).frames / FPS).toFixed(1);
  const [before, after] = [seconds(first), seconds(edit)];
  const cut = before === after ? `Your first cut keeps the take's ${after} s` : `Your first cut runs ${after} s, down from ${before} s`;
  const punched = edit.shots.filter((shot) => shot.framing.from.zoom > 1).length;
  const carries = [
    edit.items.some((item) => item.part === "title") ? "a title" : null,
    punched === 0 ? null : punched === 1 ? "a punch-in" : `${punched} punch-ins`,
    edit.look.preset === "natural" ? null : `a ${LOOK_SAID[edit.look.preset] ?? edit.look.preset} look`,
  ].filter((each) => each !== null);
  const stressed = edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []) : [])).filter((word) => word.stress).length;
  const captions = edit.captions.on ? `; its captions are ${captionsSaid(edit.captions, stressed)}` : "";
  const one = `${cut}${carries.length > 0 ? `, with ${listed(carries)}` : ""}${captions}.`;

  const captionsLeft = codesOf(findings, isCaptions);
  const still = edit.captions.on
    ? [captionsLeft.has("on-face") ? "the captions still cover your face in places" : null, captionsLeft.has("under-buttons") ? "the captions still sit under the app's buttons in places" : null].filter((each) => each !== null)
    : [];
  // A style it follows is worth its own word; without one there is nothing to hold the cut against.
  const two = [...still, ...(styled ? (said.match ?? []) : []), ...said.clauses];
  return two.length > 0 ? `${one} ${capital(two.join("; "))}.` : one;
}

/**
 * The pause a style's cut keeps (X104): with the style's quiet share, the cap `pauseFor` gives for this take's pauses over its
 * spoken span (from the head pause's end, or 0, to the tail pause's start, or the end: as `measures.ts` measures a reference's
 * share); else the style's own pause.
 */
function paceOf(style: StyleProfile, analysis: TakeAnalysis, asset: Asset): number {
  const quiet = style.pace.quiet;
  if (typeof quiet !== "number") return style.pace.pauseMs;
  const { pauses } = analysis;
  const ms = asset.kind === "video" ? asset.ms : 0;
  const [first, last] = [pauses[0], pauses.at(-1)];
  const from = first && first.startMs === 0 ? first.endMs : 0;
  const to = last && last !== first && last.endMs >= ms - TAIL_SLACK_MS ? last.startMs : ms;
  return pauseFor(pauses, { fromMs: from, toMs: to }, quiet);
}

/* ── the first cut ───────────────────────────────────────────────────────────────────────────────── */

/** The first cut of a take: see the file's header. */
export async function firstCut(input: FirstCutInput, deps: AgentDeps = {}): Promise<FirstCutResult> {
  const ask = deps.ask ?? askQwen;
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  const { asset } = input;
  const style = input.style === undefined ? undefined : StyleProfileSchema.parse(input.style);
  const profile = style ?? HOUSE_STYLE;
  const analyses: Analyses = { [asset.id]: input.analysis };
  const library: readonly Asset[] = [asset];
  const through = (edit: Edit, ops: Op[], what: string): Edit => {
    if (ops.length === 0) return edit;
    const made = applyOps(edit, ops, library);
    if (!made.ok) throw new Error(`the first cut's ${what} were refused: ${made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; ")}`);
    return made.edit;
  };

  // 1, 2: the first edit, and Qwen's choices.
  const first = firstEdit(asset);
  const words = asset.kind === "video" ? (asset.words?.length ?? 0) : 0;
  const messages: Message[] = [{ role: "system", content: firstCutPrompt() }, { role: "user", content: takeMessage(first, analyses, style) }];
  const asked = await choose(messages, choicesFor(words), input.deadlineMs, { ask, now, wait }, asset.kind === "video" ? (asset.words ?? []) : [], profile.title?.on ? profile.title : null);
  const choices: Choices = asked.choices ?? { title: null, short: null, stress: [], look: profile.look.preset, pauseMs: profile.pace.pauseMs };

  // 3: each step on the edit the one before made.
  const ops: Op[] = [];
  let edit = first;
  const step = (made: Op[], what: string) => {
    edit = through(edit, made, what);
    ops.push(...made);
  };
  step(tighten(edit, analyses, { pauseMs: style ? paceOf(style, input.analysis, asset) : choices.pauseMs }), "tightened cuts");
  const stresses = thinned(unfilled(choices.stress, asset.kind === "video" ? (asset.words ?? []) : [], input.analysis.language)).map((index): Op => ({ op: "word.set", asset: asset.id, index, stress: true }));
  step([{ op: "captions.set", ...profile.captions }, ...stresses], "captions and stresses");
  const captionsFor = codesOf(review(edit, analyses), isCaptions);
  step(placeCaptions(edit, analyses), "placed captions");
  const placedCaptions = { y: edit.captions.y, size: edit.captions.size };
  if (profile.punchIns) step(punchIns(edit, analyses, profile.punchIns), "punch-ins");
  step(levelVoice(edit, analyses), "levelled volumes");
  const title = titleOp(edit, choices.title, profile);
  let titleFor = new Set<FindingCode>();
  let placedTitle: { y: number; size: number } | null = null;
  if (title) {
    step([title], "title");
    titleFor = codesOf(review(edit, analyses), (finding) => finding.where.item === title.item.id);
    step(placeTitle(edit, analyses, title.item.id), "placed title");
    // No place for the hook at any of its sizes: the short one, from the profile's own place and size (fix round 2).
    const onIt = (finding: Finding) => isError(finding) && finding.where.item === title.item.id;
    if (choices.short !== null && profile.title && review(edit, analyses).some(onIt)) {
      step([{ op: "item.set", id: title.item.id, props: { text: choices.short, y: profile.title.y, size: profile.title.size } }], "short title");
      step(placeTitle(edit, analyses, title.item.id), "placed short title");
    }
    const placed = edit.items.find((item) => item.id === title.item.id);
    placedTitle = placed?.part === "title" ? { y: placed.props.y, size: placed.props.size } : null;
  }
  step([{ op: "look.set", preset: profile.look.preset }], "look"); // the style's, or the house's natural (X129): never Qwen's
  // Captions that draw every word alike show no stress (Task 9b, ruling 2a, (b)): the stresses chose where the punch-ins land,
  // as on every other style, and are then left out of the edit, so an asked one later is the only word in colour (`stressShows`).
  // Every box is the same with them or without (a stressed word is set at the captions' own weight here), so nothing else moves.
  if (evenLine(edit.captions)) ops.splice(0, ops.length, ...ops.filter((op) => !stresses.includes(op)));

  // 4: all of it through the door at once; then review.
  edit = through(first, ops, "operations");
  let findings = review(edit, analyses);

  // 5: the last resort, and what is left out.
  const rounds = [...asked.rounds];
  let cost = asked.cost;
  if (findings.some(isError)) {
    const fixed = await change({ edit, analyses, request: FIX_REQUEST, library, user: input.user, deadlineMs: input.deadlineMs }, deps);
    rounds.push(...fixed.rounds.map((round) => ({ ...round, n: round.n + asked.rounds.length })));
    cost += fixed.cost;
    ops.push(...fixed.ops);
    [edit, findings] = [fixed.edit, fixed.findings];
  }
  const clauses: string[] = [];
  const leftOut = new Set<string>();
  const removing = partsWithErrors(edit, findings);
  if (removing.length > 0) {
    const removed = removing.map(({ thing, where }): Op => (where === "item" ? { op: "item.remove", id: thing.id } : { op: "mark.remove", id: thing.id }));
    edit = through(edit, removed, "parts left out");
    ops.push(...removed);
    findings = review(edit, analyses);
    for (const { thing, finding } of removing) {
      leftOut.add(thing.part);
      clauses.push(`I left ${PART_NAMES[thing.part] ?? "a part"} out: ${PLAIN[finding.code] ?? "it would leave a problem in the video"}`);
    }
  }
  const left = findings.filter(isError);
  if (left.length > 0) log.warn("a first cut ends with review errors", { codes: left.map((finding) => finding.code) });
  // The captions' sentence tells their face and buttons errors; any other error left is told here, once.
  if (left.some((finding) => !isCaptions(finding))) clauses.push("something in the video still needs fixing; ask me to fix it");
  if (asked.choices === null) clauses.push("I couldn't choose a title or the words to stress this time");

  // 6: with a style, how far the cut is from it; a move is given its reason only where code made it and it stands.
  const match = style ? matchOf(style, edit, analyses) : null;
  let matched: string[] | null = null;
  if (match) {
    const kept = (field: "y" | "size", placed: { y: number; size: number } | null, now: number, own: number) => placed !== null && placed[field] === now && placed[field] !== own;
    const finalTitle = edit.items.find((item) => item.id === title?.item.id);
    const titleNow = finalTitle?.part === "title" ? finalTitle.props : null;
    const reasons = {
      "captions.y": kept("y", placedCaptions, edit.captions.y, profile.captions.y) ? why(captionsFor) : null,
      "captions.size": kept("size", placedCaptions, edit.captions.size, profile.captions.size) ? why(captionsFor) : null,
      "title.y": titleNow && profile.title && kept("y", placedTitle, titleNow.y, profile.title.y) ? why(titleFor) : null,
      "title.size": titleNow && profile.title && kept("size", placedTitle, titleNow.size, profile.title.size) ? why(titleFor) : null,
    };
    matched = matchSay(match, reasons, leftOut);
  }

  const tokens = rounds.reduce((sum, round) => ({ input: sum.input + round.tokens.input, output: sum.output + round.tokens.output }), { input: 0, output: 0 });
  const ms = now() - started;
  log.info("a first cut", {
    style: style?.source.kind ?? "house", chosen: asked.choices !== null, rounds: rounds.length, outcomes: rounds.map((round) => round.outcome),
    ops: ops.length, errors: left.length, tokens, cost, ms,
  });
  return { say: sayOf(first, edit, findings, style !== undefined, { match: matched, clauses }), ops, edit, findings, rounds, ms, cost, tokens, changed: ops.length > 0, sayBy: "code", match, choices };
}
