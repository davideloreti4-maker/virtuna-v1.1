/**
 * build-state.ts — the building state of a read (spec 2026-11-25-audience, 3.6): a reducer over the
 * stream's events (`build-stream.ts`).
 *
 * Pure. The steps are the server's own: the three names `calibrationVocabulary` gives the route, which it
 * sends as `stage` frames, so the screen shows the work actually happening and never a guessed one. A
 * description's read takes the described names, as the route does.
 *
 * Phases: running; settling once the audience is made (`done`: the route still stores the account's
 * figures and posts before it closes the stream, so the page waits for that); done once the stream
 * closes; thin (too little to read); failed. Nothing changes after thin, failed or done, and once the
 * audience is made a late error cannot undo it.
 *
 * The failure's sentence: the server's own only when it says the account was read fine and the building
 * failed (the handle is fine, and asking for it would be a false accusation); otherwise the route's
 * sentence is its old wording or a raw error text, and the screen's own sentence stands instead.
 */
import { calibrationVocabulary } from "@/lib/audience/calibration-stages";

import { AUDIENCE_STRINGS, thinWhy } from "./audience-words";
import type { BuildRequest } from "./build-request";
import type { BuildEvent } from "./build-stream";

export type BuildPhase = "running" | "settling" | "done" | "thin" | "failed";
export type StepStatus = "pending" | "active" | "done";

export interface BuildState {
  phase: BuildPhase;
  request: BuildRequest;
  plan: readonly string[];
  steps: Record<string, StepStatus>;
  evidence: { picture: string | null; covers: string[]; count: number } | null;
  audienceId: string | null;
  sentence: string | null;
}

/** The ring's wedges; all of them lit once the three steps are done. */
const WEDGES = 10;

/** The route's synthesis sentence starts so (`calibrate/route.ts`): the account was read fine. */
const READ_FINE = /^We read @[a-z0-9._]+ fine/;

const ended = (s: BuildState) => s.phase === "thin" || s.phase === "failed" || s.phase === "done";

export function startBuild(request: BuildRequest): BuildState {
  const plan = [...calibrationVocabulary("handle" in request).plan];
  return {
    phase: "running",
    request,
    plan,
    steps: Object.fromEntries(plan.map((name) => [name, "pending" as const])),
    evidence: null,
    audienceId: null,
    sentence: null,
  };
}

/** The sentence a failed read shows. */
export function failureSentence(message: string | null, request: BuildRequest): string {
  if (!("handle" in request)) return AUDIENCE_STRINGS.describeFailed;
  return message !== null && READ_FINE.test(message) ? message : AUDIENCE_STRINGS.accountNotFound;
}

export function applyEvent(s: BuildState, e: BuildEvent): BuildState {
  if (ended(s)) return s;
  switch (e.type) {
    case "stage": {
      const now = s.steps[e.name];
      if (now === undefined || now === "done" || now === e.status) return s;
      return { ...s, steps: { ...s.steps, [e.name]: e.status } };
    }
    case "evidence":
      return { ...s, evidence: { picture: e.picture, covers: e.covers, count: e.count } };
    case "done":
      if (s.phase === "settling") return s;
      return {
        ...s,
        phase: "settling",
        audienceId: e.audienceId,
        steps: Object.fromEntries(s.plan.map((name) => [name, "done" as const])),
      };
    case "fallback":
      if (s.phase === "settling") return s;
      return { ...s, phase: "thin", sentence: thinWhy("handle" in s.request ? s.request.handle : null) };
    case "error":
      if (s.phase === "settling") return s;
      return { ...s, phase: "failed", sentence: failureSentence(e.message, s.request) };
  }
}

/** The stream closed: a read with no outcome failed (the local sentence); a made audience is done. */
export function endOfStream(s: BuildState): BuildState {
  if (s.phase === "running") return { ...s, phase: "failed", sentence: failureSentence(null, s.request) };
  if (s.phase === "settling") return { ...s, phase: "done" };
  return s;
}

/** The steps as the list shows them: done, now (the one running), next. */
export function stepsOf(s: BuildState): { name: string; at: "done" | "now" | "next" }[] {
  return s.plan.map((name) => {
    const status = s.steps[name];
    return { name, at: status === "done" ? "done" : status === "active" ? "now" : "next" };
  });
}

/** How many of the ten wedges are lit: by the steps done (0, 3, 7, 10), all once the audience is made. */
export function litWedgesOf(s: BuildState): number {
  if (s.phase === "settling" || s.phase === "done") return WEDGES;
  if (s.plan.length === 0) return 0;
  const done = s.plan.filter((name) => s.steps[name] === "done").length;
  return Math.round((WEDGES * done) / s.plan.length);
}
