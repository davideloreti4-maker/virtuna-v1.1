/**
 * Block schemas + TypeScript types for the typed-block renderer system (THREAD-04).
 *
 * Each block is shaped { type: z.literal(...), props: z.object({...}) }.
 * These schemas are the SSOT consumed by:
 *  - block-registry.ts (schema + validation SSOT, server-importable)
 *  - message-blocks.tsx (renderer wiring + re-validate on rehydration, D-14)
 *  - the generative runners (per-block safeParse at the build boundary, e.g. HookCardBlockSchema)
 *
 * Design constraints:
 *  - BandBlock carries NO numeric score (D-02/D-11 honesty spine).
 *  - BandBlock carries a model tag (sim1-flash | sim1-max) for provenance (D-10).
 *  - PersonasBlock shape matches the exact {archetype, verdict, quote} D-03 spec.
 */

import { z } from "zod";
import {
  ProfileReadBlockSchema,
  ReactionDistributionBlockSchema,
  PredictionGaugeBlockSchema,
} from "./profile-blocks";

// Re-export the sibling-module schemas + types so existing `@/lib/tools/blocks` import
// sites keep working (the schemas live in profile-blocks.ts to keep this file under the
// 500-line project limit). Additive, no behavior change.
export {
  ProfileReadBlockSchema,
  ReactionDistributionBlockSchema,
  PredictionGaugeBlockSchema,
} from "./profile-blocks";
export type {
  ProfileReadBlock,
  ReactionDistributionBlock,
  PredictionGaugeBlock,
} from "./profile-blocks";

// ─── Markdown block ───────────────────────────────────────────────────────────

