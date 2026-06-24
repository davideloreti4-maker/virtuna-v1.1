/**
 * hooks-runner.ts — Hooks pipeline orchestrator (Plan 04-02, Task 1).
 *
 * Replicates the ideas-runner.ts stage structure, adding a RANK step after the gate.
 * This is "GATE THEN RANK" (D-01): unlike ideas (gate, no rank), hooks are atomic,
 * discriminable first-2s units — ranking them is legitimate and IS the demo.
 *
 * Pipeline stages:
 *
 * 1. GENERATE: assembleBundle(mode:"hooks", anchor) → user message; system = KC_HOOKS_SYSTEM_PROMPT.
 *    Structured json_object generation of ~8 distinct-mechanism hooks (HOOKS_OUTPUT_CONTRACT).
 *    Each hook carries: hookLine, mechanism, seedHook, channel?, needsTake?
 *
 * 2. SIM (gate): runFlashTextMode(seedHook ?? hookLine, "hook", { niche, contentType: null })
 *    per candidate in Promise.all (parallel). aggregateFlash → {band, fraction}.
 *    Lead scrollQuote + audienceArchetype selected NOW (D-02/D-03, WARNING-4).
 *
 * 3. GATE: drop candidates where band === "Weak" (Plan-01 GATE FLOOR — band !== "Weak").
 *
 * 4. RANK + TRIM (D-01 addition): order survivors by:
 *    - Primary: band tier (Strong > Mixed; ordinal: Strong=0, Mixed=1)
 *    - Secondary: audience-fraction stop-count descending (parse "N/10 stop" numerator)
 *    - Tie-break beyond: preserve generation order (first generated = first ranked)
 *    Assign rank = index + 1 after sort. Keep top MAX_HOOKS (= 5, D-08).
 *
 * 5. BUILD: assemble hook-card blocks (Plan 01 prop names). Validate via
 *    HookCardBlockSchema.safeParse (D-14 belt-and-suspenders).
 *
 * RANKING IS QUALITATIVE (D-02): band word + fraction + sim1-flash tag ONLY.
 * NO fabricated numeric pull-score, NO view-count promise (ENGINE-03).
 *
 * ISOLATION: imports ONLY from its declared dependency surface.
 *   - assembler.ts (assembleBundle)
 *   - compiled.ts (KC_HOOKS_SYSTEM_PROMPT)
 *   - qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED)
 *   - flash/run-flash-text-mode.ts (runFlashTextMode)
 *   - flash/flash-aggregate.ts (aggregateFlash, MIXED_THRESHOLD)
 *   - flash/rubric-critic.ts (critiqueAgainstRubric) — 14-02 best-of-N + flop pass (KCQ-02/04/07)
 *   - engine/wave3/niche-resolver.ts (resolveNicheKey) — 14-01 niche-layer fix (KCQ-06/KCQ-01)
 *   - tools/hooks/audience-archetype.ts (deriveAudienceArchetype)
 *   - tools/blocks.ts (HookCardBlockSchema, HookCardBlock)
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_HOOKS_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash, MIXED_THRESHOLD } from "@/lib/engine/flash/flash-aggregate";
import { critiqueAgainstRubric, isRubricCriticEnabled, type RubricVerdict } from "@/lib/engine/flash/rubric-critic";
import { deriveAudienceArchetype } from "@/lib/tools/hooks/audience-archetype";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
import { buildFlashWeighting } from "@/lib/engine/flash/persona-weighting";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { HookCardBlockSchema } from "@/lib/tools/blocks";
import type { HookCardBlock } from "@/lib/tools/blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { pinPredictedSignature, type RunnerPinContext } from "./flash-runner";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Over-generate buffer: ~8 hooks to get N=5 survivors (D-08, D-03). */
const HOOK_BUFFER = 8;

/** Max survivors to keep after gate + rank (D-08). */
const MAX_HOOKS = 5;

