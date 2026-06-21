/**
 * Phase 7 Plan 03 — Per-audience persona description repaint (D-02 / Pitfall 2).
 *
 * Deterministic: given the same (audienceProfile, goalIntent, weights), produces
 * byte-identical CalibratedPersona[] output — NO Date.now(), NO Math.random().
 *
 * Generated ONCE at calibration and stored on the audience row.
 * Folded deterministically into the Flash prompt in 07-04 (never regenerated per-request).
 *
 * This v1 implementation uses a structured template over profile signals (niche/platform/
 * temperature) — cheap, deterministic, and correct. An LLM repaint (if used) must be run
 * ONCE at calibration and stored; it is NOT called per-request.
 *
 * Exports: repaintPersonas
 */

import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { labelForArchetype } from "./temperature-disposition";
import type { CalibratedPersona, AudienceProfile, GoalIntent } from "./audience-types";
import type { PersonaWeights } from "@/lib/engine/persona-weights";

// ─── Repaint template helpers ──────────────────────────────────────────────────

/**
 * Maps each archetype to a compact, goal-aware description template.
 * Template uses static pattern matching — no randomness, no LLM call.
 *
 * Pattern: "[archetype trait] [in this audience context] — [engagement signal]"
 */
const ARCHETYPE_BASE_DESCRIPTION: Record<Archetype, string> = {
  high_engager:
    "Actively likes, comments, and shares. Among the most responsive segment in this audience.",
  saver:
    "Saves content for later reference. Signals high intent but low immediate virality.",
  lurker:
    "Watches without interacting. Large in volume — hard to measure but important for reach.",
  sharer:
    "Re-posts and spreads content to their own followers. Your organic amplification engine.",
  tough_crowd:
    "Sceptical on first view. Low tolerance for weak hooks — earn their trust with substance.",
  purposeful_viewer:
    "Watches with a specific goal in mind. Responds to clear, practical, direct content.",
  niche_deep_buyer:
    "Deep niche investment and buyer intent. Ready to convert when the offer is relevant.",
  niche_deep_scout:
    "Researches and vets before acting. Values credibility and specificity over entertainment.",
  loyalist:
    "Returning fan who trusts your voice. High retention — future content recalls this segment.",
  cross_niche_curiosity:
    "Stumbled in from adjacent topics. Unfamiliar with your niche — broad appeal hooks required.",
};

/** Goal-intent suffix that qualifies the repaint description for the creator's specific goal. */
const GOAL_INTENT_SUFFIX: Record<GoalIntent, Record<Archetype, string>> = {
  grow: {
    high_engager: "Drive them to share for reach acceleration.",
    saver: "Highlight shareable hooks to convert save intent into shares.",
    lurker: "Quantity here powers the algorithmic reach signal.",
    sharer: "Priority segment for growth — amplify content that triggers sharing.",
    tough_crowd: "Win them with a strong hook: one sceptic converted = broad social proof.",
    purposeful_viewer: "Clear value proposition hooks this segment into follows.",
    niche_deep_buyer: "Edge case for grow goal — they amplify within the niche.",
    niche_deep_scout: "Builds credibility that makes other segments trust the account.",
    loyalist: "Loyal segment fuels comment volume that boosts algorithmic reach.",
    cross_niche_curiosity: "Highest growth upside — new followers come from this segment.",
  },
  sell: {
    high_engager: "Engagement here signals interest — prime retargeting segment.",
    saver: "Saves correlate with purchase intent — worth a direct CTA.",
    lurker: "Low direct conversion; large volume helps social proof.",
    sharer: "Word-of-mouth sales driver — share incentives compound revenue.",
    tough_crowd: "Hard to convert; focus energy on segments with higher intent.",
    purposeful_viewer: "Solution-seeking — match content to their buying criteria.",
    niche_deep_buyer: "Highest conversion probability. Every CTA is aimed at this segment.",
    niche_deep_scout: "Researches before buying — provide detail, evidence, and comparisons.",
    loyalist: "Repeat buyer potential. Retention offers (bundles, loyalty) land here.",
    cross_niche_curiosity: "Low conversion; awareness value only.",
  },
  authority: {
    high_engager: "Public engagement builds visible social proof for authority.",
    saver: "Saves signal that your content is reference-worthy — authority signal.",
    lurker: "Passive audience that absorbs your positioning.",
    sharer: "Shares your content into new circles — extends authority reach.",
    tough_crowd: "Converting sceptics is the highest-value authority signal.",
    purposeful_viewer: "Actively seeking expertise — your depth earns their respect.",
    niche_deep_buyer: "Deep niche segment validates authority through purchase.",
    niche_deep_scout: "Critical evaluators; earning their trust makes the authority case.",
    loyalist: "Your core authority base. Their retention is the proof of value.",
    cross_niche_curiosity: "Wide reach for an authority position — breadth + depth combo.",
  },
  nurture: {
    high_engager: "Keep them engaged with consistency and personalised follow-ups.",
    saver: "Saves suggest they are building a relationship with your content.",
    lurker: "Silent retention — maintain quality to keep them in the feed.",
    sharer: "Sharers amplify community value — nurture with exclusive content.",
    tough_crowd: "Hard to retain; focus nurture energy on warmer segments.",
    purposeful_viewer: "Returns when they have a need — give them a reason to follow for continuity.",
    niche_deep_buyer: "Post-purchase nurture: loyalty and retention hooks.",
    niche_deep_scout: "Long-term relationship potential if trust is built consistently.",
    loyalist: "Highest retention ROI. Prioritise this segment in every nurture sequence.",
    cross_niche_curiosity: "Transient — low nurture value unless converted to loyalists.",
  },
};

