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
 * - label: creator-editable display name (AUD-EDIT-01 / D-06). Presentation-only —
 *   runners read `archetype` + `repaint` only and NEVER `label`, so it is outside the
 *   regression-gate surface. Falls back to the archetype-derived string when absent
 *   (legacy personas + General have none). Written via the personas JSONB override.
 */
export interface CalibratedPersona {
  archetype: Archetype;
  repaint: string;
  temperature: Temperature;
  disposition: Disposition;
  share: number;
  /**
   * Creator-editable display name (AUD-EDIT-01 / D-06). Presentation-only — the engine
   * never reads it (runners build their repaint map from `[archetype, repaint]` only),
   * so it is outside the regression-gate surface. Absent on legacy personas + General;
   * the display falls back to the archetype-derived string.
   */
  label?: string;
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

// ─── Real AudienceSignature (§P) — scrape-derived, frozen, read everywhere ────

/**
 * Creator persona (§P.6 — Sandcastles' PROVEN 3 fields + 1 video-derived).
 * PER-AUDIENCE (§P.8), auto-derived at calibration from scrape + transcripts +
 * omni-flash watchNotes, fully editable. Drives GENERATION (outputs sound like
 * the creator) — it is NOT a reactor. Stored in the `creator_persona` column.
 */
export interface CreatorPersona {
  /** Niche descriptor, 1 line → STEER (discovery / idea analysis). */
  content_description: string;
  /** Audience · voice · formats · expertise · AVOID list → generation (all skills). */
  context: string;
  /** Verbatim transcript/caption of the top video → generation voice. */
  writing_style_sample: string;
  /** Video format/style synthesised from omni-flash watchNotes (NEW, video-derived). */
  format_signature: string;
}

/**
 * One of the 10 fixed-archetype REACTORS in the signature (§P.6 behavioural 3).
 * No voice/bio — reactors judge content, they don't speak as the creator.
 * `archetype` is the immutable engine slug; engine reads archetype + reaction_frame.
 */
export interface SignaturePersona {
  archetype: Archetype;
  /** Share of the audience (0..1, all 10 sum to 1.0). Data-derived. */
  share: number;
  temperature: Temperature;
  disposition: Disposition;
  /** How THIS audience's segment judges content → folds into the SIM (REACT). */
  reaction_frame: string;
  /** Engagement-ratio proof (e.g. "saves 2.1× category") — the data receipt. */
  evidence: string;
}

/**
 * The engagement-derived audience block of the signature. `temperature_mix` +
 * `persona_weights` are DERIVED from real engagement ratios (kills F1's constant
 * lens). `persona_weights` is also baked into the row's 4 weight cols at calibration.
 */
export interface SignatureAudience {
  follower_tier: string | null;
  maturity: "new" | "growing" | "established";
  /** Data-derived cold/warm/hot mix (sums to 1.0) — fixes F1. */
  temperature_mix: Record<Temperature, number>;
  interest_tags: string[];
  what_resonates: string;
  what_falls_flat: string;
  /** Derived weight mix (Σ=1) — reality first, goal_intent only a lens (P-5). */
  persona_weights: PersonaWeights;
  /** Exactly 10 reactors, fixed archetype slugs, shares Σ=1. */
  personas: SignaturePersona[];
}

/**
 * Provenance of the bake — what was scraped/watched. Reveal + drift-cron read this.
 */
export interface SignatureProvenance {
  handle: string;
  scraped_at: string;
  videos_analyzed: number;
  videos_watched: number;
  /** e.g. "6/8" — native-subtitle coverage from the scrape. */
  sub_coverage: string;
}

/**
 * The frozen AudienceSignature (§P.14) — the real, scrape-derived audience model.
 * Baked ONCE at calibration (temp 0 + seed), stored on the `signature` column, read
 * on every skill run, NEVER re-derived on the hot path (P.7 determinism contract).
 * Present ONLY for calibrated non-general audiences — General/presets keep it null so
 * the regression gate stays free by construction (D-17).
 */
export interface AudienceSignature {
  creator_persona: CreatorPersona;
  audience: SignatureAudience;
  /** Reveal-screen copy. */
  summary: string;
  provenance: SignatureProvenance;
}

// ─── User-added grounding (D-07 — custom_context) ────────────────────────────

/**
 * A user-supplied grounding note (D-07 / D-defer-01). `source: "user"` distinguishes
 * it from scrape-derived persona evidence — user-supplied grounding STRENGTHENS
 * provenance (tagged, visible), never fakes it. Conceptually provenance-level, but
 * stored TOP-LEVEL on `Audience` (NOT in `SignatureProvenance`) so it survives when
 * `signature` is null (General/template audiences carry no signature — RESEARCH Pitfall 2).
 */
export interface CustomContext {
  /** Always "user" — marks this as user-added grounding, not scrape-derived. */
  source: "user";
  /** Free-text grounding note. */
  note: string;
  /** Optional linkage to a persona/archetype slug this note grounds. */
  persona_evidence_link?: string;
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
  /**
   * First-class domain-mode axis (D-04): 'socials' runs the Socials pack (Validated
   * anchor); 'general' is a domain-agnostic SIM (Directional by rule). REQUIRED and
   * first-class — it is NOT derived from `is_general` (which marks only the locked
   * General default constant). POP-02 carries Mode explicitly; P7 sections the library
   * and scopes skills by it.
   */
  mode: "socials" | "general";
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
   * The connected account this audience was calibrated from (nullable FK →
   * connected_accounts). NULL for custom/preset/General audiences. Deleting the
   * source account nulls this (ON DELETE SET NULL) — the audience orphans gracefully,
   * keeping its frozen personas. Absent on virtual constants.
   */
  source_account_id?: string | null;
  /**
   * Pre-baked PersonaWeights: goal-intent bias already applied at calibration time (D-05).
   * Stored directly as the four weight fields on the row; surfaced here as a typed object.
   * General audience: default mix { fyp:0.65, niche:0.20, loyalist:0.10, cross_niche:0.05 }.
   */
  persona_weights: PersonaWeights;
  /** 10 calibrated, per-audience archetype presentations (repaint + temp/disposition). */
  personas: CalibratedPersona[];
  /** Aggregate audience profile derived at calibration (LEGACY — superseded by `signature`). */
  profile: AudienceProfile | null;
  /**
   * PER-AUDIENCE editable creator card (§P.8). Stored in the `creator_persona` column.
   * Null/absent for General/presets/legacy rows. Mirrors `signature.creator_persona` at
   * bake time; the column is the editable source of truth (persona edits write here).
   * Optional so every existing Audience literal stays valid (additive — guardrail).
   */
  creator_persona?: CreatorPersona | null;
  /**
   * The frozen real AudienceSignature (§P). Stored in the `signature` column. Present
   * ONLY for calibrated non-general audiences — null/absent for General/presets/legacy
   * so the regression gate stays free by construction (D-17). Read on every skill run.
   * Optional so every existing Audience literal stays valid (additive — guardrail).
   */
  signature?: AudienceSignature | null;
  /**
   * Editable free-text "what 'good' means for this audience" (D-03 / POP-02 / POP-05).
   * Flows into the `DomainPack.scoring` input contract for the P5/P6 General scorers to
   * consume — no live scorer is wired in P3. Socials keeps its implicit fixed virality
   * fold (the pack's locked scorer), so this stays null for socials rows.
   * Optional so every existing Audience literal stays valid (additive — guardrail).
   */
  success_criterion?: string | null;
  /**
   * User-added grounding notes (D-07 / D-defer-01). Conceptually provenance-level but
   * stored TOP-LEVEL (NOT in `signature.provenance`) so it survives `signature: null`
   * on General/template audiences (RESEARCH Pitfall 2). Rendered distinctly from scraped
   * grounding as "user-added grounding."
   * Optional so every existing Audience literal stays valid (additive — guardrail).
   */
  custom_context?: CustomContext[] | null;
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
