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
import { deriveAudienceArchetype } from "@/lib/tools/hooks/audience-archetype";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { HookCardBlockSchema } from "@/lib/tools/blocks";
import type { HookCardBlock } from "@/lib/tools/blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { resolveNicheKey } from "@/lib/engine/wave3/niche-resolver";
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
  const { ask, platform, profileRow, anchor, audience = null } = input;
  const allWarnings: string[] = [];

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

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate hooks for this idea",
      platform,
      mode: "hooks",
      ...(anchor ? { anchor } : {}),
      ...(audienceOverride ? { overrides: audienceOverride } : {}),
    },
    profileRow,
  );

  const hooks = await generateHooksStructured(userMessage);

  // Record which path shipped (Open Q1 resolved decision — mirrors ideas-runner)
  const seedHookPath: "structured" | "markered" = "structured";

  if (hooks.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  // ── SIM (gate): parallel Flash per candidate ──────────────────────────────
  // Phase 14 (14-01): resolve free-text / sub-slug niche_primary to a top-level
  // NICHE_INSTANTIATION key BEFORE building the panel (KCQ-06/KCQ-01) — otherwise
  // selectPersonaSlots' exact-slug match silently falls back to generic.
  const niche = resolveNicheKey(profileRow?.niche_primary ?? null);
  const panel = { niche, contentType: null } as const;

  // ── REACT path (08-04 / AUD-STEER): resolve audience weights + persona repaint ──
  // resolveAudienceWeights([]) / is_general → DEFAULT mix (no override).
  // The repaint (stored at calibration, not generated per-request — Pitfall 2) feeds Flash.
  const resolvedWeights = resolveAudienceWeights(audience ? [audience] : []);
  void resolvedWeights; // weights wired for future Max-path integration; Flash uses the repaint

  // archetype-slug → repaint map (undefined for General/no audience → byte-identical Flash no-op).
  const audienceRepaint: Record<string, string> | undefined =
    audience && !audience.is_general && audience.personas && audience.personas.length > 0
      ? Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))
      : undefined;

  const simResults = await Promise.all(
    hooks.map((hook) =>
      runFlashTextMode(hook.seedHook ?? hook.hookLine, "hook", panel, audienceRepaint).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        allWarnings.push(`SIM failed for hook "${hook.hookLine.slice(0, 60)}": ${msg}`);
        return null; // null = failed SIM → treat as Weak (drop)
      }),
    ),
  );

  // ── GATE: drop sub-floor candidates ──────────────────────────────────────
  interface SurvivorCandidate {
    hook: StructuredHook;
    band: "Strong" | "Mixed" | "Weak";
    fraction: string;
    scrollQuote: string;
    audienceArchetype: string;
    generationIndex: number; // preserves generation order for tie-break
  }

  const survivors: SurvivorCandidate[] = [];

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    const simResult = simResults[i];

    if (!hook) continue; // type guard
    if (simResult === null || simResult === undefined) continue; // SIM failed → drop

    const personas = simResult.result.personas;
    const { band, fraction } = aggregateFlash(personas);

    // GATE FLOOR (Plan-01 handoff): band !== "Weak" (stops >= MIXED_THRESHOLD)
    if (band === "Weak") continue;

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

    survivors.push({ hook, band, fraction, scrollQuote, audienceArchetype, generationIndex: i });
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
  // the first SIM that resolved so a run that fired the SIM always pins a vector.
  // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
  if (input.pin) {
    let pinnedPersonas: FlashPersona[] | null = null;
    const lead = ranked[0];
    if (lead) {
      const leadSim = simResults[lead.generationIndex];
      if (leadSim) pinnedPersonas = leadSim.result.personas;
    }
    if (!pinnedPersonas) {
      const firstSim = simResults.find((s) => s != null);
      if (firstSim) pinnedPersonas = firstSim.result.personas;
    }
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
