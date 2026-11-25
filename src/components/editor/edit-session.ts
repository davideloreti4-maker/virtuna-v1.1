/**
 * edit-session.ts — the editor page's own state (spec 2026-11-24-editor-screens-design.md §5.1-5.3; plan
 * 2026-11-24-editor-screens-a, Task 10): the edit as last read from its routes, the call that is out, the one problem shown, the
 * look picked while the take gets ready, and what moved the edit last. Ported from the dev page's `session.ts`: what that page
 * held itself (the turns, undo) the server holds now, and every route that changes the edit answers it whole, so an answer
 * replaces the view. While a call is out nothing else moves and a poll's answer is not taken.
 *
 * A problem stays across a read, its request with it, until the read shows it is over (`over`): the take is past the step the
 * problem was about, the first cut is there, or the change that failed, asked or by hand, was made after all (its answer lost,
 * m5). One asked for that was made is told to the page (`madeAfterAll`), which had put its request back in the field. A read
 * that brings no edit is said (`unread`): no such edit, the gate's refusal with its sentence, or a failure, which before any
 * edit was read is the page's state "not read". A first cut the editor was too busy for (a 409: one call a creator at a time, and it may be the call
 * making this very cut) is no problem to show while the page asks again by itself (`busy`), `MOST_HELD_ASKS` times at most.
 *
 * Also, pure: the page's state, which controls are on, the chips under the latest answer (what is left to check and the steps
 * after the change, slice B, Task 8), where the playhead goes after a change, the moment a request is about and its time (slice
 * B, E15), a look as a cut's body, whether an answer is an edit, how long the next read waits.
 */
import { FPS, filmFrames, type Edit, type Op } from "@/lib/edit";
import { firstChangedFrame } from "@/lib/edit/changed";
import { LIVE_JOB, type EditView } from "@/lib/edit/edit-view";
import { toCheck } from "@/lib/edit/kept";
import type { NextStep, StepKind } from "@/lib/edit/next-steps";
import { NEXT_ASKS } from "@/lib/edit/said";
import { timecode } from "@/lib/result/format";
import type { Upload } from "./uploads";

/** A look as the creator picks it: ours, a preset, words, or a video's style read already. */
export type CutStyle = { kind: "house" } | { kind: "preset"; id: string } | { kind: "words"; words: string } | { kind: "video"; style: unknown };

/**
 * The call that is out. A change carries the moment it is about (E15): the film frame the video was paused on, or null. A keep
 * puts a finding of the turn shown away (slice B, Task 9): it changes no film and makes no turn.
 */
export type Working =
  | { what: "cut"; look: CutStyle }
  | { what: "change"; request: string; at: number | null }
  | { what: "ops" }
  | { what: "move"; to: number }
  | { what: "export" }
  | { what: "cancel" }
  | { what: "take" }
  | { what: "keep" };

export interface Session {
  view: EditView | null;
  /**
   * How the last read ended when it brought no edit: no such edit of theirs (404), the gate refused (not signed in, 401; not
   * open to them, 403), or it failed (anything else: no connection, a 500). Null once a read brings the edit.
   */
  unread: "gone" | "closed" | "failed" | null;
  /** The gate's own sentence when it refused the read (`unread` is "closed"); null otherwise. */
  gate: string | null;
  working: Working | null;
  /**
   * One plain sentence; and the request it was about when a change failed, so it is not lost, with the moment it was about
   * (`at`, only when it had one: Try again sends it again). `hand` when a change made by hand (`ops`) failed: a read can then
   * show it made all the same (m5).
   */
  problem: { text: string; request: string | null; at?: number | null; hand?: true } | null;
  /** The look picked while the take gets ready, sent with the first cut. */
  waitLook: CutStyle;
  /** What moved the edit last: a turn (played from where it changed) or a move (Undo, Redo). */
  moved: "turn" | "move" | null;
  /**
   * How many times running the first cut was refused because the editor was busy (a 409). Over 0, the page asks again by
   * itself and shows no problem; back to 0 when the cut is made, fails another way, or was refused `MOST_HELD_ASKS` times.
   */
  busy: number;
  /**
   * The request of a change whose answer was lost and which a read then showed made (m5), as the route keeps it: the page put it
   * back in the field, and takes it out again. Null otherwise, and again once a call starts.
   */
  madeAfterAll: string | null;
}

