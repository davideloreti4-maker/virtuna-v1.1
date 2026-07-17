/**
 * chat-runner.ts — Open-chat pipeline (Plan 05-01, Task 1).
 *
 * Streams a profile-grounded Qwen markdown answer for the open thread (THREAD-03 / D-07/D-08).
 *
 * Pipeline:
 *   1. COLD-START SIGNAL (D-08): isColdStart(profileRow) — reuses the SAME thin-profile
 *      predicate the assembler applies internally (isProfileThin). Not a second divergent
 *      definition — the exact same field-null check. Exported for the route to emit the
 *      structured coldStart meta frame (Plan 05-03 gates the one-time nudge on this).
 *
 *   2. ASSEMBLE: assembleBundle({ ask, platform, mode: "chat", anchor? }, profileRow)
 *      — the chat stance-slice + honest cold-start flag + running-turns anchor ride this
 *      with zero schema change. MODE_ROLES.chat = niche/audience/platform (D-07 tight slice).
 *
 *   3. STREAM: getQwenClient().chat.completions.create({ model: QWEN_REASONING_MODEL,
 *      messages: [{role:"system", content: KC_CHAT_SYSTEM_PROMPT}, {role:"user", content:…}],
 *      stream: true, temperature: 0.3 }). Yields token deltas via async generator.
 *
 *   4. RESULT: returns { fullContent: string; coldStart: boolean } after all tokens emitted.
 *
 * ISOLATION: imports ONLY from its declared dependency surface.
 *   - assembler.ts (assembleBundle, AssemblerInput, ProfileRow)
 *   - compiled.ts (KC_CHAT_SYSTEM_PROMPT)
 *   - qwen/client.ts (getQwenClient, QWEN_REASONING_MODEL)
 *
 * Qwen-only constraint (THREAD-03 / STATE Hard Constraints). No engine scoring core.
 */

import { assembleBundle } from "@/lib/kc/assembler";
import type { AssemblerInput } from "@/lib/kc/assembler";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import { getQwenClient, QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_TRIGGERS,
  type Archetype,
} from "@/lib/engine/wave3/persona-registry";
import {
  gatherReferencesViaTool,
  buildReferenceBlock,
} from "@/lib/grounding/corpus-tool";

// ─── Generation call timeout ───────────────────────────────────────────────────

/** Chat generation timeout — matches ideas/hooks runners (300s). */
const GENERATE_TIMEOUT_MS = 300_000;

/**
 * Reference-mode PULL flag (default OFF). When on, OPEN chat runs a pre-flight tool loop that lets the
 * model search the corpus on demand (corpus-tool.ts) and grounds the streamed answer on what it pulls.
 * Gate-free (reference mode: real evidence, no baseline claim). INDEPENDENT of the GENERATE-path
 * grounding flags. Persona/meet-mode chat is intentionally excluded — a viewer reacts in-voice, it does
 * not consult a strategy corpus.
 */
function isCorpusChatToolEnabled(): boolean {
  return process.env.GROUNDING_CHAT_TOOL === "true";
}

/** Platforms whose teardowns live in the corpus and can be retrieved. */
const REFERENCEABLE_PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ChatPipelineInput {
  /** Creator's chat message (the question or statement). */
  ask: string;
  /** Target platform — used by assembleBundle for MODE_ROLES.chat grounding. */
  platform: AssemblerInput["platform"];
  /** Creator profile (null = cold-start / thin; graceful degrade to baselines, D-08). */
  profileRow: ProfileRow | null;
  /**
   * Prior conversation turns serialized for the assembleBundle `anchor` field.
   * The assembler fences this in <<<USER_CONTENT>>> — injection-safe (D-07).
   */
  priorTurns?: Array<{ role: "user" | "assistant"; text: string }>;
  /**
   * Active audience for this run (08-04 — steer closure, AUD-STEER; mirrors 07-04 ideas-runner).
   * null or is_general → profile-only grounding (byte-identical no-op for General). Chat runs
   * no Flash, so the steer is the audience-grounding line folded into assembleBundle.overrides.
   */
  audience?: Audience | null;
  /**
   * Persona-grounding for the "Ask them why →" chat-with-persona drawer (P9 / LIVE-03, D-03).
   *
   * ADDITIVE + OPTIONAL — when ABSENT the assembled bundle + system prompt are BYTE-IDENTICAL
   * to the pre-change open-chat path (Test 1). When PRESENT the runner:
   *   - PREPENDS the persona system prompt (READ from `ARCHETYPE_DEFINITIONS[archetype]` +
   *     `ARCHETYPE_TRIGGERS` — the registry is NEVER mutated; landmine 4 / Pitfall 5) so Qwen
   *     answers IN-VOICE as that archetype reacting to THIS concept;
   *   - routes `conceptText` + the persona's own `reactionToConcept.quote` through the existing
   *     `<<<USER_CONTENT>>>` fence (via assembleBundle.overrides) — NEVER raw into the system
   *     prompt (Security Domain — injection-safe).
   */
  personaGrounding?: {
    archetype: Archetype;
    /**
     * Present = post-reaction chat ("Ask them why →"). ABSENT = MEET-MODE (the idle
     * "Meet your room" introduction): no concept exists yet, so the persona speaks to its
     * own tastes (registry triggers) instead of a reaction — no reaction anchor is fenced.
     */
    reactionToConcept?: { verdict: "stop" | "scroll"; quote: string };
    /** Required alongside reactionToConcept; absent in meet-mode. */
    conceptText?: string;
    /**
     * The persona's real DISPLAY NAME (The Room, Task A) — e.g. "Dev". Presentation-derived
     * (creator label or the stable archetype default), routed into the persona system prefix so
     * the viewer answers AS that named person. Optional: absent → the byte-identical
     * archetype-only prompt (Test 1 no-op preserved for legacy callers).
     */
    personaName?: string;
  };
}

