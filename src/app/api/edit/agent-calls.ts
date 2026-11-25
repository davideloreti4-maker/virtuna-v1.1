/**
 * agent-calls.ts — the agent's two calls as the edit routes make them (plan 2026-11-24-editor-screens-a, Task 5): read from
 * `POST /api/edit/agent` so that route and the editor's turns (`/api/edit/edits/[id]/cut`, `…/change`) run the same code.
 * What a first cut's style may be, the takes a call may use (each the creator's, ready, no reference), the change (its files
 * checked against the takes as measured, N5) and the first cut (a style from words read first, its time counted in the
 * first cut's). Each refusal is the route's own `{error}`, one plain sentence.
 *
 * Server only.
 */
import "server-only";
import { analysisOf, type Analyses, type Edit } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import { firstCut, type FirstCutResult } from "@/lib/edit/agent/first-cut";
import { AGENT_LIMITS, change, type AgentResult } from "@/lib/edit/agent/loop";
import type { Ask } from "@/lib/edit/agent/model";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { presetOf } from "@/lib/edit/style/presets";
import { referencesAmong } from "@/lib/edit/style/reference";
import { StyleProfileSchema, type StyleProfile } from "@/lib/edit/style/profile";
import { styleOfWords } from "@/lib/edit/style/words";
import { bucket } from "@/lib/edit/worker/r2";
import { MAX_TAKE_MS, assetOf, refusedFiles, takeState, type TakeRow } from "@/lib/edit/worker/takes";
import { log, ownTake, refuse, type Creator } from "./creator";

/** The longest request, style in words and list of takes. */
export const MOST = { request: 500, words: 300, takes: 20 } as const;

export const SAID = {
  unread: "The editor could not read this call.",
  edit: "This edit could not be read.",
  apart: "This edit does not hold together.",
  blank: "Say what to change.",
  long: `A request is at most ${MOST.request} characters.`,
  noPreset: "There is no preset of that name.",
  noWords: "Say in a few words what style you want.",
  longWords: `A style in words is at most ${MOST.words} characters.`,
  style: "This style could not be read.",
  busy: "The editor is already working on a call of yours; try again when it is done.",
  measured: "A video in this edit is not one of your takes as it was measured. Start again from the take.",
  words: "The style could not be read from those words. Try other words or pick a preset.",
} as const;
/** A take that is not ready, by what it is. */
const NOT_READY: Record<string, string> = {
  uploading: "That take has not finished uploading.",
  analysing: "That take is still being analysed; try again when it is ready.",
  failed: "That take could not be analysed; upload it again.",
};
/** A take the worker measured at over ten minutes (X56): failed for its length, which another upload does not change. */
const TOO_LONG = `That take is longer than ${MAX_TAKE_MS / 60_000} minutes; use a shorter take.`;
const isTooLong = (take: TakeRow): boolean => {
  const ms = (take.facts as { ms?: unknown } | null)?.ms;
  return typeof ms === "number" && ms > MAX_TAKE_MS;
};

/** The style a first cut is asked in: the house's, a profile (a preset's or one handed in), or one to read from words. */
export type Styled = { from: "house" } | { from: "profile"; profile: StyleProfile } | { from: "words"; words: string };

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const only = (value: Record<string, unknown>, key: string) => Object.keys(value).length === 1 && key in value;

/** A first cut's style: none (or null), `{preset}`, `{words}` or a profile, which `StyleProfileSchema` checks. */
export function styleOf(given: unknown): Styled | Response {
  if (given === undefined || given === null) return { from: "house" };
  if (isObject(given) && only(given, "preset")) {
    const preset = typeof given.preset === "string" ? presetOf(given.preset) : undefined;
    return preset ? { from: "profile", profile: preset.profile } : refuse(400, SAID.noPreset);
  }
  if (isObject(given) && only(given, "words")) {
    if (typeof given.words !== "string") return refuse(400, SAID.style);
    const words = given.words.trim();
    if (words === "") return refuse(400, SAID.noWords);
    return words.length > MOST.words ? refuse(400, SAID.longWords) : { from: "words", words };
  }
  const profile = StyleProfileSchema.safeParse(given);
  return profile.success ? { from: "profile", profile: profile.data } : refuse(400, SAID.style);
}

