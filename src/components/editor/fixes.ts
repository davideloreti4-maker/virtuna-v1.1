/**
 * fixes.ts — what a thing to check says to a creator, and its fix (spec 2026-11-24-editor-screens-design.md E18; plan
 * 2026-11-25-editor-screens-b, Tasks 9 and 10). The review writes for the agent: the thing by its id, the moment in seconds, a
 * number of pixels. A creator gets one plain sentence instead, the thing named as they see it ("The captions", "The title") with
 * the verb agreeing (the captions are plural), and no number they cannot act on: the card says the moment itself.
 *
 * Where a request clears the finding, it is offered as one button; its request goes to the agent with the finding's frame as its
 * moment, so "here" is that frame. Where none does (a part that fades in and out at once, a letter the tables lack), the card
 * offers "Show" only. `empty-start` cannot reach a stored edit: the door refuses every edit that would have it ("What the code
 * forced", 2). Task 10 tried every fix three times on the real model (`scripts/edit-agent-proof.ts fixes`, 2026-11-25), each on a
 * first cut made to carry its finding and sent as the card sends it; a fix is offered only where it cleared its finding (no
 * finding of its code left about the same thing) in two runs of three, and each rate is beside it below. A button that does not
 * fix what it names breaks the creator's trust. A code the tables do not know (a review newer than the page) is said plainly,
 * with no fix, and can still be put away.
 *
 * Pure: no React. The proof script imports it.
 */
import type { Edit } from "@/lib/edit";
import type { Finding, FindingCode } from "@/lib/edit/review";

/** What a finding is about, as the creator sees it. */
export type Thing = "captions" | "title" | "callout" | "progress" | "cutaway" | "sound";

/** A fix as one button: its words, and the request it sends. */
export interface Fix {
  label: string;
  request: string;
}

/** What a finding is about: its item's or its mark's part, else the captions. */
export function thingOf(finding: Finding, edit: Edit): Thing {
  const { item, mark } = finding.where;
  if (item !== undefined) return edit.items.find((each) => each.id === item)?.part ?? "captions";
  if (mark !== undefined) return edit.shots.flatMap((shot) => shot.marks).find((each) => each.id === mark)?.part ?? "captions";
  return "captions";
}

const NAMES: Record<Thing, string> = { captions: "captions", title: "title", callout: "call-out", progress: "progress bar", cutaway: "cutaway", sound: "sound" };

/** How a sentence names a thing: with "The" or "the", and its verbs and pronouns agreeing with it (the captions are plural). */
interface Named {
  /** The captions: a plural. */
  many: boolean;
  The: string;
  the: string;
  /** The verb's form for one thing, or for the captions. */
  verb(one: string, many: string): string;
  it: string;
  them: string;
  its: string;
}
function named(thing: Thing): Named {
  const many = thing === "captions";
  return {
    many, The: `The ${NAMES[thing]}`, the: `the ${NAMES[thing]}`, verb: (one, more) => (many ? more : one), it: many ? "they" : "it", them: many ? "them" : "it", its: many ? "their" : "its",
  };
}

/**
 * The sentence for each code. A cut is told by what the review says of it: the film's start, its end, or a cut between shots. An
 * `on-face` finding a creator is shown is the face covered: the chin touched is never put to them (`toCheck`, S18).
 */