export const MarkdownBlockSchema = z.object({
  type: z.literal("markdown"),
  props: z.object({
    text: z.string(),
    // Provenance marker. Set to "chat-agent" ONLY by the chat route's CHAT_AGENT_DISPATCH branch
    // (server-side, flag-on) so a reloaded thread can tell it was produced by chat-as-agent and
    // render as ONE ordered stream in the chat view. Optional + non-strict-safe: absent on every
    // existing block and every flag-off write, so rehydration of old threads is byte-identical.
    origin: z.string().optional(),
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

// Shared reaction-persona shape (D-03) — the exact {archetype, verdict, quote} a SIM
// emits. Reused by PersonasBlock AND the per-card optional `personas` field (S3′) so a
// generated card carries its own 10-persona reaction → the ambient modal reads it with
// NO extra /api/tools/react call (modal wiring lands in PR-2, UI lane).
export const ReactionPersonaSchema = z.object({
  archetype: z.string(),
  verdict: z.enum(["stop", "scroll"]),
  quote: z.string().min(1).max(160),
});

export type ReactionPersona = z.infer<typeof ReactionPersonaSchema>;

export const PersonasBlockSchema = z.object({
  type: z.literal("personas"),
  props: z.object({
    personas: z.array(ReactionPersonaSchema),
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

// ─── Proof receipt (grounding — §11f receipts-on-cards, shared by hook/idea/script) ─────
// The durable, honest receipt for the real outlier video whose proven STRUCTURE a grounded
// output adapted. Mirrors grounding's RetrievedExample (lib/grounding/types.ts); the card
// renders "@handle · N× <basis> · views ↗". Numbers are nullable — we show only what we
// truly have (a caption-tier extraction may lack a durable multiplier), never a fabricated
// stat. fitLabel is the honest §11c per-request match (● in-audience / ◐ adjacent /
// ○ structural). handle is required — no receipt without a real, nameable source.
// (Named HookProofSchema for back-compat: hooks shipped it first; ideas/script reuse it.)
export const HookProofSchema = z.object({
  handle: z.string(),                                          // @creator of the proof video
  videoUrl: z.string().nullable(),                            // link to the proof (absent on some search-mode rows)
  coverUrl: z.string().nullable(),                            // ephemeral TikTok-CDN thumbnail (display-only; may expire → renderer hides on error)
  hookTemplate: z.string().nullable(),                       // the source hook as a [bracketed] fill-in-the-blank (Sandcastles-style proof line)
  archetype: z.string().nullable(),                          // source hook archetype slug (e.g. "secret-reveal-breakdown") → pill
  multiplier: z.number().nullable(),                          // durable outlier basis (views ÷ followers, finding #2)
  views: z.number().nullable(),
  baselineLabel: z.string().nullable(),                      // honest basis, e.g. "vs followers"
  /**
   * The §11c per-request audience match — NULLABLE (2026-07-13). A fit label is a claim that
   * a source was retrieved and scored against your audience, which is true of grounded
   * hook/idea/script sources and NOT of a Remix source: you pasted that video yourself, so
   * nothing measured its fit. Grounded runners still always set it; remix passes null and the
   * renderer then omits the glyph rather than asserting a match nobody computed.
   */
  fitLabel: z.enum(["in-audience", "adjacent", "structural"]).nullable(),
});
export type HookProof = z.infer<typeof HookProofSchema>;

/**
 * Client-side coercion for a `proof` prop arriving over the SSE content event (§11f).
 * safeParse (not trust-the-wire): a malformed/absent receipt → undefined, so the streaming
 * card renders exactly like an ungrounded one instead of crashing the reveal. Shared by the
 * hooks/ideas/script stream hooks (use-*-stream.ts).
 */
export function parseProofProp(value: unknown): HookProof | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = HookProofSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * `grounded` — did THIS RUN have retrieved sources at all? (2026-07-14)
 *
 * Distinct from `proof`, which answers "did the model attribute THIS CARD to one of them".
 * The two together are what let the renderer tell apart two absences that look identical on
 * the wire but mean opposite things:
 *
 *   grounded: false, no proof → retrieval found nothing (or is off). Nothing to say. Render clean.
 *   grounded: true,  no proof → we HAD real sources and the model still wrote this one from
 *                               scratch. That is a fact about the output, so the card states it
 *                               (<NoSourceNote>) instead of leaving a receipt-shaped hole next to
 *                               a sibling that has one. A half-attributed grid read as broken.
 *
 * OPTIONAL for back-compat: absent on persisted/pre-2026-07-14 blocks → falsy → the old
 * render (silent omission) is preserved exactly. Never infer it from `proof` — a run where
 * NO card attributed a source is still a grounded run, and that is precisely the case the
 * note exists to explain.
 */
export function parseGroundedProp(value: unknown): boolean {
  return value === true;
}

// ─── Card target (per-persona generation) ─────────────────────────────────────
//
// WHO this card was written for, and whether that person then bit. Shared by every skill that
// writes for someone (hooks #299; ideas/script fan-out) — the binding rule is identical, so the
// shape is one type rather than three that drift.
//
// The audience was MEASURED not to steer generation as prompt CONTEXT (handoff §4c: 20 runs,
// embeddings p=0.43, a blind judge told exactly who the audience is scored 45% — chance). The data
// reached the writer and the writer ignored it. So the audience is made explicit in the OUTPUT
// instead: each card is assigned one named reader, and the model must say which.
//
// `verdict`/`quote` are that reader's OWN reaction from the SIM panel — the receipt that the
// aim actually landed. Both nullable: the target archetype may not appear in the run's panel,
// and we never fabricate a reaction (honesty spine — same rule as the band).
//
// `label` is display-only. It NEVER reaches the model (F7); `archetype` is the binding key and
// `repaint` is what the writer is given. Snapshotting the label here is deliberate — it records
// what the persona was CALLED when the card was written, so a later rename cannot silently
// rewrite history (the same reasoning that put `audienceId` on the Read block — never key on a
// user-editable display string).
// NOTE the name: `PersonaTarget` (select-persona-targets.ts) is the SELECTION-side shape — it carries
// the `repaint`, which is prompt input and must never be persisted onto a card or shipped to the
// client. This is the CARD-side shape: display + receipt, no prompt text. Keeping them distinct
// types is what stops the repaint leaking into a block by an innocent-looking spread.
export const CardTargetSchema = z.object({
  archetype: z.string(),                       // binding key — one of the fixed 10. THE NAME IS DERIVED FROM THIS.
  /**
   * The CREATOR'S OWN name for this persona — present ONLY when they set one. Display only; it
   * never reached the model (F7).
   *
   * ⚠️ OPTIONAL ON PURPOSE. When absent the renderer derives the name from `archetype` via
   * `archetypeDisplayName`. The split is deliberate: a creator's name is HISTORY and is snapshotted
   * (a later rename must not rewrite what a card said when it was written), while OUR name for an
   * archetype is just our current vocabulary and is resolved at RENDER — so improving it improves
   * every card ever generated instead of leaving old ones reading "NICHE DEEP BUYER" forever.
   */
  label: z.string().optional(),
  share: z.number(),                           // 0..1 share of the audience
  verdict: z.enum(["stop", "scroll"]).nullable(), // did the person we AIMED at bite?
  quote: z.string().nullable(),                // that person's own words — never invented
});

export type CardTarget = z.infer<typeof CardTargetSchema>;

/**
 * `target` at the wire boundary — safeParse, not trust-the-wire (mirrors parseProofProp).
 *
 * A malformed target → undefined → the card renders with no target line, exactly like an
 * uncalibrated one. The honesty spine again: a card must never name a reader off a payload we
 * could not actually validate.
 */
export function parseTargetProp(value: unknown): CardTarget | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = CardTargetSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

// ─── Population aggregate (Audience Sim v2, Stage 2) ────────────────────────────
// The wire mirror of `PopulationAggregate` (src/lib/audience/population.ts) — the REAL
// O(N) score of ~1,000 individuals sampled off the signature's 10 segments (NOT the 10's
// rollup at higher resolution). Carried on a card so the AudienceLens Population·1,000 Sheet
// renders the genuine distribution the type-to-room path already shows. The interface fields
// are mirrored exactly so `z.infer` is structurally assignable to `PopulationAggregate`.
// OPTIONAL on the block → General / legacy / uncharacterized runs omit it byte-identically.
// Declared before the card schemas because idea/hook/script/remix cards all reference it.
export const PopulationSegmentSchema = z.object({
  archetype: z.string(),   // engine slug — keys the swarm nodes + the legacy breakdown
  displayName: z.string(), // creator label (display_name) falling back to the archetype label
  share: z.number(),       // 0..1 share of the audience
  total: z.number(),       // individuals sampled into this segment
  stop: z.number(),        // how many stopped
  stopPct: z.number(),     // stop / total × 100
});

export const PopulationAggregateSchema = z.object({
  total: z.number(),
  stop: z.number(),
  scroll: z.number(),
  stopPct: z.number(),
  segments: z.array(PopulationSegmentSchema),
  reasons: z.array(z.object({ reason: z.string(), count: z.number() })),
});

export type PopulationAggregateBlock = z.infer<typeof PopulationAggregateSchema>;

/**
 * `population` at the wire boundary — safeParse, not trust-the-wire (mirrors parseTargetProp).
 * A malformed aggregate → undefined → the Sheet falls back to the honest-lean rollup swarm,
 * never a broken distribution (the honesty spine: no fabricated crowd off an unvalidated payload).
 */
export function parsePopulationProp(value: unknown): PopulationAggregateBlock | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = PopulationAggregateSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

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
    // A4 (premium-thread): true once the `score` event has patched band/fraction. OPTIONAL +
    // back-compat — absent on persisted/pre-A4 blocks → the renderer treats it as already-scored.
    scored: z.boolean().optional(),
    // predictedFailureMode: retained nullable field. Originally the rubric-critic's
    // "if this flops, here's why" texture (Plan 14-02); the critic was removed in S5
    // (was OFF / ~100% fail), so this is always null today. Kept OPTIONAL/nullable so
    // existing persisted blocks + rehydration stay valid (no migration).
    predictedFailureMode: z.string().nullable().optional(),
    // S3′: the card's own 10-persona reaction (generate-rate-rank — keep-all). OPTIONAL so
    // pre-S3′ persisted blocks + rehydration stay valid. The ambient modal reads this (PR-2)
    // instead of re-calling /api/tools/react for a generated card.
    personas: z.array(ReactionPersonaSchema).optional(),
    // GROUNDING (§11f fan-out): the frozen receipt for the real outlier whose proven STRUCTURE
    // this idea adapted. Present ONLY when grounded generation was ON AND the model attributed
    // this idea to a real source (sourceIndex ≥ 1) carrying a handle. OPTIONAL + nullable →
    // ungrounded/unattributed ideas omit it entirely (byte-identical pre-grounding shape).
    proof: HookProofSchema.nullable().optional(),
    // Did the RUN have sources, even if THIS card cited none? See parseGroundedProp. Ideas
    // fan out, so this is the card type where a half-attributed grid was visible.
    grounded: z.boolean().optional(),
    // PER-PERSONA GENERATION (fan-out from hooks #299): the named reader this idea was WRITTEN
    // FOR, and how that exact person then reacted in the SIM. Same contract and the same honesty
    // rule as the hook card — present ONLY on a calibrated run where the model echoed back a
    // target we actually assigned; a writer that ignored its brief loses the LINE rather than
    // getting a generic idea mislabelled with someone's name. OPTIONAL → General and every
    // persisted pre-target card stay byte-identical (regression gate).
    target: CardTargetSchema.optional(),
    // AUDIENCE SIM v2 (Stage 2): the honest N-individual population projection for this idea —
    // a REAL O(N) score of ~1,000 sampled individuals (per-segment stop split), computed by the
    // runner when the active signature carries the v2 axes. Feeds the AudienceLens Population·1,000
    // Sheet. OPTIONAL → General / legacy / uncharacterized runs omit it (byte-identical shape).
    population: PopulationAggregateSchema.optional(),
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
    // A4 (premium-thread): true once the `score` event has patched band/fraction. OPTIONAL +
    // back-compat — absent on persisted/pre-A4 blocks → the renderer treats it as already-scored.
    scored: z.boolean().optional(),
    // Multi-modal hint (corpus/hooks.md) — nullable
    channel: z.string().nullable(),    // e.g. "spoken", "visual", "caption", "edit", "audio"
    // predictedFailureMode: retained nullable field. Originally the rubric-critic's
    // "if this flops, here's why" texture (Plan 14-02); the critic was removed in S5
    // (was OFF / ~100% fail), so this is always null today. Kept OPTIONAL/nullable so
    // existing persisted blocks + rehydration stay valid (no migration).
    predictedFailureMode: z.string().nullable().optional(),
    // S3′: the card's own 10-persona reaction (generate-rate-rank — keep-all). OPTIONAL so
    // pre-S3′ persisted blocks + rehydration stay valid. The ambient modal reads this (PR-2)
    // instead of re-calling /api/tools/react for a generated card.
    personas: z.array(ReactionPersonaSchema).optional(),
    // GROUNDING (§11f receipts-on-cards): the frozen receipt for the real outlier whose
    // proven STRUCTURE this hook adapted. Present ONLY when grounded generation was ON AND
    // the model attributed this hook to a real source (sourceIndex ≥ 1) carrying a handle.
    // OPTIONAL + nullable → ungrounded/unattributed hooks omit it entirely (byte-identical
    // to the pre-grounding shape → regression gate) and the honesty spine holds: no receipt
    // without a real, above-baseline source.
    proof: HookProofSchema.nullable().optional(),
    // Did the RUN have sources, even if THIS card cited none? See parseGroundedProp. Hooks
    // fan out like ideas, so the same half-attributed grid is reachable here.
    grounded: z.boolean().optional(),
    // PER-PERSONA GENERATION: the named reader this hook was WRITTEN FOR, and how that exact
    // person then reacted to it in the SIM. Present ONLY on a calibrated run where the model
    // echoed back a target we actually assigned (see hooks-runner) — a run whose writer ignored
    // the assignment loses the line rather than mislabelling the hook. OPTIONAL → General and
    // every persisted pre-target card stay byte-identical (regression gate).
    target: CardTargetSchema.optional(),
    // AUDIENCE SIM v2 (Stage 2): the honest N-individual population projection for this hook —
    // a REAL O(N) score of ~1,000 sampled individuals (per-segment stop split), computed by the
    // runner when the active signature carries the v2 axes. Feeds the AudienceLens Population·1,000
    // Sheet. OPTIONAL → General / legacy / uncharacterized runs omit it (byte-identical shape).
    population: PopulationAggregateSchema.optional(),
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
    // S3′: the opener's 10-persona reaction. OPTIONAL (back-compat). Ambient modal reads it (PR-2).
    personas: z.array(ReactionPersonaSchema).optional(),
    // GROUNDING (§11f fan-out): the frozen receipt for the real outlier whose proven STRUCTURE
    // this script adapted (one script → at most one receipt). Present ONLY when grounded
    // generation was ON AND the model attributed the script to a real source (sourceIndex ≥ 1)
    // carrying a handle. OPTIONAL + nullable → ungrounded scripts omit it (byte-identical shape).
    proof: HookProofSchema.nullable().optional(),
    // Did the RUN have sources, even if the script cited none? See parseGroundedProp. A script
    // has no sibling to look half-rendered against (one per run), but the statement is the same
    // fact and the receipt primitive is shared — so it says it too, rather than drifting.
    grounded: z.boolean().optional(),
    // PER-PERSONA GENERATION (fan-out from hooks #299): the named reader this script was WRITTEN
    // FOR — normally inherited from the hook the creator picked, so the script develops that hook
    // for the same person. `verdict`/`quote` are that person's reaction to the OPENER only (D-01),
    // which is the only thing the SIM ever scores — the card must never read as a full-watch
    // promise. OPTIONAL → General and every persisted pre-target card stay byte-identical.
    target: CardTargetSchema.optional(),
    // AUDIENCE SIM v2 (Stage 2): the honest N-individual population projection for this script's
    // OPENER (scored opener-as-hook, D-01), computed by the runner when the active signature
    // carries the v2 axes. Feeds the AudienceLens Population·1,000 Sheet. OPTIONAL → General /
    // legacy / uncharacterized runs omit it (byte-identical shape).
    population: PopulationAggregateSchema.optional(),
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
    // Source video cover thumbnail (resolveVideoUrl → resolveAndRehost surfaces it) — an
    // ephemeral CDN image, display-only. OPTIONAL/additive (back-compat): absent → the card
    // renders with no source thumbnail. SUPERSEDED for display by `proof` below, which carries
    // the same cover plus the attribution; kept for back-compat with already-stored blocks.
    coverUrl: z.string().optional(),

    /**
     * The source post, attributed (2026-07-13). Remix is the most source-derived skill we
     * ship — it adapts ONE specific real video — yet it used to render that video as an
     * anonymous thumbnail: no creator, no reach, no way back to the original. It now carries
     * the same receipt shape as the grounded cards.
     *
     * Honest by construction: only `handle`, `views`, `coverUrl` and `videoUrl` are ever
     * populated here. `multiplier`/`baselineLabel` stay null (a remix source has no follower
     * baseline, so it has no measured outlier basis) and `fitLabel` stays null (you chose this
     * video; nothing scored it against your audience). The receipt renders exactly the facts
     * we hold. Absent when the actor gave us no author to name.
     */
    proof: HookProofSchema.nullable().optional(),

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
    // S3′: the adapted hook's 10-persona reaction. OPTIONAL (back-compat). Modal reads it (PR-2).
    personas: z.array(ReactionPersonaSchema).optional(),
    // AUDIENCE SIM v2 (Stage 2): the honest N-individual population projection for the adapted
    // hook (opener-scoped, Pitfall 5), computed by the runner when the active signature carries
    // the v2 axes. Feeds the AudienceLens Population·1,000 Sheet. OPTIONAL → General / legacy /
    // uncharacterized runs omit it (byte-identical shape).
    population: PopulationAggregateSchema.optional(),
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
        // Cover thumbnail (clockworks videoMeta.coverUrl) — ephemeral CDN image, display-only.
        // OPTIONAL/additive: existing persisted outlier-grid blocks stay valid; absent → the
        // tile renders exactly as before (no cover banner).
        coverUrl: z.string().optional(),
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
        // ── Phase 11 Explore extension (EXPLORE-03/05) ──────────────────────────
        // The audience-relative fit ESTIMATE (EXPLORE-03 / D-01). Level WORD only —
        // NO number, NO band, NO quote, NO model tag (D-02 honesty: re-ranked math
        // from rankWithAudienceFit, NOT SIM output). `null` = no calibrated audience
        // signal → renderer omits the bar entirely (degrade, D-02). OPTIONAL →
        // existing persisted outlier-grid blocks stay valid (no migration, mirrors
        // predictedFailureMode).
        fit: z.object({ level: z.enum(["Strong", "Fair", "Weak"]) }).nullable().optional(),
        // Whether this tile offers the "+ Track account" affordance (EXPLORE-05 / D-08).
        // OPTIONAL → existing Discover-view blocks default to no track button.
        trackable: z.boolean().optional(),
        // The @handle the track button writes (no '@', lowercased), present only when
        // trackable. Profile-mode pulls only — niche-mode video items carry no author
        // handle (RESEARCH Q3).
        trackHandle: z.string().optional(),
      }),
    ),
    mode: z.enum(["profile", "niche"]),
    // NOTE: deliberately NO `model: "sim1-flash"`, NO `band`, NO `score` for the
    //       MEASURED tile — Discover tiles are measured data, not SIM output
    //       (Pitfall 5 / D-11). The Phase 11 `fit` field above is an explicit
    //       audience-fit ESTIMATE (re-ranked math), not a SIM verdict.
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
            // ROLLUP-01 — the ATTRIBUTION key. `name` is a user-editable display string, so
            // rolling a persisted Read up to /audience/[id] by name would re-attribute (or
            // silently drop) every Read the moment an audience is renamed — and would attach
            // one audience's history to a DIFFERENT audience later recreated under the same
            // name. The id is the only stable handle. "general" is the GENERAL_AUDIENCE
            // sentinel (audience-repo.ts:40), so the General side of a compare is attributable
            // too. OPTIONAL because it is purely additive: the 7 blocks already persisted omit
            // it, and `.strict()` re-validates on EVERY rehydration (loadMessages) — a required
            // field here would turn every one of them into an `__unsupported__` placeholder in
            // the thread UI. Un-attributed legacy blocks are EXCLUDED from the rollup, never
            // guessed at by name.
            audienceId: z.string().min(1).optional(),
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
    // TRUST-01 run-level honesty badge (P3 03-07). Presentation-only, derived UPSTREAM
    // from the ACTIVE audience's `resolveTier(...)` — it carries NO score and is purely
    // additive (older persisted payloads omit it → renderer falls back to "Directional",
    // never silently "Validated"). TOP-LEVEL on `props`, NOT inside the per-audience
    // `.strict()` entry: that entry forbids unknown keys (would reject this), and the
    // tier is RUN-level, not per-audience. Does NOT touch the bands-only honesty spine.
    tier: z.enum(["Validated", "Directional"]).optional(),
    // ROLLUP-01 — WHAT was read. The Read route persists ONLY this assistant block; unlike
    // /api/tools/chat it never writes a user turn, so before this field the concept text
    // survived NOWHERE — not in the block, not in the thread. A divergence panel reports
    // "the two verdicts per concept", which is unreadable without the concept.
    //
    // RUN-level (one concept per Read), so it sits beside `model`/`tier` and NOT inside the
    // `.strict()` per-audience entry, which forbids unknown keys. Capped at the route's own
    // MAX_CONCEPT_LENGTH so a payload the route accepts can never fail its own write
    // boundary. Optional + additive: the already-persisted blocks omit it.
    concept: z.string().min(1).max(2000).optional(),
    // P3 orphaned-pin honesty: the thread's pinned audience no longer resolved (deleted /
    // disconnected), so this Read scored General instead — and says so. The route sets it;
    // the renderer maps it to one quiet line ("Audience removed · scoring against General.").
    // A typed literal, not free text: the fact lives here, the copy lives in the renderer.
    // RUN-level + optional + additive: persisted blocks omit it, and a transient load error
    // NEVER sets it (that would claim "removed" about an audience that still exists).
    fallback: z.literal("audience-removed").optional(),
  }),
});

export type MultiAudienceReadBlock = z.infer<typeof MultiAudienceReadBlockSchema>;

// ─── Persona-chat-turn block (P9 / LIVE-03, D-03) ────────────────────────────────
// The "Ask them why →" chat-with-persona sub-thread (Plan 09-03). One turn per row.
//
// NO MIGRATION REQUIRED: these persist as ordinary `messages` rows (body = typed-block
// JSONB array) in the EXISTING grounded thread (threads.reading_id). The "sub-thread" is
// simply the subset of a thread's messages whose blocks are `persona-chat-turn` for a given
// `archetype` — re-validated through loadMessages on rehydration (D-14). The Read is ALREADY
// a thread; `messages` carries any registered block, so no parent_message_id column is added.
//
// Honesty spine: a persona-chat turn is labeled SIM-1 in-voice text — it carries NO band,
// NO score, NO fabricated crowd. `archetype` is the persona tag; `role` distinguishes the
// creator's question from the persona's in-voice answer.

export const PersonaChatTurnBlockSchema = z.object({
  type: z.literal("persona-chat-turn"),
  props: z.object({
    archetype: z.string().min(1),         // the persona this sub-thread belongs to (D-03)
    role: z.enum(["user", "assistant"]),  // creator question vs persona in-voice answer
    text: z.string().min(1),              // the turn content
  }),
});

export type PersonaChatTurnBlock = z.infer<typeof PersonaChatTurnBlockSchema>;

// ─── Account-read block (the Account Read — Phase 10, SELF-01/02/03) ─────────────
// Plan 10-05: "A Read on your own account" — the know-thyself companion to Discover's
// know-thy-competitor. A STATIC composed card (multi-audience-read is the precedent)
// that maps the deterministic AccountReadResult (account-read.ts) onto the fixed
// `reading/` renderers (ReadingHero + ReadingSection accordions). NO model-generated UI.
//
// Honesty spine (SELF-02, carries P7 D-06): the `fallback:'thin'` discriminant carries
// NO patterns — the renderer shows the warning-toned "Not enough history to read yet"
// state, NEVER a fabricated pattern. A non-fallback payload always carries `patterns`.
//
// Accuracy track record (SELF-03): `trackRecord` is { withinPct, lastN } | null. Null →
// the renderer shows the "not enough posted outcomes yet" empty copy. The number is data
// (cream-primary), never a coral CTA.
//
// The block is SAVABLE to the shelf as item_type 'read' (SaveAffordance, Plan 04). Its
// own props ARE the snapshot the shelf re-renders without a re-fetch.

const FormatMixEntrySchema = z.object({
  label: z.string(),
  count: z.number(),
  pct: z.number(),
});

const AccountReadPatternsSchema = z.object({
  recurringHooks: z.array(z.string()),
  formatMix: z.array(FormatMixEntrySchema),
  dropPoints: z.array(z.string()),
  working: z.array(z.string()),
  fix: z.array(z.string()),
});

const TrackRecordSchema = z.object({
  withinPct: z.number(),
  lastN: z.number(),
});

// Real scraped profile header (Tier C scrape-data slice) — avatar / display name /
// verified / counts. avatarUrl is a plain string (may be "" or an ephemeral CDN URL),
// not z.url(), so an empty/expired avatar never fails validation.
const AccountReadProfileSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  verified: z.boolean(),
  followerCount: z.number(),
  videoCount: z.number(),
});

