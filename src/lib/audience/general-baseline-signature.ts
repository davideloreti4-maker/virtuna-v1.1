/**
 * GENERAL_BASELINE_SIGNATURE — the honest generic baseline the General audience reacts through.
 *
 * WHY THIS EXISTS
 * ───────────────
 * General (GENERAL_AUDIENCE, audience-repo) carries `personas: []` and no `signature`, so it
 * could not flow the Audience Sim v2 population projection (`signatureHasPopulationAxes` needs a
 * non-empty `topic_vocab` + ≥1 persona with scored `reaction` axes). That left a new, uncalibrated
 * user with a verdict-only sim and no Population room — the owner call (2026-07-23) is that a new
 * user must land on the SAME Population page a calibrated audience shows.
 *
 * This is that missing signature: the 10 fixed archetypes with a SENSIBLE GENERIC baseline (broad
 * cross-cutting interests, archetype-true reaction axes), NOT random numbers. It lets General
 * compute a real O(N) population distribution while staying honest about what it is.
 *
 * HONESTY SPINE (binding)
 * ───────────────────────
 *  - It is a GENERIC baseline, never a measurement of anyone. `creator_persona`, `summary`, every
 *    persona `evidence`, and `provenance` say so in as many words — no fabricated quote, no fake
 *    handle, no invented scrape count. The Population page reads these; they must not lie.
 *  - The axes are archetype-true (a `tough_crowd` demands a strong hook + distrusts hype; a
 *    `loyalist` is already bought in), so the projection is directionally meaningful, not noise.
 *  - It is NOT the moat. General still reads "not calibrated"; calibration replaces this generic
 *    crowd with YOUR real, scrape-derived people. The reason to calibrate is fully intact.
 *
 * INJECTION (surgical, not global)
 * ────────────────────────────────
 * This is attached to General ONLY at the population boundary (the react route) — NOT baked onto
 * the exported `GENERAL_AUDIENCE` constant. Keeping it off the constant means the every-skill-route
 * / reveal / tier / calibration code paths that key on General's null signature are untouched;
 * only the Population projection sees it. See `src/app/api/tools/react/route.ts`.
 */

import type { AudienceSignature, SignaturePersona } from "./audience-types";

/**
 * Canonical generic topic vocabulary — cross-cutting APPEAL REGISTERS (not niche subjects, since a
 * generic crowd has no niche). Content is characterized into these at test-time; each persona's
 * `reaction.interests` references only these tags. Mirrors the registers the profile-bake synth
 * prompt seeds (spectacle/humor/relatable/transformation/satisfying/educational).
 */
export const GENERAL_TOPIC_VOCAB: string[] = [
  "relatable",
  "humor",
  "spectacle",
  "transformation",
  "satisfying",
  "educational",
  "story",
  "novelty",
  "practical",
  "aspirational",
];

/** Honest baseline evidence marker — a generic segment carries no real quote (never fabricate one). */
const BASELINE_EVIDENCE = "Generic baseline segment — not calibrated to your audience.";

/**
 * The 10 baseline reactors. Shares follow General's default weight mix
 * (fyp 0.65 · niche 0.20 · loyalist 0.10 · cross_niche 0.05) distributed to realistic archetype
 * proportions (a silent lurker majority; a demanding tough crowd). Σ shares = 1.00.
 */
