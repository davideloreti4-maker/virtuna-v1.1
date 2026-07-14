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
 *    Structured json_object generation of exactly HOOK_COUNT (5) distinct-mechanism hooks
 *    (HOOKS_OUTPUT_CONTRACT). Each hook carries: hookLine, mechanism, seedHook, channel?, needsTake?
 *
 * 2. RATE (S3′): ONE batched runFlashTextModeBatch(candidates, "hook", { niche, contentType: null })
 *    scores ALL candidates in a single call. aggregateFlash → {band, fraction} per candidate.
 *    Lead scrollQuote + audienceArchetype selected NOW (D-02/D-03, WARNING-4).
 *
 * 3. KEEP-ALL (S3′): NO Weak cut. Every rated candidate is kept. The only drop is a candidate
 *    with no reaction (un-scorable) — we never fabricate a band (honesty spine).
 *
 * 4. RANK (D-01): order ALL rated by:
 *    - Primary: band tier (Strong > Mixed > Weak; ordinal: Strong=0, Mixed=1, Weak=2)
 *    - Secondary: audience-fraction stop-count descending (parse "N/10 stop" numerator)
 *    - Tie-break: preserve generation order (first generated = first ranked)
 *    Assign rank = index + 1 after sort. slice(HOOK_COUNT) is a safety bound only (keep-all).
 *
 * 5. BUILD: assemble hook-card blocks (incl. per-card personas for the ambient modal, PR-2).
 *    Validate via HookCardBlockSchema.safeParse (D-14 belt-and-suspenders).
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
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash, MIXED_THRESHOLD } from "@/lib/engine/flash/flash-aggregate";
import { deriveAudienceArchetype } from "@/lib/tools/hooks/audience-archetype";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
import { selectHookTargets, type HookTarget } from "@/lib/audience/select-hook-targets";
import { buildFlashWeighting } from "@/lib/engine/flash/persona-weighting";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { HookCardBlockSchema } from "@/lib/tools/blocks";
import type { HookCardBlock, HookCardTarget, HookProof } from "@/lib/tools/blocks";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { pinPredictedSignature, type RunnerPinContext } from "./predicted-pin";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import { buildProofFromSource, coerceSourceIndex } from "./build-proof";
import type { RetrievedExample } from "@/lib/grounding/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Generate-and-rate (S3′): generate exactly HOOK_COUNT hooks, batch-rate ALL by the audience,
 * RANK them, and KEEP them all — no Weak cut, no over-gen buffer, no top-N trim. Generation
 * count == display count, so the user always gets a full shelf (never the old "waited 1min,
 * got 0–2"). The slice at HOOK_COUNT below is a safety bound only (model occasionally over-emits).
 */
const HOOK_COUNT = 5;

/** Generation call timeout (mirrors ideas-runner). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Grounding gate (§11f step 2). OFF by default — grounding prepends a live scrape +
 * survivor profile-scrapes + a teardown LLM call (~25s + Apify cost) BEFORE generation,
 * so it ships behind an env flag until live-proven on the 2-frame reveal. TikTok-only in
 * MVP: the gather path is clockworks/TikTok; IG native is the documented fast-follow.
 */
function isGroundingEnabled(): boolean {
  return process.env.GROUNDING_HOOKS_ENABLED === "true";
}

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
Return a "hooks" array of exactly ${HOOK_COUNT} STRONG, DISTINCT-mechanism objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required; "hookLine" and "seedHook" must be non-empty. "mechanism" is plain-prose reasoning — never a bracket-tag. "channel" is the delivery channel (spoken/visual/caption/edit/audio) or null.`;

/**
 * Grounded output contract (§11f receipts-on-cards). Used ONLY when a corpus grounding block
 * was injected (grounding ON + real examples found). Adds ONE field — `sourceIndex` — so each
 * hook reports WHICH grounding example (1-based, or 0 for none) its structure adapts. That
 * integer is the attribution link the on-card receipt is built from (sourceIndex →
 * RetrievedExample → proof). The ungrounded contract above is kept byte-identical so flag-OFF
 * runs preserve their warm-cache prefix + regression gate.
 */
const HOOKS_OUTPUT_CONTRACT_GROUNDED = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "hooks": [ { "hookLine": string, "mechanism": string, "seedHook": string, "channel": string | null, "needsTake": boolean, "sourceIndex": number } ] }
Return a "hooks" array of exactly ${HOOK_COUNT} STRONG, DISTINCT-mechanism objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required; "hookLine" and "seedHook" must be non-empty. "mechanism" is plain-prose reasoning — never a bracket-tag. "channel" is the delivery channel (spoken/visual/caption/edit/audio) or null. "sourceIndex" is the 1-based number of the GROUNDING example (from the numbered GROUNDING list in the prompt) whose proven STRUCTURE this hook adapts, or 0 if the hook adapts no specific example — never cite a source you did not actually use (honesty).`;

/**
 * PER-PERSONA GENERATION — the ASSIGNMENT block (the whole point of this feature).
 *
 * ⛔ What this is NOT: "more audience text in the prompt". That was built, measured and REVERTED
 * (handoff §4c). Feeding all 10 persona repaints into `overrides` as ambient context moved
 * NOTHING: hook-line embeddings p=0.43, and a blind judge *told exactly who the audience is*
 * classified at 45% — worse than a coin flip. The prompt was dumped and verified; every persona
 * was present. The calibrated prompt was already 7× richer than General's (2,267 chars vs 307)
 * and still produced hooks nobody could tell apart. **The writer ignores ambient audience text.**
 *
 * So the persona stops being CONTEXT and becomes an ASSIGNMENT: hook N is written FOR person N,
 * and the model must name that person back to us in `targetArchetype`. The differentiation is
 * carried by the output contract rather than hoped for — and non-compliance becomes VISIBLE
 * (a hook that names no valid target loses its target line) instead of silently producing
 * generic hooks under a personalised label.
 *
 * F7 — `label` NEVER appears here. The engine binds on `archetype`; the writer is briefed with
 * `repaint`. The workspace tells users in as many words that a persona's display name never
 * reaches the model. Print a label into this block and the UI becomes a lie.
 */
function buildTargetAssignments(targets: HookTarget[]): string {
  const lines = targets
    .map(
      (t, i) =>
        `${i + 1}. [${t.archetype}] ${t.repaint} (${Math.round(t.share * 100)}% of the audience)`,
    )
    .join("\n");

  return `

---

WRITE FOR ONE NAMED PERSON PER HOOK. These are real, calibrated segments of THIS creator's actual audience — not personas you should invent or generalise:

${lines}

Hook 1 is written to stop person 1. Hook 2 is written to stop person 2. And so on, in order.
Write each hook to land on ITS assigned person specifically — the thing THAT person would stop
scrolling for, in the register THAT person responds to. A hook that would work equally well on
any of them has failed its assignment. Do not hedge toward the middle.
If the same person appears twice, write two genuinely different ways in — never a rephrase.
Report the person each hook targets in "targetArchetype" — the bare slug ONLY, exactly as written
inside the brackets above and WITHOUT the brackets themselves (e.g. "${targets[0]?.archetype ?? "saver"}", not "[${targets[0]?.archetype ?? "saver"}]").`;
}

/** Output contract for a targeted (calibrated) run — adds the one field that carries the binding. */
function targetedOutputContract(grounded: boolean): string {
  const groundedField = grounded
    ? `, "sourceIndex": number`
    : "";
  const groundedRule = grounded
    ? ` "sourceIndex" is the 1-based number of the GROUNDING example whose proven STRUCTURE this hook adapts, or 0 if none — never cite a source you did not actually use (honesty).`
    : "";

  return `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "hooks": [ { "hookLine": string, "mechanism": string, "seedHook": string, "channel": string | null, "needsTake": boolean, "targetArchetype": string${groundedField} } ] }
Return a "hooks" array of exactly ${HOOK_COUNT} STRONG, DISTINCT-mechanism objects, in assignment order — hook N targets person N from the list above. Every field is required; "hookLine" and "seedHook" must be non-empty. "mechanism" is plain-prose reasoning — never a bracket-tag. "channel" is the delivery channel (spoken/visual/caption/edit/audio) or null. "targetArchetype" is the exact bracketed slug of the person this hook was written for.${groundedRule}`;
}

/**
 * sourceIndex → RetrievedExample → receipt (§11f receipts-on-cards). Implementation moved to
 * the shared ./build-proof (fan-out: ideas/script attribute the same way); re-exported here
 * under its original name for existing imports/tests.
 */
export const buildHookProof: (
  sourceIndex: number,
  examples: RetrievedExample[],
) => HookProof | null = buildProofFromSource;

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
  /**
   * Progress callback fired at the REAL pipeline phase boundaries (Generating → Simulating your
   * audience → Ranking). The route wires this to its SSE `send("stage", …)` so the spine reflects
   * genuine phase timing instead of a single opaque await + a burst at the end. Optional/no-op —
   * absent = unchanged behavior. Honesty spine: fired at true boundaries, never on a fake timer.
   */
  onStage?: (name: string, status: "active" | "done") => void;
}

