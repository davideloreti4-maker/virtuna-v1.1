/**
 * Phase 7 Plan 01 — Audience domain SSOT.
 *
 * This is the single source of truth for the Audience object and its sub-types.
 * Downstream plans (persistence, calibration, wiring) import from here — never
 * redefine these shapes elsewhere.
 *
 * Import strategy:
 *  - PersonaWeights from engine (fyp/niche/loyalist/cross_niche) — NOT redefined here.
 *  - Archetype / ARCHETYPES from wave3/persona-registry — NOT redefined here.
 */

import type { PersonaWeights } from "@/lib/engine/persona-weights";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";

// Re-export for convenience so callers only need to import from this module.
export type { PersonaWeights, Archetype };

// ─── Presentation enums (D-02 — audience-facing labels, NOT engine vocabulary) ─

/** Temperature lens (cold/warm/hot) — presentation only, maps onto SlotType semantics. */
export type Temperature = "cold" | "warm" | "hot";

/** Disposition labels — creator-facing categorisation of audience behaviour. */
export type Disposition =
  | "scanner"
  | "skeptic"
  | "collector"
  | "connector"
  | "converter"
  | "lurker";

// ─── Goal-intent taxonomy (D-05) ─────────────────────────────────────────────

/**
 * Fixed goal-intent taxonomy. Creator picks from this set via a dropdown (not free-text
 * classification) so the weight bias is always deterministic.
 * See: src/lib/audience/goal-intent.ts for the GOAL_INTENT_BIAS table.
 */
export type GoalIntent = "grow" | "sell" | "authority" | "nurture";

// ─── Audience configuration ───────────────────────────────────────────────────

/** Audience type: creator's own account (personal) vs a described target audience. */
export type AudienceType = "personal" | "target";

/** Platform the audience is on. */
export type AudiencePlatform = "tiktok" | "instagram" | "youtube" | "custom";

// ─── Calibrated persona (per-audience archetype repaint) ─────────────────────

/**
 * A per-audience calibrated presentation of one of the 10 engine archetypes.
 * - archetype: the engine slug (immutable — ARCHETYPE_DEFINITIONS stay byte-stable).
 * - repaint: stored at calibration time for deterministic prompt fold (D-17 cache safety).
 * - temperature / disposition: the D-02 presentation lens (from TEMPERATURE_DISPOSITION).
 * - share: this archetype's share of the audience (0..1, sums to 1.0 across all personas).
 */
export interface CalibratedPersona {
  archetype: Archetype;
  repaint: string;
  temperature: Temperature;
  disposition: Disposition;
  share: number;
}

// ─── Audience Profile (derived from calibration) ─────────────────────────────

/**
 * Audience-level aggregate profile derived during calibration.
 * Presentation-only — never feeds the engine directly.
 */
export interface AudienceProfile {
  /** Fractional breakdown of cold/warm/hot temperatures across all personas. */
  temperature_mix: Record<Temperature, number>;
  /** Top 3 dispositions by share (creator-facing insight). */
  top_dispositions: Disposition[];
  /** Follower tier bucket from getFollowerTier() — null when count unavailable. */
  follower_tier: string | null;
}

// ─── Audience domain object ───────────────────────────────────────────────────

/**
 * The Audience domain object. Mirrors the `audiences` table schema (07-01 RESEARCH.md).
 *
 * Multi-select readiness: resolveAudienceWeights() accepts Audience[] — this object is
 * the element type of that array. The DB stores a single `active_audience_id` per thread
 * in v1; the resolver is array-shaped so multi-select is additive (Pitfall 5).
 */
export interface Audience {
  /** UUID PK — audience_id (multi-select ready: audiences.id). */
  id: string;
  /** Owner user ID — always from session, never request body (CR-01). */
  user_id: string;
  /** Creator-chosen display name. */
  name: string;
  /** 'personal' (own account scrape, D-06) or 'target' (described). */
  type: AudienceType;
  /** Platform the audience lives on. */
  platform: AudiencePlatform;
  /** Free-text display label for the goal (D-05 — any text, maps to goal_intent). */
  goal_label: string | null;
  /** Fixed goal-intent enum (D-05 — deterministic weight bias lookup). */
  goal_intent: GoalIntent | null;
  /** True for the locked General default (no override → DEFAULT_PERSONA_WEIGHT_CONFIG). */
  is_general: boolean;
  /** True for the 2 ready-made growth/conversion presets (D-04). */
  is_preset: boolean;
  /**
   * Pre-baked PersonaWeights: goal-intent bias already applied at calibration time (D-05).
   * Stored directly as the four weight fields on the row; surfaced here as a typed object.
   * General audience: default mix { fyp:0.65, niche:0.20, loyalist:0.10, cross_niche:0.05 }.
   */
  persona_weights: PersonaWeights;
  /** 10 calibrated, per-audience archetype presentations (repaint + temp/disposition). */
  personas: CalibratedPersona[];
  /** Aggregate audience profile derived at calibration. */
  profile: AudienceProfile | null;
  /** Calibration metadata (source, handle for personal, scraped_at, thin flag). */
  calibration: {
    source: "scrape" | "description";
    handle?: string;
    scraped_at?: string;
    thin?: boolean;
  } | null;
  created_at: string;
  updated_at: string;
}