/** Generation call timeout (mirrors ideas-runner). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Output-serialization contract — owned by the runner because the runner owns
 * `response_format: json_object`. DashScope/Qwen rejects json_object mode with a
 * 400 ("messages must contain the word 'json'") unless the literal word appears
 * in the messages; the compiled KC prompt is pure craft knowledge and carries no
 * serialization directive, so the contract lives here (mirrors IDEAS_OUTPUT_CONTRACT
 * pattern — 03-04 bug #3).
 *
 * Requests DISTINCT-mechanism hooks (intra-batch diversity per corpus/hooks.md §4A).
 * Each hookLine is an executable hook (verbatim line / named shot / caption / cut-or-sound cue).
 * mechanism is PROSE reasoning — NOT a craft-archetype slug (D-04).
 * No craft-archetype slug field requested in the output shape (D-04).
 */
const HOOKS_OUTPUT_CONTRACT = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "hooks": [ { "hookLine": string, "mechanism": string, "seedHook": string, "channel": string | null, "needsTake": boolean } ] }
Return a "hooks" array of approximately ${HOOK_BUFFER} objects, each using a DISTINCT attention mechanism. Every field is required; "hookLine" and "seedHook" must be non-empty. "mechanism" is plain-prose reasoning — never a bracket-tag. "channel" is the delivery channel (spoken/visual/caption/edit/audio) or null.`;

// ─── Input type ───────────────────────────────────────────────────────────────

export interface HooksPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
  /** Upstream idea anchor (the "what to make" concept this Hooks run develops). */
  anchor?: string;
  /**
   * Active audience for this run (08-04 — steer closure, AUD-STEER; mirrors 07-04 ideas-runner).
   * null or is_general → falls back to profile-based grounding + DEFAULT weights
   * (byte-identical no-op for General — regression gate preserved).
   */
  audience?: Audience | null;
  /**
   * Per-run reaction lens (GAP-C2 / §P.10). `sell` re-frames the SIM verdict toward purchase
   * intent; `grow`/undefined → byte-identical no-op. Only applied for a calibrated audience
   * (General/no-audience → forced undefined below, regression gate preserved).
   */
  intent?: IntentLens;
  /**
   * FLYWHEEL-02: when present, pin the run's predicted disposition vector post-SIM
   * (rank-1 hook's personas) + audience_id. Non-fatal — never blocks the cards.
   */
  pin?: RunnerPinContext;
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface HooksPipelineResult {
  /** Up to MAX_HOOKS (5) validated hook-card blocks (may be 0 if all sub-floor). */
  blocks: HookCardBlock[];
  /** Warnings from Flash SIM calls or validation. */
  warnings: string[];
  /** Which seed-hook extraction path shipped (Open Q1 resolved decision). */
  seedHookPath: "structured" | "markered";
}

// ─── Structured hook type ─────────────────────────────────────────────────────

/**
 * Structured json_object shape for hook generation.
 * KC_HOOKS_SYSTEM_PROMPT is instructed to return JSON with a `hooks` array.
 */
interface StructuredHook {
  hookLine: string;
  mechanism: string;
  seedHook: string;
  channel: string | null;
  needsTake: boolean;
}

// ─── Qwen generation call ─────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate ~HOOK_BUFFER structured hooks.
 * System = KC_HOOKS_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateHooksStructured(userMessage: string): Promise<StructuredHook[]> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let raw: string;
  try {
    const res = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: KC_HOOKS_SYSTEM_PROMPT + HOOKS_OUTPUT_CONTRACT },
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
        ? `generateHooksStructured: aborted (timeout ${GENERATE_TIMEOUT_MS}ms)`
        : `generateHooksStructured: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `generateHooksStructured: JSON.parse failed on model output: ${raw.slice(0, 200)}`,
    );
  }

  // Extract hooks array — model may return { hooks: [...] } or bare array
  const obj = parsed as { hooks?: unknown } | null;
  const arr = Array.isArray(obj?.hooks)
    ? (obj!.hooks as unknown[])
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];

  if (arr.length === 0) {
    return [];
  }

  // Coerce and filter to structurally valid hooks
  const hooks: StructuredHook[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.hookLine !== "string" || !r.hookLine) continue;
    if (typeof r.seedHook !== "string" || !r.seedHook) continue;
    hooks.push({
      hookLine: r.hookLine,
      mechanism: typeof r.mechanism === "string" ? r.mechanism : "",
      seedHook: r.seedHook,
      channel:
        typeof r.channel === "string" && r.channel.trim().length > 0 ? r.channel : null,
      needsTake: typeof r.needsTake === "boolean" ? r.needsTake : false,
    });
    if (hooks.length >= HOOK_BUFFER) break;
  }

  return hooks;
}

