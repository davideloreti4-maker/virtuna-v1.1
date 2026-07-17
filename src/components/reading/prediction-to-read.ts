/**
 * predictionResultToRead — the engine `PredictionResult` → contract `Read` adapter (Seam 2).
 *
 * The second Room↔Surfaces seam adapter (docs/SURFACE-SEAM-SPEC.md §1 row 2 / §3.3). Where
 * `audienceToActiveAudience` (Seam 3) produces the app-wide presence, THIS turns a real analysis
 * into the contract `Read` the surfaces render behind a card — so a feed tile / saved card / plan
 * slot can open the read-only Room on a REAL video instead of `mock-room.ts`'s `MOCK_READS`.
 *
 * Self-contained + pure: it builds the persona nodes the SAME way the Phase-3 embedded Room does
 * (`buildAudienceNodes` — reading-room.tsx's exact call), so the card face + the opened Room agree.
 *
 * Honesty spine (binding, mirrors the Room): every field is REAL engine output — `stop`/`split` are
 * the personas' own watch-through verdicts (never a fabricated crowd), `weakSpot`/`fix` are verbatim
 * Apollo prose, a Reaction's `verdict` is the persona's real `segment_reasons` quote (empty when it
 * carried none — never invented). Names are the persona's real name, never the archetype enum (§2).
 * Deterministic (no wall-clock / PRNG) — SSR + engine-determinism-gate safe.
 */

import type { PredictionResult } from '@/lib/engine/types';
import type { PersonaNode } from '@/components/board/_kit/PersonaGraph';
import type { Read, Reaction, Tone } from '@/lib/room-contract/types';
import { buildAudienceNodes } from './reading-panels';

// Bands mirror AmbientRoom (the surface's read-only panel renders it): "would stop" is the ≥0.5
// watch-through verdict (`verdictOf`); the 3-way tone uses the `meterTone` sage/coral thresholds.
const STOP_THRESHOLD = 0.5;
const LOVED_BAND = 0.6;
const BOUNCED_BAND = 0.4;
/** The honest "1,000 modeled from your N" population framing (matches mock-room + AmbientRoom). */
const POPULATION_TOTAL = 1000;

/** A node's continuous watch-through → the contract's 3-way tone (matches AmbientRoom `meterTone`). */
function toneOf(watchThrough: number): Tone {
  if (watchThrough >= LOVED_BAND) return 'loved';
  if (watchThrough <= BOUNCED_BAND) return 'bounced';
  return 'neutral';
}

/** One persona node → a named, in-voice contract `Reaction`. */
function nodeToReaction(n: PersonaNode): Reaction {
  const reaction: Reaction = {
    // Named person, NEVER the archetype enum (THE-CONTRACT §2): the resolved name wins, the
    // archetype display label is the fallback. The archetype slug is the stable recurring identity.
    person: { id: n.archetype ?? n.id, name: n.name ?? n.label, segment: n.segment ?? '' },
    tone: toneOf(n.watchThrough),
    // The persona's REAL verbatim reaction (`segment_reasons`); '' when it carried none (honest —
    // the Room STATES the absence: "Stopped. No words recorded."), never a fabricated quote.
    verdict: n.quote ?? '',
  };
  if (n.dropAt) reaction.moment = `drop at ${n.dropAt}`;
  return reaction;
}

/**
 * Adapt a `PredictionResult` (+ its card/analysis id) into the contract `Read`. Total (never
 * throws): an empty/degraded analysis yields a zeroed Read with no reactions + no population.
 *
 * NOTE (caller's gate): a `data.analysis_unavailable` result carries a fabricated 0 score — the
 * caller should render the "couldn't analyze" state and NOT open a Read on it (mirrors the Reading
 * UI's D-13 gate). This adapter stays total + honest rather than second-guessing that decision.
 */
export function predictionResultToRead(data: PredictionResult, contentId: string): Read {
  const nodes = buildAudienceNodes(data);
  const total = nodes.length;

  // Headline "N/10 would stop" — the SAME ≥0.5 watch-through the Room's People/Population views use,
  // normalized to /10 so the card face and the opened Room read the same number.
  const stops = nodes.filter((n) => n.watchThrough >= STOP_THRESHOLD).length;
  const stop = total > 0 ? Math.round((stops / total) * 10) : 0;

  // 3-way split (loved/bounced/neutral), % summing to exactly 100 (neutral absorbs the rounding).
  const lovedN = nodes.filter((n) => n.watchThrough >= LOVED_BAND).length;
  const bouncedN = nodes.filter((n) => n.watchThrough <= BOUNCED_BAND).length;
  const loved = total > 0 ? Math.round((lovedN / total) * 100) : 0;
  const bounced = total > 0 ? Math.round((bouncedN / total) * 100) : 0;
  const neutral = total > 0 ? Math.max(0, 100 - loved - bounced) : 0;

  const read: Read = {
    contentId,
    stop,
    split: { loved, bounced, neutral },
    // The diagnostic + the lever, verbatim from the engine (never fabricated). The first-class hero
    // block leads; the raw Apollo ceiling_capper / first warning are the fallbacks when hero didn't
    // persist (degraded / permalink rows).
    weakSpot: data.hero?.ceiling ?? data.apollo_reasoning?.ceiling_capper ?? data.warnings?.[0] ?? '',
    fix: data.hero?.the_one_fix ?? data.apollo_reasoning?.rewrites?.[0]?.variant ?? '',
    reactions: nodes.map(nodeToReaction),
  };
  // Honest population framing only when there's a real cohort to model from.
  if (total > 0) read.population = { modeledFrom: total, total: POPULATION_TOTAL };
  return read;
}
