/**
 * video-test-card.ts — the pure mapper PredictionResult → video-test-card block (TEST-01).
 *
 * The /test in-thread flow runs the full /api/analyze Max video pipeline UNTOUCHED and then
 * hands its result here to be shaped into the one honest thread card (see profile-blocks.ts
 * VideoTestCardBlockSchema for the honesty contract). This module owns the mapping ONLY — it
 * imports engine types + the block type + the flash band thresholds, and nothing route/thread.
 *
 * Honesty spine (Pitfall 5 / D-11 / D-10):
 *   - NO 0-100 score leaves this function. `verdict` is HeroBlock.verdict_line (a WORD).
 *   - `band`/`fraction` are DERIVED from the REAL persona_simulation_results — a persona
 *     "stopped" iff they watched past the ~3s hook window (scroll_past_second >= HOOK_WINDOW_S)
 *     — using the SAME STRONG/MIXED thresholds the flash cards use. Never re-rolled, never faked.
 *   - When there are NO per-persona results (Wave 3 fell back / analysis unavailable) there is
 *     no honest audience reaction to show, so this returns null — the caller degrades to a
 *     link-out rather than fabricating a crowd (mirrors the account-read thin fallback).
 *   - `theOneFix`/`ceiling` are nullable: Apollo can be down, and we surface only what ran.
 *   - `model: "sim1-max"` — a real video ran the Max VIDEO tier.
 */

import type { HeroBlock, OptimalPostWindow, PersonaSimulationResult, VerbatimPayload } from "@/lib/engine/types";
import type { VideoTestCardBlock } from "@/lib/tools/blocks";
import type { TrustTier } from "@/lib/audience/resolve-tier";
import {
  STRONG_THRESHOLD,
  MIXED_THRESHOLD,
} from "@/lib/engine/flash/flash-aggregate";

/**
 * The narrow slice of a video PredictionResult this mapper reads. A full PredictionResult
 * (the SSE `complete` payload) is structurally assignable to it, and so is a freshly-assembled
 * object built from the persisted analysis_results row (the /test card route's path — hero and
 * apollo_reasoning live in variants.hero / variants.apollo there). Narrow on purpose: the route
 * never has to fabricate a whole PredictionResult, and the unit test constructs only these fields.
 */
export interface VideoTestSource {
  overall_score: number;
  anti_virality_gated: boolean;
  persona_simulation_results: PersonaSimulationResult[];
  hero?: HeroBlock | null;
  apollo_reasoning?: { rewrites?: Array<{ variant?: string | null }> | null; ceiling_capper?: string | null } | null;
  optimal_post_window?: OptimalPostWindow | null;
  verbatim?: VerbatimPayload | null;
}

/** The ~3s hook window (seconds). A persona "stopped" iff they watched past it. */
const HOOK_WINDOW_S = 3;

/** Display cap for a persona reasoning quote (the schema allows the source's 500). */
const QUOTE_DISPLAY_CAP = 280;

export interface VideoTestCardOptions {
  /** The row id — powers the "See the full breakdown →" door to /analyze/[id]. */
  analysisId: string;
  /** The active audience's display name (resolved by the route; "General" default). */
  audienceName: string;
  /** The run-level trust tier (resolveTier of the active audience). */
  tier: TrustTier;
}

/** Band from a stop-count, reusing the flash thresholds exactly (never re-rolled). */
function bandFromStops(stops: number): "Strong" | "Mixed" | "Weak" {
  if (stops >= STRONG_THRESHOLD) return "Strong";
  if (stops >= MIXED_THRESHOLD) return "Mixed";
  return "Weak";
}

/** Trim a persona's reasoning to a card-legible quote without a mid-word cut. */
function clampQuote(text: string): string {
  const t = text.trim();
  if (t.length <= QUOTE_DISPLAY_CAP) return t;
  const cut = t.slice(0, QUOTE_DISPLAY_CAP);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The video's own opening line (spoken words, else on-screen text) — the honest room anchor. */
function conceptFromVerbatim(verbatim: VerbatimPayload | null | undefined): string | undefined {
  const hook = verbatim?.hook;
  const text = (hook?.spoken_words ?? hook?.on_screen_text ?? "").trim();
  return text.length > 0 ? text.slice(0, 500) : undefined;
}

/** Format the niche-aware optimal window into one soft line, or null when absent. */
function formatPostWindow(w: OptimalPostWindow | null | undefined): string | null {
  if (!w) return null;
  const [lo, hi] = w.hour_range;
  const pad = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return `${w.day_of_week} ${pad(lo)}–${pad(hi)} ${w.timezone}`;
}

/**
 * Map a completed video PredictionResult → the video-test-card block, or null when the run
 * carries no honest audience reaction (no per-persona results). The caller (the /test card
 * route) treats null as "couldn't read the audience on this video" and degrades to the
 * link-out rather than emitting a card with a fabricated band.
 */
export function predictionResultToVideoTestCard(
  result: VideoTestSource,
  opts: VideoTestCardOptions,
): VideoTestCardBlock | null {
  const personas = result.persona_simulation_results ?? [];
  if (personas.length === 0) return null; // no honest reaction to show → caller degrades

  const stops = personas.filter((p) => p.scroll_past_second >= HOOK_WINDOW_S).length;
  const total = personas.length;
  const band = bandFromStops(stops);
  const fraction = `${stops}/${total} stopped`;

  const reactions = personas.map((p) => ({
    archetype: p.archetype,
    verdict: (p.scroll_past_second >= HOOK_WINDOW_S ? "stop" : "scroll") as "stop" | "scroll",
    quote: clampQuote(p.reasoning),
  }));

  // Verdict + go/no-go: prefer the assembled hero (word-only), else derive the same WORD from
  // the gate + score (still never surfacing the number itself).
  const gated = result.anti_virality_gated;
  const score = result.overall_score;
  const verdict =
    result.hero?.verdict_line ??
    (gated ? "Don't post yet" : score >= 70 ? "High potential" : score >= 40 ? "Solid contender" : "Needs work");
  const goNoGo: "go" | "no-go" = result.hero?.go_no_go ?? (gated ? "no-go" : "go");

  return {
    type: "video-test-card",
    props: {
      verdict,
      goNoGo,
      audienceName: opts.audienceName,
      band,
      fraction,
      theOneFix: result.hero?.the_one_fix ?? result.apollo_reasoning?.rewrites?.[0]?.variant ?? null,
      ceiling: result.hero?.ceiling ?? result.apollo_reasoning?.ceiling_capper ?? null,
      reactions,
      postWindow: formatPostWindow(result.optimal_post_window),
      ...(conceptFromVerbatim(result.verbatim) ? { conceptText: conceptFromVerbatim(result.verbatim)! } : {}),
      analysisId: opts.analysisId,
      model: "sim1-max",
      tier: opts.tier,
    },
  };
}