// ─── Output type ─────────────────────────────────────────────────────────────

export interface HooksPipelineResult {
  /** Up to HOOK_COUNT (5) ranked hook-card blocks, keep-all (0 only on generation/SIM failure). */
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
  /**
   * 1-based grounding-example index this hook adapted (0 = none). Only ever non-zero on a
   * grounded run (the grounded contract requests it); ungrounded runs default it to 0. Drives
   * the on-card receipt via buildHookProof (§11f).
   */
  sourceIndex: number;
  /**
   * PER-PERSONA GENERATION: the archetype slug of the person this hook was written for, as
   * reported BY THE MODEL. Empty string = the model named nobody (or an unassigned slug) — the
   * card then carries no target line at all. That silence is deliberate: a writer that ignored
   * its assignment must show up as a MISSING claim, never as a generic hook wearing a
   * personalised label. Only ever set on a targeted (calibrated) run.
   */
  targetArchetype: string;
}

// ─── Qwen generation call ─────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate HOOK_COUNT structured hooks.
 * System = KC_HOOKS_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateHooksStructured(
  userMessage: string,
  grounded: boolean,
  targets: HookTarget[],
): Promise<StructuredHook[]> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  // Targeted (calibrated) runs swap in the contract that carries `targetArchetype` — the field
  // that makes the persona binding STRUCTURAL rather than ambient (see buildTargetAssignments).
  // General/uncalibrated keeps the byte-identical original contract (warm-cache prefix + the
  // regression gate): no audience, no real people, no cast — the honest degrade.
  const outputContract =
    targets.length > 0
      ? targetedOutputContract(grounded)
      : grounded
        ? HOOKS_OUTPUT_CONTRACT_GROUNDED
        : HOOKS_OUTPUT_CONTRACT;

  let raw: string;
  try {
    const res = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,
        messages: [
          { role: "system", content: KC_HOOKS_SYSTEM_PROMPT + outputContract },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        seed: QWEN_SEED,
        enable_thinking: false, // DashScope extension — cast via `as never` below
        max_tokens: 1500,       // safety rail: measured 587/791 output, ×~2 headroom
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
      // Attribution index (grounded runs only) — coerced to a clean non-negative int; anything
      // missing/malformed → 0 (no source) so an ungrounded or sloppy response never fabricates one.
      sourceIndex: coerceSourceIndex(r.sourceIndex),
      // Whom the model SAYS it wrote this for. Not trusted yet — validated against the
      // assignments below, because a slug we never assigned is not a person we can name.
      targetArchetype: normalizeTargetArchetype(r.targetArchetype),
    });
    if (hooks.length >= HOOK_COUNT) break;
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

