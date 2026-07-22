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
// New Qwen call system (2026-07-22): the persona SIM is GONE from the generation path (fan-out from
// hooks-runner). bandFromStops turns the single gen call's self-estimated OPENER /10 into the
// projected band, sharing the SIM's 6/3 calibration SSOT. runFlashTextMode / aggregateFlash /
// buildReactionPanel / buildFlashWeighting / characterizeContent / reactPopulation were the SIM-path
// machinery and are no longer imported — the opener reaction + population belong to the user-fired
// simulation now.
import { bandFromStops } from "@/lib/engine/flash/flash-aggregate";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { ScriptCardBlockSchema } from "@/lib/tools/blocks";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
// pinPredictedSignature (the FLYWHEEL pin) pinned the opener's SIM personas; with no SIM on this path
// it moves to the fired simulation. Only the RunnerPinContext type is still referenced (the
// accepted-but-unused `pin` input, kept so the route call site is unchanged).
import type { RunnerPinContext } from "./predicted-pin";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import { buildProofFromSource, coerceSourceIndex } from "./build-proof";
import { buildAdaptProfile } from "./adapt-profile";
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
 * Grounding-as-REMIX gate (adapt.ts) — the script fan-out of GROUNDING_HOOKS_ADAPT. When ON *and*
 * grounding is on, the retrieved corpus is routed through the decode→adapt briefer with the SCRIPT fit
 * measure (a Hook→Setup→Turn→Payoff→CTA beat arc over the proven rhythm) instead of the raw slice. OFF
 * by default and independent of GROUNDING_SCRIPT_ENABLED: it only changes the CONTENT of the `corpus`
 * string, so the opener SIM gate, the sourceIndex→receipt link, and (dormant) targeting are untouched.
 * The honest outcome gate (does grounding make a BETTER script?) is still open — keep it behind the flag.
 */
