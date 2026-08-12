/**
 * Adapt generator — Phase 4 (ADAPT-01).
 *
 * Single Qwen JSON-mode call that produces exactly 3 niche-adapted concepts
 * from the structural decode output. Does NOT touch runPredictionPipeline,
 * usage_tracking, or DAILY_LIMITS (D-04 lightweight path).
 *
 * Input structural guard (D-01, Pitfall 1):
 * `buildAdaptUserContent` accepts only `AdaptInput`, making it a compile-time error to pass
 * `luck[]` or any caption field. It no longer keeps the source's WORDS out — `input.blueprint`
 * carries verbatim `spoken` text by design (D2, 2026-08-10); echo-guard.ts measures the topical
 * echo that guarantee used to prevent.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { z } from "zod";
import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core";
import { MAX_BEATS } from "./blueprint";
import type { AdaptInput, AdaptConcept } from "./decode-types";

const log = createLogger({ module: "engine.remix.adapt" });

const TIMEOUT_MS = 90_000; // 90s — adapt is lighter than omni; abort if DashScope stalls
const MAX_RETRIES = 1;     // 2 total attempts (attempt 0 + 1 repair)

// =========================================================
// System prompt — stable string for DashScope cache prefix.
// Grounded in the shared KNOWLEDGE_CORE (R12/D-11) via §6 Rewrite + §2 frameworks.
// Core is prepended so the byte-stable DashScope prefix is preserved across requests.
// NOTE: extraInstruction (retry nudge) is NOT concatenated here — it goes on the USER
//       message (buildAdaptUserContent) to preserve the cached prefix on retries (T-03-08).
// =========================================================

export const ADAPT_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}

---

Apply the §6 Rewrite Lens + §2 frameworks for FORMAT adaptation. Given the structural anatomy of a viral video (hook pattern, structure, emotional beat, repeatable format items), generate exactly 3 DISTINCT adapted concepts for the specified creator niche.

RULES:
- Adapt the FORMAT and STRUCTURE, not the content or topic of the original video.
- Each concept must be firmly grounded in the creator's niche.
- All 3 concepts must be meaningfully different from each other.
- Do NOT reference the original video's topic, subject, or content — only its format patterns.

OUTPUT: Return strict JSON with this exact shape and nothing else:
{
  "concepts": [
    {
      "hook": "string — bold, actionable headline adapted to the niche (≤ 15 words)",
      "angle": "string — the structural angle or narrative approach borrowed from the source",
      "who_its_for": "string — who in the creator's niche this concept targets",
      "format_borrowed": "string — the specific format pattern borrowed (short label, ≤ 10 words)",
      "personaStops": "number — YOUR honest estimate, 0–10, of how many of 10 target viewers would STOP scrolling on this adapted hook in the first 2 seconds",
      "stopQuote": "string — ONE short first-person line of what a viewer who stops thinks in that instant",
      "production": {
        "shots": "string — the shot list to film YOUR version of this concept",
        "onScreenText": "string — key on-screen text overlays",
        "setup": "string — gear / lighting / framing setup",
        "edit": "string — edit style"
      }
    }
  ]
}
The "concepts" array MUST contain exactly 3 items. "personaStops" is a PROJECTION you are making about the ADAPTED HOOK only (not the full video) — be discriminating, never generous: a generic hook with no real mechanism stops 0–2, a genuinely strong niche-true hook stops 7–8, reserve 9–10 for the rare undeniable one; the creator sees it as your estimate and can then measure it against their real audience, so never phrase it as a finished measurement. "production" is the READY-TO-FILM shoot plan for the creator's OWN adapted version — how to execute the borrowed format for this angle, grounded in what the concept actually needs. Never invent gear or shots the concept does not call for.

When — and only when — a TIMED BEAT MAP is supplied below, every concept MUST carry one more key, "script": an array with EXACTLY one entry per beat in the map, in the same order:
  "script": [
    {
      "index": <the beat's index, copied from the map>,
      "spoken": "<what the creator SAYS in this beat — empty string when the source has no speech>",
      "on_screen_text": "<overlay text for this beat — empty string when there is none>",
      "shot": "<how to shoot this beat: framing, camera position, movement>",
      "repair": "<ONLY when the beat is marked WEAK: how your version fixes it>"
    }
  ]

SCRIPT RULES:
- Match each beat's DURATION, not its word count. The source's speech rate is given; write a line that takes about as long to SAY as the original beat lasted. A creator who speaks slower than the source needs fewer words, not the same number.
- Keep the same beat count and the same cut rhythm. Do not add beats, merge beats, or reorder them.
- Borrow the SHAPE of each line — its cadence, its sentence structure, where it lands its emphasis. Never borrow its subject. The adapted line must share no topic words with the source line.
- Where a beat is marked WEAK, REPAIR it rather than replicating it, and say what you changed in "repair".
- When the source has NO SPEECH, leave "spoken" as an empty string and carry the beat in "on_screen_text".`;

// =========================================================
// Zod schemas
// =========================================================

const AdaptedBeatZodSchema = z.object({
  index:          z.number().int().min(0),
  spoken:         z.string().max(600),
  on_screen_text: z.string().max(300),
  shot:           z.string().min(1).max(600),
  repair:         z.string().max(400).optional(),
});

/**
 * Capped at MAX_BEATS so a runaway response cannot blow the card open, and `.min(1)` because an
 * empty script is noise, not a sheet. Named because `stripInvalidScript` validates against the
 * SAME schema the response is parsed with — two copies would drift.
 */
