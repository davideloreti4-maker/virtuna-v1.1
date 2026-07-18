/**
 * profile-blocks.ts — the two Phase-5 typed-block schemas (PROF-02 / SIMU-02).
 *
 * Co-located sibling to blocks.ts: blocks.ts is at ~468 lines and the project file-size
 * limit is 500; appending these two rich `.strict()` schemas would breach it. blocks.ts
 * imports both from here and appends them to BlockUnionSchema; block-registry.ts imports
 * them into BLOCK_REGISTRY. No behavior change to existing blocks — purely additive.
 *
 * Honesty spine (D-06 / Pitfall 5): BOTH schemas are bands-only — `.strict()` on `props`
 * rejects any unknown key, INCLUDING a smuggled numeric `score` / `overall_score` / 0-100
 * field. There is NO numeric reaction field anywhere; reactions are band WORDS + a string
 * `fraction` ("8/10 react") that comes from aggregateFlash (never re-rolled).
 *
 * Person vs panel (D-02): a single human has no honest distribution. The reaction-distribution
 * card branches on `subjectKind` — person → a single `read` (verdict/reasoning/quote, NO
 * fraction); panel → band + fraction + clustered themes + per-persona reactions.
 *
 * Provenance (D-10 / TRUST-02): `model: "sim1-flash" | "sim1-max"` is the visible SIM-1 badge
 * (Profile can run the Max/video tier, unlike the always-Flash read block). `tier` is the
 * run-level Directional honesty badge (General → Directional by rule, resolveTier). Every
 * behavioral tell carries a verbatim `evidence` quote as its provenance.
 */

import { z } from "zod";

// ─── profile-read block (PROF-02) ────────────────────────────────────────────
// The forensic behavioral READ — the hero result card. Bands-only; Directional by rule;
// evidence quotes as provenance (TRUST-02). The deeper `forensic` layer rides the Max/video
// tier ONLY (D-03) — null/absent on the Flash/text tier (renderer omits the section, no teaser).

export const ProfileReadBlockSchema = z.object({
  type: z.literal("profile-read"),
  props: z
    .object({
      subjectName: z.string().min(1), // auto-derived; editable via the saved-SIM name
      subjectKind: z.enum(["person", "panel"]), // D-02 detected; default person
      identity: z.object({
        traits: z.array(z.string()).min(1),
        commStyle: z.string(),
        drivers: z.array(z.string()),
      }),
      tells: z
        .array(
          z.object({
            tell: z.string().min(1),
            evidence: z.string().min(1), // verbatim quote from the evidence (TRUST-02)
          }),
        )
        .min(1),
      howTheyReact: z.string().min(1), // goal-scoped (D-03)
      goalScope: z.string(), // the subject.goal / success_criterion this read targets
      forensic: z
        .object({
          deceptionLikelihood: z.enum(["Low", "Medium", "High"]), // band WORD, NEVER a number
          cues: z.array(
            z.object({
              timestamp: z.string(),
              observation: z.string(),
              inference: z.string(),
            }),
          ),
        })
        .nullable()
        .optional(), // D-03: present ONLY on the max/video tier; null/absent on flash/text
      caveat: z.string().min(1), // honesty caveat (D-04) — always rendered
      savedAudienceId: z.string().min(1), // PROF-03/04 — the saved SIM the chain CTA targets
      model: z.enum(["sim1-flash", "sim1-max"]), // SIM-1 badge (P4 tier)
      tier: z.literal("Directional"), // General → Directional by rule (resolveTier)
    })
    .strict(), // forbids any unknown key incl. a smuggled `score` / 0-100 (bands-only spine)
});

export type ProfileReadBlock = z.infer<typeof ProfileReadBlockSchema>;

// ─── reaction-distribution block (SIMU-02) ───────────────────────────────────
// 1 audience + stimulus → the reaction result card. Bands-only; person → a single read,
// panel → spread + clustered themes (D-02/D-06). NO numeric 0-100 anywhere — `.strict()`
// rejects a smuggled `score`; the band math comes from aggregateFlash (do NOT re-roll).

