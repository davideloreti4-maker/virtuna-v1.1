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