const ScriptZodSchema = z.array(AdaptedBeatZodSchema).min(1).max(MAX_BEATS);

/**
 * Layout budgets for the concept's own prose, and for the shoot plan's. Declared once and read by
 * BOTH the schema below and `clampOverCapProse`, so the cap a field is validated against and the
 * cap it is trimmed to cannot drift apart.
 */
const CONCEPT_PROSE_CAPS = {
  hook:            200,
  angle:           300,
  who_its_for:     200,
  format_borrowed: 200,
} as const;

const PRODUCTION_PROSE_CAPS = {
  shots:        600,
  onScreenText: 600,
  setup:        600,
  edit:         400,
} as const;

const AdaptConceptZodSchema = z.object({
  hook:            z.string().min(1).max(CONCEPT_PROSE_CAPS.hook),
  angle:           z.string().min(1).max(CONCEPT_PROSE_CAPS.angle),
  who_its_for:     z.string().min(1).max(CONCEPT_PROSE_CAPS.who_its_for),
  format_borrowed: z.string().min(1).max(CONCEPT_PROSE_CAPS.format_borrowed),
  // PROJECTION (new Qwen call system, 2026-07-22) — the adapt call self-estimates each adapted hook's
  // stop-count (/10) + a stop-quote in place of the removed persona-SIM. OPTIONAL + coerced downstream
  // so a model that omits them (or the old /api/remix/adapt surface that never asked) still validates
  // and the 3-concept contract holds; the remix runner defaults a missing personaStops to 0 (Weak).
  personaStops: z.number().optional(),
  stopQuote:    z.string().optional(),
  // READY TO FILM (owner 2026-07-22) — OPTIONAL so a model that omits it (or returns a partial
  // block) still validates and the 3-concept contract holds; the card just renders no shoot plan.
  // shots/onScreenText/setup are required together when present; edit is optional.
  production: z
    .object({
      shots:        z.string().min(1).max(PRODUCTION_PROSE_CAPS.shots),
      onScreenText: z.string().min(1).max(PRODUCTION_PROSE_CAPS.onScreenText),
      setup:        z.string().min(1).max(PRODUCTION_PROSE_CAPS.setup),
      edit:         z.string().min(1).max(PRODUCTION_PROSE_CAPS.edit).optional(),
    })
    .optional(),
  // Beat-by-beat script (D2). OPTIONAL for the same reason as production — a model that omits
  // it must not fail the exactly-3 contract, and the concept-only path never asks for one.
  script: ScriptZodSchema.optional(),
});

const AdaptConceptsZodSchema = z.object({
  concepts: z.array(AdaptConceptZodSchema).length(3), // ADAPT-01: exactly 3
});

/**
 * Trim to `cap` without leaving a dangling half-word. The ellipsis is counted IN — a clamp that
 * returns `cap + 1` characters fails the very schema it exists to satisfy, which is the bug in
 * `clip()` over in grounding/prompt.ts (harmless there, fatal here).
 */