export const ReactionDistributionBlockSchema = z.object({
  type: z.literal("reaction-distribution"),
  props: z
    .object({
      audienceName: z.string().min(1),
      // PRED-01 (A3): the panel SIM the user just simulated, carried so the "Predict an
      // outcome →" chain CTA can POST it to /api/tools/predict. Additive + optional →
      // `.strict()`-safe (no smuggled aggregate; back-compat with pre-06-07 blocks).
      audienceId: z.string().optional(),
      subjectKind: z.enum(["person", "panel"]),
      // person path — a single read; NO fraction (a single human has no honest distribution)
      read: z
        .object({
          verdict: z.string().min(1), // e.g. "receptive" / "on the fence" / "resistant"
          reasoning: z.string().min(1),
          quote: z.string().min(1).max(160),
        })
        .nullable()
        .optional(),
      // panel path — distribution + clustered themes + representative quotes
      band: z.enum(["Strong", "Mixed", "Weak"]).nullable().optional(),
      fraction: z.string().nullable().optional(), // "7/10 react" — from aggregateFlash, never re-rolled
      /**
       * The stimulus the room actually reacted to, carried so the card can open the
       * AudienceLens ("See the room →" / "Ask them why →") GROUNDED on the real concept.
       * Additive + optional → `.strict()`-safe and back-compat with pre-2026-07-14 blocks.
       *
       * Set ONLY when the stimulus is text-bearing (`text` / `file_text`). An image or video
       * stimulus has no honest concept string — `Stimulus.content` there is a storage key or a
       * base64 blob, and passing THAT as the concept would ground "Ask them why" on a filename.
       * Absent ⇒ the card renders its band row without the Lens door, which is the honest
       * degrade: no door beats a door onto nothing.
       */
      stimulus: z.string().min(1).max(500).optional(),
      themes: z
        .array(z.object({ label: z.string(), quote: z.string().min(1).max(160) }))
        .optional(),
      reactions: z
        .array(
          z.object({
            archetype: z.string(),
            verdict: z.enum(["stop", "scroll"]),
            quote: z.string().min(1).max(160),
          }),
        )
        .optional(),
      model: z.enum(["sim1-flash", "sim1-max"]),
      tier: z.literal("Directional"),
    })
    .strict(), // forbids any unknown key incl. a smuggled `score` / 0-100 (bands-only spine)
});

export type ReactionDistributionBlock = z.infer<typeof ReactionDistributionBlockSchema>;

// ─── prediction-gauge block (PRED-02 / PRED-03) ──────────────────────────────
// The honest forecast result card (06-04). Bands/words only; the panel-derived
// `range` is the SINGLE numeric — `.strict()` rejects any smuggled point-score /
// `score` / 0-100 / extra field (D-01 / T-06-08). Every factor names its analyst
// (D-04); the caveat is always present (D-04 / F-04); `model`/`tier` are literals
// (Predict is always Flash, always Directional). The schema ALLOWS `min === max`
// (a unanimous panel) — the renderer enforces the feather (F-01), not the schema.

export const PredictionGaugeBlockSchema = z.object({
  type: z.literal("prediction-gauge"),
  props: z
    .object({
      audienceName: z.string().min(1), // the panel name (header)
      scenario: z.string().min(1), // "On: {scenario}" lead (clamped in UI)
      band: z.enum(["Likely", "Lean yes", "Lean no", "Toss-up", "Unlikely"]), // gauge hero WORD
      range: z.object({
        min: z.number().int().min(0).max(100),
        max: z.number().int().min(0).max(100),
      }), // the ONLY numeric (panel-derived); min === max allowed (renderer feathers it)
      confidence: z.enum(["High", "Medium", "Low"]), // tightness (D-05) — a WORD
      factors: z
        .array(
          z.object({
            analystArchetype: z.string().min(1), // every factor names its analyst (D-04 / F-05)
            driver: z.string().min(1),
            direction: z.enum(["for", "against"]),
          }),
        )
        .min(1),
      panel: z
        .array(
          z.object({
            archetype: z.string().min(1),
            lean: z.enum(["strongly_no", "lean_no", "toss_up", "lean_yes", "strongly_yes"]), // WORD in UI
            reasoning: z.string().min(1),
          }),
        )
        .min(1), // composition drill (who reasoned) — D-04
      assumptions: z.array(z.string()).default([]), // scenario premises (D-04)
      successCriterion: z.string().nullable(), // "Judged against: {…}" lens line (D-04)
      caveat: z.string().min(1), // always-on Directional caveat (D-04 / F-04)
      model: z.literal("sim1-flash"), // Predict is always Flash
      tier: z.literal("Directional"), // never Validated for General
    })
    .strict(), // ← rejects a smuggled point-score / 0-100 / extra field (PRED-03 / D-01)
});