function isGroundingAdaptEnabled(): boolean {
  return process.env.GROUNDING_SCRIPT_ADAPT === "true";
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
/**
 * READY-TO-FILM fields (owner 2026-07-22) — shared across all three script output contracts (base,
 * grounded, targeted) so the per-beat `filming` cue + card-level topic/format + the consolidated
 * "How to film" production block are requested identically everywhere. Injected via interpolation so
 * a change lands once, not three times. Every field is OPTIONAL: the parser tolerates absence and
 * the card omits what the model does not return (back-compat — a run that emits none renders exactly
 * as it did before wiring). Honesty: cues describe HOW to shoot what the beats already say, never
 * invented gear/shots.
 */
const FILMING_BEAT_FIELD = `, "filming": string`;
const FILMING_CARD_FIELDS = `, "topic": string, "format": string, "production": { "shots": string, "onScreenText": string, "setup": string, "edit": string }`;
const FILMING_RULES = ` "filming" is a one-line DIRECTOR CUE for HOW to shoot the beat — camera/framing · b-roll or on-screen text · delivery — distinct from "content" (what to say) and "retentionMarker" (why it holds). "topic" is the subject in a few words; "format" is the video format (e.g. "Talking-head", "Voiceover + b-roll", "Screen-record"). "production" is the consolidated shoot plan for the WHOLE script: "shots" (the shot list), "onScreenText" (key text overlays), "setup" (gear / lighting / framing), "edit" (edit style, optional). Ground every cue in what the script actually needs — never invent gear or shots the beats do not call for.`;

/**
 * PROJECTION fields (new Qwen call system, 2026-07-22 — fan-out from hooks) — the single generation
 * call now ALSO self-estimates the OPENER's stopping power (`personaStops` /10) + a representative
 * stop quote, so the card carries its band signal WITHOUT the separate opener-SIM call the pipeline
 * used to make. Shared across all three script output contracts (base/grounded/targeted).
 *
 * ⚠️ HONESTY + OPENER-ONLY (Pitfall 5): `personaStops` is the WRITER'S OWN ESTIMATE of the OPENING
 * beat's scroll-stop, not a measured reaction and NOT a full-watch promise. It drives the projected
 * opener band/fraction; the card labels it a PROJECTION (provenance:"projected") and the real
 * verdict only appears when the creator fires "See the room →".
 */
const PROJECTION_FIELD = `, "personaStops": number, "stopQuote": string`;
const PROJECTION_RULE = ` "personaStops" is YOUR honest estimate, as the writer, of how many out of 10 typical target viewers would STOP scrolling on the OPENING beat (openingBeatSeed) in the first 2 seconds — an integer 0–10, about the OPENER only, never the full watch. Be discriminating, never generous: a generic opener with no real mechanism stops 0–2; a genuinely strong, niche-true opener stops 7–8; reserve 9–10 for the rare undeniable one. "stopQuote" is ONE short first-person line of what a viewer who stops on the opener thinks in that instant (e.g. "Okay I need to hear the rest"). Both are a PROJECTION you are making — the creator sees them as your estimate and can then measure the opener against their real audience; never phrase them as a finished measurement.`;

const SCRIPT_OUTPUT_CONTRACT = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string${FILMING_BEAT_FIELD} } ], "openingBeatSeed": string${PROJECTION_FIELD}${FILMING_CARD_FIELDS} }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat.${PROJECTION_RULE}${FILMING_RULES}`;

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
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string${FILMING_BEAT_FIELD} } ], "openingBeatSeed": string, "sourceIndex": number${PROJECTION_FIELD}${FILMING_CARD_FIELDS} }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat. "sourceIndex" is the 1-based number of the GROUNDING example (from the numbered GROUNDING list in the prompt) whose proven STRUCTURE this script adapts, or 0 if it adapts no specific example — never cite a source you did not actually use (honesty).${PROJECTION_RULE}${FILMING_RULES}`;

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
Shape: { "beats": [ { "label": string, "content": string, "timing": string, "retentionMarker": string${FILMING_BEAT_FIELD} } ], "openingBeatSeed": string, "targetArchetype": string${groundedField}${PROJECTION_FIELD}${FILMING_CARD_FIELDS} }
Return exactly ONE script object. "beats" is an ordered array (Hook → Setup → Turn → Payoff → CTA). Each beat field is required and non-empty. "timing" is the time window (e.g. "0–3s", "3–15s"). "retentionMarker" is plain-prose craft reasoning explaining WHY this beat holds attention — NEVER a numeric score. "openingBeatSeed" is the verbatim first-2s opening line fed to audience simulation — must equal the "content" of the first beat. "targetArchetype" is the bare slug of the person this script was written for. For "personaStops", estimate the OPENER's stop-count specifically for THAT assigned person's segment.${groundedRule}${PROJECTION_RULE}${FILMING_RULES}`;
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
   * May THIS run pay for a live outlier scrape on a cache miss? Default false (see gather-for-run
   * `allowScrape`) — a normal run never bills Apify. Set true ONLY by the explicit "Find new
   * outliers" action; the scrape's write-through then repopulates the cache so the next normal run
   * is grounded for free. Mirrors hooks-runner.
   */
  allowScrape?: boolean;
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
  /**
   * Could a live scrape have found outliers this (ungrounded/partial) run couldn't? Surfaced from
   * gather-for-run — true only when the run degraded purely because `allowScrape` was false on a
   * scrapable platform. The route forwards it as the `outliers` SSE event → the "Find new outliers"
   * affordance. Mirrors hooks-runner.
   */
  scrapeAvailable: boolean;
}

// ─── Structured script type ───────────────────────────────────────────────────

interface StructuredBeat {
  label: string;
  content: string;
  timing: string;
  retentionMarker: string;
  /** Per-beat director cue — HOW to shoot the beat. OPTIONAL (owner 2026-07-22): back-compat. */
  filming?: string;
}

/** The consolidated "How to film" shoot plan (owner 2026-07-22). All three of shots/onScreenText/
 * setup are required together (schema); edit is optional. */
interface StructuredProduction {
  shots: string;
  onScreenText: string;
  setup: string;
  edit?: string;
}

interface StructuredScript {
  beats: StructuredBeat[];
  openingBeatSeed: string;
  /** The subject + video format meta line (owner 2026-07-22). OPTIONAL → omitted when the model
   * returns neither (back-compat). */
  topic?: string;
  format?: string;
  /** The card-foot shoot plan (owner 2026-07-22). OPTIONAL → omitted unless the model returns a
   * well-formed block (all of shots/onScreenText/setup non-empty). */
  production?: StructuredProduction;
  /**
   * PROJECTION (new Qwen call system, 2026-07-22): the writer's own estimate of how many of 10
   * target viewers would STOP on this script's OPENER (0–10), self-emitted by the single generation
   * call in place of the removed opener-SIM. Drives the projected opener band/fraction (Pitfall 5:
   * opener-only, never full-watch). An ESTIMATE — the card carries it as provenance:"projected".
   */
  personaStops: number;
  /**
   * PROJECTION: one first-person line of what a viewer who stops on the OPENER thinks, self-emitted
   * by the same generation call → the card's lead scroll-quote (replaces the SIM-derived selector).
   */
  stopQuote: string;
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
      // Per-beat filming cue — carried through only when the model returned a non-empty one.
      ...(typeof b.filming === "string" && b.filming.trim().length > 0
        ? { filming: b.filming }
        : {}),
    });
  }

  if (beats.length === 0) return null;

  // openingBeatSeed must be a non-empty string
  const openingBeatSeed =
    typeof obj.openingBeatSeed === "string" && obj.openingBeatSeed.trim().length > 0
      ? obj.openingBeatSeed
      : beats[0]?.content ?? "";

  if (!openingBeatSeed) return null;

  // Ready-to-film card-level fields (owner 2026-07-22) — each tolerated as absent so a run that
  // returns none renders byte-identically to pre-wiring. topic/format are bare strings; production
  // is included only when the whole required trio (shots/onScreenText/setup) came back non-empty.
  const topic =
    typeof obj.topic === "string" && obj.topic.trim().length > 0 ? obj.topic : undefined;
  const format =
    typeof obj.format === "string" && obj.format.trim().length > 0 ? obj.format : undefined;
  const production = coerceProduction(obj.production);

  // Attribution index (grounded runs only) — missing/malformed → 0 (no source) so an
  // ungrounded or sloppy response never fabricates one (§11f honesty spine).
  return {
    beats,
    openingBeatSeed,
    ...(topic ? { topic } : {}),
    ...(format ? { format } : {}),
    ...(production ? { production } : {}),
    // PROJECTION (new call system): the writer's self-estimated OPENER stop-count + stop-quote —
    // the card's band signal now that no opener-SIM runs. Clamped 0–10; a missing estimate degrades
    // to 0 (Weak), a missing quote to "" (no lead quote).
    personaStops: coercePersonaStops(obj.personaStops),
    stopQuote: typeof obj.stopQuote === "string" ? obj.stopQuote.trim() : "",
    sourceIndex: coerceSourceIndex(obj.sourceIndex),
    // Whom the model SAYS it wrote this for. Not trusted yet — validated against the assignment
    // below, because a slug we never assigned is not a person we can name.
    targetArchetype: normalizeTargetArchetype(obj.targetArchetype),
  };
}

/**
 * Coerce the model's self-estimated OPENER stop-count into a clean integer 0–10. Accepts a number or
 * a numeric string ("8", "8/10" → 8). Anything missing/malformed → 0, which bands as Weak — the
 * honest degrade for a writer that gave no estimate, never a fabricated high. Mirrors hooks-runner.
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

/**
 * Coerce a raw `production` value into a StructuredProduction, or undefined. The card schema
 * requires shots + onScreenText + setup together, so a partial block (model gave only "shots") is
 * dropped whole rather than shipped half-formed. `edit` is optional. Never fabricates a field.
 */
function coerceProduction(raw: unknown): StructuredProduction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v : undefined;
  const shots = str(p.shots);
  const onScreenText = str(p.onScreenText);
  const setup = str(p.setup);
  if (!shots || !onScreenText || !setup) return undefined;
  const edit = str(p.edit);
  return { shots, onScreenText, setup, ...(edit ? { edit } : {}) };
}

// selectLeadScrollQuote was removed with the opener SIM (new Qwen call system): the lead quote is now
// the gen call's self-emitted `stopQuote`, not a pick from a reacted panel.

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
  const { ask, platform, profileRow, anchor, audience = null, targetArchetype } = input;
  const allWarnings: string[] = [];
  // NOTE: `input.intent` (the sell/grow reaction lens) only ever reframed the opener-SIM verdict.
  // With the SIM removed from generation it is unused on this path for now; it re-attaches to the
  // user-fired simulation when that wiring lands. Kept on the interface so the route call site is
  // unchanged. Same for `input.pin` (the FLYWHEEL pin — see below).

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
  const {
    corpus,
    examples: groundingExamples,
    scrapeAvailable,
    grounded: corpusGrounded,
  } = await gatherCorpusForRun({
    enabled: isGroundingEnabled(),
    skill: "script", // → the timed-beats slice: the pacing a proven outlier actually ran
    platform,
    queryCandidates: [ask, anchor, genProfileRow?.niche_primary],
    niche: genProfileRow?.niche_primary ?? null,
    // Explicit-only spend: the user's "Find new outliers" tap is the ONLY thing that sets this.
    allowScrape: input.allowScrape,
    onStage: input.onStage,
    warnings: allWarnings,
    // Grounding-as-remix: when ON, the corpus is a fitted+dosed beat-arc brief, not the raw slice.
    // The briefer maps proven rhythms onto THIS creator's subject, so hand it their profile.
    adapt: isGroundingAdaptEnabled(),
    adaptProfile: buildAdaptProfile(genProfileRow),
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
    return { blocks: [], warnings: allWarnings, scrapeAvailable };
  }
  input.onStage?.("Generating", "done");

  // ── SELF-JUDGE: bounded gate — drop sub-floor generation (no regen — cost) ───
  if (!script || script.beats.length === 0) {
    allWarnings.push("Script generation sub-floored: beats array empty or malformed — dropped.");
    return { blocks: [], warnings: allWarnings, scrapeAvailable };
  }

  // ── RATE (projection — NO SIM): the OPENER band signal off the self-estimated /10 ──
  // The single generation call above already self-estimated the OPENER's stop-count (personaStops
  // /10) + a stop-quote. There is NO opener SIM, NO population characterization, NO reaction panel
  // on this path any more — the opener's per-persona cast + the N-individual projection are MEASURED
  // artefacts that now belong to the user-fired simulation ("See the room →"). band via bandFromStops
  // (shares the SIM's 6/3 calibration SSOT), fraction as the honest "N/10 stop", quote = stopQuote.
  // OPENER-ONLY (Pitfall 5): the /10 is about the opening beat, never the full watch.
  const band = bandFromStops(script.personaStops);
  const fraction = `${script.personaStops}/10 stop`;
  const scrollQuote = script.stopQuote;

  // ── BUILD: assemble script-card block ─────────────────────────────────────────
  // §11f receipts-on-cards: attach the frozen receipt for the outlier this script adapted.
  // null (no source / ungrounded run) → the field is omitted so the block shape stays
  // byte-identical to the pre-grounding card (regression gate + honesty spine).
  const proof = buildProofFromSource(script.sourceIndex, groundingExamples);

  // WHO this script was written for. The reaction half (verdict/quote) is NULL now — no opener SIM
  // ran on this path — so bindTarget receives an EMPTY panel and returns the assignment WITHOUT a
  // reaction receipt. That receipt arrives when the creator fires the room. Uncalibrated runs still
  // return null. (Script targeting is DORMANT anyway — see SCRIPT_UNIT — so `target` is null on
  // every route today; the binding is kept runnable for a future re-measure.)
  const cardTarget = bindTarget({
    claimedArchetype: script.targetArchetype,
    positionalTarget: target ?? undefined,
    assignments,
    personas: [], // no opener SIM on the generation path — reaction deferred to the fired run
    warnings: allWarnings,
    unitNoun: "Script",
    subject: script.openingBeatSeed,
  });

  const blockData = {
    type: "script-card" as const,
    props: {
      // beats carry their per-beat `filming` cue through directly — the schema allows it optional,
      // and generateScriptStructured only attaches it when the model returned a non-empty one.
      beats: script.beats,
      openingBeatSeed: script.openingBeatSeed,
      band,
      fraction,
      scrollQuote,
      model: "sim1-flash" as const,
      // PROJECTION (new call system): the opener band/fraction/quote are the WRITER'S self-estimate,
      // not a measured opener reaction. The renderer gates ALL measurement language on this; the
      // measured opener verdict replaces the projection when the creator fires "See the room →".
      provenance: "projected" as const,
      // personas + population INTENTIONALLY OMITTED — the opener's cast and the N-individual
      // projection are MEASURED artefacts of the fired simulation, not the generation-time card.
      // Ready-to-film (owner 2026-07-22) — each omitted when the model returned it empty, so an
      // ungrounded/uncooperative run keeps the exact pre-wiring block shape (regression-safe).
      ...(script.topic ? { topic: script.topic } : {}),
      ...(script.format ? { format: script.format } : {}),
      ...(script.production ? { production: script.production } : {}),
      ...(proof ? { proof } : {}),  // §11f — only when a real source was attributed
      // Did the RUN earn a grounding claim, regardless of what the script cited? Set from the
      // shared WARRANT (warrant.ts), NOT from `proof` — a grounded run where the model attributed
      // nothing is still grounded, and that is exactly the case the card's note explains. Omitted
      // on ungrounded runs so the pre-grounding block shape stays byte-identical.
      ...(corpusGrounded ? { grounded: true } : {}),
      // Per-persona generation — omitted entirely when there is no named reader, so General and
      // every pre-target persisted card keep their exact shape (regression gate).
      ...(cardTarget ? { target: cardTarget } : {}),
    },
  };

  // D-14 belt-and-suspenders validation at the runner boundary
  const validated = ScriptCardBlockSchema.safeParse(blockData);
  if (!validated.success) {
    allWarnings.push(
      `script-card block validation failed — dropped: ${validated.error.message}`,
    );
    return { blocks: [], warnings: allWarnings, scrapeAvailable };
  }

  return { blocks: [validated.data as ScriptCardBlock], warnings: allWarnings, scrapeAvailable };
}
