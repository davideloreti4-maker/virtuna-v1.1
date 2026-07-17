/**
 * script-runner.ts — Script pipeline orchestrator (Plan 06-03, Task 1).
 *
 * Clones hooks-runner.ts structure with D-02 one-card (not N) and D-01 opener-only gate.
 *
 * Pipeline stages:
 *
 * 1. GENERATE: assembleBundle(mode:"script", anchor) → user message; system = KC_SCRIPT_SYSTEM_PROMPT.
 *    Structured json_object generation of ONE script: { beats[{label,content,timing,retentionMarker}], openingBeatSeed }
 *    openingBeatSeed = the first-2s line fed to the Flash opener gate.
 *
 * 2. SELF-JUDGE: bounded gate — drop sub-floor generation rather than fabricate.
 *    If beats array is empty or malformed, return { blocks: [], warnings }.
 *
 * 3. GATE (D-01 — OPENER ONLY): runFlashTextMode(script.openingBeatSeed, "hook", panel)
 *    → aggregateFlash(personas) → {band, fraction}.
 *    This scores ONLY the opening hook beat — NEVER the full script (honesty spine / Pitfall 5).
 *    If the SIM fails, push a warning and drop (mirror hooks null handling).
 *
 * 4. BUILD: assemble the script-card block. Validate via ScriptCardBlockSchema.safeParse (D-14).
 *    On failure push a warning + drop. Return { blocks, warnings } (0 or 1 block).
 *
 * D-02 ONE-CARD: Script returns exactly ONE script-card per run (not N candidates).
 *   This is "ONE-CARD" not "GATE THEN RANK" — the model writes one complete script.
 *
 * OPENER-ONLY HONESTY (D-01 / Pitfall 5):
 *   band/fraction describe the OPENING BEAT only — never fabricated as a full-watch score.
 *   The renderer must show "opener stops the scroll" copy, never "your script will perform...".
 *
 * ISOLATION: imports ONLY from its declared dependency surface.
 *   - assembler.ts (assembleBundle)
 *   - compiled.ts (KC_SCRIPT_SYSTEM_PROMPT)
 *   - qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED)
 *   - flash/run-flash-text-mode.ts (runFlashTextMode)
 *   - flash/flash-aggregate.ts (aggregateFlash)
 *   - tools/blocks.ts (ScriptCardBlockSchema, ScriptCardBlock)
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_SCRIPT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash } from "@/lib/engine/flash/flash-aggregate";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
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
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { ScriptCardBlockSchema } from "@/lib/tools/blocks";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
import { pinPredictedSignature, type RunnerPinContext } from "./predicted-pin";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import { buildProofFromSource, coerceSourceIndex } from "./build-proof";
import { resolveSingleTarget, type PersonaTarget } from "@/lib/audience/select-persona-targets";
import {
  buildTargetAssignments,
  normalizeTargetArchetype,
  bindTarget,
  type TargetUnitCopy,
} from "./target-assignment";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Generation call timeout (mirrors hooks-runner). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Grounding gate (§11f fan-out — mirrors GROUNDING_HOOKS_ENABLED). OFF by default —
 * grounding prepends a live scrape + survivor profile-scrapes + a teardown LLM call
 * (~25s + Apify cost) BEFORE generation, so it ships behind an env flag until live-proven.
 * TikTok-only in MVP (the gather path is clockworks); IG native is the documented fast-follow.
 */
function isGroundingEnabled(): boolean {
  return process.env.GROUNDING_SCRIPT_ENABLED === "true";
}

/**
 * Output-serialization contract — owned by the runner because the runner owns
 * `response_format: json_object`. DashScope/Qwen rejects json_object mode with a
 * 400 ("messages must contain the word 'json'") unless the literal word appears
 * in the messages (Pitfall 3). Mirrors HOOKS_OUTPUT_CONTRACT pattern.
 *
 * D-02: ONE script (beats+timing+retention), no array of scripts.
 * openingBeatSeed = the first-2s opener hook — fed to the Flash gate (D-01).
 */