function trimToCap(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const cut       = text.slice(0, cap - 1); // one char of headroom for the ellipsis
  const lastSpace = cut.lastIndexOf(" ");
  // Fall back to a hard cut only when the word boundary is so early that honouring it would throw
  // most of the line away — a 300-char run with one space at index 3 must not clamp to 3 chars.
  const body = lastSpace > cap * 0.6 ? cut.slice(0, lastSpace) : cut;
  // A hard cut can land BETWEEN an emoji's two UTF-16 code units. Zod counts code units too, so
  // the length stays legal and nothing complains — but a lone surrogate renders as the
  // replacement glyph, which is the "looks broken" outcome this whole function exists to avoid.
  const whole = /[\uD800-\uDBFF]$/.test(body) ? body.slice(0, -1) : body;
  return `${whole.trimEnd()}…`;
}

/**
 * The same trade as the two functions below, one level up, and the one that was missing.
 *
 * Every cap on a concept's prose is a LAYOUT budget, not a correctness rule — `angle` renders as
 * one muted sub-row (D-09), `production.shots` as a paragraph in "Your shots". Enforcing them as
 * validation makes an over-long string fatal for the whole response: measured live 2026-08-12,
 * the model returned `angle` > 300 chars on two of three concepts, Zod rejected all three, the
 * repair attempt came back with a fourth concept, and the creator got `adapt_failed` and an error
 * state — no card at all, because some prose was long (spec §11, third failure mode).
 *
 * Note this also covers `production`: `stripPartialProduction` tests each sub-field for PRESENCE
 * and non-emptiness, never for validity, so an over-long `shots` sails through it and dies at the
 * schema with the whole card. Trimming runs first so both siblings see legal lengths.
 *
 * `script` is deliberately NOT clamped. Its caps are semantic rather than cosmetic — a 600-char
 * `spoken` is not a beat line that ran long, it is a malformed sheet — and `stripInvalidScript`
 * already degrades that case correctly.
 */
function clampOverCapProse(parsed: unknown): unknown {
  const concepts = (parsed as { concepts?: unknown } | null)?.concepts;
  if (!Array.isArray(concepts)) return parsed;
  for (const c of concepts) {
    if (!c || typeof c !== "object") continue;
    const concept = c as Record<string, unknown>;

    for (const [field, cap] of Object.entries(CONCEPT_PROSE_CAPS)) {
      const v = concept[field];
      if (typeof v === "string" && v.length > cap) {
        log.warn("adapt returned over-cap prose — trimming it, keeping the concept", {
          field, length: v.length, cap,
        });
        concept[field] = trimToCap(v, cap);
      }
    }

    const p = concept.production;
    if (!p || typeof p !== "object") continue;
    const production = p as Record<string, unknown>;
    for (const [field, cap] of Object.entries(PRODUCTION_PROSE_CAPS)) {
      const v = production[field];
      if (typeof v === "string" && v.length > cap) {
        log.warn("adapt returned over-cap prose — trimming it, keeping the concept", {
          field: `production.${field}`, length: v.length, cap,
        });
        production[field] = trimToCap(v, cap);
      }
    }
  }
  return parsed;
}

/**
 * A partial shoot plan must never kill 3 valid concepts. `production` is a GARNISH —
 * optional by schema, "the card just renders no shoot plan" — but when the model emits
 * it MISSING one required sub-field, Zod fails the WHOLE response and the retry usually
 * repeats the omission (observed live 2026-08-10: `production.setup` absent on all 3
 * concepts of two corpus rows, both retries too → two shelf rows lost, a 5/6 shelf).
 * Stripping the partial garnish before validation converts that into a valid response.
 */
function stripPartialProduction(parsed: unknown): unknown {
  const concepts = (parsed as { concepts?: unknown } | null)?.concepts;
  if (!Array.isArray(concepts)) return parsed;
  for (const c of concepts) {
    if (!c || typeof c !== "object") continue;
    const p = (c as { production?: unknown }).production;
    if (p === undefined) continue;
    const complete =
      p !== null &&
      typeof p === "object" &&
      (["shots", "onScreenText", "setup"] as const).every((k) => {
        const v = (p as Record<string, unknown>)[k];
        return typeof v === "string" && v.length > 0;
      });
    if (!complete) delete (c as { production?: unknown }).production;
  }
  return parsed;
}

