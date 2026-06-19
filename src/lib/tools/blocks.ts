/**
 * Block schemas + TypeScript types for the typed-block renderer system (THREAD-04).
 *
 * Each block is shaped { type: z.literal(...), props: z.object({...}) }.
 * These schemas are the SSOT consumed by:
 *  - block-registry.ts (schema + validation SSOT, server-importable)
 *  - message-blocks.tsx (renderer wiring + re-validate on rehydration, D-14)
 *  - tool-runner.ts (assertBlocksInRegistry at the output boundary)
 *  - message-blocks.tsx (re-validate on rehydration, D-14)
 *
 * Design constraints:
 *  - BandBlock carries NO numeric score (D-02/D-11 honesty spine).
 *  - BandBlock carries a model tag (sim1-flash | sim1-max) for provenance (D-10).
 *  - PersonasBlock shape matches the exact {archetype, verdict, quote} D-03 spec.
 */

import { z } from "zod";

// ─── Markdown block ───────────────────────────────────────────────────────────

export const MarkdownBlockSchema = z.object({
  type: z.literal("markdown"),
  props: z.object({
    text: z.string(),
  }),
});

export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;

// ─── Band block ───────────────────────────────────────────────────────────────
// D-02: band word + audience fraction only — NO 0-100 number (D-11 honesty spine).
// D-10: model tag lives ON the block so provenance survives scroll-away.
// D-10: Flash and Max MUST use distinct band styling (enforced in band-block.tsx).

export const BandBlockSchema = z.object({
  type: z.literal("band"),
  props: z.object({
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string(),                            // e.g. "6/10 stop"
    model: z.enum(["sim1-flash", "sim1-max"]),       // provenance tag (D-10)
  }),
});

export type BandBlock = z.infer<typeof BandBlockSchema>;

// ─── Personas block ───────────────────────────────────────────────────────────
// D-03: each persona returns a stop/scroll verdict + a first-person voice quote.
// This is also the exact data shape custom personas will emit later (v6.1+, D-05).

export const PersonasBlockSchema = z.object({
  type: z.literal("personas"),
  props: z.object({
    personas: z.array(
      z.object({
        archetype: z.string(),
        verdict: z.enum(["stop", "scroll"]),
        quote: z.string().min(1).max(160),
      }),
    ),
  }),
});

export type PersonasBlock = z.infer<typeof PersonasBlockSchema>;

// ─── Idea-card block ──────────────────────────────────────────────────────────
// D-10: schema-validated idea card carrying the concept anatomy + embedded Flash
// band signal. No model-generated UI — the model emits these props only; the
// IdeaCardRenderer component owns layout (THREAD-04).
//
// Face (always visible, D-08):
//   title · angle · whyItFits (grounding line, D-09) · scrollQuote (lead, D-04)
// Expand (tap, D-08):
//   mechanism · seedHook · topic × take × format
// Badge (D-11): needsTake flag
// Secondary chip (D-04): band + fraction + model "sim1-flash"

export const IdeaCardBlockSchema = z.object({
  type: z.literal("idea-card"),
  props: z.object({
    // Concept anatomy (D-08)
    title: z.string(),
    angle: z.string(),
    whyItFits: z.string(),          // grounding line from GROUND-03 extractor (D-09)
    mechanism: z.string(),          // named mechanism behind the concept
    seedHook: z.string(),           // the one-line hook the SIM reacted to (D-01)
    needsTake: z.boolean(),         // D-11: shows "needs your first-hand take" badge when true
    topic: z.string(),              // Topic×Take×Format breakdown
    take: z.string(),
    format: z.string().nullable(),  // nullable — not every idea maps to a specific format
    // Embedded Flash signal (D-04/D-10)
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string(),           // e.g. "6/10 stop"
    scrollQuote: z.string(),        // lead per-persona scroll quote (D-04)
    model: z.literal("sim1-flash"), // provenance tag — always Flash for idea cards
  }),
});

export type IdeaCardBlock = z.infer<typeof IdeaCardBlockSchema>;

