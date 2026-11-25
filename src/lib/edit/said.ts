/**
 * said.ts — the words the editor writes by code, never the model's (spec 2026-11-24-editor-screens-design.md §5.3, §5.4, E7;
 * plan 2026-11-24-editor-screens-a, Task 3): the first cut's line from the facts of the cut; the sentence of a change made by
 * hand; the edit's title; a look's name; the next steps offered under the latest answer. Pure, and light enough for the page.
 */
import { FPS, filmFrames, type Edit, type Op } from "@/lib/edit";
import { presetOf } from "@/lib/edit/style/presets";

/** The next steps under the latest answer in slice A, after "N to check" (§5.3). */
export const NEXT_ASKS = ["Shorter", "Bigger captions", "Add zooms"] as const;

const seconds = (edit: Edit): string => (filmFrames(edit) / FPS).toFixed(1);
const wordsOf = (edit: Edit) => edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []) : []));

/** Minutes to a tenth, as said: "5", "3.3". */
const minutes = (tenths: number): string => (tenths / 10).toFixed(1).replace(/\.0$/, "");

/**
 * What is said first of a take longer than a film may be (R31): its length, and that the cut is made from the stretch of it
 * the film can hold (its first three minutes, `firstEdit`), so the rest of the take is not missed in silence. Null for a take
 * that is all in the film. Its length is said to a tenth of a minute and never as no longer than that stretch: a take of 3:02
 * is "3.1 minutes", not "3 minutes".
 */
function longTakeSaid(take: Edit): string | null {
  const shot = take.shots[0];
  const heard = take.assets.find((asset) => asset.id === shot?.asset);
  if (!shot || heard?.kind !== "video" || heard.ms <= shot.endMs - shot.startMs) return null;
  const used = Math.round((shot.endMs - shot.startMs) / 6000);
  const length = Math.max(Math.round(heard.ms / 6000), used + 1);
  return `Your take is ${minutes(length)} minutes long. This cut is made from its first ${minutes(used)} minutes.`;
}

/**
 * The first cut's line (§5.4): what was cut, then what is on. `take` is the take as one shot (`firstEdit`), `cut` the first
 * cut. The agent's long first-cut sentence is not shown. Three lines of the spec, and two more for a look with no label
 * (`mono`) or a cut whose label was left out by its review: "Captions are on." and "A label is on.". A take longer than a film
 * may be is said first (R31), and "Cut from" then starts from the three minutes the cut was made from.
 */
export function firstCutLine(take: Edit, cut: Edit): string {
  const long = longTakeSaid(take);
  const said = cutSaid(take, cut);
  return long === null ? said : `${long} ${said}`;
}

function cutSaid(take: Edit, cut: Edit): string {
  if (wordsOf(cut).length === 0) return "No speech was found, so there are no captions.";
  const [from, to] = [seconds(take), seconds(cut)];
  const label = cut.items.some((item) => item.part === "title");
  const on = cut.captions.on && label ? "Captions and a label are on." : cut.captions.on ? "Captions are on." : label ? "A label is on." : null;
  const said = [from === to ? null : `Cut from ${from} to ${to} seconds.`, on].filter((part) => part !== null);
  return said.length > 0 ? said.join(" ") : "Your first cut is ready.";
}

/** A word without the punctuation around it; "" for one that is all punctuation. */
const stripped = (text: string) => text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** A word bare of case and of the punctuation around it; "" for one that is all punctuation. */
const bare = (text: string) => stripped(text).toLocaleLowerCase();

/** Whether two heard words are the same word ("Claudel" and "claudel."): "Fix all N" offers the others. */
export function sameWord(a: string, b: string): boolean {
  return bare(a) !== "" && bare(a) === bare(b);
}

/** A change `opsSay` has no words for. The route refuses such a change before it is made (R13), so this is a caller's mistake. */
function unsaid(op: Op, what?: string): never {
  throw new Error(`opsSay has no words for ${op.op}${what ? ` (${what})` : ""}`);
}

