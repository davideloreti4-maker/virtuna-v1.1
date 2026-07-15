/**
 * ideas-runner.ts — Ideas pipeline orchestrator (Plan 03-03, Task 1).
 *
 * Formalizes the prototype's (scripts/ideas-sim-rank.ts) generate→SIM→gate stages:
 *
 * 1. GENERATE: assembleBundle(mode:"idea") → user message; system = KC_IDEAS_SYSTEM_PROMPT.
 *    Structured json_object generation of exactly IDEA_COUNT (4) ideas (Open Q1 — seedHookPath).
 *    Each idea carries: title, angle, mechanism, seedHook, needsTake, topic, take, format.
 *
 * 2. RATE (S3′): ONE batched runFlashTextModeBatch(candidates, "idea", { niche, contentType: null })
 *    scores ALL candidates in a single call. aggregateFlash → {band, fraction} per candidate.
 *    Lead scrollQuote selected NOW from stop-verdicted personas (D-04, WARNING-4).
 *
 * 3. KEEP-ALL + RANK (S3′): NO Weak cut. Every rated idea is kept and RANKED (band tier →
 *    stop-count → generation order). slice(IDEA_COUNT) is a safety bound only. No regen (D-03).
 *    The only drop is a candidate with no reaction (un-scorable — never fabricate a band).
 *
 * 4. BUILD: assemble validated idea-card blocks (incl. per-card personas for the modal, PR-2).
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
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
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
import { pinPredictedSignature, type RunnerPinContext } from "./predicted-pin";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import { buildProofFromSource, coerceSourceIndex } from "./build-proof";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Generate-and-rate (S3′): generate exactly IDEA_COUNT ideas, batch-rate ALL, RANK them,
 * and KEEP them all — no Weak cut, no over-gen buffer, no top-N trim. Generation count ==
 * display count (the user always gets a full shelf). The slice at IDEA_COUNT is a safety
 * bound only (model occasionally over-emits).
 */
const IDEA_COUNT = 4;

/** Generation call timeout (mirrors hooks-runner; ideas generate is heavier). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Grounding gate (§11f fan-out — mirrors GROUNDING_HOOKS_ENABLED). OFF by default —
 * grounding prepends a live scrape + survivor profile-scrapes + a teardown LLM call
 * (~25s + Apify cost) BEFORE generation, so it ships behind an env flag until live-proven.
 * TikTok-only in MVP (the gather path is clockworks); IG native is the documented fast-follow.
 */
function isGroundingEnabled(): boolean {
  return process.env.GROUNDING_IDEAS_ENABLED === "true";
}

// ─── Rank helpers (S3′ — mirrors hooks-runner) ──────────────────────────────────
/** Band tier ordinal for ranking: Strong=0 > Mixed=1 > Weak=2 (keep-all, Weak ranked last). */
function bandOrdinal(band: "Strong" | "Mixed" | "Weak"): number {
  if (band === "Strong") return 0;
  if (band === "Mixed") return 1;
  return 2;
}

/** Parse the stop-count numerator from a fraction string (e.g. "6/10 stop" → 6); NaN-safe → 0. */
function parseFractionNumerator(fraction: string): number {
  const n = parseInt(fraction, 10);
  return Number.isNaN(n) ? 0 : n;
}

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
Return an "ideas" array of exactly ${IDEA_COUNT} STRONG, distinct idea objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required (use "" or null where empty); "seedHook" must be non-empty.`;

/**
 * Grounded output contract (§11f fan-out — mirrors HOOKS_OUTPUT_CONTRACT_GROUNDED). Used ONLY
 * when a corpus grounding block was injected (grounding ON + real examples found). Adds ONE
 * field — `sourceIndex` — so each idea reports WHICH grounding example (1-based, or 0 for none)
 * its structure adapts. That integer is the attribution link the on-card receipt is built from
 * (sourceIndex → RetrievedExample → proof). The ungrounded contract above is kept byte-identical
 * so flag-OFF runs preserve their warm-cache prefix + regression gate.
 */
const IDEAS_OUTPUT_CONTRACT_GROUNDED = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "ideas": [ { "title": string, "angle": string, "mechanism": string, "seedHook": string, "needsTake": boolean, "topic": string, "take": string, "format": string | null, "sourceIndex": number } ] }
Return an "ideas" array of exactly ${IDEA_COUNT} STRONG, distinct idea objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required (use "" or null where empty); "seedHook" must be non-empty. "sourceIndex" is the 1-based number of the GROUNDING example (from the numbered GROUNDING list in the prompt) whose proven STRUCTURE this idea adapts, or 0 if the idea adapts no specific example — never cite a source you did not actually use (honesty).`;

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
  /**
   * Progress callback fired at the REAL pipeline phase boundaries (Generating → Simulating your
   * audience → Ranking). The route wires this to its SSE `send("stage", …)` so the spine reflects
   * genuine phase timing instead of a single opaque await + a burst at the end. Optional/no-op —
   * absent = unchanged behavior. Honesty spine: fired at true boundaries, never on a fake timer.
   */
  onStage?: (name: string, status: "active" | "done") => void;
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface IdeasPipelineResult {
  /** Up to IDEA_COUNT (4) ranked idea-card blocks, keep-all (0 only on generation/SIM failure). */
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
  /**
   * 1-based grounding-example index this idea adapted (0 = none). Only ever non-zero on a
   * grounded run (the grounded contract requests it); ungrounded runs default it to 0. Drives
   * the on-card receipt via buildProofFromSource (§11f).
   */
  sourceIndex: number;
}