// ─── Hook-card block ──────────────────────────────────────────────────────────
// D-11: schema-validated hook card carrying the hook anatomy + embedded Flash
// band signal. No model-generated UI — the model emits these props only; the
// HookCardRenderer component owns layout (THREAD-04).
//
// Face (always visible, D-11):
//   hookLine · audienceArchetype (D-03) · scrollQuote (lead, D-02/D-04) · rank badge
// Expand (tap, D-08):
//   mechanism · seedHook · channel (optional multi-modal hint)
// Secondary chip (D-04): band + fraction + model "sim1-flash"
// CTA (D-05): "Test full →" affordance with onTest seam (wired in Plan 03)
//
// D-04: NO craft-archetype field (BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION).
//   The audienceArchetype field is the AUDIENCE persona tag (D-03), not a craft slug.
//   mechanism is prose reasoning — never a craft slug.
//
// channel: multi-modal hint (spoken/visual/caption/edit/audio) per corpus/hooks.md.
//   nullable — not every hook maps to a specific delivery channel.

export const HookCardBlockSchema = z.object({
  type: z.literal("hook-card"),
  props: z.object({
    // Hook anatomy (D-11)
    hookLine: z.string(),              // the verbatim/executable hook text
    audienceArchetype: z.string(),     // D-03 tag from deriveAudienceArchetype (audience persona, NOT craft)
    mechanism: z.string(),             // named attention mechanism — prose, NEVER a craft slug (D-04)
    seedHook: z.string(),              // the one-line hook the SIM reacted to (may equal hookLine)
    rank: z.number().int().positive(), // #1..N rank position (D-01)
    // Embedded Flash signal (D-02/D-04/D-10)
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string(),              // e.g. "6/10 stop"
    scrollQuote: z.string(),           // lead per-persona scroll quote (D-02/D-04 texture)
    model: z.literal("sim1-flash"),    // provenance tag — always Flash for hook cards
    // Multi-modal hint (corpus/hooks.md) — nullable
    channel: z.string().nullable(),    // e.g. "spoken", "visual", "caption", "edit", "audio"
  }),
});

export type HookCardBlock = z.infer<typeof HookCardBlockSchema>;

// ─── Script-card block ────────────────────────────────────────────────────────
// D-02 card anatomy — beat structure (Hook→Setup→Turn→Payoff→CTA) with per-beat
// timing and retentionMarker (craft reasoning — not a score).
//
// Honesty spine (Pitfall 5 — OPENER ONLY):
//   band/fraction describe the OPENER beat only — NOT the full-watch retention
//   or a global quality score. The openingBeatSeed is the line fed to the Flash
//   hook-beat gate (D-01). Per-beat retentionMarker is craft reasoning explaining
//   WHY that beat holds attention — it is prose, never a numeric score.
//
// Fixed typed renderer — model emits validated props only; ScriptCardRenderer owns
// ALL layout (THREAD-04). ONE script per run (D-02). model literal forces sim1-flash
// provenance (D-10).

export const ScriptCardBlockSchema = z.object({
  type: z.literal("script-card"),
  props: z.object({
    // Beat structure (Hook → Setup → Turn → Payoff → CTA per D-02)
    beats: z.array(
      z.object({
        label: z.string(),             // beat name (e.g. "Hook", "Setup", "Turn", "Payoff", "CTA")
        content: z.string(),           // the actual script content for this beat
        timing: z.string(),            // timing window (e.g. "0–3s", "3–15s")
        retentionMarker: z.string(),   // craft reasoning: WHY this beat holds attention — NOT a score
      }),
    ),
    openingBeatSeed: z.string(),       // the one-line hook fed to the Flash hook-beat gate (D-01)
    // Opener-scoped band signal (Pitfall 5 — OPENER ONLY, not full-watch/general retention)
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string(),              // e.g. "7/10 stop" — opener audience fraction only
    scrollQuote: z.string(),           // lead per-persona scroll quote for the opener (D-04)
    model: z.literal("sim1-flash"),    // provenance tag — always Flash for script cards (D-10)
  }),
});

