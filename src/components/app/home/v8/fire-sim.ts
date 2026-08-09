/**
 * fire-sim — the PURE half of the v8 report's fire-on-demand sim (Phase 3).
 *
 * ⚠️ This intentionally MIRRORS `AmbientOverviewRail`'s shipped fireSim rather than importing
 * from it: the rail is retiring under CONCEPT_V8_ENABLED and must stay byte-identical while the
 * flag is off, so it is not refactored on the way out. Delete this note (and reconcile the two)
 * when the rail is deleted for good.
 *
 * The report NEVER sends a platform or a lens: the Flash SIM is platform-blind
 * (`buildReactionPanel` has no platform), so a lens on the wire would imply the verdict moved
 * with it. It does not.
 */

import type { ReactionPersona } from "@/lib/tools/blocks";
import type { PopulationAggregate } from "@/lib/audience/population";

/** One fired run's full result — the measured %, the exemplar voices, and the Stage-2
 *  projection when the audience's signature could produce one (null otherwise; never faked). */
export interface ReportSnapshot {
  stopPct: number;
  personas: ReactionPersona[];
  population: PopulationAggregate | null;
}

/** Parse aggregateFlash's honest "N/10 stop" → a 0–100 stop %. Unparseable ⇒ null: we NEVER
 *  seal a row from a malformed fraction. */
export function fractionToStopPct(fraction: string): number | null {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

/** The Flash framing a card's kind implies — a hook's read is first-2s, an idea's is "would they
 *  want it". Anything else takes the route's own default. */
function framingOf(kind?: string): "hook" | "idea" | undefined {
  if (kind === "hook") return "hook";
  if (kind === "idea") return "idea";
  return undefined;
}

export function reactRequestBody(input: { text: string; kind?: string }): Record<string, unknown> {
  const framing = framingOf(input.kind);
  // pin: captures the predicted vector for the flywheel. persist: the seal survives reload.
  return { text: input.text, pin: true, persist: true, ...(framing ? { framing } : {}) };
}

export function reactResponseToSnapshot(data: unknown): ReportSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    fraction?: string;
    personas?: ReactionPersona[];
    population?: PopulationAggregate | null;
  };
  const stopPct = fractionToStopPct(d.fraction ?? "");
  if (stopPct === null) return null;
  return { stopPct, personas: d.personas ?? [], population: d.population ?? null };
}
