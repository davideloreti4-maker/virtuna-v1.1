/**
 * ideas-runner.ts — Ideas pipeline orchestrator (Plan 03-03, Task 1).
 *
 * Formalizes the prototype's (scripts/ideas-sim-rank.ts) generate→SIM→gate stages:
 *
 * 1. GENERATE: assembleBundle(mode:"idea") → user message; system = KC_IDEAS_SYSTEM_PROMPT.
 *    Structured json_object generation of ~5 ideas (Open Q1 RESOLVED — see seedHookPath).
 *    Each idea carries: title, angle, mechanism, seedHook, needsTake, topic, take, format.
 *
 * 2. SIM (gate): runFlashTextMode(seedHook, "idea", { niche, contentType: null }) per candidate,
 *    in Promise.all (parallel — RESEARCH Pitfall 4 / Open Q2). aggregateFlash → {band, fraction}.
 *    Lead scrollQuote selected NOW from stop-verdicted personas (D-04, WARNING-4).
 *
 * 3. GATE + TRIM: drop candidates where band === "Weak" (Plan-01 GATE FLOOR: band !== "Weak",
 *    i.e., stops >= MIXED_THRESHOLD = 3). Keep up to 3 survivors (D-13). No regen loop (D-03).
 *
 * 4. BUILD: assemble validated idea-card blocks (IdeaCardBlockSchema, Plan 02 prop names).
 *    whyItFits = buildGroundingLine(profileRow, platform).line (Plan 02).
 *    Each block passes validateBlock (re-validated at insertMessage boundary too).
 *
 * SEED-HOOK EXTRACTION (Open Q1 decision):
 *   PRIMARY path: structured json_object generation — each idea has an explicit `seedHook`
 *   field, removing brittle prose parsing. This is the path that shipped (seedHookPath = "structured").
 *   FALLBACK path: the prototype's ===IDEA=== machine-marker prose with a `seedHook` marker,
 *   used ONLY if the structured generation visibly degrades KC's authored prose craft
 *   (generic/flattened concepts). The fallback is preserved in code but not currently triggered.
 *   seedHookPath is returned so the route can log it and the SUMMARY records the resolved outcome.
 *
 * GATE FLOOR (from 03-01-SUMMARY.md — MANDATORY HANDOFF):
 *   band !== "Weak" (stop-count >= MIXED_THRESHOLD = 3)
 *   Fail-loud if the gate floor cannot be applied (WARNING-3).
 *
 * ISOLATION: imports ONLY from its declared dependency surface.
 *   - assembler.ts (assembleBundle)
 *   - compiled.ts (KC_IDEAS_SYSTEM_PROMPT)
 *   - qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED)
 *   - flash/run-flash-text-mode.ts (runFlashTextMode)
 *   - flash/flash-aggregate.ts (aggregateFlash, MIXED_THRESHOLD)
 *   - audience/audience-grounding.ts (buildAudienceGroundingLine) — 07-04 steer (AUD-05/AUD-08)
 *   - audience/resolve-audience-weights.ts (resolveAudienceWeights) — 07-04 react (AUD-04)
 *   - engine/wave3/niche-resolver.ts (resolveNicheKey) — 14-01 niche-layer fix (KCQ-06/KCQ-01)
 *   - tools/blocks.ts (IdeaCardBlockSchema, IdeaCardBlock)
 *
 * 07-04 BLAST RADIUS (AUD-08): the profile slim-down for grounding is confined HERE only.
 *   ideas-runner uses buildAudienceGroundingLine (which delegates to buildGroundingLine when
 *   no audience is active). Other runners still read creator_profiles via the existing path.
 *   This is the ONE steer proof per D-01 scope. Steer-everywhere = post-P7 refinement run.
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_IDEAS_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash, MIXED_THRESHOLD } from "@/lib/engine/flash/flash-aggregate";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { buildFlashWeighting } from "@/lib/engine/flash/persona-weighting";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { IdeaCardBlockSchema } from "@/lib/tools/blocks";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { pinPredictedSignature, type RunnerPinContext } from "./flash-runner";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Over-generate buffer: ~5 ideas to get N=3 survivors (D-13, D-03). */
const IDEA_BUFFER = 5;

/** Max survivors to keep after gating (D-13). */
const MAX_SURVIVORS = 3;