export type ScriptCardBlock = z.infer<typeof ScriptCardBlockSchema>;

// ─── Remix-card block ─────────────────────────────────────────────────────────
// Maps the decode→adapt anatomy into a typed thread card.
//
// Honesty spine (Pitfall 5 — OPENER ONLY):
//   band/fraction describe the ADAPTED HOOK scroll-stop only — NOT full-video
//   retention or a global quality score of the original video.
//
// sourceDecode carries the REAL structural decode output (D-05, the moat):
//   hookPattern / structure / theTurn / emotionalBeat are the four fixed beats
//   from the Decode engine (decode-types.ts BeatId order: hook_pattern,
//   structure_pacing, the_turn, emotional_beat). These are surfaced in the
//   card's expand section so the creator understands WHY the original worked.
//
// Fixed typed renderer — model emits validated props only; RemixCardRenderer owns
// ALL layout (THREAD-04). model literal forces sim1-flash provenance (D-10).

export const RemixCardBlockSchema = z.object({
  type: z.literal("remix-card"),
  props: z.object({
    // Adapt output — the niche-adapted concept anatomy (AdaptConcept UI mapping D-09)
    adaptedHook: z.string().min(1),    // bold adapted headline (AdaptConcept.hook)
    angle: z.string().min(1),          // structural angle borrowed (muted sub-row)
    whoItsFor: z.string().min(1),      // target audience in niche (muted sub-row)
    formatBorrowed: z.string().min(1), // format pattern chip — prefixed "Borrowed:" in UI

    // Source decode anatomy — the REAL structural decode (D-05 moat, NOT a metadata guess)
    // Shown on expand: WHY the original video worked structurally
    sourceDecode: z.object({
      hookPattern: z.string().min(1),  // hook_pattern beat body
      structure: z.string().min(1),    // structure_pacing beat body
      theTurn: z.string().min(1),      // the_turn beat body
      emotionalBeat: z.string().min(1),// emotional_beat beat body
    }),

    // Opener-scoped band signal (Pitfall 5 — adapted hook scroll-stop ONLY)
    band: z.enum(["Strong", "Mixed", "Weak"]),
    fraction: z.string().min(1),       // e.g. "7/10 stop" — adapted hook audience fraction only
    scrollQuote: z.string().min(1),    // lead per-persona scroll quote for the adapted hook
    model: z.literal("sim1-flash"),    // provenance tag — always Flash for remix cards (D-10)

    // 08-04 / D-03 STEER tag: the active calibrated audience this remix was generated for.
    // Absent/empty = General (no steer) → renderer shows NO tag (regression-safe no-op).
    // Populated only when a non-general audience is active (remix-runner Task 1).
    audienceName: z.string().min(1).optional(),
  }),
});

export type RemixCardBlock = z.infer<typeof RemixCardBlockSchema>;

// ─── Outlier-grid block (Discover) ──────────────────────────────────────────────
// Phase 08 (D-13/D-14). A Discover outlier TILE: the VideoCard metrics grid + a
// MEASURED outlier multiplier carrying its honest baseline label + a source tag.
//
// Honesty spine (Pitfall 5 / D-05 / D-11):
//   This block carries NO band, NO 0-100 score, and NO `model: sim1-flash` field.
//   Discover tiles are MEASURED scrape data (real engagement arithmetic), NOT SIM
//   output. The multiplier is `views / baseline` (computed in outlier-compute.ts).
//   The renderer MUST surface the multiplier WITH its baselineLabel ("vs own" |
//   "vs niche") — NEVER a bare "{n}×" (D-05).
//
// The video reference (videoUrl / platformVideoId / caption) is what the
// "Remix → Read" CTA needs to launch the discover→remix chain (chain-handoff.ts).
// Fixed typed renderer — model/route emits validated props only; OutlierTile owns
// ALL layout (THREAD-04).