// ─── Qwen generation call ────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate IDEA_COUNT structured ideas.
 * System = KC_IDEAS_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateIdeasStructured(
  userMessage: string,
  grounded: boolean,
): Promise<StructuredIdea[]> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  // Grounded runs use the sourceIndex-carrying contract so ideas can be attributed to the real
  // outlier they adapted; ungrounded runs keep the byte-identical original (warm-cache prefix).
  const outputContract = grounded ? IDEAS_OUTPUT_CONTRACT_GROUNDED : IDEAS_OUTPUT_CONTRACT;

  let raw: string;
  try {
    const res = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: KC_IDEAS_SYSTEM_PROMPT + outputContract },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        enable_thinking: false, // DashScope extension — cast via `as never` below
        max_tokens: 2000,       // safety rail: est. richer × 4 ideas
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
      // Attribution index (grounded runs only) — missing/malformed → 0 (no source) so an
      // ungrounded or sloppy response never fabricates one (§11f honesty spine).
      sourceIndex: coerceSourceIndex(r.sourceIndex),
    });
    if (ideas.length >= IDEA_COUNT) break;
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
 * Returns up to IDEA_COUNT (4) ranked idea-card blocks (keep-all — Weak kept, ranked last).
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

  // ── GROUND (§11f fan-out, gated): pull LIVE outlier teardowns for the topic → the one
  //    additive corpus field. OFF by default; TikTok-only. ANY failure degrades to
  //    ungrounded — corpus stays undefined → byte-identical no-op (honesty spine).
  //    `groundingExamples` maps each idea's sourceIndex back to its outlier (the receipt).
  const { corpus, examples: groundingExamples } = await gatherCorpusForRun({
    enabled: isGroundingEnabled(),
    skill: "ideas", // → the belief↔reality slice: the tension that made the video travel
    platform,
    queryCandidates: [ask, genProfileRow?.niche_primary],
    niche: genProfileRow?.niche_primary ?? null,
    onStage: input.onStage,
    warnings: allWarnings,
  });

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate ideas from my profile",
      platform,
      mode: "idea",
      ...(creatorSteer ? { overrides: creatorSteer } : {}),
      ...(corpus ? { corpus } : {}),
    },
    genProfileRow,
  );

  // Record which path shipped (Open Q1 resolved decision)
  const seedHookPath: "structured" | "markered" = "structured";

  // ── RATE (S3′): ONE batched Flash call scores all candidates ───────────────
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

  // S3′ generate-rate-rank: a rated idea carries everything the rank+build need;
  // personas travel ON it for the FLYWHEEL pin + the per-card modal feed (PR-2).
  interface RatedIdea {
    idea: StructuredIdea;
    band: "Strong" | "Mixed" | "Weak";
    fraction: string;
    scrollQuote: string;
    personas: FlashPersona[];
    generationIndex: number;
  }

  /**
   * S3′ generate-rate-rank: ONE batched SIM call rates ALL candidates, then KEEP them all
   * (ranked) — no Weak cut, no trim. The ONLY drop is a candidate with a missing/invalid
   * reaction (honesty spine — we never fabricate a band). Ranking happens AFTER (D-01 order).
   */
  async function ratePass(ideaBatch: StructuredIdea[]): Promise<RatedIdea[]> {
    // Stable ids = generation index (echoed by the model, mapped back; positional fallback).
    const candidates = ideaBatch.map((idea, i) => ({ id: String(i), text: idea.seedHook }));

    const batch = await runFlashTextModeBatch(
      candidates,
      "idea",
      panel,
      audienceRepaint,
      simIntent,
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      allWarnings.push(`Batched SIM failed for ideas: ${msg}`);
      return null; // hard failure → no cards (no auto-regen; user-pressed rewrite handles retry)
    });
    if (!batch) return [];
    allWarnings.push(...batch.warnings);

    const out: RatedIdea[] = [];

    ideaBatch.forEach((idea, i) => {
      const sim = batch.results.get(String(i));
      if (!sim) {
        allWarnings.push(`SIM produced no reaction for idea "${idea.title}" — dropped`);
        return; // un-scorable → drop (can't show a card with no reaction)
      }

      const personas = sim.personas;
      const { band, fraction } = aggregateFlash(personas, flashWeighting);
      // S3′: NO Weak gate — keep ALL rated bands (rank handles ordering).
      const scrollQuote = selectLeadScrollQuote(personas);

      out.push({ idea, band, fraction, scrollQuote, personas, generationIndex: i });
    });

    return out;
  }

  // Generate exactly IDEA_COUNT ideas (no over-gen buffer — all are shown).
  // ── STAGE: Generating (real boundary — the big LLM call) ──
  input.onStage?.("Generating", "active");
  const firstBatch = await generateIdeasStructured(userMessage, Boolean(corpus));
  input.onStage?.("Generating", "done");
  if (firstBatch.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  // S3′: ONE batched SIM rates all candidates. NO conditional regen (D-06 removed) —
  // keep-all + user-pressed rewrite (PR-3) replaces the auto-regenerate-on-zero loop.
  // ── STAGE: Simulating your audience (real boundary — the batched Flash SIM call) ──
  input.onStage?.("Simulating your audience", "active");
  const rated = await ratePass(firstBatch);
  input.onStage?.("Simulating your audience", "done");

  // ── STAGE: Ranking (real boundary — sort + build; fast) ──
  input.onStage?.("Ranking", "active");

  // ── RANK (keep-all): band tier → fraction → generation order. No Weak cut, no trim
  //    below what was generated; slice(IDEA_COUNT) is a safety bound only. ──
  rated.sort((a, b) => {
    const bandDiff = bandOrdinal(a.band) - bandOrdinal(b.band);
    if (bandDiff !== 0) return bandDiff;
    const fractionDiff =
      parseFractionNumerator(b.fraction) - parseFractionNumerator(a.fraction); // descending
    if (fractionDiff !== 0) return fractionDiff;
    return a.generationIndex - b.generationIndex; // preserve generation order
  });
  const ranked = rated.slice(0, IDEA_COUNT);

  // ── BUILD: assemble idea-card blocks in ranked order ────────────────────────
  const blocks: IdeaCardBlock[] = [];
  for (const candidate of ranked) {
    // §11f receipts-on-cards: attach the frozen receipt for the outlier this idea adapted.
    // null (no source / ungrounded run) → the field is omitted so the block shape stays
    // byte-identical to the pre-grounding card (regression gate + honesty spine).
    const proof = buildProofFromSource(candidate.idea.sourceIndex, groundingExamples);

    const blockData = {
      type: "idea-card" as const,
      props: {
        title: candidate.idea.title,
        angle: candidate.idea.angle,
        whyItFits: groundingLine,   // GROUND-03 (Plan 02)
        mechanism: candidate.idea.mechanism,
        seedHook: candidate.idea.seedHook,
        needsTake: candidate.idea.needsTake,
        topic: candidate.idea.topic,
        take: candidate.idea.take,
        format: candidate.idea.format,
        band: candidate.band,
        fraction: candidate.fraction,
        scrollQuote: candidate.scrollQuote,
        model: "sim1-flash" as const,
        predictedFailureMode: null, // S5: rubric critic removed (was OFF / ~100% fail)
        personas: candidate.personas, // S3′: per-card reaction for the ambient modal (PR-2)
        ...(proof ? { proof } : {}),  // §11f — only when a real source was attributed
        // Did the RUN retrieve anything, regardless of what THIS card cited? Set from the
        // examples, NOT from `proof` — a grounded run where the model attributed nothing is
        // still grounded, and that is exactly the case the card's note explains. Omitted on
        // ungrounded runs so the pre-grounding block shape stays byte-identical.
        ...(groundingExamples.length > 0 ? { grounded: true } : {}),
      },
    };

    // Validate at the runner boundary (D-14 belt-and-suspenders)
    const validated = IdeaCardBlockSchema.safeParse(blockData);
    if (!validated.success) {
      allWarnings.push(
        `idea-card block validation failed for "${candidate.idea.title}": ${validated.error.message}`,
      );
      continue;
    }

    blocks.push(validated.data as IdeaCardBlock);
  }

  // ── STAGE: Ranking (done) — cards are built + ready to stream ──
  input.onStage?.("Ranking", "done");

  // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
  // The predicted vector is computed ONCE from the rank-1 idea's personas (falling back
  // to the first rated idea) and persisted with the run's audience_id — the "predict"
  // half of the moat loop. void (not awaited): never delays card render.
  if (input.pin) {
    const pinnedPersonas = ranked[0]?.personas ?? rated[0]?.personas ?? null;
    if (pinnedPersonas && pinnedPersonas.length > 0) {
      const audienceId = audience && !audience.is_general ? audience.id : null;
      void pinPredictedSignature(input.pin.supabase, pinnedPersonas, {
        audienceId,
        analysisId: input.pin.analysisId ?? null,
      });
    }
  }

  return { blocks, warnings: allWarnings, seedHookPath };
}