/**
 * Same trade as `stripPartialProduction`, and a sharper version of the same risk: the script is
 * up to MAX_BEATS entries of four required fields EACH, so the chance the model fumbles one entry
 * is far higher than for the single `production` block. Failing the whole response over it would
 * cost the creator three valid concepts to save a garnish, and the retry usually repeats the
 * omission. Dropping the script degrades to the card we ship today.
 *
 * All-or-nothing per concept, not per entry: the sheet's contract is one line per source beat,
 * and half a sheet reads as a bug rather than as a missing feature.
 */
function stripInvalidScript(parsed: unknown): unknown {
  const concepts = (parsed as { concepts?: unknown } | null)?.concepts;
  if (!Array.isArray(concepts)) return parsed;
  for (const c of concepts) {
    if (!c || typeof c !== "object") continue;
    const script = (c as { script?: unknown }).script;
    if (script === undefined) continue;
    if (!ScriptZodSchema.safeParse(script).success) {
      log.warn("adapt returned an unusable script — dropping it, keeping the concept");
      delete (c as { script?: unknown }).script;
    }
  }
  return parsed;
}

/**
 * The other half of the same live failure. The repair attempt returned FOUR concepts — the fourth
 * with every field undefined — and `.length(3)` failed the response, so three good concepts were
 * lost to one padded entry the card would never have rendered (spec §11).
 *
 * Surplus is not corruption. Keep the first three that stand up on their own and drop the rest.
 * Validity-filtered rather than `slice(0, 3)`: the padding has been observed in the tail, but a
 * blind slice would keep a malformed leading entry and throw away a good trailing one.
 *
 * Only ever narrows to EXACTLY three. Anything else — two valid entries out of five, a genuinely
 * corrupt response — is left untouched so the schema reports the real defect and the repair
 * attempt runs. A short card cannot be padded into a full one.
 */
function dropSurplusConcepts(parsed: unknown): unknown {
  const root     = parsed as { concepts?: unknown } | null;
  const concepts = root?.concepts;
  if (!Array.isArray(concepts) || concepts.length <= 3) return parsed;

  const keep = concepts.filter((c) => AdaptConceptZodSchema.safeParse(c).success).slice(0, 3);
  if (keep.length !== 3) return parsed;

  log.warn("adapt returned more than 3 concepts — keeping the first 3 valid ones", {
    returned: concepts.length,
  });
  (root as { concepts: unknown[] }).concepts = keep;
  return parsed;
}

// =========================================================
// Input builder — accepts AdaptInput only (D-01 structural guard)
// =========================================================

/**
 * Build the Qwen user-turn content from the adapt input.
 *
 * Parameter type is `AdaptInput`. Passing `luck[]`, `content_summary`, or a raw caption is a
 * compile-time error (Pitfall 1 guard).
 *
 * The TIMED BEAT MAP block is emitted only when the blueprint HAS beats. The three callers with
 * no video hand over `emptyBlueprint()` and get back exactly the concept-only prompt this
 * function produced before D2 — a "0s, 0 beats" header would instruct the model to script beats
 * that do not exist.
 */