const SCRIPT_OUTPUT_CONTRACT = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string } ], "openingBeatSeed": string }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat.`;

/**
 * Grounded output contract (§11f fan-out — mirrors HOOKS_OUTPUT_CONTRACT_GROUNDED). Used ONLY
 * when a corpus grounding block was injected (grounding ON + real examples found). Adds ONE
 * top-level field — `sourceIndex` — so the script reports WHICH grounding example (1-based, or
 * 0 for none) its structure adapts (one script → at most one attribution). That integer is the
 * link the on-card receipt is built from (sourceIndex → RetrievedExample → proof). The
 * ungrounded contract above is kept byte-identical (warm-cache prefix + regression gate).
 */
const SCRIPT_OUTPUT_CONTRACT_GROUNDED = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string } ], "openingBeatSeed": string, "sourceIndex": number }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat. "sourceIndex" is the 1-based number of the GROUNDING example (from the numbered GROUNDING list in the prompt) whose proven STRUCTURE this script adapts, or 0 if it adapts no specific example — never cite a source you did not actually use (honesty).`;

/**
 * PER-PERSONA GENERATION (fan-out from hooks #299) — the craft half of the assignment.
 *
 * ⚠️ A SCRIPT IS NOT A HOOK, AND THIS IS WHERE THAT BITES. A hook is one atomic line: a person's
 * whole psychology can fit in eight words, and the assignment has nowhere to hide. A script is five
 * beats — the per-person difference has to survive an arc, and it may simply WASH OUT. Worse, aiming
 * five beats at a 5%-share segment could make the script worse for everyone else.
 *
 * 🔴 MEASURED 2026-07-15 — IT DOES NOT TRANSFER, AND SO IT IS NOT SHIPPED. `scripts/measure-targeting.ts
 * script` ran the real pipeline: a blind judge scored the targeted arm 6.7% (1/15) — BELOW the 20%
 * chance floor and IDENTICAL to the written-for-nobody control (6.7%). The binding itself worked (5/5
 * named a target every trial): the model wrote for the assigned person and named them back. The
 * DIFFERENTIATION is what failed — five beats wash the per-persona signal out exactly as feared. This
 * is a FINDING, not a failure, and "it doesn't transfer" was always an allowed answer.
 *
 * So this capability is DORMANT: no route passes `targetArchetype` to `runScriptPipeline`, an
 * untargeted call is byte-identical to before, and no script card ever renders a target line. It is
 * kept — not reverted — so the harness stays runnable for a future re-measure (a different-family
 * judge, off-niche asks, or per-beat granularity) without rebuilding the plumbing. DO NOT wire it to
 * a route or the UI until a measurement clears it. Ideas, by contrast, DID transfer (75% vs a 21%
 * control) and shipped.
 */
const SCRIPT_UNIT: TargetUnitCopy = {
  noun: "Script",
  craft: `Write every beat for THIS person — the setup they need (and the setup they do not), the turn they
would not see coming, the payoff they actually came for, and a CTA they would plausibly do. A script
that would hold any segment of the audience equally well has failed its assignment. Do not hedge
toward the middle.`,
};

/**
 * Output contract for a targeted (calibrated) run — adds the one field that carries the binding.
 *
 * The echo-back is kept even though WE choose the person here (unlike hooks/ideas, where the model
 * picks from a cast). It is not redundant: it is the tripwire. A writer that ignored the brief hands
 * back a slug we never assigned — or nothing — and the card then carries NO target line instead of a
 * generic script wearing somebody's name.
 */