/** Generation call timeout (mirrors flash-runner; ideas generate is heavier). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Output-serialization contract — owned by the runner because the runner owns
 * `response_format: json_object`. DashScope/Qwen rejects json_object mode with a
 * 400 ("messages must contain the word 'json'") unless the literal word appears
 * in the messages; the compiled KC prompt is pure craft knowledge and carries no
 * serialization directive, so the contract lives here. Static (byte-stable) so it
 * stays part of the warm system-prefix cache. Mirrors the StructuredIdea shape.
 */
const IDEAS_OUTPUT_CONTRACT = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "ideas": [ { "title": string, "angle": string, "mechanism": string, "seedHook": string, "needsTake": boolean, "topic": string, "take": string, "format": string | null } ] }
Return an "ideas" array of distinct idea objects. Every field is required (use "" or null where empty); "seedHook" must be non-empty.`;

// ─── Input type ───────────────────────────────────────────────────────────────

export interface IdeasPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
  /**
   * Active audience for this run (07-04 — steer + react wiring, AUD-04/AUD-05).
   * null or GENERAL_AUDIENCE.is_general=true → falls back to profile-based grounding
   * (zero behavior change for General — regression gate preserved).
   * AUD-08 blast radius: this field is ONLY consumed by ideas-runner in P7;
   * other runners still use buildGroundingLine(profileRow) unchanged.
   */
  audience?: Audience | null;
  /**
   * Per-run reaction lens (GAP-C2 / §P.10). `sell` re-frames the SIM verdict toward purchase
   * intent; `grow`/undefined → byte-identical no-op. Calibrated-audience only (gated below).
   */
  intent?: IntentLens;
  /**
   * FLYWHEEL-02: when present, pin the run's predicted disposition vector post-SIM
   * (lead idea's personas) + audience_id. Non-fatal — never blocks the cards.
   */
  pin?: RunnerPinContext;
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface IdeasPipelineResult {
  /** Up to MAX_SURVIVORS validated idea-card blocks (may be 0 if all sub-floor). */
  blocks: IdeaCardBlock[];
  /** Warnings from Flash SIM calls. */
  warnings: string[];
  /** Which seed-hook extraction path shipped (Open Q1 resolved decision). */
  seedHookPath: "structured" | "markered";
}

// ─── Structured idea type ────────────────────────────────────────────────────

/**
 * The structured json_object shape for idea generation (Open Q1 PRIMARY path).
 * KC_IDEAS_SYSTEM_PROMPT is instructed to return JSON with an `ideas` array.
 */
interface StructuredIdea {
  title: string;
  angle: string;
  mechanism: string;
  seedHook: string;
  needsTake: boolean;
  topic: string;
  take: string;
  format: string | null;
}

// ─── Qwen generation call ────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate ~IDEA_BUFFER structured ideas.
 * System = KC_IDEAS_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateIdeasStructured(userMessage: string): Promise<StructuredIdea[]> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let raw: string;
  try {
    const res = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: KC_IDEAS_SYSTEM_PROMPT + IDEAS_OUTPUT_CONTRACT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
      } as never,
      { signal: controller.signal },
    );
    raw = res.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(
      error.name === "AbortError"
        ? `generateIdeasStructured: aborted (timeout ${GENERATE_TIMEOUT_MS}ms)`
        : `generateIdeasStructured: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `generateIdeasStructured: JSON.parse failed on model output: ${raw.slice(0, 200)}`,
    );
  }

  // Extract ideas array — model may return { ideas: [...] } or bare array
  const obj = parsed as { ideas?: unknown } | null;
  const arr = Array.isArray(obj?.ideas)
    ? (obj!.ideas as unknown[])
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];

  if (arr.length === 0) {
    return [];
  }

  // Coerce and filter to structurally valid ideas
  const ideas: StructuredIdea[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.seedHook !== "string" || !r.seedHook) continue;
    ideas.push({
      title: typeof r.title === "string" ? r.title : "(untitled)",
      angle: typeof r.angle === "string" ? r.angle : "",
      mechanism: typeof r.mechanism === "string" ? r.mechanism : "",
      seedHook: r.seedHook,
      needsTake: typeof r.needsTake === "boolean" ? r.needsTake : false,
      topic: typeof r.topic === "string" ? r.topic : "",
      take: typeof r.take === "string" ? r.take : "",
      format:
        typeof r.format === "string" && r.format.trim().length > 0 ? r.format : null,
    });
    if (ideas.length >= IDEA_BUFFER) break;
  }

  return ideas;
}

// ─── Lead scroll-quote selector ───────────────────────────────────────────────

/**
 * Select the lead scroll-quote from the SIM personas.
 * D-04: the quote ships ON the card face, never deferred.
 * Priority: first stop-verdict persona's quote (they're the audience that engaged).
 * Fallback: first persona's quote regardless of verdict.
 */