// ─── Archetype → weight slot grouping ─────────────────────────────────────────

/**
 * Slot keys for PersonaWeights (fyp/niche/loyalist/cross_niche).
 * Based on wave3/persona-registry.ts slot assignments.
 *
 * fyp        → high_engager, saver, lurker, sharer, tough_crowd
 * niche      → purposeful_viewer, niche_deep_buyer, niche_deep_scout
 * loyalist   → loyalist
 * cross_niche → cross_niche_curiosity
 */
type WeightKey = "fyp" | "niche" | "loyalist" | "cross_niche";

/** Archetypes grouped by their PersonaWeights slot (for proportional share calculation). */
const ARCHETYPES_PER_SLOT: Record<WeightKey, Archetype[]> = {
  fyp: ["high_engager", "saver", "lurker", "sharer", "tough_crowd"],
  niche: ["purposeful_viewer", "niche_deep_buyer", "niche_deep_scout"],
  loyalist: ["loyalist"],
  cross_niche: ["cross_niche_curiosity"],
};

// ─── Public API ────────────────────────────────────────────────────────────────

export interface RepaintPersonasInput {
  audienceProfile: AudienceProfile;
  goalIntent: GoalIntent;
  weights: PersonaWeights;
}

/**
 * Repaint the 10 byte-stable archetypes into audience-specific CalibratedPersona entries.
 *
 * Deterministic: same (audienceProfile, goalIntent, weights) → byte-identical output.
 * Stored on the audience row at calibration time — never called per-request (Pitfall 2).
 *
 * Share calculation: archetype share = slot_weight / slot_archetype_count.
 * e.g. fyp=0.65, 5 fyp archetypes → each gets 0.13 share.
 */
export function repaintPersonas(input: RepaintPersonasInput): CalibratedPersona[] {
  const { goalIntent, weights } = input;

  // Pre-compute share per slot member (deterministic — depends only on weights)
  const sharePerArchetype: Record<Archetype, number> = {} as Record<Archetype, number>;
  for (const [slotKey, archetypes] of Object.entries(ARCHETYPES_PER_SLOT) as [WeightKey, Archetype[]][]) {
    const slotWeight = weights[slotKey];
    const shareEach = slotWeight / archetypes.length;
    for (const arch of archetypes) {
      sharePerArchetype[arch] = shareEach;
    }
  }

  // Build personas in ARCHETYPES order (deterministic order)
  return ARCHETYPES.map((archetype) => {
    const { temperature, disposition } = labelForArchetype(archetype);
    const baseDesc = ARCHETYPE_BASE_DESCRIPTION[archetype];
    const goalSuffix = GOAL_INTENT_SUFFIX[goalIntent][archetype];
    // Repaint = structured template: base trait + goal-aware qualifier
    const repaint = `${baseDesc} ${goalSuffix}`;

    return {
      archetype,
      repaint,
      temperature,
      disposition,
      share: sharePerArchetype[archetype] ?? 0,
    };
  });
}