// ─── Lead scroll-quote selector (mirrors ideas-runner) ──────────────────────

/**
 * Select the lead scroll-quote from the SIM personas.
 * D-02: the quote ships ON the card face, never deferred.
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

// ─── Rank comparator helpers ──────────────────────────────────────────────────

/**
 * Band tier ordinal: lower = higher rank (Strong ranks before Mixed).
 * D-01: Strong > Mixed (Weak is already gated out before ranking).
 */
function bandOrdinal(band: "Strong" | "Mixed" | "Weak"): number {
  if (band === "Strong") return 0;
  if (band === "Mixed") return 1;
  return 2; // Weak — should not reach here after gate
}

/**
 * Parse the stop-count numerator from a fraction string (e.g. "6/10 stop" → 6).
 * Returns 0 on parse failure.
 */
function parseFractionNumerator(fraction: string): number {
  const match = /^(\d+)\//.exec(fraction);
  if (!match || !match[1]) return 0;
  const n = parseInt(match[1], 10);
  return isNaN(n) ? 0 : n;
}

// ─── runHooksPipeline ─────────────────────────────────────────────────────────

/**
 * Full Hooks pipeline: over-generate → parallel niche SIM → gate → rank → top-5 hook-card blocks.
 *
 * Returns up to MAX_HOOKS (5) validated hook-card blocks ranked by band tier → fraction.
 * Returns 0 blocks if all hooks score Weak (valid, no regen — D-03).
 *
 * @param input.ask         Creator's ask (seeded topic; defaults to anchor-only mode when empty).
 * @param input.platform    Target platform.
 * @param input.profileRow  Creator profile (null = cold-start, never blocks on onboarding).
 * @param input.anchor      Upstream idea concept (optional; fenced via assembleBundle).
 */