const SENTENCES: Record<FindingCode, (x: Named, finding: Finding) => string> = {
  "on-face": (x) => `${x.The} ${x.verb("covers", "cover")} your face here.`,
  "under-buttons": (x) => `${x.The} ${x.verb("sits", "sit")} under the app's buttons here.`,
  "on-text": (x) => `${x.The} ${x.verb("covers", "cover")} other words here.`,
  "text-fits": (x) => (x.many ? "A caption here is too long to fit at a size people can read." : `${x.The} is too long to fit at a size people can read.`),
  "two-titles": () => "Two titles show at once here.",
  "short-text": (x) => `${x.The} ${x.verb("is", "are")} gone before ${x.it} can be read.`,
  "caption-rows": () => "The captions take up too many lines here.",
  "cut-outside-pause": (_x, { says }) =>
    says.startsWith("the film's start") ? "The video starts in the middle of a word." : says.startsWith("the film's end") ? "The video ends in the middle of a word." : "This cut lands in the middle of a word.",
  "empty-start": () => "The video starts on an empty frame.",
  "mark-hidden": (x) => `${x.The} ${x.verb("sits", "sit")} on a part that was cut, so ${x.it} never ${x.verb("shows", "show")}.`,
  "fade-both": () => "This part fades in and out at once.",
  "soft-zoom": () => "This zoom makes the picture soft.",
  unmeasured: (x) => `${x.The} ${x.verb("uses", "use")} a letter we cannot measure, so ${x.its} fit is a guess.`,
  "no-analysis": () => "This part was not checked.",
};

/**
 * The fix of each code, or null where none is offered ("Show" only), and the one kind of thing it is offered on: the kind it was
 * tried on. Until a fix is tried on another kind, the same finding there has its sentence, "Show" and "Keep it", and no fix
 * (final review, I4: asked to clear a title off an app's zone, the model moved the line onto the eyes, 3 of 3). The request is
 * about the finding's frame ("here"). The button says "them" of the captions, "it" of anything else. Each rate is of three runs,
 * the code's finding set on the kind named; the fixes set to null were "Zoom less", "Make them fit", "Fewer words a page" and "Move
 * the cut to the pause" (Task 10's report says what the model did in each run).
 */
const FIXES: Record<FindingCode, { on: Thing; fix: (x: Named) => Fix } | null> = {
  "soft-zoom": null, // tried 2026-11-25: 0 of 3, Show only
  // tried 2026-11-25 on the captions: the error cleared in 3 of 3; the chin's warning left in 3 of 3 is never shown (S18)
  "on-face": { on: "captions", fix: (x) => ({ label: `Move ${x.them} off my face`, request: `Move ${x.the} off my face.` }) },
  // tried 2026-11-25 on the captions: 3 of 3
  "under-buttons": { on: "captions", fix: (x) => ({ label: `Move ${x.them} clear of the app's buttons`, request: `Move ${x.the} clear of the app's buttons.` }) },
  // tried 2026-11-25 on a title: 3 of 3
  "short-text": { on: "title", fix: (x) => ({ label: `Keep ${x.them} on longer`, request: `Keep ${x.the} on screen longer.` }) },
  "text-fits": null, // tried 2026-11-25 on the captions: 0 of 3, Show only
  // tried 2026-11-25 on a title over the first cut's label: 3 of 3
  "two-titles": { on: "title", fix: () => ({ label: "Keep one", request: "Keep only one title here." }) },
  "caption-rows": null, // tried 2026-11-25: 0 of 3, Show only
  "cut-outside-pause": null, // tried 2026-11-25: 0 of 3, Show only
  "empty-start": null,
  "on-text": null,
  "mark-hidden": null,
  "fade-both": null,
  unmeasured: null,
  "no-analysis": null,
};

/** What is said of a code the tables do not know. */
const UNKNOWN = "Have a look at this moment.";

/** One sentence for a creator, not the review's own words. */
export function sentenceOf(finding: Finding, edit: Edit): string {
  if (!Object.hasOwn(SENTENCES, finding.code)) return UNKNOWN;
  return SENTENCES[finding.code](named(thingOf(finding, edit)), finding);
}

/** The fix offered as one button, or null ("Show" only): on the kind of thing it was tried on, and no other. */
export function fixOf(finding: Finding, edit: Edit): Fix | null {
  if (!Object.hasOwn(FIXES, finding.code)) return null;
  const row = FIXES[finding.code];
  const thing = thingOf(finding, edit);
  return row && row.on === thing ? row.fix(named(thing)) : null;
}
