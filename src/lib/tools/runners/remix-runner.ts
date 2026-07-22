/**
 * remix-runner.ts — Remix pipeline orchestrator (Plan 06-04, Task 1).
 *
 * Revives the live engine/remix decode+adapt chain (D-05/D-06, per 06-SCOUT.md).
 * Does NOT rebuild — imports the 5 confirmed-reusable functions as-is.
 *
 * Pipeline stages:
 *
 * 1. RESOLVE: resolveAndRehost(url, requestId) → {signedUrl, cleanup}
 *    cleanup() MUST be called in finally — unconditional (T-03-02 derive-and-drop).
 *
 * 2. PERCEIVE: analyzeVideoWithOmni(signedUrl) — perception only (NOT Max scoring — D-05a).
 *    Uses the Omni path, not the protected SIM-1 Max video-scoring path.
 *
 * 3. DECODE: omniOutputToStructuralInput(omni) → OmniStructuralInput|null;
 *    runDecode(structural) → DecodeResult|null.
 *    If null → return {blocks:[], error:"decode_failed"} (graceful — Pitfall 6).
 *
 * 4. ADAPT: decodeResultToAdaptInput(decode, niche) → AdaptInput (luck NEVER mapped — D-01);
 *    generateAdaptConcepts(adaptInput) → AdaptConcept[]|null.
 *    Pick ONE concept: concepts[0] (cardinality A3/scout — studio one-card aesthetic).
 *
 * 5. GATE (D-05 opener-scoped): runFlashTextMode(chosen.hook, "hook", panel)
 *    → aggregateFlash(personas) → {band, fraction} + lead scrollQuote.
 *    Gate is on the ADAPTED hook only — never the full decode (Pitfall 5 honesty spine).
 *
 * 6. BUILD: assemble remix-card block. sourceDecode carries REAL 4-beat decode anatomy
 *    (D-05 moat). Validate via RemixCardBlockSchema.safeParse (D-14). Return 0 or 1 block.
 *
 * D-05a ISOLATION — MUST NOT import:
 *   - runPredictionPipeline (protected SIM-1 Max video-scoring path)
 *   - aggregateScores (engine scoring aggregator)
 *   - usage_tracking (engine usage accounting)
 * Do NOT touch ENGINE_VERSION (no version bump from decode/adapt usage — 06-SCOUT.md D-05a GREEN).
 */

