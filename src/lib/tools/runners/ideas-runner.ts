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
// New Qwen call system (2026-07-22): the persona SIM is GONE from the generation path (fan-out from
// hooks-runner). bandFromStops turns the single gen call's self-estimated /10 into the projected
// band, sharing the SIM's 6/3 calibration SSOT. runFlashTextModeBatch / aggregateFlash /
// buildReactionPanel / buildFlashWeighting / characterizeContent / reactPopulation were the SIM-path
// machinery and are no longer imported — the per-persona reaction + population belong to the
// user-fired simulation now.
import { bandFromStops } from "@/lib/engine/flash/flash-aggregate";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { applyCreatorPersona } from "@/lib/audience/apply-creator-persona";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "@/lib/audience/audience-types";
import type { IntentLens } from "@/lib/audience/intent-lens";
import { IdeaCardBlockSchema } from "@/lib/tools/blocks";
import type { IdeaCardBlock } from "@/lib/tools/blocks";
// pinPredictedSignature (the FLYWHEEL pin) pinned the rank-1 idea's SIM personas; with no SIM on this
// path it moves to the fired simulation. Only the RunnerPinContext type is still referenced (the
// accepted-but-unused `pin` input, kept so the route call site is unchanged).
import type { RunnerPinContext } from "./predicted-pin";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import { buildProofFromSource, coerceSourceIndex } from "./build-proof";
import { buildAdaptProfile } from "./adapt-profile";
import { selectPersonaTargets, type PersonaTarget } from "@/lib/audience/select-persona-targets";
import {
  buildTargetAssignments,
  normalizeTargetArchetype,
  bindTarget,
  type TargetUnitCopy,
} from "./target-assignment";

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

/**
 * Grounding-as-REMIX gate (adapt.ts) — the ideas fan-out of GROUNDING_HOOKS_ADAPT. When ON *and*
 * grounding is on, the retrieved corpus is routed through the decode→adapt briefer with the IDEAS fit
 * measure (a belief↔reality tension bound to the creator's subject) instead of the raw slice. OFF by
 * default and independent of GROUNDING_IDEAS_ENABLED: it only changes the CONTENT of the `corpus`
 * string, so the SIM gate, the sourceIndex→receipt link, and per-persona targeting are untouched. The
 * honest outcome gate (does grounding make a BETTER idea?) is still open — keep it behind the flag.
 */
function isGroundingAdaptEnabled(): boolean {
  return process.env.GROUNDING_IDEAS_ADAPT === "true";
}

// bandOrdinal / parseFractionNumerator were removed with the persona SIM (new Qwen call system):
// the rank is now a single descending sort on the projected `personaStops` /10 — the band derives
// monotonically from that count (bandFromStops), so a stop-count sort is already band-consistent
// (Strong before Mixed before Weak). No tier ordinal, no fraction-string re-parsing.

/**
 * PROJECTION field (new Qwen call system, 2026-07-22 — fan-out from hooks) — the single generation
 * call now ALSO self-estimates each idea's stopping power (`personaStops` /10) + a representative
 * stop quote, so the card carries its ranking signal WITHOUT the separate persona-SIM call the
 * pipeline used to make. Shared across all three idea output contracts so the ask is identical.
 *
 * ⚠️ HONESTY: `personaStops` is the WRITER'S OWN ESTIMATE, not a measured room reaction. It drives
 * the projected band/fraction + the best→worst rank; the card labels it a PROJECTION
 * (provenance:"projected") and the real verdict only appears when the creator fires "See the room →".
 * The stop is estimated on the idea's SEED HOOK — the same line the SIM used to react to — so the
 * projection is about the idea's opener, not a full-watch promise.
 */
const PROJECTION_FIELD = `, "personaStops": number, "stopQuote": string`;
const PROJECTION_RULE = ` "personaStops" is YOUR honest estimate, as the writer, of how many out of 10 typical target viewers would STOP scrolling on this idea's SEED HOOK in the first 2 seconds — an integer 0–10. Be discriminating, never generous: a generic idea with no real mechanism stops 0–2; a genuinely strong, niche-true concept stops 7–8; reserve 9–10 for the rare undeniable one. "stopQuote" is ONE short first-person line of what a viewer who stops thinks in that instant (e.g. "Okay I actually want to watch this"). Both are a PROJECTION you are making — the creator sees them as your estimate and can then measure the idea against their real audience; never phrase them as a finished measurement.`;

