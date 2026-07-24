/**
 * S1 — the guided rail.
 *
 * "Guided rails, not free roam" (`ONBOARDING-FUNNEL-DESIGN.md` §4): each beat lights exactly ONE
 * affordance, and it is the REAL control on the real surface, never a glowing overlay on a
 * screenshot. The visitor drives; they cannot drive off the road.
 *
 * The rail is data, not control flow, so the sequence can be reordered or A/B'd without touching
 * the component — and so the state machine is testable without rendering anything.
 */

import type { FunnelEvent } from "@/lib/analytics/funnel-events";
import type { SealState } from "./walkthrough-fixture";

export type BeatId = "frames" | "revealed" | "wall" | "open";

export interface Beat {
  id: BeatId;
  /** Small caps label above the line — where they are in the walkthrough. */
  kicker: string;
  /** The one sentence this beat is making land. */
  headline: string;
  /** Supporting line. Kept to one sentence — more than one and the beat has two jobs. */
  body: string;
  /** The single lit affordance. `null` on the terminal beat. */
  cta: string | null;
  /** How much of the analysis this beat may render. */
  seal: SealState;
  /** Emitted on ENTERING the beat. */
  event: FunnelEvent;
  /** The wall is the only beat that asks for money — the shell renders the tripwire here. */
  isWall?: boolean;
}

/**
 * Time-to-aha budget (design §0a): beat 1's insight inside ~10s of load, the wall by ~45s. That is
 * why there are four beats and not eight — every additional beat spends the budget that the wall
 * needs. If a beat cannot justify its seconds, cut it.
 */
export const BEATS: readonly Beat[] = [
  {
    id: "frames",
    kicker: "The video",
    headline: "This is 12 seconds, read frame by frame.",
    body: "The line is measured attention — where it falls, viewers left. Two places it falls here.",
    cta: "Show me the first one",
    seal: "sealed",
    event: "demo_view",
  },
  {
    id: "revealed",
    kicker: "0:08 · the smaller drop",
    headline: "Attention sags through the proof section.",
    body: "Here is the whole read on it — what happened, why, and the fix. Nothing held back.",
    cta: "Now show me the big one",
    seal: "sealed",
    event: "demo_fix_open",
  },
  {
    id: "wall",
    kicker: "0:04 · the drop that matters",
    headline: "This is where the video actually loses people.",
    body: "You can see where. The why, the fix, and what your own audience would score are what the dollar buys.",
    cta: null,
    seal: "sealed",
    event: "demo_wall_shown",
    isWall: true,
  },
  {
    id: "open",
    kicker: "0:04 · unlocked",
    headline: "Here is what was behind the wall.",
    body: "Exactly what was withheld — nothing regenerated, nothing different.",
    cta: null,
    seal: "open",
    event: "reveal_shown",
  },
] as const;

const ORDER: readonly BeatId[] = BEATS.map((b) => b.id);

export function beatAt(id: BeatId): Beat {
  const beat = BEATS.find((b) => b.id === id);
  if (!beat) throw new Error(`unknown beat: ${id}`);
  return beat;
}

/**
 * The next beat on the rail, or `null` at the end.
 *
 * NOTE the wall does NOT advance on its own — `nextBeat("wall")` returns `open`, but only a
 * successful checkout may call it. The rail describes the order; it does not authorise the step.
 */
export function nextBeat(id: BeatId): BeatId | null {
  const i = ORDER.indexOf(id);
  if (i < 0) throw new Error(`unknown beat: ${id}`);
  return ORDER[i + 1] ?? null;
}

/** Progress for the rail indicator — 1-based, so "2 of 4" reads correctly. */
export function beatPosition(id: BeatId): { step: number; total: number } {
  const i = ORDER.indexOf(id);
  if (i < 0) throw new Error(`unknown beat: ${id}`);
  return { step: i + 1, total: ORDER.length };
}