export const START: Session = { view: null, unread: null, gate: null, working: null, problem: null, waitLook: { kind: "house" }, moved: null, busy: 0, madeAfterAll: null };

/** The most times the page asks again by itself for a first cut the editor was too busy for: a minute, at its three seconds. */
export const MOST_HELD_ASKS = 20;

export type Action =
  | { type: "read"; view: EditView }
  /** A read that brought no edit: its status (0 for no answer), and the route's sentence when it gave one. */
  | { type: "unread"; status: number; text?: string }
  | { type: "start"; working: Working }
  | { type: "answered"; view: EditView }
  /** The call out failed: one sentence, and the status the route answered when one did. */
  | { type: "failed"; text: string; status?: number }
  | { type: "wait look"; look: CutStyle }
  | { type: "dismiss" };

const TURNS: ReadonlySet<Working["what"]> = new Set(["cut", "change", "ops"]);

/**
 * Whether the problem shown is over by what a read brings. One with no request was about a step towards the first cut (a
 * video picked, the cut asked for): it is over when the take is another or past that step, and when the cut is there. A
 * change that failed is over when the edit holds its request as the turn made at the head it was asked at: it was made after
 * all (its answer was lost), or the same was asked there by another page. The route keeps a request trimmed. A change by hand
 * that failed is over the same way, when the edit holds a hand-made turn there (m5).
 */
function over(problem: NonNullable<Session["problem"]>, was: EditView, now: EditView): boolean {
  if (problem.hand) return now.turns.some((turn) => turn.n === (was.head ?? 0) + 1 && turn.kind === "direct");
  if (problem.request === null) return was.take.id !== now.take.id || was.take.status !== now.take.status || (was.shown === null && now.shown !== null);
  const asked = problem.request.trim();
  return now.turns.some((turn) => turn.n === (was.head ?? 0) + 1 && turn.kind !== "cut" && turn.request === asked);
}

export function reduce(session: Session, action: Action): Session {
  switch (action.type) {
    case "read": {
      if (session.working) return session;
      const read = { ...session, view: action.view, unread: null, gate: null, busy: action.view.shown === null ? session.busy : 0 };
      if (!session.problem || !session.view || !over(session.problem, session.view, action.view)) return read;
      // A change that was made after all is played as any turn is, and one asked for leaves the field it was put back in.
      const { request, hand } = session.problem;
      return { ...read, problem: null, moved: request === null && !hand ? session.moved : "turn", madeAfterAll: request === null ? session.madeAfterAll : request.trim() };
    }
    case "unread":
      if (session.working) return session;
      if (action.status === 404) return { ...session, unread: "gone", gate: null };
      if (action.status === 401 || action.status === 403) return { ...session, unread: "closed", gate: action.text ?? null };
      return { ...session, unread: "failed", gate: null };
    case "start": {
      if (session.working) return session;
      // A call starts clean: a problem shown was about the try before. But for the page's own asking again for a busy cut,
      // which is no try of the creator's: a problem shown beside it (a video picked and refused) stays to be read.
      const asksAgain = action.working.what === "cut" && session.busy > 0;
      return { ...session, working: action.working, problem: asksAgain ? session.problem : null, madeAfterAll: null };
    }
    case "answered": {
      if (!session.working) return session;
      const moved = session.working.what === "move" ? "move" : TURNS.has(session.working.what) ? "turn" : session.moved;
      return { ...session, view: action.view, unread: null, gate: null, working: null, problem: null, moved, busy: 0 };
    }
    case "failed": {
      const { working } = session;
      if (!working) return session;
      // A first cut the editor was too busy for is no problem yet: the page asks again. Another call that fails meanwhile
      // (a video picked and refused) is a problem, and leaves that asking as it is.
      const held = working.what === "cut" && session.view?.shown == null && action.status === 409 && session.busy < MOST_HELD_ASKS;
      if (held) return { ...session, working: null, busy: session.busy + 1 };
      const problem = {
        text: action.text,
        request: working.what === "change" ? working.request : null,
        ...(working.what === "change" && working.at !== null ? { at: working.at } : {}),
        ...(working.what === "ops" ? { hand: true as const } : {}),
      };
      return { ...session, working: null, busy: working.what === "cut" ? 0 : session.busy, problem };
    }
    case "wait look":
      return { ...session, waitLook: action.look };
    case "dismiss":
      return session.problem ? { ...session, problem: null } : session;
  }
}

