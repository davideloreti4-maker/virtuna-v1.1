/**
 * v8-report — the PURE read behind the verdict report's personas-only grade (Phase 3).
 *
 * A drop card carries its CACHED Flash personas and nothing else: `{archetype, verdict,
 * quote}` × 10. That is the whole evidence base for a pre-run report, and this module is
 * the boundary that refuses to exceed it. What it prints:
 *   - the verdict count (a real tally of `verdict === "stop"`)
 *   - each group's real size (the "with counts" the spec asks for — the COUNT OF PEOPLE,
 *     never a coded-reason tally, because no producer codes reasons for a Flash text run)
 *   - the real quotes, attributed to their archetype
 * A persona that said nothing contributes no voice; a room that said nothing gets no lead.
 *
 * Pure + deterministic (no clock, no RNG, no I/O) — SSR-safe, engine-determinism-gate safe.
 */

import type { ReactionPersona } from "@/lib/tools/blocks";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";

/** One simulated viewer speaking, in their own words. `who` is the humanised archetype. */
export interface ReportVoice {
  who: string;
  quote: string;
}

export interface ReportRead {
  stop: number;
  total: number;
  /** 0..100, rounded. 0 when the room is empty — never a fabricated midpoint. */
  stopPct: number;
  stopped: ReportVoice[];
  scrolled: ReportVoice[];
  /** The one quote the report leads with, from the pool that WON. Null when nobody spoke. */
  lead: ReportVoice | null;
}

function voicesOf(personas: ReactionPersona[], verdict: "stop" | "scroll"): ReportVoice[] {
  return personas
    .filter((p) => p.verdict === verdict && p.quote.trim().length > 0)
    .map((p) => ({ who: archetypeDisplayName(p.archetype), quote: p.quote.trim() }));
}

export function personasToReportRead(personas: ReactionPersona[]): ReportRead {
  const total = personas.length;
  const stop = personas.filter((p) => p.verdict === "stop").length;
  const stopped = voicesOf(personas, "stop");
  const scrolled = voicesOf(personas, "scroll");
  // Lead with the majority's voice — a bounced room leads with a scroller, so the report never
  // opens on an endorsement it did not earn. An empty pool falls through to the other one, and
  // two empty pools yield NO lead (never invented).
  const majorityStopped = stop * 2 >= total;
  const lead = (majorityStopped ? stopped[0] : scrolled[0]) ?? stopped[0] ?? scrolled[0] ?? null;
  return {
    stop,
    total,
    stopPct: total > 0 ? Math.round((stop / total) * 100) : 0,
    stopped,
    scrolled,
    lead,
  };
}

/**
 * The personas-only `DomainTemplate`. `population` is NULL and `brain`/`engagement` are absent
 * on purpose: a pre-run Flash read has no Stage-2 projection, no attention timeline and no
 * retention curve, so `AmbientDetail` dims those tabs and states the absence. The Audience tab
 * is the EXISTING `PopulationFrame` at its reduced grade, fed by `personaRead` — never a
 * second frame (owner ruling 2026-08-09: the content is the content we already had).
 */
export function buildPersonaReportTemplate(input: {
  read: ReportRead;
  title: string;
  coverSrc?: string | null;
  audienceName: string;
  calibratedFrom: string;
}): DomainTemplate {
  const { read, title, calibratedFrom } = input;
  return {
    id: "v8-report",
    label: title,
    // The report is not the rail's drill: no back label, no pager, no identity strip.
    backLabel: "",
    pager: "",
    verdict: { value: `${read.stop}/${read.total}`, label: "stopped scrolling" },
    simline: `${read.total} simulated · calibrated on ${calibratedFrom}`,
    population: null,
    personaRead: { stop: read.stop, total: read.total, stopped: read.stopped, scrolled: read.scrolled },
  };
}