/** The look an edit keeps of a first cut's style (`edits.look`, a cut turn's `request`): `house`, a preset's id, `words`, `video`. */
export function lookKeyOf(given: unknown, styled: Styled): string {
  if (styled.from === "house") return "house";
  if (styled.from === "words") return "words";
  if (isObject(given) && typeof given.preset === "string" && presetOf(given.preset)) return given.preset;
  return "video";
}

/**
 * The creator's takes of these ids, each ready; or the refusal: 404 for one that is not theirs or is a reference (another's video
 * read for its style is no take of the creator's, `referencesAmong`), 409 for one not ready.
 */
export async function readyTakes(who: Creator, ids: readonly string[]): Promise<TakeRow[] | Response> {
  const takes: TakeRow[] = [];
  for (const take of await Promise.all([...new Set(ids)].map((id) => ownTake(who, id)))) {
    if (take instanceof Response) return take;
    takes.push(take);
  }
  const references = await referencesAmong(who.session, who.user, takes);
  if (takes.some((take) => references.has(take.id))) return refuse(404, "no such take");
  for (const take of takes) {
    const { status } = takeState(take); // its jobs not looked up: an analysing take reads as analysing
    if (status !== "ready") return refuse(409, isTooLong(take) ? TOO_LONG : (NOT_READY[status] ?? "That take is not ready."));
  }
  return takes;
}

/**
 * A change to the creator's edit, on these takes: 422 for an edit whose files are not the takes as measured. `at` is the film
 * frame of `edit` the video was paused on, null when the request has none (the agent's own route never has one).
 */
export async function changeEdit(who: Creator, takes: readonly TakeRow[], edit: Edit, request: string, begun: number, at: number | null = null): Promise<AgentResult | Response> {
  const refused = refusedFiles(edit, takes, bucket());
  if (refused.length > 0) {
    log.warn("an edit's files are not the creator's takes as measured", { problems: refused.map((problem) => problem.message) });
    return refuse(422, SAID.measured);
  }
  const analyses: Analyses = Object.fromEntries(takes.map((take) => [take.id, analysisOf(take)]));
  const library = takes.map((take) => assetOf(take, bucket()));
  return change(
    { edit, analyses, request, library, user: who.user, deadlineMs: begun + AGENT_LIMITS.changeMs, at: at ?? undefined },
    { ask: agentDeps.ask, stills: agentDeps.stills },
  );
}

/** A first cut, with the style it used (the house's with none), what was said of a style from words, its whole cost, its source. */
export interface Cut {
  result: FirstCutResult;
  style: StyleProfile;
  styleSay: string | null;
  /** In cents: the words' calls and the cut's. */
  cost: number;
  /** For the log: the style's source kind, or `house`. */
  source: string;
}

/** A first cut of the creator's take, in the style asked: 502 when no style could be read from the words. */
export async function cutTake(who: Creator, take: TakeRow, styled: Styled, begun: number): Promise<Cut | Response> {
  let style = styled.from === "profile" ? styled.profile : undefined;
  let styleSay: string | null = null;
  const spent = { cost: 0 };
  if (styled.from === "words") {
    try {
      const read = await styleOfWords(styled.words, costed(agentDeps.ask, spent));
      style = read.style;
      styleSay = read.say;
    } catch (error) {
      log.warn("no style could be read from a creator's words", { error: error instanceof Error ? error.message : String(error), cost: spent.cost, ms: Date.now() - begun });
      return refuse(502, SAID.words);
    }
  }
  const result = await firstCut(
    { asset: assetOf(take, bucket()), analysis: analysisOf(take), user: who.user, deadlineMs: begun + AGENT_LIMITS.firstCutMs, style },
    { ask: agentDeps.ask, stills: agentDeps.stills },
  );
  return { result, style: style ?? HOUSE_STYLE, styleSay, cost: spent.cost + result.cost, source: style?.source.kind ?? "house" };
}

/** `ask`, with what each call costs added to `spent`, in cents, as the loop prices its own. */
function costed(ask: Ask, spent: { cost: number }): Ask {
  return async (messages, options) => {
    const answer = await ask(messages, options);
    spent.cost += calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: answer.usage.input, completion_tokens: answer.usage.output });
    return answer;
  };
}