export function buildAdaptUserContent(input: AdaptInput): string {
  const repeatableList = input.repeatable
    .map((item, i) =>
      item.why_repeatable
        ? `  ${i + 1}. "${item.label}" — ${item.why_repeatable}`
        : `  ${i + 1}. "${item.label}"`,
    )
    .join("\n");

  // D3: the brief IS the target when present; niche is the fallback, never both. Two targets in
  // one prompt is how you get three concepts that belong to neither.
  const targetLine = input.target
    ? `MAKE IT ABOUT: ${input.target}`
    : `CREATOR NICHE: ${input.niche}`;

  const bp = input.blueprint;
  let beatMap = "";
  if (bp.beats.length > 0) {
    const speechNote = bp.has_speech
      ? `Source speech rate: ${bp.words_per_second} words/second.`
      : `This source has NO SPEECH — carry every beat in on-screen text only.`;

    const rows = bp.beats
      .map((b) => {
        const parts = [
          `  [${b.index}] ${b.t_start.toFixed(1)}–${b.t_end.toFixed(1)}s (${b.duration_s}s) · ${b.role.toUpperCase()}`,
          `      they show: ${b.visual_event}`,
        ];
        if (b.spoken) {
          parts.push(`      they say: "${b.spoken}"`);
          // The quote can outlive the beat holding it: enforceHookZoneBoundary cuts any cell
          // straddling 3s and keeps the whole quote on the left child, so a 0-8s talking cell
          // leaves eight seconds of words on a three-second hook beat. Unstated, the model reads
          // "3s beat" beside a 20-word line and writes 20 words for 3 seconds — measured at
          // 7.7 w/s, which cannot be said aloud (spec §11). Say how long the line really took
          // and what this beat's share of it is.
          if (b.spoken_span_s !== null && b.spoken_span_s > b.duration_s) {
            parts.push(
              `      ⏱ that line takes ${b.spoken_span_s}s to say and runs PAST this beat — ` +
              `this beat is only ${b.duration_s}s of it. Write ~${b.duration_s}s of speech, not the whole line.`,
            );
          }
        }
        if (b.on_screen_text) parts.push(`      on screen: "${b.on_screen_text}"`);
        if (b.cuts > 1) parts.push(`      cuts inside this beat: ${b.cuts}`);
        if (b.weakness) {
          parts.push(`      ⚠ WEAK (${b.weakness.factor} ${b.weakness.score}/10) — ${b.weakness.tip}`);
        }
        return parts.join("\n");
      })
      .join("\n");

    beatMap = `

TIMED BEAT MAP (${bp.duration_s}s, ${bp.beats.length} beats). ${speechNote}
${rows}

Write a "script" entry for EVERY beat above, in order.`;
  }

  return `VIRAL VIDEO STRUCTURAL ANATOMY:
Hook Pattern: ${input.hook_pattern}
Structure: ${input.structure}
The Turn: ${input.the_turn}
Emotional Beat: ${input.emotional_beat}

Repeatable Format Items (adapt these, not the content):
${repeatableList}

${targetLine}${beatMap}

Generate exactly 3 distinct adapted concepts using the format patterns above.`;
}

// =========================================================
// Main generator
// =========================================================

/**
 * Generate exactly 3 niche-adapted concepts from the structural decode output.
 *
 * Returns `null` on graceful failure (never throws). The Adapt frame shows an
 * error state when null — it does NOT propagate to the Decode frame (D-06).
 */
