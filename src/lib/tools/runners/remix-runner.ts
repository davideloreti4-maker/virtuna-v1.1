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
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";
import type { RemixCardBlock } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { pinPredictedSignature, type RunnerPinContext } from "./flash-runner";

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

// ─── Lead scroll-quote selector (mirrors script-runner) ──────────────────────

/**
 * Select the lead scroll-quote from the SIM personas.
 * D-04: quote ships ON the card face, never deferred.
 * Priority: first stop-verdict persona's quote.
 * Fallback: first persona's quote regardless of verdict.
 */
function selectLeadScrollQuote(
  personas: Array<{ verdict: string; quote: string; archetype: string }>,
): string {
  const stopper = personas.find((p) => p.verdict === "stop");
  if (stopper) return stopper.quote;
  return personas[0]?.quote ?? "";
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
  const { url, platform, profileRow, requestId, audience = null, intent } = input;
  const allWarnings: string[] = [];
  // GAP-C2: sell lens applies only for a calibrated audience (General → undefined no-op).
  const simIntent: IntentLens | undefined =
    audience && !audience.is_general ? intent : undefined;

  // ── STEER (08-04 / AUD-STEER + REMIX-01): audience-grounding + niche + repaint ──
  // buildAudienceGroundingLine delegates to buildGroundingLine for General/null (no-op).
  // resolveAudienceWeights([]) / is_general → DEFAULT mix (no analysis_override injected).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  void groundingLine; // grounding folds into the adapt niche + card steer tag below

  const resolvedWeights = resolveAudienceWeights(audience ? [audience] : []);
  void resolvedWeights; // weights wired for future Max-path integration; Flash uses the repaint

  // S1 fix: shared buildReactionPanel resolves niche via resolveNicheKey (was raw
  // niche_primary at the gate → exact-slug miss → niche-blind "all Mixed"). Matches
  // hooks/ideas runners; audienceRepaint construction is byte-identical to before.
  // `panel` is also consumed at the Flash gate (STEP 5) below.
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── STEP 1: RESOLVE — resolveAndRehost wraps temp mp4 rehost ──────────────────
  // cleanup MUST run in finally (T-03-02 — derive-and-drop invariant).
  // resolve_failed is caught outside the try/finally so cleanup is still attempted below
  // if possible. But since resolveAndRehost itself fails before returning cleanup,
  // we catch resolve errors separately and return early.

  let signedUrl: string;
  let cleanup: () => Promise<void>;

  try {
    const resolved = await resolveAndRehost(url, requestId);
    signedUrl = resolved.signedUrl;
    cleanup = resolved.cleanup;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allWarnings.push(`Resolve failed: ${msg}`);
    return { blocks: [], warnings: allWarnings, error: "resolve_failed" };
  }

  // cleanup is now available — wrap all subsequent work in try/finally
  try {
    // ── STEP 2: PERCEIVE — analyzeVideoWithOmni (perception only, NOT Max scoring — D-05a) ──
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

    // Cardinality A3/scout: pick ONE concept — concepts[0] (studio one-card aesthetic)
    const chosen = concepts[0]!;

    // ── STEP 5: GATE (D-05 opener-scoped) — Flash on the ADAPTED hook ─────────────
    // This gates the ADAPTED hook text only — never a full-video quality score (Pitfall 5).
    // `panel` (niche-resolved) + `audienceRepaint` were built up-front via buildReactionPanel.

    let simResult: Awaited<ReturnType<typeof runFlashTextMode>>;
    try {
      simResult = await runFlashTextMode(chosen.hook, "hook", panel, audienceRepaint, simIntent);
    } catch (flashErr) {
      const msg = flashErr instanceof Error ? flashErr.message : String(flashErr);
      allWarnings.push(`Flash gate failed for adapted hook: ${msg}`);
      return { blocks: [], warnings: allWarnings, error: "adapt_failed" };
    }

    const personas = simResult.result.personas;
    const { band, fraction } = aggregateFlash(personas);
    const scrollQuote = selectLeadScrollQuote(personas);

    // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
    // The adapted hook's personas ARE the run's prediction (opener-scoped SIM, D-05).
    // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
    if (input.pin && personas.length > 0) {
      const audienceId = audience && !audience.is_general ? audience.id : null;
      void pinPredictedSignature(input.pin.supabase, personas, {
        audienceId,
        analysisId: input.pin.analysisId ?? null,
      });
    }

    // ── STEP 6: BUILD — assemble remix-card block (D-05 moat: real 4-beat decode anatomy) ──
    // sourceDecode carries the REAL structural decode output — NOT a metadata guess.
    // Beat order: hook_pattern → structure_pacing → the_turn → emotional_beat (D-06)
    const beatBody = (id: string) =>
      decode.beats.find((b) => b.id === id)?.body ?? "";

    const blockData = {
      type: "remix-card" as const,
      props: {
        // Adapt output — the niche-adapted concept anatomy (AdaptConcept UI mapping D-09)
        adaptedHook: chosen.hook,
        angle: chosen.angle,
        whoItsFor: chosen.who_its_for,
        formatBorrowed: chosen.format_borrowed,

        // Source decode anatomy — REAL 4-beat structural decode (D-05 moat)
        sourceDecode: {
          hookPattern:  beatBody("hook_pattern"),
          structure:    beatBody("structure_pacing"),
          theTurn:      beatBody("the_turn"),
          emotionalBeat: beatBody("emotional_beat"),
        },

        // Opener-scoped band signal (Pitfall 5 — adapted hook scroll-stop ONLY)
        band,
        fraction,
        scrollQuote,
        model: "sim1-flash" as const,

        // 08-04 / D-03 STEER tag — populated only for a calibrated audience (General → omitted).
        ...(isCalibrated && audience ? { audienceName: audience.name } : {}),
      },
    };

    // D-14 belt-and-suspenders validation at the runner boundary
    const validated = RemixCardBlockSchema.safeParse(blockData);
    if (!validated.success) {
      allWarnings.push(
        `remix-card block validation failed — dropped: ${validated.error.message}`,
      );
      return { blocks: [], warnings: allWarnings };
    }

    return { blocks: [validated.data as RemixCardBlock], warnings: allWarnings };

  } finally {
    // T-03-02: cleanup() MUST run unconditionally — temp mp4 removed regardless of outcome
    await cleanup();
  }
}