/**
 * Output-serialization contract — owned by the runner because the runner owns
 * `response_format: json_object`. DashScope/Qwen rejects json_object mode with a
 * 400 ("messages must contain the word 'json'") unless the literal word appears
 * in the messages; the compiled KC prompt is pure craft knowledge and carries no
 * serialization directive, so the contract lives here. Mirrors the StructuredIdea shape.
 */
const IDEAS_OUTPUT_CONTRACT = `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "ideas": [ { "title": string, "angle": string, "mechanism": string, "seedHook": string, "needsTake": boolean, "topic": string, "take": string, "format": string | null${PROJECTION_FIELD} } ] }
Return an "ideas" array of exactly ${IDEA_COUNT} STRONG, distinct idea objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required (use "" or null where empty); "seedHook" must be non-empty.${PROJECTION_RULE}`;

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
Shape: { "ideas": [ { "title": string, "angle": string, "mechanism": string, "seedHook": string, "needsTake": boolean, "topic": string, "take": string, "format": string | null, "sourceIndex": number${PROJECTION_FIELD} } ] }
Return an "ideas" array of exactly ${IDEA_COUNT} STRONG, distinct idea objects — each must earn its place (these are all shown to the creator, not filtered). Every field is required (use "" or null where empty); "seedHook" must be non-empty. "sourceIndex" is the 1-based number of the GROUNDING example (from the numbered GROUNDING list in the prompt) whose proven STRUCTURE this idea adapts, or 0 if the idea adapts no specific example — never cite a source you did not actually use (honesty).${PROJECTION_RULE}`;

/**
 * PER-PERSONA GENERATION (fan-out from hooks #299) — the craft half of the assignment.
 *
 * The SHAPE of the assignment lives in ./target-assignment (shared, and the source of the two
 * bugs worth remembering). What lives HERE is the only genuinely idea-craft part: writing an IDEA
 * for one person is not the same instruction as writing a HOOK for one person. A hook has two
 * seconds to stop a thumb; an idea has to be a thing that person actually wants to exist.
 *
 * ⚠️ THE EFFECT TRANSFERRING FROM HOOKS IS A HYPOTHESIS, NOT A GIVEN — see
 * scripts/measure-targeting.ts, which is what decides whether this ships.
 */
const IDEA_UNIT: TargetUnitCopy = {
  noun: "Idea",
  craft: `Build each idea around what ITS assigned person actually wants to watch — the angle THAT person
would click, the take THAT person would argue with or send to a friend, the format THAT person
already consumes. An idea that would suit any of them equally well has failed its assignment.
Do not hedge toward the middle.`,
};

/**
 * Output contract for a targeted (calibrated) run — adds the one field that carries the binding.
 *
 * Mirrors hooks' targetedOutputContract. `targetArchetype` is what makes the persona STRUCTURAL
 * rather than ambient: the model cannot satisfy the schema without naming who each idea is for,
 * so non-compliance is visible instead of silent.
 */
function targetedOutputContract(grounded: boolean): string {
  const groundedField = grounded ? `, "sourceIndex": number` : "";
  const groundedRule = grounded
    ? ` "sourceIndex" is the 1-based number of the GROUNDING example whose proven STRUCTURE this idea adapts, or 0 if none — never cite a source you did not actually use (honesty).`
    : "";

  return `

---