export type PredictionGaugeBlock = z.infer<typeof PredictionGaugeBlockSchema>;

// ─── video-test-card block (the /test in-thread result — TEST-01) ─────────────
// The 1:1 in-thread representation of a real-video Test: the full frame-by-frame
// /api/analyze Max pipeline runs underneath (untouched), and its result is mapped
// onto THIS card so the Test lands in the thread like every other skill — no
// navigate-out (mirrors how Remix, the other heavy video skill, lands a card).
//
// Honesty spine (Pitfall 5 / D-11 / D-10):
//   - NO numeric 0-100 score anywhere — `.strict()` rejects a smuggled `overall_score`
//     / `score`. `verdict` is the WORD label (HeroBlock.verdict_line: "High potential"
//     / "Solid contender" / "Needs work" / "Don't post yet") — never the number the
//     /analyze page shows. The precision lives one door away (`analysisId`), not on the card.
//   - `model: z.literal("sim1-max")` is the honest provenance: a real video ran the Max
//     video pipeline, NOT the Flash text tier. This is exactly why the multi-audience-read
//     card (hardcoded sim1-flash) could NOT be reused for /test — it would misstate the tier.
//   - `band`/`fraction` are the audience-reaction slice, DERIVED from the real
//     persona_simulation_results (per-persona verdict from scroll_past_second; the SAME
//     STRONG/MIXED thresholds as the flash cards) — never re-rolled, never fabricated.
//   - `theOneFix`/`ceiling` are nullable: Apollo can be down, and we show only what ran.
//
// `analysisId` powers the ONE door out — "See the full breakdown →" to /analyze/[id] —
// for the filmstrips / per-frame perception / verbatim wall / Apollo depth a card can't
// hold. Optional drill, never the primary path (the card IS the thread representation).
export const VideoTestCardBlockSchema = z.object({
  type: z.literal("video-test-card"),
  props: z
    .object({
      // The Test verdict — a WORD (HeroBlock.verdict_line), NEVER the 0-100 score.
      verdict: z.string().min(1),
      goNoGo: z.enum(["go", "no-go"]), // HeroBlock.go_no_go (anti_virality gate)
      // Audience reaction — band + fraction DERIVED from the real per-persona video sim.
      audienceName: z.string().min(1),
      band: z.enum(["Strong", "Mixed", "Weak"]),
      fraction: z.string().min(1), // e.g. "6/10 stopped" — from persona_simulation_results
      // The single highest-leverage rewrite (HeroBlock.the_one_fix) — null when Apollo down.
      theOneFix: z.string().nullable(),
      // Apollo §4 ceiling rationale (shown on expand) — null when Apollo down.
      ceiling: z.string().nullable(),
      // Per-persona reactions from the video sim (mapped) — the drill. quote is the
      // persona's own reasoning (source caps at 500), truncated for display by the mapper.
      reactions: z
        .array(
          z.object({
            archetype: z.string(),
            verdict: z.enum(["stop", "scroll"]),
            quote: z.string().min(1).max(500),
          }),
        )
        .default([]),
      // Optimal posting window label (e.g. "Tue 18:00–21:00 UTC") — optional/nullable.
      postWindow: z.string().nullable().optional(),
      // The video's own verbatim hook (spoken words / on-screen text) — the honest concept the
      // room reacted to, so the shared ProofUnit's "See the room → · Ask them why" grounds on
      // what the clip actually said, not a filename. Optional: a silent/no-speech clip omits it
      // and the room still opens on the reactions, just without a text anchor for the chat.
      conceptText: z.string().optional(),
      // The analysis id — powers the "See the full breakdown →" door to /analyze/[id].
      analysisId: z.string().min(1),
      model: z.literal("sim1-max"), // provenance — the Max VIDEO tier (D-10)
      tier: z.enum(["Validated", "Directional"]),
    })
    .strict(), // forbids a smuggled `overall_score` / `score` / any 0-100 (bands-only spine)
});

export type VideoTestCardBlock = z.infer<typeof VideoTestCardBlockSchema>;