/**
 * The sentence of a change made by hand (`POST …/ops`): each word fixed, once or "in N places", then captions on or off.
 * `before` is the edit the ops were applied to, and each op is read against it.
 *
 * A word heard in several spellings ("Claudel", "claudel.") and fixed to one word is one fix (`sameWord`), said without the
 * marks around the words. The same word given a new mark or a new case is said as written, and no sentence ends on two
 * closing marks. "Nothing changed." is said only when nothing did: no ops, a word set to the text it has, a setting given
 * the value it has. For a change it has no words for (a word hidden or stressed, a caption setting other than on and off,
 * any other op, a word `before` does not hold) it throws rather than call it nothing.
 */
export function opsSay(before: Edit, ops: readonly Op[]): string {
  const fixed = new Map<string, { from: string; to: string; times: number }>();
  const captions: string[] = [];
  for (const op of ops) {
    if (op.op === "captions.set") {
      const { op: _op, on, ...rest } = op;
      const set = (Object.keys(rest) as (keyof typeof rest)[]).filter((key) => rest[key] !== undefined && rest[key] !== before.captions[key]);
      if (set.length > 0) unsaid(op, set.join(", "));
      if (on !== undefined) captions.push(on ? "Captions are on." : "Captions are off.");
      continue;
    }
    if (op.op !== "word.set") unsaid(op);
    const asset = before.assets.find((each) => each.id === op.asset);
    const word = asset?.kind === "video" ? asset.words?.[op.index] : undefined;
    if (!word) unsaid(op, "a word the edit does not hold");
    const flags = (["hidden", "stress"] as const).filter((flag) => op[flag] !== undefined && op[flag] !== (word[flag] === true));
    if (flags.length > 0) unsaid(op, flags.join(", "));
    const text = op.text?.normalize("NFC"); // as the door stores it
    if (text === undefined || text === word.text) continue;
    // The same word with a new mark or case: its marks are the change, so both are said whole, and told apart exactly.
    const whole = sameWord(word.text, text);
    const [from, to] = whole ? [word.text, text] : [stripped(word.text) || word.text, stripped(text) || text];
    const pair = `${from}\u0000${to}`;
    const key = whole ? pair : pair.toLocaleLowerCase();
    const seen = fixed.get(key);
    if (seen) seen.times += 1;
    else fixed.set(key, { from, to, times: 1 });
  }
  const words = [...fixed.values()].map(({ from, to, times }) => {
    const said = `Changed "${from}" to "${to}"${times > 1 ? ` in ${times} places` : ""}`;
    return /[.!?…]"$/.test(said) ? said : `${said}.`; // a word's own closing mark ends the sentence
  });
  const all = [...words, ...captions];
  return all.length > 0 ? all.join(" ") : "Nothing changed.";
}

/**
 * The edit's title (§6, the card): the take's first words up to the end of its first sentence or five words, without the
 * closing mark; with none heard, its file's name without the extension; "Your video" when that is empty.
 */
export function takeTitle(name: string, words: readonly { text: string }[] | null): string {
  const first: string[] = [];
  for (const word of words ?? []) {
    first.push(word.text);
    if (/[.!?]$/.test(word.text) || first.length === 5) break;
  }
  const said = first.join(" ").replace(/[.!?,;:]+$/, "").trim();
  if (said !== "") return said.slice(0, 200);
  const stem = name.replace(/\.[A-Za-z0-9]{2,4}$/, "").trim();
  return stem === "" ? "Your video" : stem.slice(0, 200);
}

/** A look's name, as the sheet and the card say it: "Our pick" for the house style (and before any cut). */
export function lookName(key: string | null): string {
  if (key === null || key === "house") return "Our pick";
  if (key === "video") return "Like a video";
  if (key === "words") return "Described";
  return presetOf(key)?.name ?? "Our pick";
}