// One analyzed post as a cover thumbnail (real scrape media). coverUrl is an ephemeral
// TikTok-CDN image (display-only) — plain string, optional; the renderer degrades to a
// placeholder tile when it's absent or has expired in a saved snapshot.
const AnalyzedVideoSchema = z.object({
  coverUrl: z.string().optional(),
  views: z.number(),
  caption: z.string(),
  videoUrl: z.string(),
});

export const AccountReadBlockSchema = z.object({
  type: z.literal("account-read"),
  props: z.object({
    // The creator's own handle (resolved from session — T-10-12, never arbitrary input).
    handle: z.string().min(1),
    // Honest thin-history flag (SELF-02). When true, patterns are omitted and the
    // renderer shows the warning-toned fallback. When absent/false, `patterns` is present.
    fallback: z.literal("thin").optional(),
    // Real scrape header — present on the success path, absent on the thin fallback.
    profile: AccountReadProfileSchema.optional(),
    // The analyzed posts as cover thumbnails (real scrape media) — present on success.
    analyzedVideos: z.array(AnalyzedVideoSchema).optional(),
    // Pattern payload — present on the success path, absent on the thin fallback.
    patterns: AccountReadPatternsSchema.optional(),
    // Accuracy track record (SELF-03) — null below the row threshold (empty copy shown).
    trackRecord: TrackRecordSchema.nullable().optional(),
  }),
});

export type AccountReadBlock = z.infer<typeof AccountReadBlockSchema>;

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
  PersonaChatTurnBlockSchema,
  AccountReadBlockSchema,
  ProfileReadBlockSchema,
  ReactionDistributionBlockSchema,
  PredictionGaugeBlockSchema,
]);

export type BlockUnion = z.infer<typeof BlockUnionSchema>;
