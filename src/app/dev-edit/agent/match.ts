/**
 * match.ts — the style match as a creator reads it (Task 13b): the route's field-by-field match (`matchOf`,
 * `src/lib/edit/style/match.ts`) grouped into five marks, Pace, Captions, Title, Zooms and Look, and the one line a mark opens.
 * A line tells what was asked and what was set; why a field was moved is not in the route's answer, so no line gives a reason.
 * Pure.
 */
export type Verdict = "matched" | "near" | "not";

/** One field of the route's match. */
export interface Field {
  field: string;
  target: string;
  actual: string;
  verdict: Verdict;
}

export interface Mark {
  id: "pace" | "captions" | "title" | "zooms" | "look";
  label: string;
  verdict: Verdict;
  fields: Field[];
}

/** The five marks in the order they are shown, each with the first part of its fields' names. */
const MARKS: readonly { id: Mark["id"]; label: string; group: string }[] = [
  { id: "pace", label: "Pace", group: "pace" },
  { id: "captions", label: "Captions", group: "captions" },
  { id: "title", label: "Title", group: "title" },
  { id: "zooms", label: "Zooms", group: "punchIns" },
  { id: "look", label: "Look", group: "look" },
];

/**
 * The match as marks: a group is matched when all its fields are, not when any is `not`, else near. A group the match says
 * nothing of is left out, and so is a field of no group.
 */
export function marksOf(fields: readonly Field[]): Mark[] {
  return MARKS.flatMap(({ id, label, group }) => {
    const own = fields.filter((field) => field.field.split(".")[0] === group);
    if (own.length === 0) return [];
    const verdict: Verdict = own.some((field) => field.verdict === "not") ? "not" : own.every((field) => field.verdict === "matched") ? "matched" : "near";
    return [{ id, label, verdict, fields: own }];
  });
}

const LOOKS: Record<string, string> = { mono: "black and white" };
const look = (id: string) => LOOKS[id] ?? id;
const number = (text: string) => Number.parseFloat(text);
/** "320 ms" as "0.32 s". */
const pause = (text: string) => `${(number(text) / 1000).toFixed(2)} s`;
/** "0.12" as "12 %"; "none" stays. */
const share = (text: string) => (Number.isNaN(number(text)) ? text : `${Math.round(number(text) * 100)} %`);
/** "5.54 a minute" as "5.5", "14 a minute" as "14". */
const rate = (text: string) => String(Math.round(number(text) * 10) / 10);

/** What was asked and what was set, for each field the kit can be off in. */
const CLAUSES: Record<string, (asked: string, got: string) => string> = {
  "pace.pauseMs": (asked, got) => `asked for pauses of ${pause(asked)}, kept at ${pause(got)}`,
  "pace.quiet": (asked, got) => `asked for ${share(asked)} quiet, came to ${share(got)}`,
  "pace.cutsPerMin": (asked, got) => `asked ${rate(asked)} cuts a minute, made ${rate(got)}`,
  "captions.on": (asked, got) => `asked ${asked}, they are ${got}`,
  "captions.look": (asked, got) => `asked for the ${asked} look, set in ${got}`,
  "captions.font": (asked, got) => `asked for ${asked}, set in ${got}`,
  "captions.size": (asked, got) => `asked ${asked}, set at ${got}`,
  "captions.y": (asked, got) => `asked ${asked} from the top, placed at ${got}`,
  "captions.maxWords": (asked, got) => `asked ${asked} words at a time, set ${got}`,
  "captions.highlight": (asked, got) =>
    asked === "none" ? "asked for no highlight colour, there is one" : got === "none" ? "asked for a highlight colour, there is none" : "the highlight is another colour",
  title: (asked) => (asked === "none" ? "asked for none, there is one" : "asked for one, there is none"),
  "title.y": (asked, got) => `asked ${asked} from the top, placed at ${got}`,
  "title.stays": (asked) => (asked === "to the end" ? "asked to stay to the end, it leaves before" : "asked to leave before the end, it stays"),
  "title.frames": (asked, got) => `asked to show for ${asked}, shows for ${got}`,
  "title.look": (asked, got) => `asked for the ${asked} look, set in ${got}`,
  "title.size": (asked, got) => `asked ${asked}, set at ${got}`,
  punchIns: (asked) => (asked === "none" ? "asked for none, there are some" : "asked for some, there are none"),
  "punchIns.perMin": (asked, got) => `asked ${rate(asked)} a minute, made ${rate(got)}`,
  "punchIns.zoom": (asked, got) => `asked ${asked}×, set at ${got}×`,
  "look.preset": (asked, got) => `asked for ${look(asked)}, set to ${look(got)}`,
};

/** How many fields a line tells before it says there are more. */
const TOLD = 2;

/** The line a mark opens: "as asked", or what was asked and what was set for its first fields that are not as asked. */
export function lineOf(mark: Mark): string {
  const off = mark.fields.filter((field) => field.verdict !== "matched");
  if (off.length === 0) return `${mark.label}: as asked.`;
  const clauses = off.slice(0, TOLD).map((field) => (CLAUSES[field.field] ?? ((asked, got) => `asked ${asked}, got ${got}`))(field.target, field.actual));
  if (off.length > TOLD) clauses.push(`and ${off.length - TOLD} more`);
  return `${mark.label}: ${clauses.join("; ")}.`;
}

/** What the style does that the kit cannot draw, as one line; null when there is nothing. */
export function notInKit(notMatched: readonly string[]): string | null {
  return notMatched.length === 0 ? null : `Not in the kit yet: ${notMatched.join(", ")}.`;
}