import { resolveAndRehost } from "@/lib/engine/remix/resolve-and-rehost";
import { analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";
import { omniOutputToStructuralInput, runDecode } from "@/lib/engine/remix/decode";
import { decodeResultToAdaptInput } from "@/lib/engine/remix/decode-types";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
// New Qwen call system (2026-07-22): the persona SIM is GONE from the remix path (fan-out from
// hooks-runner). The ADAPT call is the generation call — it now self-estimates each adapted hook's
// /10 + stop-quote, and bandFromStops turns that into the projected band (SIM's 6/3 calibration
// SSOT). runFlashTextModeBatch / aggregateFlash / buildReactionPanel / buildFlashWeighting /
// characterizeContent / reactPopulation were the SIM-path machinery and are no longer imported — the
// per-persona reaction + population belong to the user-fired simulation now.
import { bandFromStops } from "@/lib/engine/flash/flash-aggregate";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";
import type { RemixCardBlock, HookProof } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
// pinPredictedSignature (the FLYWHEEL pin) pinned the rank-1 adapted hook's SIM personas; with no SIM
// on this path it moves to the fired simulation. Only the RunnerPinContext type is still referenced
// (the accepted-but-unused `pin` input, kept so the route call site is unchanged).
import type { RunnerPinContext } from "./predicted-pin";

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface RemixPipelineInput {
  /** The TikTok (or platform) URL to decode and adapt from. */
  url: string;
  /** Target platform (used for niche panel in Flash gate). */
  platform: "tiktok" | "instagram" | "youtube";
  /** Creator profile — null = cold-start, niche defaults to "general". */
  profileRow: ProfileRow | null;
  /** Unique request ID for the temp rehost path (prevents concurrent collision). */
  requestId: string;
  /**
   * Active audience for this run (08-04 — steer closure + REMIX-01; mirrors 07-04 ideas-runner).
   * null or is_general → profile-based niche + DEFAULT weights (byte-identical no-op for General).
   * Calibrated audience → audience niche steers the adapt + Flash panel; repaint feeds Flash;
   * audienceName surfaces the as-your-{audience} steer tag on the card (D-03).
   */
  audience?: Audience | null;
  /**
   * Per-run reaction lens (GAP-C2 / §P.10). `sell` re-frames the adapted-hook-SIM verdict toward
   * purchase intent; `grow`/undefined → byte-identical no-op. Calibrated-audience only (gated below).
   */
  intent?: IntentLens;
  /**
   * FLYWHEEL-02: when present, pin the run's predicted disposition vector (the
   * adapted hook's personas) + audience_id post-SIM. Non-fatal — never blocks the card.
   */
  pin?: RunnerPinContext;
  /**
   * Progress callback fired at the REAL pipeline phase boundaries (Resolving → Decoding →
   * Adapting → Simulating your audience). Wired to the route's SSE `send("stage", …)` so the
   * spine reflects genuine phase timing. Optional/no-op — absent = unchanged. Honesty spine:
   * true boundaries, never a fake timer.
   */
  onStage?: (name: string, status: "active" | "done") => void;
}

export interface RemixPipelineResult {
  /** 0 or 1 validated remix-card block (cardinality A3 — one-card). */
  blocks: RemixCardBlock[];
  /** Warnings from any stage. */
  warnings: string[];
  /**
   * Error discriminant:
   *   "resolve_failed"  — URL could not be resolved / re-hosted (Apify failure)
   *   "decode_failed"   — omniOutputToStructuralInput or runDecode returned null (Pitfall 6)
   *   "adapt_failed"    — generateAdaptConcepts returned null or empty (graceful failure)
   */
  error?: "resolve_failed" | "decode_failed" | "adapt_failed";
}

// selectLeadScrollQuote was removed with the persona SIM (new Qwen call system): the lead quote is
// now the adapt call's self-emitted `stopQuote`, not a pick from a reacted panel.

/**
 * Coerce the adapt call's self-estimated stop-count into a clean integer 0–10. Accepts a number or a
 * numeric string ("8", "8/10" → 8). Anything missing/malformed → 0, which bands as Weak and ranks
 * the concept LAST — the honest degrade, never a fabricated high. Mirrors hooks-runner.
 */
function coercePersonaStops(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

// ─── runRemixPipeline ─────────────────────────────────────────────────────────

/**
 * Full Remix pipeline: resolve URL → real structural decode → niche adapt
 * → opener Flash gate → ONE remix-card block.
 *
 * Returns 0 or 1 validated remix-card block.
 * Returns 0 blocks on resolve, decode, or adapt failure — never throws.
 *
 * cleanup() is called unconditionally in a finally block (T-03-02 derive-and-drop).
 *
 * @param input.url         The TikTok URL to remix (resolve + decode + adapt)
 * @param input.platform    Target platform
 * @param input.profileRow  Creator profile (null = cold-start)
 * @param input.requestId   Unique ID for the temp rehost path
 */
export async function runRemixPipeline(input: RemixPipelineInput): Promise<RemixPipelineResult> {
  const { url, platform, profileRow, requestId, audience = null } = input;
  const allWarnings: string[] = [];
  // NOTE: `input.intent` (the sell/grow reaction lens) only ever reframed the persona-SIM verdict.
  // With the SIM removed from generation it is unused on this path for now; it re-attaches to the
  // user-fired simulation when that wiring lands. Kept on the interface so the route call site is
  // unchanged. Same for `input.pin` (the FLYWHEEL pin — see below).

  // ── STEER (08-04 / AUD-STEER + REMIX-01): audience-grounding + niche ──
  // buildAudienceGroundingLine delegates to buildGroundingLine for General/null (no-op).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  void groundingLine; // grounding folds into the adapt niche + card steer tag below

  // The persona SIM is GONE from this path (new Qwen call system): no flashWeighting, no
  // buildReactionPanel, no population characterization. The ADAPT call self-estimates each adapted
  // hook's /10 (RATE step below), and the per-persona reaction + population belong to the user-fired
  // simulation now.

  // ── STEP 1: RESOLVE — resolveAndRehost wraps temp mp4 rehost ──────────────────
  // cleanup MUST run in finally (T-03-02 — derive-and-drop invariant).
  // resolve_failed is caught outside the try/finally so cleanup is still attempted below
  // if possible. But since resolveAndRehost itself fails before returning cleanup,
  // we catch resolve errors separately and return early.

  let signedUrl: string;
  let cleanup: () => Promise<void>;
  // Source video cover (display-only thumbnail for the card) — captured from the resolve
  // step, NOT a media reference. Undefined when the rehost item carried no cover.
  let sourceCoverUrl: string | undefined;
  // Who made the post we are remixing, and how it did (resolve step). The card's receipt.
  let sourceHandle: string | undefined;
  let sourceViews: number | undefined;
  let sourcePostUrl: string | undefined;

  // ── STAGE: Resolving (real boundary — pull + rehost the source video) ──
  input.onStage?.("Resolving", "active");
  try {
    const resolved = await resolveAndRehost(url, requestId);
    signedUrl = resolved.signedUrl;
    cleanup = resolved.cleanup;
    sourceCoverUrl = resolved.coverUrl;
    sourceHandle = resolved.handle;
    sourceViews = resolved.views;
    sourcePostUrl = resolved.sourceUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allWarnings.push(`Resolve failed: ${msg}`);
    return { blocks: [], warnings: allWarnings, error: "resolve_failed" };
  }
  input.onStage?.("Resolving", "done");

  // cleanup is now available — wrap all subsequent work in try/finally
  try {
    // ── STEP 2: PERCEIVE — analyzeVideoWithOmni (perception only, NOT Max scoring — D-05a) ──
    // ── STAGE: Decoding (real boundary — perceive + decode what made it work) ──
    input.onStage?.("Decoding", "active");
    const omni = await analyzeVideoWithOmni(signedUrl);

    // ── STEP 3: DECODE ───────────────────────────────────────────────────────────
    // omniOutputToStructuralInput: maps Omni output → flat OmniStructuralInput | null
    // runDecode: decodes structural input → DecodeResult | null (Pitfall 6 graceful)
    const structural = omniOutputToStructuralInput(omni);
    const decode = structural ? await runDecode(structural) : null;

    if (!decode) {
      allWarnings.push("Decode returned null — decode_failed graceful (Pitfall 6).");
      return { blocks: [], warnings: allWarnings, error: "decode_failed" };
    }
    input.onStage?.("Decoding", "done");

    // ── STEP 4: ADAPT ────────────────────────────────────────────────────────────
    // decodeResultToAdaptInput: bridges DecodeResult → AdaptInput (luck NEVER mapped — D-01)
    // generateAdaptConcepts: 3 niche-adapted concepts or null on graceful failure
    // REMIX-01 steer: when a calibrated audience is active, the adapt niche targets that
    // audience (name + goal) instead of the generic profile niche alone. General → profile niche.
    const profileNiche = profileRow?.niche_primary ?? "general";
    const audienceNiche =
      isCalibrated && audience
        ? `${profileNiche} · ${audience.name}${audience.goal_label ? ` (${audience.goal_label})` : ""}`
        : profileNiche;
    const adaptInput = decodeResultToAdaptInput(decode, audienceNiche);

    // ── STAGE: Adapting (real boundary — rewrite the concepts for your audience) ──
    input.onStage?.("Adapting", "active");
    let concepts: Awaited<ReturnType<typeof generateAdaptConcepts>>;
    try {
      concepts = await generateAdaptConcepts(adaptInput);
    } catch (adaptErr) {
      const msg = adaptErr instanceof Error ? adaptErr.message : String(adaptErr);
      allWarnings.push(`Adapt generation threw: ${msg}`);
      return { blocks: [], warnings: allWarnings, error: "adapt_failed" };
    }

    if (!concepts || concepts.length === 0) {
      allWarnings.push("generateAdaptConcepts returned null/empty — adapt_failed graceful.");
      return { blocks: [], warnings: allWarnings, error: "adapt_failed" };
    }
    input.onStage?.("Adapting", "done");

    // ── STEP 5: RATE (projection — NO SIM) — the adapted hook's /10 rode the ADAPT call ──
    // New Qwen call system: the ADAPT call (generateAdaptConcepts) is the generation call, and it
    // now self-estimated each concept's stop-count (personaStops /10) + a stop-quote. There is NO
    // batched Flash SIM, NO population characterization on this path any more — the per-persona cast
    // + the N-individual projection are MEASURED artefacts that belong to the user-fired simulation
    // ("See the room →"). band via bandFromStops (shares the SIM's 6/3 calibration SSOT), fraction as
    // the honest "N/10 stop", quote = the stopQuote. This rates the ADAPTED hook only (Pitfall 5).
    interface RatedConcept {
      concept: (typeof concepts)[number];
      band: "Strong" | "Mixed" | "Weak";
      fraction: string;
      scrollQuote: string;
      stops: number; // the projected /10 — the rank key
      generationIndex: number;
    }

    const rated: RatedConcept[] = concepts.map((concept, i) => {
      const stops = coercePersonaStops(concept.personaStops);
      return {
        concept,
        band: bandFromStops(stops),
        fraction: `${stops}/10 stop`,
        scrollQuote: typeof concept.stopQuote === "string" ? concept.stopQuote.trim() : "",
        stops,
        generationIndex: i,
      };
    });

    // RANK (keep-all): best → worst by the projected /10 stop-count. Tie-break preserves generation
    // order. Bands derive monotonically from `stops`, so this single sort is already band-consistent
    // (Strong before Mixed before Weak) — no separate tier ordinal needed. (Same keep-all + rank
    // selection behaviour as before — only the ranking SIGNAL moved from the SIM to the /10.)
    rated.sort((a, b) => {
      const stopDiff = b.stops - a.stops; // descending
      if (stopDiff !== 0) return stopDiff;
      return a.generationIndex - b.generationIndex;
    });

    // FLYWHEEL-02 pin REMOVED from the generation path: it pinned the rank-1 adapted hook's SIM
    // personas, and no SIM runs here now. The predicted-vector pin moves to the user-fired
    // simulation. `input.pin` is accepted but unused on this path (route call site unchanged).

    // ── STEP 6: BUILD — one remix-card per ranked concept (D-05 moat: real 4-beat decode) ──
    // sourceDecode is the SAME real structural decode for every card (shared source video).
    // Beat order: hook_pattern → structure_pacing → the_turn → emotional_beat (D-06)
    const beatBody = (id: string) => decode.beats.find((b) => b.id === id)?.body ?? "";
    const sourceDecode = {
      hookPattern: beatBody("hook_pattern"),
      structure: beatBody("structure_pacing"),
      theTurn: beatBody("the_turn"),
      emotionalBeat: beatBody("emotional_beat"),
    };

    // The source receipt (§11f) — the SAME anatomy the grounded cards carry, so a remix names
    // the video it adapted instead of showing an anonymous thumbnail. Requires a handle: an
    // unnamed source is not attributable, and a receipt that cannot say WHOSE video it was is
    // not a receipt (mirrors buildProofFromSource's honesty gate).
    //
    // Everything we cannot honestly know about a pasted video stays null — there is no
    // follower baseline here, hence no multiplier and no basis label; nothing scored this
    // video against the audience, hence no fit. The receipt shows the creator, the reach, and
    // a link back. Nothing else.
    const sourceProof: HookProof | null = sourceHandle
      ? {
          handle: sourceHandle,
          videoUrl: sourcePostUrl ?? url,
          coverUrl: sourceCoverUrl ?? null,
          views: sourceViews ?? null,
          hookTemplate: null,
          archetype: null,
          multiplier: null,
          baselineLabel: null,
          fitLabel: null,
        }
      : null;

    const blocks: RemixCardBlock[] = [];
    for (const r of rated) {
      const blockData = {
        type: "remix-card" as const,
        props: {
          // Adapt output — the niche-adapted concept anatomy (AdaptConcept UI mapping D-09)
          adaptedHook: r.concept.hook,
          angle: r.concept.angle,
          whoItsFor: r.concept.who_its_for,
          formatBorrowed: r.concept.format_borrowed,

          // READY TO FILM (owner 2026-07-22) — the shoot plan for YOUR adapted version. Omitted
          // when the adapt model returned none, so a pre-wiring remix card stays byte-identical.
          ...(r.concept.production ? { production: r.concept.production } : {}),

          // Source decode anatomy — REAL 4-beat structural decode (D-05 moat)
          sourceDecode,

          // Source video cover thumbnail (display-only) — omitted when the resolve step
          // surfaced none (additive / back-compat). Still emitted for blocks stored before
          // `proof` existed; the renderer now prefers the receipt when present.
          ...(sourceCoverUrl ? { coverUrl: sourceCoverUrl } : {}),

          // The attributed source post — null when the actor named no author.
          ...(sourceProof ? { proof: sourceProof } : {}),

          // Opener-scoped band signal (Pitfall 5 — adapted hook scroll-stop ONLY)
          band: r.band,
          fraction: r.fraction,
          scrollQuote: r.scrollQuote,
          model: "sim1-flash" as const,
          // PROJECTION (new call system): the adapted-hook band/fraction/quote are the adapt call's
          // self-estimate, not a measured reaction. The renderer gates ALL measurement language on
          // this; the measured verdict replaces the projection when the creator fires "See the room →".
          provenance: "projected" as const,

          // 08-04 / D-03 STEER tag — populated only for a calibrated audience (General → omitted).
          ...(isCalibrated && audience ? { audienceName: audience.name } : {}),

          // personas + population INTENTIONALLY OMITTED — the per-card cast and the N-individual
          // projection are MEASURED artefacts of the fired simulation, not the generation-time card.
        },
      };

      // D-14 belt-and-suspenders validation at the runner boundary
      const validated = RemixCardBlockSchema.safeParse(blockData);
      if (!validated.success) {
        allWarnings.push(
          `remix-card block validation failed — dropped: ${validated.error.message}`,
        );
        continue;
      }
      blocks.push(validated.data as RemixCardBlock);
    }

    return { blocks, warnings: allWarnings };

  } finally {
    // T-03-02: cleanup() MUST run unconditionally — temp mp4 removed regardless of outcome
    await cleanup();
  }
}