// ─── Result type ─────────────────────────────────────────────────────────────

export interface ChatPipelineResult {
  /** Full accumulated markdown response text for persistence. */
  fullContent: string;
  /** True when the profile is thin/null — the route emits this as a structured meta frame (D-08). */
  coldStart: boolean;
}

/** Injectable pipeline deps (tests swap these; prod uses the real modules). */
export interface ChatPipelineDeps {
  /** The reference-mode corpus pull. Tests inject a stub; prod uses the real gatherReferencesViaTool. */
  gatherReferences?: typeof gatherReferencesViaTool;
}

// ─── isColdStart ──────────────────────────────────────────────────────────────

/**
 * Determine whether a profile row is thin / absent — the cold-start predicate.
 *
 * MIRRORS assembler.ts `isProfileThin` EXACTLY (not a divergent definition — D-08):
 *   null row → thin; row with all null/empty fields → thin.
 * Exported so the chat route can emit the structured `coldStart` meta frame independently
 * of the runner result (before the stream starts — D-08 nudge signal).
 *
 * Do NOT modify this predicate independently of assembler.ts:isProfileThin.
 * If the assembler's thin-profile rule changes, update both in lockstep.
 */
export function isColdStart(profileRow: ProfileRow | null): boolean {
  if (profileRow === null) return true;
  const hasNiche = Boolean(profileRow.niche_primary);
  const hasAudience = Boolean(profileRow.target_audience);
  const hasGoals = Boolean(profileRow.primary_goal);
  const hasWins = Boolean(profileRow.past_wins?.length);
  const hasFlops = Boolean(profileRow.past_flops?.length);
  const hasPlatform = Boolean(profileRow.target_platforms?.length);
  return !hasNiche && !hasAudience && !hasGoals && !hasWins && !hasFlops && !hasPlatform;
}

// ─── Anchor serializer ────────────────────────────────────────────────────────

/**
 * Serialize prior conversation turns into a plain-text anchor string for assembleBundle.
 * Format mirrors the thread's natural reading order (oldest first, role: text pairs).
 * assembleBundle fences this in <<<USER_CONTENT>>> (injection-safe — D-07).
 */
function serializePriorTurns(
  turns: Array<{ role: "user" | "assistant"; text: string }>,
): string {
  return turns
    .map((t) => `${t.role === "user" ? "Creator" : "Numen"}: ${t.text}`)
    .join("\n");
}

// ─── Persona grounding (P9 / LIVE-03) ─────────────────────────────────────────

/** Server-side cap on the per-request concept/quote anchor (WARNING-5 — mirrors the route ask-cap). */
const PERSONA_ANCHOR_CAP = 2000;

/**
 * Build the persona system-prompt PREFIX from the registry — READ ONLY.
 *
 * Pulls `ARCHETYPE_DEFINITIONS[archetype]` (the byte-stable persona definition) and the
 * archetype's stop/scroll triggers from `ARCHETYPE_TRIGGERS` to instruct Qwen to answer
 * in-voice. This is REGISTRY-DERIVED, non-user text — safe to place in the system prompt.
 * The registry objects are never mutated (Pitfall 5 / landmine 4); we only read fields.
 */
