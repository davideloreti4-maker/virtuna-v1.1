/**
 * POST /api/edit/agent → 200 {say, ops, edit, findings, rounds, ms, cost, changed, match, style, styleSay}
 *
 * The edit agent (part 3; Task 13a), one route for its two calls:
 * - a change, `{takes, edit, request}`: the creator's request made on their edit (`change`): one Qwen answer a round, judged
 *   by the door and the review, at most three rounds, stopped 50 s after the call came in (X89). `takes` are the creator's
 *   takes the call may use: each take the edit holds, and any other on offer to `asset.add`.
 * - a first cut, `{takes: [take], firstCut: true, style?}`: the take cut in its pauses, captioned, titled, punched in and
 *   levelled (`firstCut`), stopped 170 s after the call came in. With no style (or null), in the house style; `{preset: id}`,
 *   in that preset; `{words}`, in the style `styleOfWords` reads from them first, its time counted in the 170 s; or a profile
 *   as it is (a reference's, read by `/api/edit/references`), checked with `StyleProfileSchema`.
 * The edit handed in is checked as a render's is: `EditSchema`, `checkEdit`, and each file's facts against its take's row
 * (`refusedFiles`, N5). The takes' facts and analyses are their rows', read through the creator's session.
 *
 * The answer: what the creator reads (`say`), the ops applied, the edit and what `review` finds in it, as the agent gives them;
 * `rounds`, the agent's rounds (a first cut's choices and any last resort; the words' calls are not rounds); `ms`, the call's
 * whole time, from when it came in; `cost`, in cents, every Qwen call it made (the
 * words' too); `changed`; `match`, the first cut's match with its style, null with none and for a change; `style`, the profile
 * the first cut used (the house's with no style), null for a change; `styleSay`, what was said of a style from words, else null.
 *
 * One agent call of a creator's at a time (X92): held in this server's memory (`holdAgent`) and let go however the call ends.
 * Every refusal is `{error}`, one plain sentence, with no ids and no paths:
 * 401/403 as every edit route · 415/403 for a body that is not JSON or a call from another origin · 400 for a body that is
 * neither call, a request blank or over 500 characters, an edit that is not one or does not hold together, words none or over
 * 300 characters, an unknown preset, a style that is no profile · 404 for a take that is not the creator's, or is a reference · 409 for a take not
 * ready, or while an agent call of theirs is live · 422 for an edit whose files are not the creator's takes as measured · 502
 * when no style could be read from the words.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { EditSchema, checkEdit, type Edit } from "@/lib/edit";
import type { AgentResult } from "@/lib/edit/agent/loop";
import { csrfGuard } from "@/lib/http/csrf-guard";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { MOST, SAID, changeEdit, cutTake, isObject, readyTakes, styleOf, type Styled } from "../agent-calls";
import { creator, holdAgent, log, refuse, route, type Creator } from "../creator";

/** A first cut stops at 170 s (X89), its words' style read included; a change at 50 s. */
export const maxDuration = 180;

const Id = z.string().max(64);
const ChangeBody = z.strictObject({ takes: z.array(Id).min(1).max(MOST.takes), edit: z.unknown(), request: z.string() });
const FirstCutBody = z.strictObject({ takes: z.tuple([Id]), firstCut: z.literal(true), style: z.unknown().optional() });

type Asked = { kind: "change"; takes: string[]; edit: Edit; request: string } | { kind: "first cut"; take: string; style: Styled };

/** The call asked, read and checked without the database: the refusal to give, or what to do. */
function askedOf(body: unknown): Asked | Response {
  if (isObject(body) && "firstCut" in body) {
    const asked = FirstCutBody.safeParse(body);
    if (!asked.success) return refuse(400, SAID.unread);
    const style = styleOf(asked.data.style);
    return style instanceof Response ? style : { kind: "first cut", take: asked.data.takes[0], style };
  }
  const asked = ChangeBody.safeParse(body);
  if (!asked.success) return refuse(400, SAID.unread);
  const edit = EditSchema.safeParse(asked.data.edit);
  if (!edit.success) return refuse(400, SAID.edit);
  if (checkEdit(edit.data).length > 0) return refuse(400, SAID.apart);
  const request = asked.data.request.trim();
  if (request === "") return refuse(400, SAID.blank);
  if (request.length > MOST.request) return refuse(400, SAID.long);
  return { kind: "change", takes: asked.data.takes, edit: edit.data, request };
}

export const POST = route("POST /api/edit/agent", async (request: Request) => {
  const begun = Date.now();
  const who = await creator();
  if (who instanceof Response) return who;
  const guard = csrfGuard(request);
  if (guard) return guard;
  const asked = askedOf(await request.json().catch(() => undefined));
  if (asked instanceof Response) return asked;

  const release = holdAgent(who.user);
  if (!release) return refuse(409, SAID.busy);
  try {
    return asked.kind === "change" ? await changing(who, asked, begun) : await cutting(who, asked, begun);
  } finally {
    release();
  }
});

/** A change to the creator's edit. */
async function changing(who: Creator, asked: Extract<Asked, { kind: "change" }>, begun: number): Promise<Response> {
  const takes = await readyTakes(who, asked.takes);
  if (takes instanceof Response) return takes;
  const result = await changeEdit(who, takes, asked.edit, asked.request, begun);
  if (result instanceof Response) return result;
  return answered("change", result, begun, { cost: result.cost, match: null, style: null, styleSay: null });
}

/** A first cut of the creator's take, in the style asked. */
async function cutting(who: Creator, asked: Extract<Asked, { kind: "first cut" }>, begun: number): Promise<Response> {
  const takes = await readyTakes(who, [asked.take]);
  if (takes instanceof Response) return takes;
  const cut = await cutTake(who, takes[0]!, asked.style, begun);
  if (cut instanceof Response) return cut;
  return answered(`first cut (${cut.source})`, cut.result, begun, { cost: cut.cost, match: cut.result.match, style: cut.style, styleSay: cut.styleSay });
}

/** The 200: the agent's result as the creator's page reads it; logged with its kind, rounds, cost and time, never its words. */
function answered(
  kind: string, result: AgentResult, begun: number,
  more: { cost: number; match: unknown; style: StyleProfile | null; styleSay: string | null },
): Response {
  const ms = Date.now() - begun;
  log.info("an agent call", { kind, rounds: result.rounds.length, changed: result.changed, cost: more.cost, ms });
  return NextResponse.json({
    say: result.say, ops: result.ops, edit: result.edit, findings: result.findings, rounds: result.rounds.length, ms, cost: more.cost, changed: result.changed,
    match: more.match, style: more.style, styleSay: more.styleSay,
  });
}