function targetedOutputContract(grounded: boolean): string {
  const groundedField = grounded ? `, "sourceIndex": number` : "";
  const groundedRule = grounded
    ? ` "sourceIndex" is the 1-based number of the GROUNDING example whose proven STRUCTURE this script adapts, or 0 if none — never cite a source you did not actually use (honesty).`
    : "";

  return `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string } ], "openingBeatSeed": string, "targetArchetype": string${groundedField} }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat. "targetArchetype" is the bare slug of the person this script was written for.${groundedRule}`;
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ScriptPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
  /** Upstream hook anchor — the chosen hookLine carried from Hooks→Script (optional). */
  anchor?: string;
  /**
   * PER-PERSONA GENERATION: the reader this script is written for — normally INHERITED from the
   * hook the creator picked (that hook's `target.archetype`), so the script develops the chosen
   * hook for the same person instead of quietly re-aiming at someone else.
   *
   * Absent on a standalone /script run → the biggest eligible segment (resolveSingleTarget).
   * Names a persona this audience cannot bind → NO target, and the card simply carries no line
   * (we never substitute a different person behind the caller's back).
   */
  targetArchetype?: string;
  /**
   * Active audience for this run (08-04 — steer closure, AUD-STEER; mirrors 07-04 ideas-runner).
   * null or is_general → profile-based grounding + DEFAULT weights (byte-identical no-op).
   */
  audience?: Audience | null;
  /**
   * Per-run reaction lens (GAP-C2 / §P.10). `sell` re-frames the opener-SIM verdict toward
   * purchase intent; `grow`/undefined → byte-identical no-op. Calibrated-audience only (gated below).
   */
  intent?: IntentLens;
  /**
   * FLYWHEEL-02: when present, pin the run's predicted disposition vector (the
   * opener's personas) + audience_id post-SIM. Non-fatal — never blocks the card.
   */
  pin?: RunnerPinContext;
  /**
   * Progress callback fired at the REAL pipeline phase boundaries (Generating → Simulating your
   * audience). Wired to the route's SSE `send("stage", …)` so the spine reflects genuine phase
   * timing. Optional/no-op — absent = unchanged. Honesty spine: true boundaries, no fake timer.
   */
  onStage?: (name: string, status: "active" | "done") => void;
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface ScriptPipelineResult {
  /** 0 or 1 validated script-card block (D-02 one-card). */
  blocks: ScriptCardBlock[];
  /** Warnings from Flash SIM calls or schema validation. */
  warnings: string[];
}

// ─── Structured script type ───────────────────────────────────────────────────

interface StructuredBeat {
  label: string;
  content: string;
  timing: string;
  retentionMarker: string;
}

interface StructuredScript {
  beats: StructuredBeat[];
  openingBeatSeed: string;
  /**
   * 1-based grounding-example index this script adapted (0 = none). Only ever non-zero on a
   * grounded run (the grounded contract requests it); ungrounded runs default it to 0. Drives
   * the on-card receipt via buildProofFromSource (§11f).
   */
  sourceIndex: number;
  /**
   * PER-PERSONA GENERATION: the archetype slug of the person this script was written for, as
   * reported BY THE MODEL. Empty string = the model named nobody (or an unassigned slug) — the
   * card then carries no target line at all. A writer that ignored its brief must show up as a
   * MISSING claim, never as a generic script wearing a personalised label.
   */
  targetArchetype: string;
}

// ─── Qwen generation call ─────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate ONE structured script.
 * System = KC_SCRIPT_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateScriptStructured(
  userMessage: string,
  grounded: boolean,
  targeted: boolean,
): Promise<StructuredScript | null> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  // Targeted (calibrated) runs swap in the contract that carries `targetArchetype` — the field that
  // makes the persona binding STRUCTURAL rather than ambient (see SCRIPT_UNIT). General and
  // uncalibrated keep the byte-identical original (warm-cache prefix + regression gate).
  // Grounded runs carry sourceIndex so the script can be attributed to the outlier it adapted.
  const outputContract = targeted
    ? targetedOutputContract(grounded)
    : grounded
      ? SCRIPT_OUTPUT_CONTRACT_GROUNDED
      : SCRIPT_OUTPUT_CONTRACT;

  let raw: string;
  try {
    const res = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: KC_SCRIPT_SYSTEM_PROMPT + outputContract },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        enable_thinking: false, // DashScope extension — cast via `as never` below
        max_tokens: 2000,       // safety rail: script beats est.
      } as never,
      { signal: controller.signal },
    );
    raw = res.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(
      error.name === "AbortError"
        ? `generateScriptStructured: aborted (timeout ${GENERATE_TIMEOUT_MS}ms)`
        : `generateScriptStructured: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `generateScriptStructured: JSON.parse failed on model output: ${raw.slice(0, 200)}`,
    );
  }

  const obj = parsed as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") return null;

  // Coerce and validate structure
  const rawBeats = Array.isArray(obj.beats) ? (obj.beats as unknown[]) : [];
  if (rawBeats.length === 0) return null;

  const beats: StructuredBeat[] = [];
  for (const rawBeat of rawBeats) {
    if (!rawBeat || typeof rawBeat !== "object") continue;
    const b = rawBeat as Record<string, unknown>;
    if (
      typeof b.label !== "string" || !b.label ||
      typeof b.content !== "string" || !b.content ||
      typeof b.timing !== "string" || !b.timing ||
      typeof b.retentionMarker !== "string" || !b.retentionMarker
    ) continue;
    beats.push({
      label: b.label,
      content: b.content,
      timing: b.timing,
      retentionMarker: b.retentionMarker,
    });
  }

  if (beats.length === 0) return null;

  // openingBeatSeed must be a non-empty string
  const openingBeatSeed =
    typeof obj.openingBeatSeed === "string" && obj.openingBeatSeed.trim().length > 0
      ? obj.openingBeatSeed
      : beats[0]?.content ?? "";

  if (!openingBeatSeed) return null;

  // Attribution index (grounded runs only) — missing/malformed → 0 (no source) so an
  // ungrounded or sloppy response never fabricates one (§11f honesty spine).
  return {
    beats,
    openingBeatSeed,
    sourceIndex: coerceSourceIndex(obj.sourceIndex),
    // Whom the model SAYS it wrote this for. Not trusted yet — validated against the assignment
    // below, because a slug we never assigned is not a person we can name.
    targetArchetype: normalizeTargetArchetype(obj.targetArchetype),
  };
}

// ─── Lead scroll-quote selector (mirrors hooks-runner) ────────────────────────

/**
 * Select the lead scroll-quote from the SIM personas.
 * D-04: the quote ships ON the card face, never deferred.
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

// ─── runScriptPipeline ────────────────────────────────────────────────────────

/**
 * Full Script pipeline: generate ONE script → self-judge → opener-only Flash gate → script-card block.
 *
 * Returns 0 or 1 validated script-card block.
 * Returns 0 blocks if generation sub-floors, SIM fails, or schema validation fails.
 *
 * @param input.ask         Creator's ask (defaults to anchor-only mode when empty).
 * @param input.platform    Target platform.
 * @param input.profileRow  Creator profile (null = cold-start, never blocks on onboarding).
 * @param input.anchor      Upstream hook anchor — the chosen hookLine from Hooks→Script.
 */
export async function runScriptPipeline(input: ScriptPipelineInput): Promise<ScriptPipelineResult> {
  const { ask, platform, profileRow, anchor, audience = null, intent, targetArchetype } = input;
  // GAP-C2: sell lens applies only for a calibrated audience (General → undefined no-op).
  const simIntent: IntentLens | undefined =
    audience && !audience.is_general ? intent : undefined;
  const allWarnings: string[] = [];

  // ── STEER (08-04 / AUD-STEER): audience-grounding line replaces buildGroundingLine ──
  // Calibrated audience → fold the audience-facing line into assembleBundle.overrides so
  // the script is written FOR the active audience. General/null → undefined (byte-identical).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  const audienceOverride = isCalibrated ? `Write for this audience — ${groundingLine}` : undefined;

  // ── §P step-7: creator voice (fallback) + steer from the per-audience creator_persona ──
  // genProfileRow may carry a voice backfilled from creator_persona.writing_style_sample;
  // creatorSteer folds who's writing into overrides. General/no-audience → inputs unchanged.
  const { profileRow: genProfileRow, creatorSteer } = applyCreatorPersona(profileRow, audience);

  // ── TARGET (per-persona generation, fan-out from hooks #299): WHO this script is for ──────
  // ONE card ⇒ ONE reader (D-02). Normally the person the CHOSEN HOOK was written for, carried in
  // by the route; standalone → the biggest eligible segment. null for General/uncalibrated, and
  // null when the caller named somebody this audience cannot bind — we never silently retarget.
  const target: PersonaTarget | null = resolveSingleTarget(
    audience,
    targetArchetype ? normalizeTargetArchetype(targetArchetype) : undefined,
  );
  if (targetArchetype && !target) {
    allWarnings.push(
      `Script was asked to target "${targetArchetype}", which this audience cannot bind — no target line`,
    );
  }
  const targetAssignments = target ? buildTargetAssignments([target], SCRIPT_UNIT) : undefined;
  // The one slug we are willing to have named back at us (bindTarget rejects anything else).
  const assignments = new Map<string, PersonaTarget>(target ? [[target.archetype, target]] : []);

  const overrides =
    [audienceOverride, creatorSteer, targetAssignments].filter(Boolean).join("\n") || undefined;

  // ── GROUND (§11f fan-out, gated): pull LIVE outlier teardowns for the topic → the one
  //    additive corpus field. OFF by default; TikTok-only. ANY failure degrades to
  //    ungrounded — corpus stays undefined → byte-identical no-op (honesty spine).
  //    `groundingExamples` maps the script's sourceIndex back to its outlier (the receipt).
  const { corpus, examples: groundingExamples } = await gatherCorpusForRun({
    enabled: isGroundingEnabled(),
    skill: "script", // → the timed-beats slice: the pacing a proven outlier actually ran
    platform,
    queryCandidates: [ask, anchor, genProfileRow?.niche_primary],
    niche: genProfileRow?.niche_primary ?? null,
    onStage: input.onStage,
    warnings: allWarnings,
  });

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Write a script for this hook",
      platform,
      mode: "script",
      ...(anchor ? { anchor } : {}),
      ...(overrides ? { overrides } : {}),
      ...(corpus ? { corpus } : {}),
    },
    genProfileRow,
  );

  let script: StructuredScript | null;
  // ── STAGE: Generating (real boundary — the big LLM call) ──
  input.onStage?.("Generating", "active");
  try {
    script = await generateScriptStructured(userMessage, Boolean(corpus), Boolean(target));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allWarnings.push(`Script generation failed: ${msg}`);
    return { blocks: [], warnings: allWarnings };
  }
  input.onStage?.("Generating", "done");

  // ── SELF-JUDGE: bounded gate — drop sub-floor generation (no regen — cost) ───
  if (!script || script.beats.length === 0) {
    allWarnings.push("Script generation sub-floored: beats array empty or malformed — dropped.");
    return { blocks: [], warnings: allWarnings };
  }

  // ── REACT path (A1 — weighted SIM aggregation): build the optional Flash weighting ──
  // General / null / no-override → undefined → flat band (byte-identical, regression gate).
  // Calibrated audience → per-slot persona_weights bias the weighted stop-MASS band gate.
  const flashWeighting = buildFlashWeighting(audience ?? null);

  // ── GATE (D-01 — OPENER ONLY): Flash on the opening beat seed only ───────────
  // S1 fix: route through the shared buildReactionPanel helper so niche resolves via
  // resolveNicheKey (was raw niche_primary → exact-slug miss → niche-blind "all Mixed").
  // Matches hooks/ideas runners; audienceRepaint construction is byte-identical to before.
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);

  // ── Audience Sim v2 (Stage 2): population projection gate + concurrent characterize ──
  // A calibrated signature with the v2 axes is the gate — General / legacy / preset skip it
  // (population stays undefined → byte-identical pre-v2 shape). The script card's reaction is
  // OPENER-ONLY in "hook" mode (D-01), so we characterize the SAME openingBeatSeed the SIM scores
  // → the projection and the on-card panel agree (a script is a hook HERE, by the opener design).
  // Fired BEFORE the SIM so it runs concurrently (no serial latency); a failure degrades to null.
  const populationSignature = audience?.signature ?? null;
  const wantPopulation = signatureHasPopulationAxes(populationSignature);
  const populationVocab = populationSignature?.audience.topic_vocab ?? [];
  const vectorPromise: Promise<ContentVector | null> = wantPopulation
    ? characterizeContent(script.openingBeatSeed, populationVocab).catch(() => null)
    : Promise.resolve(null);

  let simResult: Awaited<ReturnType<typeof runFlashTextMode>> | null;
  // ── STAGE: Simulating your audience (real boundary — the opener SIM call) ──
  input.onStage?.("Simulating your audience", "active");
  try {
    simResult = await runFlashTextMode(script.openingBeatSeed, "hook", panel, audienceRepaint, simIntent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allWarnings.push(`SIM failed for script opener "${script.openingBeatSeed.slice(0, 60)}": ${msg}`);
    return { blocks: [], warnings: allWarnings };
  }
  input.onStage?.("Simulating your audience", "done");

  const personas = simResult.result.personas;
  const { band, fraction } = aggregateFlash(personas, flashWeighting);

  // D-04: select lead scrollQuote NOW — ships on the card face
  const scrollQuote = selectLeadScrollQuote(personas);

  // Audience Sim v2 (Stage 2): the population projection — pure O(N) once the vector lands.
  // A null vector (skip / characterize failure) or a scorer throw → undefined (card omits the
  // field). Never let the projection break a card: the SIM band/fraction is the load-bearing
  // signal, the population is additive texture.
  let population: PopulationAggregate | undefined;
  const contentVector = await vectorPromise;
  if (populationSignature && contentVector) {
    try {
      population = reactPopulation(populationSignature, contentVector);
    } catch {
      population = undefined;
    }
  }

  // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
  // The opener's personas ARE the run's prediction (opener-only SIM, D-01). Pinned
  // before build so even a dropped card still records the SIM's predicted vector.
  // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
  if (input.pin && personas.length > 0) {
    const audienceId = audience && !audience.is_general ? audience.id : null;
    void pinPredictedSignature(input.pin.supabase, personas, {
      audienceId,
      analysisId: input.pin.analysisId ?? null,
    });
  }

  // ── BUILD: assemble script-card block ─────────────────────────────────────────
  // §11f receipts-on-cards: attach the frozen receipt for the outlier this script adapted.
  // null (no source / ungrounded run) → the field is omitted so the block shape stays
  // byte-identical to the pre-grounding card (regression gate + honesty spine).
  const proof = buildProofFromSource(script.sourceIndex, groundingExamples);

  // WHO this script was written for + how that exact person reacted to its OPENER (the only beat
  // the SIM ever scores — D-01/Pitfall 5; the verdict is honest about the hook, not the full watch).
  // null on an uncalibrated run, and null on a calibrated run whose writer named nobody we assigned.
  const cardTarget = bindTarget({
    claimedArchetype: script.targetArchetype,
    positionalTarget: target ?? undefined,
    assignments,
    personas,
    warnings: allWarnings,
    unitNoun: "Script",
    subject: script.openingBeatSeed,
  });

  const blockData = {
    type: "script-card" as const,
    props: {
      beats: script.beats,
      openingBeatSeed: script.openingBeatSeed,
      band,
      fraction,
      scrollQuote,
      model: "sim1-flash" as const,
      personas, // S3′: opener reaction for the ambient modal (PR-2)
      ...(proof ? { proof } : {}),  // §11f — only when a real source was attributed
      // Did the RUN retrieve anything, regardless of what the script cited? Set from the
      // examples, NOT from `proof` — a grounded run where the model attributed nothing is
      // still grounded, and that is exactly the case the card's note explains. Omitted on
      // ungrounded runs so the pre-grounding block shape stays byte-identical.
      ...(groundingExamples.length > 0 ? { grounded: true } : {}),
      // Per-persona generation — omitted entirely when there is no named reader, so General and
      // every pre-target persisted card keep their exact shape (regression gate).
      ...(cardTarget ? { target: cardTarget } : {}),
      // Audience Sim v2 (Stage 2) — the N-individual population projection (opener-as-hook).
      // Omitted when the audience lacks the v2 axes or characterization failed → pre-v2 shape.
      ...(population ? { population } : {}),
    },
  };

  // D-14 belt-and-suspenders validation at the runner boundary
  const validated = ScriptCardBlockSchema.safeParse(blockData);
  if (!validated.success) {
    allWarnings.push(
      `script-card block validation failed — dropped: ${validated.error.message}`,
    );
    return { blocks: [], warnings: allWarnings };
  }

  return { blocks: [validated.data as ScriptCardBlock], warnings: allWarnings };
}
