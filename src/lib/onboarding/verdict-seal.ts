/**
 * verdict-seal.ts — the funnel's WALL, server side (ONBOARDING-FUNNEL-DESIGN.md §0b②).
 *
 * An anonymous /go visitor runs the REAL Test free; the $1 buys the simulation verdict —
 * the audience would-stop %, the population breakdown, the why and the fix. This module is
 * how that verdict is sealed: the API layer strips it from every response to an anonymous
 * session, so the verdict is NEVER TRANSMITTED — absent from the wire, not hidden by the
 * client. (The walkthrough fixture accepted devtools exposure because its video was a
 * public sample; the visitor's OWN run gets the real seal.) The full data still persists
 * server-side (`analysis_results` + `threads.sim_seals`), so payment + identity linking
 * unlock it without a re-run.
 *
 * Keyed on `is_anonymous === true` — NEVER on tier `free` (every existing user is tier
 * free), and NEVER gated by AMBIENT_V2 / BILLING flags: what crosses the wire must not
 * depend on which UI happens to be mounted. Mirrors DEMO_CREDITS' keying (lib/pricing.ts).
 *
 * Polarity: a session with NO `is_anonymous` claim reads as a REAL user — not sealed.
 * Sealing legacy users would withhold the product they signed up for; a missing claim on a
 * genuine visitor costs us one free verdict (a conversion leak), never a broken customer.
 *
 * What stays free ON the wire (the §0b③ free column, all already in the Test card):
 * the craft read (score, dims, drivers, director's fixes), the transcript, the filmstrip
 * frames and segment labels, and the ambient room's local 1,000-node animation. What this
 * module strips is the RECEPTION read — every field the room's verdict is derived from:
 * the attention curve (`heatmap` carries `weighted_hook_score`, the would-stop % itself),
 * the fold cast's reactions (`personas`), the action intents
 * (`persona_behavioral_aggregate`, `behavioral_predictions`), and the engagement forecast.
 */

import type { SimSealMap } from "@/lib/threads/sim-seals";

/** True only for a `/go` funnel visitor — the `is_anonymous` JWT claim, strictly. */
export function isSealedVisitor(
  user: { is_anonymous?: boolean } | null | undefined,
): boolean {
  return user?.is_anonymous === true;
}

/**
 * The reception fields of an analysis payload (the SSE `complete` event, the JSON result,
 * the cached replay, and the persisted-row reads — all share these top-level names).
 * Everything the sealed trio (`unlock` / `brain.whyThisSecond` / `population`) and the
 * would-stop verdict chip are derived from, and nothing the free craft card needs.
 */
const SEALED_ANALYSIS_FIELDS = [
  "heatmap", // per-segment attention curve + weighted_hook_score (the would-stop % itself)
  "personas", // the fold cast's per-persona reactions → the population drill
  "persona_behavioral_aggregate", // action intents (share/save/comment) → "what they'd do"
  "behavioral_predictions", // completion/share/comment/save forecast — the same read, engine-level
  "predicted_engagement", // the engagement range forecast
] as const;

/**
 * Strip the reception read from an analysis-shaped payload. Returns a COPY with the sealed
 * fields nulled and a `verdict_sealed: true` receipt, so a client (and a test) can tell a
 * sealed response from a degraded run instead of guessing from absences.
 */
export function sealAnalysisPayload<T extends object>(
  payload: T,
): T & { verdict_sealed: true } {
  const out = { ...payload } as Record<string, unknown>;
  for (const field of SEALED_ANALYSIS_FIELDS) {
    out[field] = null;
  }
  out.verdict_sealed = true;
  return out as T & { verdict_sealed: true };
}

/**
 * The wire shape of a sealed thread seal — what `/api/threads/open` sends an anonymous
 * session instead of a `SimSeal`. Carries exactly the free half: the run's identity and
 * its craft score (already on the visitor's Test card). No `pct`, no `population`, no
 * `heatmap`, no intents — the sealed room renders from THIS, so it cannot leak what it
 * never received.
 */
export interface SealedSimSeal {
  sealed: true;
  at: string;
  video: {
    analysisId: string;
    craftScore: number | null;
  };
}

/** What the client actually receives from `/api/threads/open`: full seals for a real user,
 *  sealed wire seals for an anonymous one. Narrow with `isSealedSimSeal`. */
export type WireSimSeal = import("@/lib/threads/sim-seals").SimSeal | SealedSimSeal;
export type WireSimSealMap = Record<string, WireSimSeal>;

export function isSealedSimSeal(
  seal: WireSimSeal | null | undefined,
): seal is SealedSimSeal {
  return !!seal && (seal as SealedSimSeal).sealed === true;
}

/**
 * Map a thread's full seal store to its sealed wire form. Video seals keep their free
 * half; concept seals (a text sim's verdict IS the verdict, with no free half) are
 * omitted entirely — their rows rehydrate as honestly queued. An anonymous thread should
 * hold none anyway (the react/simulate routes refuse anonymous runs before any spend);
 * this is the belt to that suspender.
 */
export function sealSimSeals(seals: SimSealMap): WireSimSealMap {
  const out: WireSimSealMap = {};
  for (const [key, seal] of Object.entries(seals)) {
    if (!seal.video) continue;
    out[key] = {
      sealed: true,
      at: seal.at,
      video: {
        analysisId: seal.video.analysisId,
        craftScore: seal.video.craftScore ?? null,
      },
    };
  }
  return out;
}