export type PageState = "loading" | "not read" | "not here" | "closed" | "getting ready" | "upload stopped" | "cutting" | "ready" | "exporting" | "take failed";

/**
 * The page's state (§5.1, and "not read": the edit could not be read and none is shown yet, ruling R20). `upload` is the
 * holder's upload of the take, null when none is held (a reload). A read that fails once an edit is shown changes no state:
 * the page keeps what it has.
 */
export function pageStateOf(session: Session, upload: Pick<Upload, "status"> | null): PageState {
  if (session.unread === "gone") return "not here";
  if (session.unread === "closed") return "closed";
  const view = session.view;
  if (!view) return session.unread === "failed" ? "not read" : "loading";
  if (view.export && LIVE_JOB.has(view.export.status)) return "exporting";
  if (view.shown !== null) return "ready";
  switch (view.take.status) {
    case "failed":
      return "take failed";
    case "uploading":
      return upload && upload.status !== "failed" ? "getting ready" : "upload stopped";
    case "analysing":
      return "getting ready";
    default:
      return "cutting";
  }
}

/**
 * Whether the page asks for the first cut now (E2): the take is ready, there is no turn, nothing is out, nothing went wrong,
 * and it is not waiting to ask again for one the editor was too busy for.
 */
export function wantsFirstCut(session: Session): boolean {
  const view = session.view;
  return view !== null && view.take.status === "ready" && view.head === null && session.working === null && session.problem === null && session.busy === 0;
}

export interface Controls {
  /** The field, its send and the chips. */
  ask: boolean;
  /** Look and Captions. */
  tools: boolean;
  undo: boolean;
  redo: boolean;
  /** Export, or the Ready sheet of the export made. */
  exportOn: boolean;
  /** The export is being made: the tools and the field rest, the video can be watched (E20). */
  exporting: boolean;
}

export function controlsOf(session: Session): Controls {
  const view = session.view;
  const exporting = !!view?.export && LIVE_JOB.has(view.export.status);
  const on = !!view && view.shown !== null && session.working === null && !exporting;
  return { ask: on, tools: on, undo: on && view?.undo != null, redo: on && view?.redo != null, exportOn: on, exporting };
}

export type NextChip =
  | { kind: "check"; count: number }
  | { kind: "style" }
  /** A step after the change shown: asked of the agent about its moment, or Undo when it asks nothing. */
  | { kind: "step"; step: NextStep }
  | { kind: "ask"; text: string }
  /** A change made by hand through `POST …/ops`, no model call: "Captions on". */
  | { kind: "hand"; text: string; ops: Op[] };

/** The kind of change each fixed next step is: one of a kind the steps after the change already offer is left out. */
const ASK_KIND: Record<(typeof NEXT_ASKS)[number], StepKind> = { Shorter: "cut", "Bigger captions": "captions", "Add zooms": "zoom" };
/** In the place of "Bigger captions" while the captions are off: turned on by hand, as the Captions sheet's switch does. */
const CAPTIONS_ON: NextChip = { kind: "hand", text: "Captions on", ops: [{ op: "captions.set", on: true }] };

/**
 * The chips under the latest answer (§5.3): what is left to check, a video's style once read, the steps after the change
 * shown (`view.next`), the fixed next steps less one of a kind already offered; four at most, one row (R30). What to check is
 * what the review found in the edit shown (the turn `view.shown`) less what was put away there (`toCheck`), so it stays under
 * an answer that changed nothing. With the captions off, "Bigger captions" is "Captions on", made by hand.
 */
export function chipsOf(view: EditView | null, styleReady: boolean): NextChip[] {
  if (!view || view.shown === null || !view.edit) return [];
  const turn = view.turns.find((each) => each.n === view.shown);
  const count = toCheck(turn?.findings ?? [], turn?.kept ?? []).length;
  const offered = new Set(view.next.map((step) => step.kind));
  const captionsOn = view.edit.captions.on;
  const chips: NextChip[] = [
    ...(count > 0 ? [{ kind: "check" as const, count }] : []),
    ...(styleReady ? [{ kind: "style" as const }] : []),
    ...view.next.map((step) => ({ kind: "step" as const, step })),
    ...NEXT_ASKS.filter((text) => !offered.has(ASK_KIND[text])).map((text): NextChip => (text === "Bigger captions" && !captionsOn ? CAPTIONS_ON : { kind: "ask", text })),
  ];
  return chips.slice(0, 4);
}