export const OutlierGridBlockSchema = z.object({
  type: z.literal("outlier-grid"),
  props: z.object({
    tiles: z.array(
      z.object({
        // Video reference — what Remix needs (videoUrl is the rehost anchor)
        platformVideoId: z.string().min(1),
        videoUrl: z.string().min(1),
        caption: z.string(),
        // VideoCard-derived metrics grid (measured scrape data)
        views: z.number(),
        likes: z.number(),
        comments: z.number(),
        shares: z.number(),
        saves: z.number(),
        durationSeconds: z.number(),
        postedAt: z.string(),                          // ISO string (block props are JSON-serializable)
        // Measured outlier signal (NOT a SIM score — Pitfall 5)
        multiplier: z.number(),                        // views / baseline ("{n}×")
        baselineLabel: z.enum(["vs own", "vs niche"]), // D-05 — renderer NEVER shows a bare multiplier
        // Source tag (D-15): "Your channel" | "Competitor" (profile) | niche label (niche)
        source: z.string().min(1),
      }),
    ),
    mode: z.enum(["profile", "niche"]),
    // NOTE: deliberately NO `model: "sim1-flash"`, NO `band`, NO `score` —
    //       Discover tiles are measured data, not SIM output (Pitfall 5 / D-11).
  }),
});

export type OutlierGridBlock = z.infer<typeof OutlierGridBlockSchema>;

// ─── Multi-audience-read block (the Read — Phase 08, W3/W4) ──────────────────────
// Plan 08-05 (READ-01): the single-audience concept Read landing — the moat payoff.
// Plan 08-06 (D-09): extends the SAME block to the 2-audience compare + verbatim wall.
//
// Honesty spine (Pitfall 5 / D-11): each audience entry carries a qualitative
//   band (Strong/Mixed/Weak) + audience fraction string ONLY — NEVER a numeric
//   0-100 score. The `.strict()` on each entry REJECTS any payload that smuggles a
//   `score` (or any other unknown) field, enforcing the bands-only contract at the
//   validation boundary. Provenance is `model: z.literal("sim1-flash")` (D-10),
//   mirroring BandBlockSchema.
//
// Array shape (D-09): `audiences` is an array — this plan emits exactly 1 entry;
//   Plan 08-06 emits up to 2 (active calibrated audience vs General). The array is
//   W4-ready so the 2-audience compare is additive, not a schema change.
//
// Per audience: name + aggregate band + fraction (from aggregateFlash — do NOT
//   re-roll), the one-line interpretation, the Lever line, the who-not-for segment
//   (from deriveWhoNotFor — D-10), and the per-persona drill (archetype + verdict +
//   quote, the exact PersonasBlock shape reused in the renderer).

export const MultiAudienceReadBlockSchema = z.object({
  type: z.literal("multi-audience-read"),
  props: z.object({
    audiences: z
      .array(
        z
          .object({
            name: z.string().min(1),                      // audience display name
            band: z.enum(["Strong", "Mixed", "Weak"]),    // aggregate band — NO score (Pitfall 5)
            fraction: z.string().min(1),                  // e.g. "8/10 stop"
            interpretation: z.string().min(1),            // the one-line Read interpretation
            lever: z.string().min(1),                     // the "Lever →" line — the one thing to act on
            whoNotFor: z.string(),                        // "Scrolls past" segment (may be "" → no line)
            personas: z.array(
              z.object({
                archetype: z.string(),
                verdict: z.enum(["stop", "scroll"]),
                quote: z.string().min(1).max(160),
              }),
            ),
          })
          .strict(), // forbids `score` or any 0-100 numeric field (bands-only honesty spine)
      )
      .min(1),
    model: z.literal("sim1-flash"),                       // provenance — always Flash (D-10)
  }),
});

export type MultiAudienceReadBlock = z.infer<typeof MultiAudienceReadBlockSchema>;

// ─── Union ────────────────────────────────────────────────────────────────────

export const BlockUnionSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  BandBlockSchema,
  PersonasBlockSchema,
  IdeaCardBlockSchema,
  HookCardBlockSchema,
  ScriptCardBlockSchema,
  RemixCardBlockSchema,
  OutlierGridBlockSchema,
  MultiAudienceReadBlockSchema,
]);

export type BlockUnion = z.infer<typeof BlockUnionSchema>;