function buildPersonaSystemPrefix(
  archetype: Archetype,
  verdict: "stop" | "scroll" | null,
  personaName?: string,
): string {
  const definition = ARCHETYPE_DEFINITIONS[archetype];
  const triggers = ARCHETYPE_TRIGGERS[archetype];
  const stop = triggers.stop.join("; ");
  const scrollPast = triggers.scroll_past.join("; ");
  // Named-people reframe (The Room, Task A): when the caller supplies a real name the viewer
  // answers AS that person (first line + a "your name is" anchor); the archetype still drives
  // the behaviour. `name` is a short presentation string (server-capped) — safe, non-user-authored
  // in practice (derived from the registry default or the creator's own label).
  const name = personaName?.trim();
  const opener = name
    ? `You are ${name}, a single real viewer, answering in first person, in-voice as yourself.`
    : `You are a single viewer of this archetype, answering in first person, in-voice.`;
  return [
    opener,
    name ? `Your name is ${name}. If asked who you are, answer as ${name}.` : ``,
    `Archetype: ${archetype}.`,
    definition,
    `What makes you stop: ${stop}.`,
    `What makes you scroll past: ${scrollPast}.`,
    verdict
      ? `On the concept below you ${verdict === "stop" ? "STOPPED" : "SCROLLED past"}.`
      : `The creator hasn't shown you a concept yet — they're meeting you. Speak from your own taste: what makes you stop, what makes you scroll past, what you're tired of seeing.`,
    verdict
      ? `Answer the creator's question as THIS viewer about THIS concept — honest, specific,`
      : `Answer the creator's question as THIS viewer — honest, specific,`,
    `first-person. Do not break character or describe yourself as an AI.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Serialize the persona's reaction-to-concept into a single anchor string. This text is
 * routed through assembleBundle's `<<<USER_CONTENT>>>` fence (Security Domain) — it is
 * NEVER concatenated raw into the system prompt. Length-capped server-side (WARNING-5).
 */
function serializePersonaReaction(g: {
  reactionToConcept: { verdict: "stop" | "scroll"; quote: string };
  conceptText: string;
}): string {
  const concept = g.conceptText.slice(0, PERSONA_ANCHOR_CAP);
  const quote = g.reactionToConcept.quote.slice(0, PERSONA_ANCHOR_CAP);
  return [
    `The concept you reacted to:`,
    concept,
    ``,
    `Your verbatim reaction was: "${quote}"`,
  ].join("\n");
}

// ─── runChatPipeline ─────────────────────────────────────────────────────────

/**
 * Stream a profile-grounded Qwen markdown answer for the open chat thread.
 *
 * USAGE (async generator pattern):
 *   const gen = runChatPipeline(input, onToken);
 *   const result = await gen;  // { fullContent, coldStart }
 *
 * The route consumes this via the callback: for each token delta, `onToken(delta)` is called
 * immediately (SSE send). After all tokens, returns { fullContent, coldStart }.
 *
 * @param input     Chat pipeline input (ask, platform, profileRow, priorTurns).
 * @param onToken   Callback invoked per token delta (string). Route pushes these to the SSE stream.
 * @returns         { fullContent: string; coldStart: boolean }
 */
export async function runChatPipeline(
  input: ChatPipelineInput,
  onToken: (delta: string) => void,
  deps: ChatPipelineDeps = {},
): Promise<ChatPipelineResult> {
  const {
    ask,
    platform,
    profileRow,
    priorTurns = [],
    audience = null,
    personaGrounding,
  } = input;

  // ── COLD-START SIGNAL (D-08) ──────────────────────────────────────────────
  const coldStart = isColdStart(profileRow);

  // ── STEER (08-04 / AUD-STEER): audience-grounding line replaces buildGroundingLine ──
  // Chat runs no Flash; the only steer vector is the assembled bundle. For a calibrated
  // audience the audience-facing line is folded into assembleBundle.overrides so the answer
  // is grounded on the active audience. General/null → undefined override (byte-identical).
  const isCalibrated = Boolean(audience && !audience.is_general);
  const { line: groundingLine } = buildAudienceGroundingLine(audience, platform, profileRow);
  const audienceOverride = isCalibrated ? `Answer for this audience — ${groundingLine}` : undefined;

  // ── PERSONA GROUNDING (P9 / LIVE-03, D-03): in-voice answer about THIS concept ──
  // The persona DEFINITION (registry-derived, non-user) becomes the system-prompt prefix.
  // The concept + the persona's reaction quote (user-influenced) ride the FENCED overrides —
  // never raw into the system prompt (Security Domain). When absent → byte-identical no-op.
  const personaSystemPrefix = personaGrounding
    ? buildPersonaSystemPrefix(
        personaGrounding.archetype,
        personaGrounding.reactionToConcept?.verdict ?? null,
        personaGrounding.personaName,
      )
    : undefined;
  // Meet-mode has no reaction → no fenced reaction anchor (the prefix alone carries the voice).
  const personaReactionAnchor = personaGrounding?.reactionToConcept
    ? serializePersonaReaction({
        reactionToConcept: personaGrounding.reactionToConcept,
        conceptText: personaGrounding.conceptText ?? "",
      })
    : undefined;

  // Compose the fenced override: audience steer and/or persona reaction (both ride the fence).
  const composedOverride =
    [audienceOverride, personaReactionAnchor].filter(Boolean).join("\n\n") || undefined;

  // Weights resolved to mirror the shipped 07-04 shape (DEFAULT for General — no override).
  const resolvedWeights = resolveAudienceWeights(audience ? [audience] : []);
  void resolvedWeights; // wired for future Max-path integration; chat has no Flash scoring path

  // ── ASSEMBLE: per-request live-tier grounding bundle (D-07) ──────────────
  // Serialise prior turns into the assembleBundle `anchor` field (chat running context).
  // assembleBundle fences the anchor in <<<USER_CONTENT>>> — injection-safe.
  const anchorText = priorTurns.length > 0 ? serializePriorTurns(priorTurns) : undefined;

  const userMessage = assembleBundle(
    {
      ask,
      platform,
      mode: "chat",
      ...(anchorText ? { anchor: anchorText } : {}),
      ...(composedOverride ? { overrides: composedOverride } : {}),
    },
    profileRow,
  );

  // System prompt: byte-identical KC_CHAT_SYSTEM_PROMPT for open chat; persona-grounded
  // chat PREPENDS the registry-derived persona prefix so Qwen answers in-voice (D-03).
  const baseSystem = personaSystemPrefix
    ? `${personaSystemPrefix}\n\n${KC_CHAT_SYSTEM_PROMPT}`
    : KC_CHAT_SYSTEM_PROMPT;

  // ── PULL (reference mode, flag-gated, degrade-safe): OPEN chat only ──────────
  // Let the model search the corpus on demand (pre-flight tool loop) and ground the streamed answer on
  // what it pulls. Excluded for persona/meet-mode (a viewer reacts in-voice, it does not consult a
  // strategy corpus). Any failure OR zero rows → the block stays undefined → the streamed call is
  // BYTE-IDENTICAL to today's chat (no-op guarantee). Costs one pre-flight call before the stream starts.
  let corpusReferenceBlock: string | undefined;
  if (
    !personaGrounding &&
    isCorpusChatToolEnabled() &&
    ask.trim().length > 0 &&
    REFERENCEABLE_PLATFORMS.has(platform)
  ) {
    const gather = deps.gatherReferences ?? gatherReferencesViaTool;
    try {
      const { references } = await gather({ ask, platform });
      if (references.length > 0) corpusReferenceBlock = buildReferenceBlock(references);
    } catch (err) {
      console.warn(
        `[grounding] chat corpus pull degraded (streaming ungrounded): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const systemContent = corpusReferenceBlock
    ? `${baseSystem}\n\n${corpusReferenceBlock}`
    : baseSystem;

  // ── STREAM: Qwen generation (D-07 temperature 0.3 — matches grounded chat route) ──
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let fullContent = "";
  try {
    const ai = getQwenClient();
    const chatParams = {
      model: QWEN_REASONING_MODEL,
      messages: [
        { role: "system" as const, content: systemContent },
        { role: "user" as const, content: userMessage },
      ],
      stream: true as const,
      temperature: 0.3,
      max_tokens: 2000, // safety ceiling: bound runaway streamed answer
    };
    (chatParams as Record<string, unknown>).enable_thinking = false; // DashScope extension: thinking-off
    const stream = await ai.chat.completions.create(
      chatParams,
      { signal: controller.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        fullContent += delta;
        onToken(delta);
      }
    }
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(
      error.name === "AbortError"
        ? `runChatPipeline: aborted (timeout ${GENERATE_TIMEOUT_MS}ms)`
        : `runChatPipeline: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  return { fullContent, coldStart };
}