OUTPUT FORMAT: Respond with a single JSON object — no markdown, no code fences, no prose.
Shape: { "ideas": [ { "title": string, "angle": string, "mechanism": string, "seedHook": string, "needsTake": boolean, "topic": string, "take": string, "format": string | null, "targetArchetype": string${groundedField}${PROJECTION_FIELD} } ] }
Return an "ideas" array of exactly ${IDEA_COUNT} STRONG, distinct idea objects, in assignment order — idea N is for person N from the list above. Every field is required (use "" or null where empty); "seedHook" must be non-empty. "targetArchetype" is the bare slug of the person this idea was written for. For "personaStops", estimate the stop-count specifically for THAT assigned person's segment.${groundedRule}${PROJECTION_RULE}`;
}

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
   * May THIS run pay for a live outlier scrape on a cache miss? Default false (see gather-for-run
   * `allowScrape`) — a normal run never bills Apify. Set true ONLY by the explicit "Find new
   * outliers" action; the scrape's write-through then repopulates the cache so the next normal run
   * is grounded for free. Mirrors hooks-runner.
   */
  allowScrape?: boolean;
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
  /**
   * Could a live scrape have found outliers this (ungrounded/partial) run couldn't? Surfaced from
   * gather-for-run — true only when the run degraded purely because `allowScrape` was false on a
   * scrapable platform. The route forwards it as the `outliers` SSE event → the "Find new outliers"
   * affordance. Mirrors hooks-runner.
   */
  scrapeAvailable: boolean;
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
   * PROJECTION (new Qwen call system, 2026-07-22): the writer's own estimate of how many of 10
   * target viewers would STOP on this idea's seed hook (0–10), self-emitted by the single generation
   * call in place of the removed persona-SIM. Drives the projected band/fraction + the best→worst
   * rank. An ESTIMATE, never a measurement — the card carries it as provenance:"projected".
   */
  personaStops: number;
  /**
   * PROJECTION: one first-person line of what a stopping viewer thinks, self-emitted by the same
   * generation call → the card's lead scroll-quote (replaces the SIM-derived selectLeadScrollQuote).
   */
  stopQuote: string;
  /**
   * 1-based grounding-example index this idea adapted (0 = none). Only ever non-zero on a
   * grounded run (the grounded contract requests it); ungrounded runs default it to 0. Drives
   * the on-card receipt via buildProofFromSource (§11f).
   */
  sourceIndex: number;
  /**
   * PER-PERSONA GENERATION: the archetype slug of the person this idea was written for, as
   * reported BY THE MODEL. Empty string = the model named nobody (or an unassigned slug) — the
   * card then carries no target line at all. That silence is deliberate: a writer that ignored
   * its assignment must show up as a MISSING claim, never as a generic idea wearing a
   * personalised label. Only ever set on a targeted (calibrated) run.
   */
  targetArchetype: string;
}

/**
 * Coerce the model's self-estimated stop-count into a clean integer 0–10. Accepts a number or a
 * numeric string ("8", "8/10" → 8). Anything missing/malformed → 0, which bands as Weak and ranks
 * the idea LAST — the honest degrade for a writer that gave no estimate, never a fabricated high.
 * Mirrors hooks-runner's coercePersonaStops.
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

// ─── Qwen generation call ────────────────────────────────────────────────────

/**
 * Call Qwen in json_object mode to generate IDEA_COUNT structured ideas.
 * System = KC_IDEAS_SYSTEM_PROMPT (byte-stable warm cache prefix).
 * User = assembleBundle output (volatile per-request).
 */
async function generateIdeasStructured(
  userMessage: string,
  grounded: boolean,
  targets: PersonaTarget[],
): Promise<StructuredIdea[]> {
  const ai = getQwenClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  // Targeted (calibrated) runs swap in the contract that carries `targetArchetype` — the field
  // that makes the persona binding STRUCTURAL rather than ambient (see IDEA_UNIT). General and
  // uncalibrated keep the byte-identical original contract (warm-cache prefix + regression gate):
  // no audience, no real people, no cast — the honest degrade.
  // Grounded runs carry sourceIndex so ideas can be attributed to the real outlier they adapted.
  const outputContract =
    targets.length > 0
      ? targetedOutputContract(grounded)
      : grounded
        ? IDEAS_OUTPUT_CONTRACT_GROUNDED
        : IDEAS_OUTPUT_CONTRACT;

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
      // PROJECTION (new call system): the writer's self-estimated stop-count + representative
      // stop-quote — the card's ranking signal now that no persona-SIM runs. Clamped 0–10; a
      // missing estimate degrades to 0 (Weak, ranked last), a missing quote to "" (no lead quote).
      personaStops: coercePersonaStops(r.personaStops),
      stopQuote: typeof r.stopQuote === "string" ? r.stopQuote.trim() : "",
      // Attribution index (grounded runs only) — missing/malformed → 0 (no source) so an
      // ungrounded or sloppy response never fabricates one (§11f honesty spine).
      sourceIndex: coerceSourceIndex(r.sourceIndex),
      // Whom the model SAYS it wrote this for. Not trusted yet — validated against the
      // assignments below, because a slug we never assigned is not a person we can name.
      targetArchetype: normalizeTargetArchetype(r.targetArchetype),
    });
    if (ideas.length >= IDEA_COUNT) break;
  }

  return ideas;
}