const BASELINE_PERSONAS: SignaturePersona[] = [
  {
    archetype: "lurker",
    share: 0.22,
    temperature: "cold",
    disposition: "lurker",
    reaction_frame: "Watches quietly; stays for a clear, easy payoff and drifts on friction.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Quiet Watchers",
    reaction: {
      interests: { relatable: 0.4, story: 0.4, satisfying: 0.4, humor: 0.3 },
      hookSensitivity: 0.4,
      noveltyBias: 0.4,
      skepticism: 0.4,
      attentionSpan: 0.6,
    },
    behavior: { watchThrough: 0.5, sharePropensity: 0.1, commentPropensity: 0.05, savePropensity: 0.2 },
  },
  {
    archetype: "tough_crowd",
    share: 0.14,
    temperature: "cold",
    disposition: "skeptic",
    reaction_frame: "Scrolls past unless the first two seconds land; distrusts big claims.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Tough Crowd",
    reaction: {
      interests: { spectacle: 0.4, humor: 0.3, satisfying: 0.3 },
      hookSensitivity: 0.85,
      noveltyBias: 0.6,
      skepticism: 0.8,
      attentionSpan: 0.2,
    },
    behavior: { watchThrough: 0.2, sharePropensity: 0.1, commentPropensity: 0.1, savePropensity: 0.1 },
  },
  {
    archetype: "high_engager",
    share: 0.1,
    temperature: "warm",
    disposition: "connector",
    reaction_frame: "Reacts fast — likes, comments, tags a friend when it hits.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Commenters",
    reaction: {
      interests: { relatable: 0.6, humor: 0.6, story: 0.5, aspirational: 0.5 },
      hookSensitivity: 0.5,
      noveltyBias: 0.55,
      skepticism: 0.35,
      attentionSpan: 0.4,
    },
    behavior: { watchThrough: 0.55, sharePropensity: 0.5, commentPropensity: 0.7, savePropensity: 0.3 },
  },
  {
    archetype: "saver",
    share: 0.08,
    temperature: "warm",
    disposition: "collector",
    reaction_frame: "Bookmarks anything useful or practical to come back to.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Savers",
    reaction: {
      interests: { educational: 0.7, practical: 0.7, satisfying: 0.4 },
      hookSensitivity: 0.45,
      noveltyBias: 0.35,
      skepticism: 0.45,
      attentionSpan: 0.7,
    },
    behavior: { watchThrough: 0.6, sharePropensity: 0.25, commentPropensity: 0.1, savePropensity: 0.75 },
  },
  {
    archetype: "sharer",
    share: 0.06,
    temperature: "warm",
    disposition: "connector",
    reaction_frame: "DMs the relatable and the funny to friends; social proof matters.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Sharers",
    reaction: {
      interests: { relatable: 0.7, humor: 0.7, spectacle: 0.5, story: 0.5 },
      hookSensitivity: 0.55,
      noveltyBias: 0.5,
      skepticism: 0.3,
      attentionSpan: 0.35,
    },
    behavior: { watchThrough: 0.5, sharePropensity: 0.8, commentPropensity: 0.3, savePropensity: 0.25 },
  },
  {
    archetype: "purposeful_viewer",
    share: 0.05,
    temperature: "warm",
    disposition: "scanner",
    reaction_frame: "Here to learn; skips filler, rewards a clear takeaway.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Purposeful Viewers",
    reaction: {
      interests: { educational: 0.8, practical: 0.6, story: 0.4 },
      hookSensitivity: 0.45,
      noveltyBias: 0.4,
      skepticism: 0.6,
      attentionSpan: 0.8,
    },
    behavior: { watchThrough: 0.7, sharePropensity: 0.2, commentPropensity: 0.15, savePropensity: 0.55 },
  },
  {
    archetype: "niche_deep_buyer",
    share: 0.1,
    temperature: "hot",
    disposition: "converter",
    reaction_frame: "Picky and outcome-driven; weighs whether it actually delivers.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Deep Fans",
    reaction: {
      interests: { practical: 0.7, educational: 0.6, transformation: 0.5, aspirational: 0.5 },
      hookSensitivity: 0.5,
      noveltyBias: 0.35,
      skepticism: 0.7,
      attentionSpan: 0.75,
    },
    behavior: { watchThrough: 0.7, sharePropensity: 0.25, commentPropensity: 0.2, savePropensity: 0.6 },
  },
  {
    archetype: "niche_deep_scout",
    share: 0.1,
    temperature: "warm",
    disposition: "scanner",
    reaction_frame: "Knows the space; rewards a fresh angle, spots a cliché instantly.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Scouts",
    reaction: {
      interests: { novelty: 0.8, educational: 0.5, satisfying: 0.4 },
      hookSensitivity: 0.6,
      noveltyBias: 0.8,
      skepticism: 0.75,
      attentionSpan: 0.6,
    },
    behavior: { watchThrough: 0.55, sharePropensity: 0.3, commentPropensity: 0.25, savePropensity: 0.4 },
  },
  {
    archetype: "loyalist",
    share: 0.1,
    temperature: "hot",
    disposition: "converter",
    reaction_frame: "Already bought in; forgiving of a slow open, roots for the payoff.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Regulars",
    reaction: {
      interests: { story: 0.6, relatable: 0.6, aspirational: 0.5, transformation: 0.5 },
      hookSensitivity: 0.25,
      noveltyBias: 0.4,
      skepticism: 0.25,
      attentionSpan: 0.8,
    },
    behavior: { watchThrough: 0.8, sharePropensity: 0.4, commentPropensity: 0.4, savePropensity: 0.45 },
  },
  {
    archetype: "cross_niche_curiosity",
    share: 0.05,
    temperature: "cold",
    disposition: "scanner",
    reaction_frame: "From an adjacent world; a novel or spectacular angle pulls them in.",
    evidence: BASELINE_EVIDENCE,
    display_name: "Passers-by",
    reaction: {
      interests: { novelty: 0.6, spectacle: 0.5, humor: 0.5, story: 0.5 },
      hookSensitivity: 0.6,
      noveltyBias: 0.7,
      skepticism: 0.5,
      attentionSpan: 0.45,
    },
    behavior: { watchThrough: 0.4, sharePropensity: 0.3, commentPropensity: 0.15, savePropensity: 0.2 },
  },
];

/**
 * The frozen generic baseline signature. Shape-identical to a scrape-baked `AudienceSignature`
 * (profile-bake) so it flows every downstream reader unchanged — but every human-readable field is
 * honest that this is a generic, uncalibrated baseline.
 */
export const GENERAL_BASELINE_SIGNATURE: AudienceSignature = {
  creator_persona: {
    content_description: "A general TikTok audience — not calibrated to your niche.",
    context:
      "The default crowd: a broad mix of casual scrollers, skeptics, learners and sharers, with no niche affinity. Calibrate an audience to replace this baseline with your real people.",
    writing_style_sample: "",
    format_signature: "Short-form vertical video on a fast-scrolling feed.",
  },
  audience: {
    follower_tier: null,
    maturity: "new",
    // Derived from the persona shares above (cold 0.41 · warm 0.39 · hot 0.20).
    temperature_mix: { cold: 0.41, warm: 0.39, hot: 0.2 },
    interest_tags: [...GENERAL_TOPIC_VOCAB],
    what_resonates: "A strong opening, a clear payoff, and something relatable, funny or genuinely useful.",
    what_falls_flat: "A slow start, over-promising hype, or a payoff that never arrives.",
    // Matches GENERAL_AUDIENCE.persona_weights (DEFAULT_PERSONA_WEIGHT_CONFIG).
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: BASELINE_PERSONAS,
    topic_vocab: [...GENERAL_TOPIC_VOCAB],
  },
  summary:
    "A generic baseline crowd — a broad, uncalibrated audience. Calibrate to model YOUR people.",
  provenance: {
    handle: "general-baseline",
    scraped_at: "1970-01-01T00:00:00Z",
    videos_analyzed: 0,
    videos_watched: 0,
    sub_coverage: "0/0",
  },
};