export function chipLabel(chip: NextChip): string {
  switch (chip.kind) {
    case "check":
      return `${chip.count} to check`;
    case "style":
      return "Use that style";
    case "step":
      return chip.step.label;
    case "ask":
    case "hand":
      return chip.text;
  }
}

/** Where a first cut stands until it is played: half a second in, where its label and first captions are on (the dev page's). */
export const STILL = 15;
/** How far before a change the video starts, so the change is seen arriving. */
export const LEAD_IN = 15;

/**
 * The moment a request is about (E15; plan 2026-11-25-editor-screens-b, Task 7): the film frame the video is paused on, when
 * the creator paused inside the film; else null. Not while it plays, not in its first half second (up to `STILL`, where a first
 * cut stands by itself), not on its last frame (where it stops by itself), and not on the frame whose moment the creator took
 * away (`dropped`): the moment comes back when the video is paused on another frame. `frames` is the film's length.
 */
export function pausedMoment(frame: number, frames: number, playing: boolean, dropped: number | null): number | null {
  if (playing || frame <= STILL || frame >= frames - 1 || frame === dropped) return null;
  return frame;
}

/** A moment as the scrubber says the time (ruling R30): the whole seconds gone by, rounded down ("0:06"). */
export function momentLabel(frame: number): string {
  return timecode(Math.floor(frame / FPS));
}

export interface Playhead {
  frame: number;
  play: boolean;
  /** A first cut standing still: it plays from its start when it is first played. */
  still: boolean;
}

/**
 * Where the playhead goes when the edit shown becomes `now` (§5.2): a first cut stands half a second in; a turn goes to just
 * before where it changed the film and plays it; a move goes there and waits; when the whole film changed (a look) the playhead
 * stays where it was, at the start when that frame is gone.
 */
export function playheadAfter(was: Edit | null, now: Edit, at: number, moved: "turn" | "move" | null): Playhead {
  const frames = filmFrames(now);
  if (was === null) return { frame: Math.min(STILL, frames - 1), play: false, still: true };
  const change = firstChangedFrame(was, now);
  if (change === null) return { frame: at < frames ? at : 0, play: false, still: false };
  return { frame: Math.max(0, change - LEAD_IN), play: moved === "turn", still: false };
}

/** A look as the cut's body (`POST …/cut`). */
export function styleBody(look: CutStyle): { style?: unknown } {
  switch (look.kind) {
    case "house":
      return {};
    case "preset":
      return { style: { preset: look.id } };
    case "words":
      return { style: { words: look.words } };
    case "video":
      return { style: look.style };
  }
}

/** A look's key, as the edit keeps it (`house`, a preset's id, `words`, `video`): which look is picked. */
export function lookKeyOfStyle(look: CutStyle): string {
  return look.kind === "house" ? "house" : look.kind === "preset" ? look.id : look.kind;
}

const turnOrNone = (value: unknown): boolean => value === null || typeof value === "number";
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a route's answer is an edit as the page reads it: as much of its shape as the page's own code reads, so an answer
 * that is ok and is no edit (an empty body, another route's) is not taken for one.
 */
export function isView(value: unknown): value is EditView {
  if (!isObject(value) || !isObject(value.take)) return false;
  return (
    typeof value.id === "string" && typeof value.take.id === "string" && typeof value.take.status === "string" && Array.isArray(value.turns) &&
    turnOrNone(value.head) && turnOrNone(value.shown) && turnOrNone(value.undo) && turnOrNone(value.redo) &&
    (value.shown === null) === !isObject(value.edit) && (value.export === null || isObject(value.export)) && Array.isArray(value.next)
  );
}

/** The longest a read waits after reads that failed. */
export const MOST_READ_WAIT_MS = 30_000;

/** How long the next read of a waiting edit waits: its pace, twice as long after each read running that failed, up to the most. */
export function readWait(pace: number, missed: number): number {
  return Math.min(pace * 2 ** missed, Math.max(pace, MOST_READ_WAIT_MS));
}