export async function runHooksPipeline(input: HooksPipelineInput): Promise<HooksPipelineResult> {
  const { ask, platform, profileRow, anchor, audience = null, intent } = input;
  const allWarnings: string[] = [];
  // GAP-C2: the sell lens only applies for a calibrated audience; General/no-audience → undefined
  // (byte-identical no-op, regression gate). `grow` is also a no-op in buildFlashUserContent.
  const simIntent: IntentLens | undefined =
    audience && !audience.is_general ? intent : undefined;

  // ── GATE FLOOR ASSERTION (WARNING-3: fail loud if MIXED_THRESHOLD unreachable) ──
  if (typeof MIXED_THRESHOLD !== "number" || isNaN(MIXED_THRESHOLD)) {
    throw new Error(
      "runHooksPipeline: MIXED_THRESHOLD is not a valid number — Plan-01 gate floor handoff missing or corrupt. " +
        "Do NOT proceed; complete 04-01-SUMMARY.md first. (WARNING-3)",
    );
  }

  // ── STEER (08-04 / AUD-STEER): audience-grounding line replaces buildGroundingLine ──
  // buildAudienceGroundingLine delegates to buildGroundingLine for General/null (no-op).
  // For a calibrated audience the line is folded into assembleBundle.overrides so
  // generation targets the active audience (undefined override for General → byte-identical).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  const audienceOverride = isCalibrated ? `Generate for this audience — ${groundingLine}` : undefined;

  // ── §P step-7: creator voice (fallback) + steer from the per-audience creator_persona ──
  // genProfileRow may carry a voice backfilled from creator_persona.writing_style_sample;
  // creatorSteer folds who's writing into overrides. General/no-audience → inputs unchanged.
  const { profileRow: genProfileRow, creatorSteer } = applyCreatorPersona(profileRow, audience);
  const overrides = [audienceOverride, creatorSteer].filter(Boolean).join("\n") || undefined;

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate hooks for this idea",
      platform,
      mode: "hooks",
      ...(anchor ? { anchor } : {}),
      ...(overrides ? { overrides } : {}),
    },
    genProfileRow,
  );

  // Record which path shipped (Open Q1 resolved decision — mirrors ideas-runner)
  const seedHookPath: "structured" | "markered" = "structured";

  // ── SIM (gate): parallel Flash per candidate ──────────────────────────────
  // Niche panel + audience repaint via the shared buildReactionPanel helper (Plan 13-01):
  // resolveNicheKey normalizes free-text/sub-slug niche_primary to a top-level
  // NICHE_INSTANTIATION key BEFORE the panel (14-01 / KCQ-06/KCQ-01 — otherwise
  // selectPersonaSlots' exact-slug match silently falls back to generic); audienceRepaint is
  // undefined for General/no-audience → runFlashTextMode omits the arg → byte-identical no-op.
  // POST /api/tools/react reuses the SAME helper (RESEARCH Open Q1 / Pitfall 2).
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── REACT path (A1 — weighted SIM aggregation): build the optional Flash weighting ──
  // General / null / no-override → undefined → flat band (byte-identical, regression gate).
  // Calibrated audience → per-slot persona_weights bias the weighted stop-MASS band gate.
  // SIM call + repaint (built above) UNTOUCHED — only the post-SIM band math is weighted.
  const flashWeighting = buildFlashWeighting(audience ?? null);

  // ── GATE: a survivor candidate carries everything the rank+build need ──────
  // personas travel ON the candidate (not via a parallel simResults array) so the
  // FLYWHEEL pin survives the conditional regeneration without index bookkeeping.
  interface SurvivorCandidate {
    hook: StructuredHook;
    band: "Strong" | "Mixed" | "Weak";
    fraction: string;
    scrollQuote: string;
    audienceArchetype: string;
    predictedFailureMode: string | null; // KCQ-04 (null on clean pass)
    personas: FlashPersona[];             // for the FLYWHEEL-02 pin
    generationIndex: number;              // preserves generation order for tie-break
  }

  /**
   * 14-02 best-of-N + flop pass: over-generate → PARALLEL { SIM band + rubric
   * critic } per candidate → combined gate. SIM + critic run in the SAME Promise.all
   * entry so wall-clock stays ~1x (D-05 — never serial). Combined gate (KCQ-05 +
   * KCQ-02): keep iff band !== "Weak" AND verdict.pass. predictedFailureMode (KCQ-04)
   * rides onto each survivor for the 14-04 drill-reveal. Ranking happens AFTER, on the
   * returned survivors (D-01 gate-then-rank preserved).
   */
  async function gateHooks(hookBatch: StructuredHook[]): Promise<SurvivorCandidate[]> {
    // P13: when the rubric critic is OFF (default), skip the call entirely — no extra
    // API hit, no regen-on-zero doubling — and gate on the SIM band alone. A forced
    // pass verdict makes the combined gate below collapse to `band !== "Weak"`.
    const criticEnabled = isRubricCriticEnabled();
    const PASS_VERDICT: RubricVerdict = { pass: true, predictedFailureMode: null };
    const judged = await Promise.all(
      hookBatch.map(async (hook, i) => {
        const seed = hook.seedHook ?? hook.hookLine;
        const [simResult, verdict] = await Promise.all([
          runFlashTextMode(seed, "hook", panel, audienceRepaint, simIntent).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            allWarnings.push(`SIM failed for hook "${hook.hookLine.slice(0, 60)}": ${msg}`);
            return null; // null = failed SIM → treat as Weak (drop)
          }),
          criticEnabled
            ? critiqueAgainstRubric(seed, "hook", panel) // fail-safe internally (never throws)
            : Promise.resolve(PASS_VERDICT),
        ]);
        return { hook, simResult, verdict, generationIndex: i };
      }),
    );

    const out: SurvivorCandidate[] = [];
    let abstainedKept = 0; // WR-01: candidates kept on band-only because the critic abstained

    for (const { hook, simResult, verdict, generationIndex } of judged) {
      if (simResult === null || simResult === undefined) continue; // SIM failed → drop

      const personas = simResult.result.personas;
      const { band, fraction } = aggregateFlash(personas, flashWeighting);

      // COMBINED GATE (KCQ-05 + KCQ-02): band !== "Weak" AND the rubric critic passed.
      if (band === "Weak") continue;
      // WR-01: a critic ABSTENTION (infra failure — timeout/429/parse) is NOT a quality
      // FAIL. Hard-dropping both identically lets a transient critic outage silently zero
      // a SIM-Strong thread with no diagnostic. On abstention, degrade to the band-only
      // gate (the candidate already cleared band !== "Weak") and surface a warning.
      if (verdict.abstained) {
        abstainedKept++;
      } else if (!verdict.pass) {
        continue;
      }

      // D-02: select lead scrollQuote NOW — ships on the card face (WARNING-4)
      const scrollQuote = selectLeadScrollQuote(personas);

      // D-03: derive audience archetype tag (audience persona, never craft slug — D-04)
      const audienceArchetype = deriveAudienceArchetype(
        personas.map((p) => ({
          archetype: p.archetype,
          verdict: p.verdict as "stop" | "scroll",
          quote: p.quote,
        })),
      );

      out.push({
        hook,
        band,
        fraction,
        scrollQuote,
        audienceArchetype,
        predictedFailureMode: verdict.predictedFailureMode,
        personas,
        generationIndex,
      });
    }

    // WR-01: one aggregated warning when the critic was unavailable, so a degraded
    // run is observable (not a silent band-only pass mislabelled as a quality pass).
    if (abstainedKept > 0) {
      allWarnings.push(
        `Quality critic unavailable for ${abstainedKept} hook candidate(s) — kept on SIM band only (critic degraded, not a quality pass).`,
      );
    }

    return out;
  }

  // First over-generate batch.
  const firstBatch = await generateHooksStructured(userMessage);
  if (firstBatch.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  let survivors = await gateHooks(firstBatch);

  // ── CONDITIONAL REGEN (D-06): regenerate ONCE only when ZERO candidates pass ──
  // Never an unbounded serial loop — one extra parallel over-generate + critique
  // pass, then proceed with whatever survives (may still be 0 — "0 blocks is valid").
  if (survivors.length === 0) {
    const secondBatch = await generateHooksStructured(userMessage);
    if (secondBatch.length > 0) {
      survivors = await gateHooks(secondBatch);
    }
  }

  // ── RANK + TRIM (D-01): order by band tier → fraction, keep top MAX_HOOKS ──
  // Primary: band tier (Strong=0 > Mixed=1)
  // Secondary: stop-count descending (numerator of fraction string)
  // Tie-break: preserve generation order (lower generationIndex ranks first)
  survivors.sort((a, b) => {
    const bandDiff = bandOrdinal(a.band) - bandOrdinal(b.band);
    if (bandDiff !== 0) return bandDiff;
    const fractionDiff =
      parseFractionNumerator(b.fraction) - parseFractionNumerator(a.fraction); // descending
    if (fractionDiff !== 0) return fractionDiff;
    return a.generationIndex - b.generationIndex; // preserve generation order
  });

  const ranked = survivors.slice(0, MAX_HOOKS);

  // ── BUILD: assemble hook-card blocks with rank ──────────────────────────────
  const blocks: HookCardBlock[] = [];

  for (let rank = 1; rank <= ranked.length; rank++) {
    const candidate = ranked[rank - 1];
    if (!candidate) continue;

    const blockData = {
      type: "hook-card" as const,
      props: {
        hookLine: candidate.hook.hookLine,
        audienceArchetype: candidate.audienceArchetype,
        mechanism: candidate.hook.mechanism,
        seedHook: candidate.hook.seedHook,
        rank,
        band: candidate.band,
        fraction: candidate.fraction,
        scrollQuote: candidate.scrollQuote,
        model: "sim1-flash" as const,
        channel: candidate.hook.channel,
        predictedFailureMode: candidate.predictedFailureMode, // KCQ-04 (null on clean pass)
      },
    };

    // D-14 belt-and-suspenders validation at the runner boundary
    const validated = HookCardBlockSchema.safeParse(blockData);
    if (!validated.success) {
      allWarnings.push(
        `hook-card block validation failed for hook "${candidate.hook.hookLine.slice(0, 60)}": ${validated.error.message}`,
      );
      continue;
    }

    blocks.push(validated.data as HookCardBlock);
  }

  // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
  // Pin the rank-1 hook's personas (the hook most likely posted), falling back to
  // the first survivor that resolved so a run that produced any survivor pins a vector.
  // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
  if (input.pin) {
    const pinnedPersonas = ranked[0]?.personas ?? survivors[0]?.personas ?? null;
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