function selectLeadScrollQuote(
  personas: Array<{ verdict: string; quote: string; archetype: string }>,
): string {
  // Prefer a stop-verdict persona (they stopped → their quote is the pull signal)
  const stopper = personas.find((p) => p.verdict === "stop");
  if (stopper) return stopper.quote;
  // Fallback: first persona (persona count guaranteed ≥1 by FlashResultSchema)
  return personas[0]?.quote ?? "";
}

// ─── runIdeasPipeline ─────────────────────────────────────────────────────────

/**
 * Full Ideas pipeline: generate → SIM gate → build idea-card blocks.
 *
 * Returns up to MAX_SURVIVORS validated idea-card blocks.
 * Returns 0 blocks if all ideas score Weak (valid, no regen — D-03).
 *
 * @param input.ask         Creator's ask (seeded or defaulted to empty → route handles default).
 * @param input.platform    Target platform.
 * @param input.profileRow  Creator profile (null = cold-start, never blocks on onboarding).
 */
export async function runIdeasPipeline(input: IdeasPipelineInput): Promise<IdeasPipelineResult> {
  const { ask, platform, profileRow, audience = null, intent } = input;
  const allWarnings: string[] = [];
  // GAP-C2: sell lens applies only for a calibrated audience (General → undefined no-op).
  const simIntent: IntentLens | undefined =
    audience && !audience.is_general ? intent : undefined;

  // ── GATE FLOOR ASSERTION (WARNING-3: fail loud if MIXED_THRESHOLD unreachable) ──
  // This fires only if the import itself resolves a bad value (e.g. undefined/NaN).
  if (typeof MIXED_THRESHOLD !== "number" || isNaN(MIXED_THRESHOLD)) {
    throw new Error(
      "runIdeasPipeline: MIXED_THRESHOLD is not a valid number — Plan-01 gate floor handoff missing or corrupt. " +
        "Do NOT proceed; complete 03-01-SUMMARY.md first. (WARNING-3)",
    );
  }

  // ── §P step-7: creator voice (fallback) + steer from the per-audience creator_persona ──
  // genProfileRow may carry a voice backfilled from creator_persona.writing_style_sample;
  // creatorSteer folds who's writing into overrides. General/no-audience → inputs unchanged.
  const { profileRow: genProfileRow, creatorSteer } = applyCreatorPersona(profileRow, audience);

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate ideas from my profile",
      platform,
      mode: "idea",
      ...(creatorSteer ? { overrides: creatorSteer } : {}),
    },
    genProfileRow,
  );

  // Record which path shipped (Open Q1 resolved decision)
  const seedHookPath: "structured" | "markered" = "structured";

  // ── SIM (gate): parallel Flash per candidate ──────────────────────────────
  // Niche panel + audience repaint via the shared buildReactionPanel helper (Plan 13-01):
  // resolveNicheKey normalizes free-text/sub-slug niche_primary to a top-level
  // NICHE_INSTANTIATION key BEFORE the panel (14-01 — otherwise selectPersonaSlots' exact-slug
  // match silently falls back to generic "all Mixed"); audienceRepaint is undefined for
  // General/no-audience → runFlashTextMode omits the arg → byte-identical no-op (regression gate).
  // The new POST /api/tools/react route reuses the SAME helper so type-to-room discriminates
  // by niche exactly like a card reaction (RESEARCH Open Q1 / Pitfall 2).
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── REACT path (A1 — weighted SIM aggregation): build the optional Flash weighting ──
  // General / null / no-override audience → undefined → aggregateFlash takes its flat path
  // (byte-identical band, ENGINE_VERSION 3.19.0 regression gate). Calibrated audience →
  // per-slot persona_weights bias the weighted stop-MASS band gate (which candidates survive).
  // The SIM call + repaint (built above) are UNTOUCHED — only the post-SIM band math is
  // weighted. This is what finally CONSUMES audience.persona_weights (void before A1).
  const flashWeighting = buildFlashWeighting(audience ?? null);

  // ── STEER path (07-04 / AUD-05): audience-grounding line replaces buildGroundingLine ──
  // buildAudienceGroundingLine delegates to buildGroundingLine for General/null (AUD-08
  // blast-radius gate: only ideas-runner uses audience-grounding in P7).
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);

  // FLYWHEEL-02: capture the personas to pin — the lead survivor (the idea most
  // likely posted), falling back to the first SIM that resolved so a run that
  // fired the SIM always pins a vector.
  let leadPersonas: FlashPersona[] | null = null;
  let firstSimPersonas: FlashPersona[] | null = null;

  /**
   * 14-02 best-of-N + flop pass: over-generate → PARALLEL SIM band per candidate →
   * band gate. S5: the rubric critic (Phase-14 best-of-N second opinion) was OFF by
   * default and ~100% fail in practice — removed entirely. The gate is now the SIM
   * band alone (KCQ-05): keep a candidate iff band !== "Weak".
   */
  async function gatePass(ideaBatch: StructuredIdea[]): Promise<IdeaCardBlock[]> {
    // Per-candidate SIM band, all in parallel (D-05 — never serial). A failed SIM
    // resolves to null and is treated as Weak (dropped).
    const judged = await Promise.all(
      ideaBatch.map(async (idea) => {
        const simResult = await runFlashTextMode(
          idea.seedHook,
          "idea",
          panel,
          audienceRepaint,
          simIntent,
        ).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          allWarnings.push(`SIM failed for idea "${idea.title}": ${msg}`);
          return null; // null = failed SIM → treat as Weak (drop)
        });
        return { idea, simResult };
      }),
    );

    const passed: IdeaCardBlock[] = [];

    for (const { idea, simResult } of judged) {
      if (passed.length >= MAX_SURVIVORS) break;
      if (simResult === null || simResult === undefined) continue; // SIM failed → drop

      const personas = simResult.result.personas;
      if (!firstSimPersonas) firstSimPersonas = personas;
      const { band, fraction } = aggregateFlash(personas, flashWeighting);

      // GATE (KCQ-05): keep iff band !== "Weak".
      if (band === "Weak") continue;

      // First survivor → the lead card; pin its personas (FLYWHEEL-02).
      if (!leadPersonas) leadPersonas = personas;

      // D-04 WARNING-4: select lead scrollQuote NOW — ships on the card face
      const scrollQuote = selectLeadScrollQuote(personas);

      // BUILD: validated idea-card block (Plan 02 prop names)
      const blockData = {
        type: "idea-card" as const,
        props: {
          title: idea.title,
          angle: idea.angle,
          whyItFits: groundingLine,   // GROUND-03 (Plan 02)
          mechanism: idea.mechanism,
          seedHook: idea.seedHook,
          needsTake: idea.needsTake,
          topic: idea.topic,
          take: idea.take,
          format: idea.format,
          band,
          fraction,
          scrollQuote,
          model: "sim1-flash" as const,
          predictedFailureMode: null, // S5: rubric critic removed (was OFF / ~100% fail)
        },
      };

      // Validate at the runner boundary (D-14 belt-and-suspenders)
      const validated = IdeaCardBlockSchema.safeParse(blockData);
      if (!validated.success) {
        allWarnings.push(
          `idea-card block validation failed for "${idea.title}": ${validated.error.message}`,
        );
        continue;
      }

      passed.push(validated.data as IdeaCardBlock);
    }

    return passed;
  }

  // First over-generate batch.
  const firstBatch = await generateIdeasStructured(userMessage);
  if (firstBatch.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  let survivors = await gatePass(firstBatch);

  // ── CONDITIONAL REGEN (D-06): regenerate ONCE only when ZERO candidates pass ──
  // Never an unbounded serial loop — one extra parallel over-generate + critique
  // pass, then proceed with whatever survives (may still be 0 — "0 blocks is valid").
  if (survivors.length === 0) {
    const secondBatch = await generateIdeasStructured(userMessage);
    if (secondBatch.length > 0) {
      survivors = await gatePass(secondBatch);
    }
  }

  // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
  // The predicted vector is computed ONCE here from the lead idea's personas and
  // persisted with the run's audience_id — the "predict" half of the moat loop.
  // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
  if (input.pin) {
    // leadPersonas/firstSimPersonas are mutated INSIDE the gatePass closure. TS
    // control-flow analysis narrows the outer `let`s to their initializer (`null`)
    // because it does not track closure assignments, so a direct read infers `never`.
    // Re-widen explicitly to the declared union before the runtime null-check.
    const pinnedPersonas = (leadPersonas ?? firstSimPersonas) as FlashPersona[] | null;
    if (pinnedPersonas && pinnedPersonas.length > 0) {
      const audienceId = audience && !audience.is_general ? audience.id : null;
      void pinPredictedSignature(input.pin.supabase, pinnedPersonas, {
        audienceId,
        analysisId: input.pin.analysisId ?? null,
      });
    }
  }

  return { blocks: survivors, warnings: allWarnings, seedHookPath };
}
