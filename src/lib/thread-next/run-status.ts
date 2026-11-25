/**
 * run-status.ts — what the wait says (thread feel spec §4.2): the line's words from the run's kind
 * and the stages it reports, the usual length of such a run in words, and which runs draw their
 * answer's card as an outline while they wait.
 *
 * The words describe what is being done or read, never what the result will be (the ruling of
 * 2026-08-13). "Ranking" has no words: it is a sort that takes no time. "Simulating your audience" is
 * never said: no generation simulates. No counting clock: the usual length is said in round words,
 * as the video's running card says "of about a minute" (rulings 4).
 *
 * Pure: no React.
 */

/** Until a stage says more, each run's own words. */
const OWN_WORDS: Readonly<Record<string, string>> = {
  hooks: "Writing hooks",
  ideas: "Finding ideas",
  script: "Writing your script",
  remix: "Reworking the video",
  explore: "Scanning for outliers",
  account: "Reading your account",
};

/** A typed ask the router has not placed, and any run not in the table. */
const THINKING = "Thinking";

const GROUNDING = "Looking for videos on this topic";

/** The stages that speak, per run (the names the runners emit). A stage not listed keeps the words
 *  before it. The account read's stages do not reach the turn. */
const STAGE_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hooks: { "Finding proven outliers": GROUNDING, Generating: "Writing hooks" },
  ideas: { "Finding proven outliers": GROUNDING, Generating: "Finding ideas" },
  script: { "Finding proven outliers": GROUNDING, Generating: "Writing your script" },
  remix: { Resolving: "Getting the video", Decoding: "Working out why it worked", Adapting: "Reworking it for your audience" },
  explore: { "Pulling outliers": "Finding videos", "Scoring for your audience": "Checking them against your audience" },
};

/**
 * The line's words: the words of the last stage, in order, that has started (`active` or `done`)
 * and has words for this run; before any such stage, the run's own words; "Thinking" for any run
 * not in the table.
 */
export function statusWords(skill: string, stages: readonly { name: string; status: string }[]): string {
  const own = OWN_WORDS[skill];
  if (!own) return THINKING;
  const table = STAGE_WORDS[skill] ?? {};
  let words = own;
  for (const stage of stages) {
    if (stage.status !== "active" && stage.status !== "done") continue;
    const said = table[stage.name];
    if (said) words = said;
  }
  return words;
}

/** How long such a run takes from the send, in seconds, as measured on 2026-11-25 and rounded. */
export const USUAL_S: Readonly<Record<string, number>> = { hooks: 20, ideas: 30, script: 30 };

/** "about 20 s" until twice the usual length has passed, then "taking longer"; nothing for a run
 *  whose length is not known. */
export function usualNote(skill: string, elapsedS: number): string | null {
  const usual = USUAL_S[skill];
  if (usual === undefined) return null;
  return elapsedS <= 2 * usual ? `about ${usual} s` : "taking longer";
}

/** The runs that end in a card of their own draw it at once as an outline (§4.3); the others wait
 *  on the line alone. */
export function outlineOf(skill: string): "pack" | "script" | "remix" | null {
  switch (skill) {
    case "hooks":
    case "ideas":
      return "pack";
    case "script":
      return "script";
    case "remix":
      return "remix";
    default:
      return null;
  }
}