export async function generateAdaptConcepts(input: AdaptInput): Promise<AdaptConcept[] | null> {
  const ai = getQwenClient();
  let lastError: unknown;

  // A beat map was supplied, so ADAPT_SYSTEM_PROMPT told the model every concept MUST carry a
  // `script`. When one comes back without it the SHEET DOES NOT EXIST — and the response is
  // otherwise perfectly valid, so nothing downstream notices (measured: ~3 of 8 live runs
  // returned three bare concepts, exit 0, "adapt concepts generated {count:3}" in the log, the
  // creator handed the pre-lane artefact with no indication anything was missing — spec §11).
  const beatMapSupplied = input.blueprint.beats.length > 0;

  // Why the retry nudge is not one string: the two failures need opposite instructions, and
  // sending "your previous response was not valid JSON" after a perfectly-parsed bare response
  // aims the repair at the wrong defect.
  let missingScriptRetry = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Retry nudge goes on the USER message (not system) to preserve the byte-stable
      // ADAPT_SYSTEM_PROMPT prefix for DashScope cache hits on retries (T-03-08).
      // Aligns with decode.ts:67 and deepseek.ts:471 patterns.
      const extraInstruction = missingScriptRetry
        ? "\nIMPORTANT: Your previous response omitted the \"script\" array. A TIMED BEAT MAP was supplied, so EVERY concept MUST include \"script\" with exactly one entry per beat, in order. Return the full JSON object with it."
        : attempt > 0
        ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
        : "";

      const completion = await ai.chat.completions.create(
        {
          // Same constant as pass2.ts and pipeline.ts. It DEFAULTS to qwen3.7-flash and is
          // env-overridable — the "qwen3.6-plus" this comment used to name has not been the
          // default since 2026-06-06. Which model actually runs decides how much the
          // determinism finding below transfers, so do not re-hardcode a name here.
          model:           QWEN_REASONING_MODEL,
          messages: [
            { role: "system", content: ADAPT_SYSTEM_PROMPT },
            { role: "user",   content: buildAdaptUserContent(input) + extraInstruction },
          ],
          response_format: { type: "json_object" },
          // ⚠️ NOT reproducible, despite what D-04 and QWEN_SEED's own docstring claim.
          // Measured 2026-08-12 over 9 runs on a byte-identical frozen input: 9 distinct
          // outputs (scripts/probe-adapt-determinism.ts). Kept because greedy decoding still
          // narrows the distribution — but no gate on this path may be cleared by a single
          // run, and no wording change can bound a sampler. Fixes here must be mechanical.
          temperature:     0,
          seed:            QWEN_SEED, // 7
          // Bound generation: ADAPT_SYSTEM_PROMPT now carries the full KNOWLEDGE_CORE
          // (Plan 03-03), so without these the reasoning model emits unbounded CoT and
          // times out (>90s) — the same failure fixed for deepseek.ts at the 03-04
          // checkpoint. Mirrors decode.ts (1200); 3 concepts fit comfortably.
          //
          // A SHOOT SHEET DOES NOT. 3 concepts x MAX_BEATS(8) entries x ~65 tokens per entry is
          // ~1560 tokens of script ON TOP of the ~600 the concepts already take — 1200 truncates
          // the JSON mid-object, which fails the parse, and the retry truncates identically.
          // Widened only on the path that asks for a script, so the concept-only callers
          // (/api/remix/adapt, the drops pipe) keep the exact budget they run on today.
          // max_tokens is a CEILING, not a spend floor: an unused ceiling costs nothing.
          max_tokens: input.blueprint.beats.length > 0 ? 3000 : 1200,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types
          enable_thinking: false,
        },
        { signal: controller.signal },
      );

      const raw     = completion.choices[0]?.message?.content ?? "";
      const cleaned = stripModelOutput(raw); // strips <think>...</think> + fences
      const parsed  = JSON.parse(cleaned) as unknown;
      // Degrade before validating, innermost first: trim over-cap prose, drop a partial shoot
      // plan, drop an unusable script, and only THEN decide whether a surplus concept can be
      // dropped — a concept must be judged on what survives the degrades, not on what arrived.
      const result  = AdaptConceptsZodSchema.safeParse(
        dropSurplusConcepts(stripInvalidScript(stripPartialProduction(clampOverCapProse(parsed)))),
      );

      if (!result.success) {
        log.warn("adapt Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        continue; // → repair attempt with extraInstruction on next loop
      }

      // Belt-and-suspenders count guard (mirrors pass2.ts:197-200)
      if (result.data.concepts.length !== 3) {
        throw new Error(`concept count mismatch: ${result.data.concepts.length}`);
      }

      // Read the RAW response, not the validated one. `stripInvalidScript` deletes a malformed
      // script deliberately (see its docstring — a fumbled garnish must not cost three good
      // concepts), and that decision stands. What is being caught here is narrower and
      // different: the model never emitted a script AT ALL.
      const rawConcepts = (parsed as { concepts?: Array<{ script?: unknown }> } | null)?.concepts;
      const noneEmittedScript =
        Array.isArray(rawConcepts) && rawConcepts.every((c) => c?.script === undefined);

      if (beatMapSupplied && noneEmittedScript) {
        if (attempt < MAX_RETRIES) {
          // Worth a second draw. The old rationale for not retrying assumed "the retry repeats
          // the omission" — measured FALSE: this call is non-deterministic (three byte-identical
          // inputs produced three distinct outputs at temperature 0 with a fixed seed), so a
          // retry is a genuinely new sample, not a replay.
          log.warn("adapt returned no script[] despite a beat map — retrying", { attempt });
          missingScriptRetry = true;
          continue;
        }
        // Out of attempts. Return the concepts — three of them still beat nothing, and failing
        // here would turn a degraded card into no card. But say so at ERROR: this is the shoot
        // sheet silently not existing, and it was invisible until someone went looking.
        log.error("adapt returned no script[] after retry — the shoot sheet is MISSING", {
          beats: input.blueprint.beats.length,
          concepts: result.data.concepts.length,
        });
      }

      log.info("adapt concepts generated", { attempt, count: result.data.concepts.length });
      return result.data.concepts as AdaptConcept[];

    } catch (err: unknown) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("adapt attempt failed", { attempt, error: String(err), isAbort });
      if (attempt >= MAX_RETRIES) break;
    } finally {
      // #11: clear the abort timer on EVERY exit path — including the Zod-fail `continue`
      // above, which previously skipped clearTimeout and leaked the timer (a spurious
      // controller.abort() would fire TIMEOUT_MS later on the already-settled request).
      clearTimeout(timer);
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "remix_adapt" } });
  log.error("adapt generation failed after all retries", { error: String(lastError) });
  return null; // graceful failure → frame shows error state (D-06)
}