// ─── Target binding (per-persona generation) ──────────────────────────────────

/**
 * Normalize the archetype slug the model hands back.
 *
 * ⚠️ THIS EXISTS BECAUSE THE LIVE RUN CAUGHT WHAT 3,600 GREEN TESTS COULD NOT. The assignment
 * list renders each person as `1. [lurker] …`, and the contract said "use the exact bracketed
 * slug" — so the model dutifully returned `"targetArchetype": "[lurker]"`, brackets and all. The
 * assignment map is keyed on the bare slug, every lookup missed, and EVERY card silently lost its
 * target line. The writer had complied perfectly (its own reasoning cited "the lurker", "the
 * loyalist", "the niche buyer" by name) — the BINDING is what broke. tsc, eslint and the entire
 * suite were green; the feature was 100% dead on the only path a user ever watches.
 *
 * The lesson is not "fix the wording" (that is done too — see targetedOutputContract). It is that
 * an exact-match lookup on free-form model output is a silent-failure machine. Decorations a model
 * may reasonably add — brackets, quotes, backticks, spacing, case — must never be the difference
 * between a bound target and a dropped one. What must STILL fail loudly is a slug we never
 * assigned: that is bindHookTarget's job, and it is unchanged.
 */
export function normalizeTargetArchetype(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^[[({<"'`\s]+|[\])}>"'`\s]+$/g, "") // strip wrapping brackets/quotes/backticks
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_"); // "niche deep buyer" / "niche-deep-buyer" → "niche_deep_buyer"
}

/**
 * Bind a generated hook to the reader it was written for — and attach that reader's OWN reaction.
 *
 * TWO HONESTY RULES, both of which exist because a card that names a person is making a claim:
 *
 * 1. WE ONLY NAME SOMEONE WE ACTUALLY ASSIGNED. The model's `targetArchetype` is checked against
 *    the assignment set. A missing, malformed or unassigned slug → null → the card ships with NO
 *    target line. That is the honest failure: if the writer ignored its brief, the user must see
 *    an absence, not a generic hook wearing a personalised label. (This is also the runtime
 *    tripwire for the §4c failure mode — a writer that ignores the audience shows up as cards
 *    with no target, rather than as cards that lie.)
 *
 * 2. THE REACTION IS LOOKED UP, NEVER INVENTED. `verdict`/`quote` come from the SIM persona whose
 *    archetype matches the target. If that archetype did not appear in this run's panel, both are
 *    null — we do not fabricate a reaction any more than we fabricate a band.
 *
 * Note it reports the target the MODEL named, not the one we assigned by position: if the writer
 * swapped two assignments, the truthful card is the one that says who the hook is actually for.
 * A mismatch is logged as a warning, not silently corrected.
 */
function bindHookTarget(
  hook: StructuredHook,
  positionalTarget: HookTarget | undefined,
  assignments: Map<string, HookTarget>,
  personas: FlashPersona[],
  warnings: string[],
): HookCardTarget | null {
  if (assignments.size === 0) return null; // uncalibrated run — nobody to name

  const claimed = assignments.get(hook.targetArchetype);
  if (!claimed) {
    warnings.push(
      hook.targetArchetype
        ? `Hook "${hook.hookLine.slice(0, 40)}" claimed target "${hook.targetArchetype}", which was never assigned — target line dropped`
        : `Hook "${hook.hookLine.slice(0, 40)}" named no target — target line dropped`,
    );
    return null;
  }

  if (positionalTarget && positionalTarget.archetype !== claimed.archetype) {
    // Not corrected — the model wrote for whoever it says it wrote for. Just say so out loud.
    warnings.push(
      `Hook targeted "${claimed.archetype}" but was assigned "${positionalTarget.archetype}" — reporting the model's target`,
    );
  }

  // The aimed-at reader's real verdict + real words. Absent from the panel → null, never invented.
  const reaction = personas.find((p) => p.archetype === claimed.archetype);

  return {
    archetype: claimed.archetype,
    label: claimed.label, // display only — never went near the prompt (F7)
    share: claimed.share,
    verdict: (reaction?.verdict as "stop" | "scroll" | undefined) ?? null,
    quote: reaction?.quote ?? null,
  };
}

// ─── Rank comparator helpers ──────────────────────────────────────────────────

/**
 * Band tier ordinal: lower = higher rank (Strong ranks before Mixed).
 * D-01: Strong > Mixed (Weak is already gated out before ranking).
 */
function bandOrdinal(band: "Strong" | "Mixed" | "Weak"): number {
  if (band === "Strong") return 0;
  if (band === "Mixed") return 1;
  return 2; // Weak — S3′ keeps Weak cards (ranked last), so this IS reached
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
 * Full Hooks pipeline (S3′): generate 5 → ONE batched niche SIM → rate → rank → keep ALL.
 *
 * Returns up to HOOK_COUNT (5) ranked hook-card blocks (keep-all — Weak kept, ranked last).
 * Returns 0 blocks only if generation or the batched SIM hard-fails (no auto-regen — D-03).
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

  // ── TARGET (per-persona generation): WHO each hook is written for ──────────────
  // Deterministic, no LLM — top-N by share, forced to span the four persona_weights slots
  // (see select-hook-targets.ts). Empty for General / uncalibrated / no bindable persona: there
  // are no real people behind those, so we name none and the run is byte-identical to today's.
  const targets = selectHookTargets(audience, HOOK_COUNT);
  const targetAssignments = targets.length > 0 ? buildTargetAssignments(targets) : undefined;
  // The slugs we are willing to have named back at us. A hook claiming anything outside this set
  // names nobody (bindHookTarget) — we never print a reader we did not brief the writer on.
  const assignments = new Map<string, HookTarget>(targets.map((t) => [t.archetype, t]));

  const overrides =
    [audienceOverride, creatorSteer, targetAssignments].filter(Boolean).join("\n") || undefined;

  // ── GROUND (§11f step 2, gated): pull LIVE outlier teardowns for the topic → the one
  //    additive corpus field. OFF by default; TikTok-only (gather path is clockworks).
  //    ANY failure degrades to ungrounded — corpus stays undefined → byte-identical no-op,
  //    never fabricate a source (honesty spine). `groundingExamples` is retained so the BUILD
  //    step can map each hook's sourceIndex back to the outlier it adapted (the on-card receipt).
  const { corpus, examples: groundingExamples } = await gatherCorpusForRun({
    enabled: isGroundingEnabled(),
    skill: "hooks", // → the madlib slice: the reusable skeleton a proven hook ran on
    platform,
    queryCandidates: [ask, anchor, genProfileRow?.niche_primary],
    niche: genProfileRow?.niche_primary ?? null,
    onStage: input.onStage,
    warnings: allWarnings,
  });

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate hooks for this idea",
      platform,
      mode: "hooks",
      ...(anchor ? { anchor } : {}),
      ...(overrides ? { overrides } : {}),
      ...(corpus ? { corpus } : {}),
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

  // ── RATE: a rated candidate carries everything the rank+build need ─────────
  // personas travel ON the candidate so the FLYWHEEL pin + the per-card modal feed
  // (S3′) read them directly without index bookkeeping.
  interface RatedCandidate {
    hook: StructuredHook;
    band: "Strong" | "Mixed" | "Weak";
    fraction: string;
    scrollQuote: string;
    audienceArchetype: string;
    predictedFailureMode: string | null; // KCQ-04 (null on clean pass)
    personas: FlashPersona[];             // for the FLYWHEEL-02 pin + per-card modal feed (S3′)
    generationIndex: number;              // preserves generation order for tie-break
  }

  /**
   * S3′ generate-rate-rank: ONE batched SIM call rates ALL candidates, then KEEP them all
   * (ranked) — no Weak cut, no trim. The ONLY drop is a candidate with a missing/invalid
   * reaction (rare — whole-batch parse failure, or a single malformed candidate): it can't
   * be shown without a real reaction (honesty spine — we never fabricate a band). Ranking
   * happens AFTER, on the returned rated candidates (D-01 order preserved).
   */
  async function rateHooks(hookBatch: StructuredHook[]): Promise<RatedCandidate[]> {
    // Stable ids = generation index (echoed by the model, mapped back; positional fallback).
    const candidates = hookBatch.map((hook, i) => ({
      id: String(i),
      text: hook.seedHook ?? hook.hookLine,
    }));

    const batch = await runFlashTextModeBatch(
      candidates,
      "hook",
      panel,
      audienceRepaint,
      simIntent,
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      allWarnings.push(`Batched SIM failed for hooks: ${msg}`);
      return null; // hard failure → no cards (no auto-regen; user-pressed rewrite handles retry)
    });
    if (!batch) return [];
    allWarnings.push(...batch.warnings);

    const out: RatedCandidate[] = [];

    hookBatch.forEach((hook, i) => {
      const sim = batch.results.get(String(i));
      if (!sim) {
        // Un-scorable candidate → drop (can't show a card with no reaction). Keep-all
        // never fabricates a band; a missing reaction is the only reason a hook drops.
        allWarnings.push(
          `SIM produced no reaction for hook "${hook.hookLine.slice(0, 60)}" — dropped`,
        );
        return;
      }

      const personas = sim.personas;
      const { band, fraction } = aggregateFlash(personas, flashWeighting);

      // S3′: NO Weak gate — keep ALL rated bands (rank handles ordering).

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
        predictedFailureMode: null, // S5: rubric critic removed (was OFF / ~100% fail)
        personas,
        generationIndex: i,
      });
    });

    return out;
  }

  // Generate exactly HOOK_COUNT hooks (no over-gen buffer — all are shown).
  // ── STAGE: Generating (real boundary — the big LLM call) ──
  input.onStage?.("Generating", "active");
  const firstBatch = await generateHooksStructured(userMessage, Boolean(corpus), targets);
  input.onStage?.("Generating", "done");
  if (firstBatch.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  // S3′: ONE batched SIM rates all candidates. NO conditional regen (D-06 removed) —
  // keep-all + user-pressed rewrite (PR-3) replaces the auto-regenerate-on-zero loop.
  // ── STAGE: Simulating your audience (real boundary — the batched Flash SIM call) ──
  input.onStage?.("Simulating your audience", "active");
  const rated = await rateHooks(firstBatch);
  input.onStage?.("Simulating your audience", "done");

  // ── STAGE: Ranking (real boundary — sort + build; fast) ──
  input.onStage?.("Ranking", "active");

  // ── RANK (keep-all): order by band tier → fraction → generation order. No Weak cut,
  //    no trim below what was generated; slice(HOOK_COUNT) is a safety bound only. ──
  // Primary: band tier (Strong=0 > Mixed=1 > Weak=2)
  // Secondary: stop-count descending (numerator of fraction string)
  // Tie-break: preserve generation order (lower generationIndex ranks first)
  rated.sort((a, b) => {
    const bandDiff = bandOrdinal(a.band) - bandOrdinal(b.band);
    if (bandDiff !== 0) return bandDiff;
    const fractionDiff =
      parseFractionNumerator(b.fraction) - parseFractionNumerator(a.fraction); // descending
    if (fractionDiff !== 0) return fractionDiff;
    return a.generationIndex - b.generationIndex; // preserve generation order
  });

  const ranked = rated.slice(0, HOOK_COUNT);

  // ── BUILD: assemble hook-card blocks with rank ──────────────────────────────
  const blocks: HookCardBlock[] = [];

  for (let rank = 1; rank <= ranked.length; rank++) {
    const candidate = ranked[rank - 1];
    if (!candidate) continue;

    // §11f receipts-on-cards: attach the frozen receipt for the outlier this hook adapted.
    // null (no source / ungrounded run) → the field is omitted so the block shape stays
    // byte-identical to the pre-grounding card (regression gate + honesty spine).
    const proof = buildHookProof(candidate.hook.sourceIndex, groundingExamples);

    // WHO this hook was written for + how that exact person reacted. null on an uncalibrated run,
    // and null on a calibrated run whose writer named nobody we assigned — the card then simply
    // carries no target line (an honest absence beats a personalised label over a generic hook).
    // NOTE the positional lookup uses generationIndex, not `rank`: the cards have been SORTED by
    // band since generation, so rank-1 is not assignment-1.
    const target = bindHookTarget(
      candidate.hook,
      targets[candidate.generationIndex],
      assignments,
      candidate.personas,
      allWarnings,
    );

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
        personas: candidate.personas, // S3′: per-card reaction for the ambient modal (PR-2)
        ...(proof ? { proof } : {}),  // §11f — only when a real source was attributed
        // Did the RUN retrieve anything, regardless of what THIS card cited? Set from the
        // examples, NOT from `proof` — a grounded run where the model attributed nothing is
        // still grounded, and that is exactly the case the card's note explains. Omitted on
        // ungrounded runs so the pre-grounding block shape stays byte-identical.
        ...(groundingExamples.length > 0 ? { grounded: true } : {}),
        // Per-persona generation — omitted entirely when there is no named reader, so General
        // and every pre-target persisted card keep their exact shape (regression gate).
        ...(target ? { target } : {}),
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

  // ── STAGE: Ranking (done) — cards are built + ready to stream ──
  input.onStage?.("Ranking", "done");

  // ── FLYWHEEL-02: pin the predicted signature (non-fatal, fire-after-compute) ──
  // Pin the rank-1 hook's personas (the hook most likely posted), falling back to
  // the first rated candidate so a run that produced any reaction pins a vector.
  // void (not awaited): never delays card render; pinPredictedSignature swallows errors.
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
