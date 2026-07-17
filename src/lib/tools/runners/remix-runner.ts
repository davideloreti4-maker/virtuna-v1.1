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
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { buildFlashWeighting } from "@/lib/engine/flash/persona-weighting";
import { characterizeContent } from "@/lib/audience/characterize-content";
import {
  reactPopulation,
  signatureHasPopulationAxes,
  type ContentVector,
  type PopulationAggregate,
} from "@/lib/audience/population";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";
import type { RemixCardBlock, HookProof } from "@/lib/tools/blocks";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { pinPredictedSignature, type RunnerPinContext } from "./predicted-pin";

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
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  void groundingLine; // grounding folds into the adapt niche + card steer tag below

  // ── REACT path (A1 — weighted SIM aggregation): build the optional Flash weighting ──
  // General / null / no-override → undefined → flat band (byte-identical, regression gate).
  // Calibrated audience → per-slot persona_weights bias the weighted stop-MASS band gate.
  const flashWeighting = buildFlashWeighting(audience ?? null);

  // S1 fix: shared buildReactionPanel resolves niche via resolveNicheKey (was raw
  // niche_primary at the gate → exact-slug miss → niche-blind "all Mixed"). Matches
  // hooks/ideas runners; audienceRepaint construction is byte-identical to before.
  // `panel` is also consumed at the Flash gate (STEP 5) below.
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── Audience Sim v2 (Stage 2): population projection gate ──────────────────
  // A calibrated signature carrying the v2 axes is the gate — General / legacy / preset skip it
  // (population stays undefined → byte-identical pre-v2 shape). Resolved ONCE per run (mirrors
  // hooks/ideas). The RATE step characterizes each ADAPTED hook (opener-scoped, Pitfall 5) below.
  const populationSignature = audience?.signature ?? null;
  const wantPopulation = signatureHasPopulationAxes(populationSignature);
  const populationVocab = populationSignature?.audience.topic_vocab ?? [];

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

    // ── STEP 5: RATE (D-05 opener-scoped) — ONE batched Flash call on ALL adapted hooks ──
    // S3′ generate-rate-rank: KEEP all adapted concepts (was concepts[0] only). Each concept
    // is a distinct adaptation of the SAME decoded source, so sourceDecode is shared across the
    // cards. This rates the ADAPTED hook text only — never a full-video score (Pitfall 5).
    const candidates = concepts.map((c, i) => ({ id: String(i), text: c.hook }));

    // ── Audience Sim v2 (Stage 2): characterize each adapted hook CONCURRENTLY with the SIM ──
    // Fired BEFORE awaiting the batch so they run in parallel (no serial latency — mirrors
    // hooks/ideas). Each resolves to the ContentVector the cheap O(N) scorer reacts on; a per-call
    // failure degrades to null (that card omits population). Gated off entirely for audiences
    // without the v2 axes → all null, no LLM calls, byte-identical old behaviour. Characterized on
    // the SAME adapted `hook` the SIM reacts to (opener-scoped, Pitfall 5), so they agree.
    const vectorPromises: Promise<ContentVector | null>[] = candidates.map((c) =>
      wantPopulation
        ? characterizeContent(c.text, populationVocab).catch(() => null)
        : Promise.resolve(null),
    );

    // ── STAGE: Simulating your audience (real boundary — batched Flash on the adapted hooks) ──
    input.onStage?.("Simulating your audience", "active");
    const batch = await runFlashTextModeBatch(
      candidates,
      "hook",
      panel,
      audienceRepaint,
      simIntent,
    ).catch((flashErr) => {
      const msg = flashErr instanceof Error ? flashErr.message : String(flashErr);
      allWarnings.push(`Batched Flash gate failed for adapted hooks: ${msg}`);
      return null;
    });
    if (!batch) {
      return { blocks: [], warnings: allWarnings, error: "adapt_failed" };
    }
    allWarnings.push(...batch.warnings);
    input.onStage?.("Simulating your audience", "done");

    // Collect the (already in-flight) content vectors — indexed to match `concepts`/candidates.
    const vectors = await Promise.all(vectorPromises);

    // Rank helpers (S3′): band tier → stop-count.
    const bandOrdinal = (b: "Strong" | "Mixed" | "Weak") =>
      b === "Strong" ? 0 : b === "Mixed" ? 1 : 2;
    const fractionNumerator = (f: string) => {
      const n = parseInt(f, 10);
      return Number.isNaN(n) ? 0 : n;
    };

    interface RatedConcept {
      concept: (typeof concepts)[number];
      band: "Strong" | "Mixed" | "Weak";
      fraction: string;
      scrollQuote: string;
      personas: FlashPersona[];
      population?: PopulationAggregate; // Audience Sim v2 Stage 2 — the N-individual projection
      generationIndex: number;
    }

    const rated: RatedConcept[] = [];
    concepts.forEach((concept, i) => {
      const sim = batch.results.get(String(i));
      if (!sim) {
        allWarnings.push(
          `SIM produced no reaction for adapted hook "${concept.hook.slice(0, 60)}" — dropped`,
        );
        return; // un-scorable → drop (honesty spine — never fabricate a band)
      }
      const personas = sim.personas;
      const { band, fraction } = aggregateFlash(personas, flashWeighting);
      const scrollQuote = selectLeadScrollQuote(personas);

      // Audience Sim v2 (Stage 2): the population projection — pure O(N) once the vector lands.
      // A null vector (skip / characterize failure) or a scorer throw → undefined (card omits the
      // field). Never let the projection break a card: the SIM band/fraction stays load-bearing.
      let population: PopulationAggregate | undefined;
      const vector = vectors[i];
      if (populationSignature && vector) {
        try {
          population = reactPopulation(populationSignature, vector);
        } catch {
          population = undefined;
        }
      }

      rated.push({ concept, band, fraction, scrollQuote, personas, population, generationIndex: i });
    });

    if (rated.length === 0) {
      return { blocks: [], warnings: allWarnings, error: "adapt_failed" };
    }

    // RANK (keep-all): band tier → stop-count → generation order.
    rated.sort((a, b) => {
      const bandDiff = bandOrdinal(a.band) - bandOrdinal(b.band);
      if (bandDiff !== 0) return bandDiff;
      const fractionDiff = fractionNumerator(b.fraction) - fractionNumerator(a.fraction);
      if (fractionDiff !== 0) return fractionDiff;
      return a.generationIndex - b.generationIndex;
    });

    // ── FLYWHEEL-02: pin the rank-1 adapted hook's personas (the run's prediction, D-05) ──
    // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
    if (input.pin && rated[0] && rated[0].personas.length > 0) {
      const audienceId = audience && !audience.is_general ? audience.id : null;
      void pinPredictedSignature(input.pin.supabase, rated[0].personas, {
        audienceId,
        analysisId: input.pin.analysisId ?? null,
      });
    }

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

          // 08-04 / D-03 STEER tag — populated only for a calibrated audience (General → omitted).
          ...(isCalibrated && audience ? { audienceName: audience.name } : {}),

          // S3′: per-card reaction for the ambient modal (PR-2)
          personas: r.personas,

          // Audience Sim v2 (Stage 2) — the N-individual population projection (adapted-hook).
          // Omitted when the audience lacks the v2 axes or characterization failed → pre-v2 shape.
          ...(r.population ? { population: r.population } : {}),
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
