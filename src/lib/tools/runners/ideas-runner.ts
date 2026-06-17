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
 *   - grounding-line.ts (buildGroundingLine)
 *   - tools/blocks.ts (IdeaCardBlockSchema, IdeaCardBlock)
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_IDEAS_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { runFlashTextMode } from "@/lib/engine/flash/run-flash-text-mode";
import { aggregateFlash, MIXED_THRESHOLD } from "@/lib/engine/flash/flash-aggregate";
import { buildGroundingLine } from "@/lib/kc/grounding-line";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import { IdeaCardBlockSchema } from "@/lib/tools/blocks";
import type { IdeaCardBlock } from "@/lib/tools/blocks";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Over-generate buffer: ~5 ideas to get N=3 survivors (D-13, D-03). */
const IDEA_BUFFER = 5;

/** Max survivors to keep after gating (D-13). */
const MAX_SURVIVORS = 3;

/** Generation call timeout (mirrors flash-runner; ideas generate is heavier). */
const GENERATE_TIMEOUT_MS = 300_000;

// ─── Input type ───────────────────────────────────────────────────────────────

export interface IdeasPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
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
          { role: "system", content: KC_IDEAS_SYSTEM_PROMPT },
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
  const { ask, platform, profileRow } = input;
  const allWarnings: string[] = [];

  // ── GATE FLOOR ASSERTION (WARNING-3: fail loud if MIXED_THRESHOLD unreachable) ──
  // This fires only if the import itself resolves a bad value (e.g. undefined/NaN).
  if (typeof MIXED_THRESHOLD !== "number" || isNaN(MIXED_THRESHOLD)) {
    throw new Error(
      "runIdeasPipeline: MIXED_THRESHOLD is not a valid number — Plan-01 gate floor handoff missing or corrupt. " +
        "Do NOT proceed; complete 03-01-SUMMARY.md first. (WARNING-3)",
    );
  }

  // ── GENERATE: assemble bundle → Qwen json_object generation ──────────────────
  const userMessage = assembleBundle(
    { ask: ask || "Generate ideas from my profile", platform, mode: "idea" },
    profileRow,
  );

  const ideas = await generateIdeasStructured(userMessage);

  // Record which path shipped (Open Q1 resolved decision)
  const seedHookPath: "structured" | "markered" = "structured";

  if (ideas.length === 0) {
    return { blocks: [], warnings: allWarnings, seedHookPath };
  }

  // ── SIM (gate): parallel Flash per candidate ──────────────────────────────
  const niche = profileRow?.niche_primary ?? null;
  const panel = { niche, contentType: null } as const;

  const simResults = await Promise.all(
    ideas.map((idea) =>
      runFlashTextMode(idea.seedHook, "idea", panel).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        allWarnings.push(`SIM failed for idea "${idea.title}": ${msg}`);
        return null; // null = failed SIM → treat as Weak (drop)
      }),
    ),
  );

  // ── GATE + TRIM: drop sub-floor, keep up to MAX_SURVIVORS ────────────────
  const { line: groundingLine } = buildGroundingLine(profileRow, platform);

  const survivors: IdeaCardBlock[] = [];

  for (let i = 0; i < ideas.length && survivors.length < MAX_SURVIVORS; i++) {
    const idea = ideas[i];
    const simResult = simResults[i];

    if (simResult === null) continue; // SIM failed → drop

    const personas = simResult.result.personas;
    const { band, fraction } = aggregateFlash(personas);

    // GATE FLOOR (Plan-01 handoff): band !== "Weak" (stops >= MIXED_THRESHOLD)
    if (band === "Weak") continue;

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

    survivors.push(validated.data as IdeaCardBlock);
  }

  return { blocks: survivors, warnings: allWarnings, seedHookPath };
}