// selectLeadScrollQuote was removed with the persona SIM (new Qwen call system): the lead quote is
// now the gen call's self-emitted `stopQuote`, not a pick from a reacted panel.

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
  const { ask, platform, profileRow, audience = null } = input;
  const allWarnings: string[] = [];
  // NOTE: `input.intent` (the sell/grow reaction lens) only ever reframed the persona-SIM verdict.
  // With the SIM removed from generation it is unused on this path for now; it re-attaches to the
  // user-fired simulation (which owns the reaction) when that wiring lands. Kept on the interface so
  // the route call site is unchanged. Same for `input.pin` (the FLYWHEEL pin — see below).

  // ── §P step-7: creator voice (fallback) + steer from the per-audience creator_persona ──
  // genProfileRow may carry a voice backfilled from creator_persona.writing_style_sample;
  // creatorSteer folds who's writing into overrides. General/no-audience → inputs unchanged.
  const { profileRow: genProfileRow, creatorSteer } = applyCreatorPersona(profileRow, audience);

  // ── TARGET (per-persona generation, fan-out from hooks #299): WHO each idea is written for ──
  // Deterministic, no LLM — top-N by share, forced to span the four persona_weights slots (see
  // select-persona-targets.ts). Empty for General / uncalibrated / no bindable persona: there are
  // no real people behind those, so we name none and the run is byte-identical to today's.
  //
  // NOTE what is deliberately NOT here: an ambient "generate for this audience — <grounding line>"
  // override. Ideas has never had one, and this change does not add one. Feeding the writer more
  // audience PROSE was measured at chance (handoff §4c) and reverted; the assignment below is the
  // whole mechanism. That also makes this the cleanest test of the claim: the ONLY new generation
  // input on a calibrated ideas run is the contract itself.
  const targets = selectPersonaTargets(audience, IDEA_COUNT);
  const targetAssignments =
    targets.length > 0 ? buildTargetAssignments(targets, IDEA_UNIT) : undefined;
  // The slugs we are willing to have named back at us. An idea claiming anything outside this set
  // names nobody (bindTarget) — we never print a reader we did not brief the writer on.
  const assignments = new Map<string, PersonaTarget>(targets.map((t) => [t.archetype, t]));

  const overrides = [creatorSteer, targetAssignments].filter(Boolean).join("\n") || undefined;

  // ── GROUND (§11f fan-out, gated): pull LIVE outlier teardowns for the topic → the one
  //    additive corpus field. OFF by default; TikTok-only. ANY failure degrades to
  //    ungrounded — corpus stays undefined → byte-identical no-op (honesty spine).
  //    `groundingExamples` maps each idea's sourceIndex back to its outlier (the receipt).
  const {
    corpus,
    examples: groundingExamples,
    scrapeAvailable,
    grounded: corpusGrounded,
  } = await gatherCorpusForRun({
    enabled: isGroundingEnabled(),
    skill: "ideas", // → the belief↔reality slice: the tension that made the video travel
    platform,
    queryCandidates: [ask, genProfileRow?.niche_primary],
    niche: genProfileRow?.niche_primary ?? null,
    // Explicit-only spend: the user's "Find new outliers" tap is the ONLY thing that sets this.
    allowScrape: input.allowScrape,
    onStage: input.onStage,
    warnings: allWarnings,
    // Grounding-as-remix: when ON, the corpus is a fitted+dosed belief↔reality brief, not the raw
    // slice. The briefer re-points proven tensions at THIS creator, so hand it their profile.
    adapt: isGroundingAdaptEnabled(),
    adaptProfile: buildAdaptProfile(genProfileRow),
  });

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    {
      ask: ask || "Generate ideas from my profile",
      platform,
      mode: "idea",
      ...(overrides ? { overrides } : {}),
      ...(corpus ? { corpus } : {}),
    },
    genProfileRow,
  );

  // Record which path shipped (Open Q1 resolved decision)
  const seedHookPath: "structured" | "markered" = "structured";

  // ── STEER path (07-04 / AUD-05): audience-grounding line → the card's whyItFits ──
  // buildAudienceGroundingLine delegates to buildGroundingLine for General/null. This is the
  // "why it fits your profile" line, NOT a SIM artefact — it stays on this path.
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);

  // ── RATE (projection — NO SIM): the candidate carries what rank + build need ──
  // The single generation call above already self-estimated each idea's stop-count (personaStops
  // /10) + a stop-quote. There is NO batched SIM, NO population characterization, NO reaction panel
  // on this path any more — the per-card cast + the N-individual population projection are MEASURED
  // artefacts that now belong to the user-fired simulation ("See the room →"), not the generation
  // card. A rated idea is a pure derivation of the projection, with nothing async left.
  interface RatedIdea {
    idea: StructuredIdea;
    band: "Strong" | "Mixed" | "Weak";
    fraction: string;
    scrollQuote: string;
    generationIndex: number; // preserves generation order for the rank tie-break
  }

  // Generate exactly IDEA_COUNT ideas (no over-gen buffer — all are shown). ONE Qwen call now
  // carries the whole pipeline: the candidates AND their /10 projection AND the ranking signal.
  // ── STAGE: Generating (real boundary — the single LLM call) ──
  input.onStage?.("Generating", "active");
  const firstBatch = await generateIdeasStructured(userMessage, Boolean(corpus), targets);
  input.onStage?.("Generating", "done");
  if (firstBatch.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath, scrapeAvailable };
  }

  // ── STAGE: Ranking (real boundary — a pure map + sort; NO second call) ──
  input.onStage?.("Ranking", "active");

  // Rate each idea straight off its self-estimated /10 — band via bandFromStops (shares the SIM's
  // 6/3 calibration SSOT), fraction as the honest "N/10 stop" count, lead quote = the stopQuote.
  const rated: RatedIdea[] = firstBatch.map((idea, i) => ({
    idea,
    band: bandFromStops(idea.personaStops),
    fraction: `${idea.personaStops}/10 stop`,
    scrollQuote: idea.stopQuote,
    generationIndex: i,
  }));

  // ── RANK (keep-all): best → worst by the projected /10 stop-count. Tie-break preserves
  //    generation order. Bands derive monotonically from personaStops, so this single sort is
  //    already band-consistent (Strong before Mixed before Weak) — no separate tier ordinal
  //    needed. slice(IDEA_COUNT) is a safety bound only. (Same selection behaviour as before —
  //    keep-all + rank — only the ranking SIGNAL moved from the SIM to the self-estimated /10.)
  rated.sort((a, b) => {
    const stopDiff = b.idea.personaStops - a.idea.personaStops; // descending
    if (stopDiff !== 0) return stopDiff;
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

    // WHO this idea was written for. The reaction half (verdict/quote) is NULL now — no SIM ran on
    // this path — so bindTarget receives an EMPTY panel and returns the assignment WITHOUT a
    // reaction receipt. That receipt arrives when the creator fires the room. Uncalibrated runs
    // still return null. (The positional lookup uses generationIndex, not loop position: sorted.)
    const target = bindTarget({
      claimedArchetype: candidate.idea.targetArchetype,
      positionalTarget: targets[candidate.generationIndex],
      assignments,
      personas: [], // no persona SIM on the generation path — reaction deferred to the fired run
      warnings: allWarnings,
      unitNoun: "Idea",
      subject: candidate.idea.title,
    });

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
        // PROJECTION (new call system): band/fraction/quote are the WRITER'S self-estimate, not a
        // measured room reaction. The renderer gates ALL measurement language on this; the measured
        // verdict replaces the projection when the creator fires "See the room →".
        provenance: "projected" as const,
        predictedFailureMode: null, // S5: rubric critic removed (was OFF / ~100% fail)
        // personas + population INTENTIONALLY OMITTED — the per-card cast and the N-individual
        // projection are MEASURED artefacts of the fired simulation, not the generation-time card.
        ...(proof ? { proof } : {}),  // §11f — only when a real source was attributed
        // Did the RUN earn a grounding claim, regardless of what THIS card cited? Set from the
        // shared WARRANT (warrant.ts), NOT from `proof` — a grounded run where the model attributed
        // nothing is still grounded, and that is exactly the case the card's note explains. Omitted
        // on ungrounded runs so the pre-grounding block shape stays byte-identical.
        ...(corpusGrounded ? { grounded: true } : {}),
        // Per-persona generation — omitted entirely when there is no named reader, so General
        // and every pre-target persisted card keep their exact shape (regression gate).
        ...(target ? { target } : {}),
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

  // FLYWHEEL-02 pin REMOVED from the generation path: it pinned the rank-1 idea's SIM personas as
  // the predicted disposition vector, and no SIM runs here now. The predicted-vector pin moves to
  // the user-fired simulation (the run that actually produces a reaction). `input.pin` is accepted
  // but unused on this path (kept so the route call site is unchanged).

  return { blocks, warnings: allWarnings, seedHookPath, scrapeAvailable };
}
