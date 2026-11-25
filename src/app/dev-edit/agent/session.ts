/**
 * session.ts — the page's own state (Task 13b): the first cut, the requests made of it with their answers, the call that is
 * out, and the one problem shown. It lives in the page only: a reload starts over. Pure.
 *
 * The edit on the phone is the last answer's that changed something, or the first cut's. Undo goes back one edit: the last
 * change, and whatever was said after it, are dropped. While a call is out nothing else moves.
 */
import type { Edit } from "@/lib/edit";
import type { Finding } from "@/lib/edit/review";
import type { StyleProfile } from "@/lib/edit/style/profile";
import type { Field } from "./match";

/** What `POST /api/edit/agent` answers. */
export interface Answer {
  say: string;
  edit: Edit;
  findings: Finding[];
  rounds: number;
  ms: number;
  /** In cents. */
  cost: number;
  changed: boolean;
  match: { fields: Field[]; notMatched: string[] } | null;
  style: StyleProfile | null;
  styleSay: string | null;
}

/** A request and its answer. */
export interface Turn {
  request: string;
  answer: Answer;
}

/**
 * What is under way, at its stage where it has stages (`share` of the bar, null when it cannot be told):
 * - `read`: a video's style is being read for the first cut. No call of the agent's is out yet, and the creator can stop it
 *   by picking another row;
 * - `cut`: the agent's call for the first cut is out;
 * - `change`: the agent's call for a change is out.
 */
export type Working = { what: "read" | "cut"; stage: string; share: number | null } | { what: "change"; request: string };

export interface Session {
  cut: { first: Answer; turns: Turn[] } | null;
  working: Working | null;
  /** One plain sentence, and the request it was about when a change failed. */
  problem: { text: string; request: string | null } | null;
  /** Every call answered since the page was opened, undone or not: the dev's facts. */
  spent: { calls: number; cost: number; last: Pick<Answer, "rounds" | "ms" | "cost"> | null };
}

export const START: Session = { cut: null, working: null, problem: null, spent: { calls: 0, cost: 0, last: null } };

export type Action =
  | { type: "reading"; stage: string; share: number | null }
  | { type: "cutting"; stage: string; share: number | null }
  | { type: "stopped" }
  | { type: "moved on" }
  | { type: "cut"; answer: Answer }
  | { type: "asking"; request: string }
  | { type: "answered"; answer: Answer }
  | { type: "failed"; text: string }
  | { type: "undo"; turn?: number }
  | { type: "start over" };

/** The last turn that changed the edit; -1 for none. */
const lastChanged = (turns: readonly Turn[]): number => turns.findLastIndex((turn) => turn.answer.changed);

const spend = (spent: Session["spent"], { rounds, ms, cost }: Answer): Session["spent"] => ({ calls: spent.calls + 1, cost: spent.cost + cost, last: { rounds, ms, cost } });

export function reduce(session: Session, action: Action): Session {
  const { cut, working } = session;
  switch (action.type) {
    case "reading": // a video's style: started, or at its next stage
      if (cut || (working && working.what !== "read")) return session;
      return { ...session, working: { what: "read", stage: action.stage, share: action.share }, problem: null };
    case "cutting": // the agent's call: straight away, or once a video's style is read
      if (cut || working?.what === "change") return session;
      return { ...session, working: { what: "cut", stage: action.stage, share: action.share }, problem: null };
    case "stopped": // the creator picked another row while a video's style was read
      return working?.what === "read" ? { ...session, working: null } : session;
    case "moved on": // the creator changed what they picked: a problem shown was about what they had picked before
      return working || !session.problem ? session : { ...session, problem: null };
    case "cut":
      if (working?.what !== "cut") return session;
      return { cut: { first: action.answer, turns: [] }, working: null, problem: null, spent: spend(session.spent, action.answer) };
    case "asking":
      if (!cut || working) return session;
      return { ...session, working: { what: "change", request: action.request }, problem: null };
    case "answered":
      if (!cut || working?.what !== "change") return session;
      return { cut: { ...cut, turns: [...cut.turns, { request: working.request, answer: action.answer }] }, working: null, problem: null, spent: spend(session.spent, action.answer) };
    case "failed":
      if (!working) return session;
      return { ...session, working: null, problem: { text: action.text, request: working.what === "change" ? working.request : null } };
    case "undo": {
      if (!cut || working) return session;
      const turn = action.turn ?? lastChanged(cut.turns);
      if (!cut.turns[turn]?.answer.changed) return session;
      return { ...session, cut: { ...cut, turns: cut.turns.slice(0, turn) }, problem: null };
    }
    case "start over":
      return working ? session : { ...START, spent: session.spent };
  }
}

/** The answer the phone shows: the last that changed the edit, or the first cut's. */
const standing = (cut: NonNullable<Session["cut"]>): Answer => cut.turns[lastChanged(cut.turns)]?.answer ?? cut.first;

/** The edit on the phone; null before the first cut. */
export function editOf(session: Session): Edit | null {
  return session.cut ? standing(session.cut).edit : null;
}

/** Whether there is an edit to go back to: a change was made, and no call is out. */
export function canUndo(session: Session): boolean {
  return session.cut !== null && session.working === null && lastChanged(session.cut.turns) >= 0;
}

/** What to check in the edit as it stands: the latest answer's findings (an answer that changed nothing still read the edit). */
export function findingsOf(session: Session): Finding[] {
  return session.cut ? (session.cut.turns.at(-1)?.answer ?? session.cut.first).findings : [];
}
